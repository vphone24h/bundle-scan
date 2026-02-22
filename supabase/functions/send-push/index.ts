import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Web Push helpers using Web Crypto API (no npm dependencies)
async function generatePushHeaders(endpoint: string, vapidPublicKey: string, vapidPrivateKey: string, subject: string) {
  const urlObj = new URL(endpoint);
  const audience = `${urlObj.protocol}//${urlObj.host}`;
  
  const now = Math.floor(Date.now() / 1000);
  const jwtHeader = { typ: 'JWT', alg: 'ES256' };
  const jwtPayload = {
    aud: audience,
    exp: now + 12 * 3600,
    sub: subject,
  };

  const headerB64 = base64urlEncode(new TextEncoder().encode(JSON.stringify(jwtHeader)));
  const payloadB64 = base64urlEncode(new TextEncoder().encode(JSON.stringify(jwtPayload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  // Import private key
  const privateKeyBytes = base64urlDecode(vapidPrivateKey);
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    convertRawPrivateKeyToPKCS8(privateKeyBytes, base64urlDecode(vapidPublicKey)),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );

  const signatureB64 = base64urlEncode(new Uint8Array(convertDERToRaw(new Uint8Array(signature))));
  const jwt = `${unsignedToken}.${signatureB64}`;

  return {
    Authorization: `vapid t=${jwt}, k=${vapidPublicKey}`,
    'Content-Type': 'application/octet-stream',
    TTL: '86400',
  };
}

function base64urlEncode(data: Uint8Array): string {
  let str = '';
  for (const byte of data) str += String.fromCharCode(byte);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(str: string): Uint8Array {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// Convert raw 32-byte private key + 65-byte public key to PKCS8 DER format
function convertRawPrivateKeyToPKCS8(rawPrivate: Uint8Array, rawPublic: Uint8Array): ArrayBuffer {
  // Build the ECPrivateKey structure
  const ecPrivateKey = new Uint8Array([
    0x30, 0x77, // SEQUENCE
    0x02, 0x01, 0x01, // INTEGER version = 1
    0x04, 0x20, // OCTET STRING (32 bytes)
    ...rawPrivate,
    0xa0, 0x0a, // [0] OID
    0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, // P-256 OID
    0xa1, 0x44, // [1] BIT STRING
    0x03, 0x42, 0x00, // BIT STRING header
    ...rawPublic,
  ]);

  // Wrap in PKCS8 PrivateKeyInfo
  const pkcs8 = new Uint8Array([
    0x30, 0x81, 0x87, // SEQUENCE
    0x02, 0x01, 0x00, // INTEGER version = 0
    0x30, 0x13, // SEQUENCE (AlgorithmIdentifier)
    0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01, // EC OID
    0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, // P-256 OID
    0x04, 0x6d, // OCTET STRING wrapping ECPrivateKey
    0x30, 0x6b, // SEQUENCE (ECPrivateKey without curve OID)
    0x02, 0x01, 0x01, // INTEGER version = 1
    0x04, 0x20, // OCTET STRING (32 bytes private key)
    ...rawPrivate,
    0xa1, 0x44, // [1] public key
    0x03, 0x42, 0x00,
    ...rawPublic,
  ]);

  return pkcs8.buffer;
}

// Convert DER ECDSA signature to raw r||s format
function convertDERToRaw(der: Uint8Array): Uint8Array {
  // DER: 0x30 <len> 0x02 <rlen> <r> 0x02 <slen> <s>
  let offset = 2; // skip SEQUENCE header
  
  // Read r
  offset++; // skip 0x02
  const rLen = der[offset++];
  let r = der.slice(offset, offset + rLen);
  offset += rLen;
  
  // Read s
  offset++; // skip 0x02
  const sLen = der[offset++];
  let s = der.slice(offset, offset + sLen);
  
  // Trim leading zeros and pad to 32 bytes
  if (r.length > 32) r = r.slice(r.length - 32);
  if (s.length > 32) s = s.slice(s.length - 32);
  
  const raw = new Uint8Array(64);
  raw.set(r, 32 - r.length);
  raw.set(s, 64 - s.length);
  return raw;
}

// Encrypt push payload using RFC 8291 (simplified - using aes128gcm)
async function encryptPayload(
  payload: string,
  p256dhKey: string,
  authSecret: string
): Promise<{ encrypted: Uint8Array; salt: Uint8Array; localPublicKey: Uint8Array }> {
  const subscriberPublicKey = base64urlDecode(p256dhKey);
  const subscriberAuth = base64urlDecode(authSecret);

  // Generate local ECDH key pair
  const localKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  );

  const localPublicKeyRaw = new Uint8Array(
    await crypto.subtle.exportKey('raw', localKeyPair.publicKey)
  );

  // Import subscriber public key
  const subscriberKey = await crypto.subtle.importKey(
    'raw',
    subscriberPublicKey,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );

  // ECDH shared secret
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'ECDH', public: subscriberKey },
      localKeyPair.privateKey,
      256
    )
  );

  // Generate salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // HKDF-based key derivation (simplified for aes128gcm)
  const authInfo = new TextEncoder().encode('Content-Encoding: auth\0');
  const ikmKey = await crypto.subtle.importKey('raw', sharedSecret, { name: 'HKDF' }, false, ['deriveBits']);
  
  // PRK = HKDF-Extract(auth_secret, shared_secret)
  const prkKey = await crypto.subtle.importKey('raw', subscriberAuth, { name: 'HKDF' }, false, ['deriveBits']);
  
  // Simplified: use HKDF to derive the content encryption key
  const keyInfo = concatBuffers(
    new TextEncoder().encode('Content-Encoding: aes128gcm\0'),
    new Uint8Array([0]),
    subscriberPublicKey,
    localPublicKeyRaw
  );

  const ikm = await crypto.subtle.importKey('raw', sharedSecret, { name: 'HKDF' }, false, ['deriveBits']);
  
  // Use a simpler approach: derive key material
  const keyMaterial = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: subscriberAuth, info: authInfo },
    ikm,
    256
  );
  
  const prk = await crypto.subtle.importKey('raw', new Uint8Array(keyMaterial), { name: 'HKDF' }, false, ['deriveBits']);
  
  const cekInfo = concatBuffers(
    new TextEncoder().encode('Content-Encoding: aes128gcm\0'),
    subscriberPublicKey,
    localPublicKeyRaw
  );
  
  const cekBits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: salt, info: cekInfo },
    prk,
    128
  );
  
  const nonceInfo = concatBuffers(
    new TextEncoder().encode('Content-Encoding: nonce\0'),
    subscriberPublicKey,
    localPublicKeyRaw
  );
  
  const nonceBits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: salt, info: nonceInfo },
    prk,
    96
  );

  // Encrypt with AES-128-GCM
  const cek = await crypto.subtle.importKey('raw', new Uint8Array(cekBits), { name: 'AES-GCM' }, false, ['encrypt']);
  
  // Pad the payload with a delimiter
  const paddedPayload = concatBuffers(new TextEncoder().encode(payload), new Uint8Array([2]));
  
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: new Uint8Array(nonceBits), tagLength: 128 },
      cek,
      paddedPayload
    )
  );

  // Build aes128gcm header: salt(16) + rs(4) + idlen(1) + keyid(65) + ciphertext
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096);
  
  const encrypted = concatBuffers(
    salt,
    rs,
    new Uint8Array([localPublicKeyRaw.length]),
    localPublicKeyRaw,
    ciphertext
  );

  return { encrypted, salt, localPublicKey: localPublicKeyRaw };
}

function concatBuffers(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((acc, arr) => acc + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { notification_id, title, message, url } = await req.json();

    // Get VAPID keys
    const { data: vapidKeys } = await supabase
      .from('push_vapid_keys')
      .select('*')
      .limit(1)
      .single();

    if (!vapidKeys) {
      return new Response(JSON.stringify({ error: 'VAPID keys not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get all push subscriptions
    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('*');

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ message: 'No subscriptions', sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload = JSON.stringify({
      title: title || 'Thông báo mới',
      body: message || '',
      url: url || '/',
      notification_id: notification_id || null,
    });

    let sent = 0;
    let failed = 0;
    const staleEndpoints: string[] = [];

    for (const sub of subscriptions) {
      try {
        const encrypted = await encryptPayload(payload, sub.p256dh, sub.auth_key);
        
        const headers = await generatePushHeaders(
          sub.endpoint,
          vapidKeys.public_key,
          vapidKeys.private_key,
          'mailto:admin@vkho.vn'
        );

        const response = await fetch(sub.endpoint, {
          method: 'POST',
          headers: {
            ...headers,
            'Content-Encoding': 'aes128gcm',
          },
          body: encrypted.encrypted,
        });

        if (response.status === 201 || response.status === 200) {
          sent++;
        } else if (response.status === 410 || response.status === 404) {
          // Subscription expired, mark for cleanup
          staleEndpoints.push(sub.endpoint);
          failed++;
        } else {
          console.error(`Push failed for ${sub.endpoint}: ${response.status} ${await response.text()}`);
          failed++;
        }
      } catch (err) {
        console.error(`Push error for ${sub.endpoint}:`, err);
        failed++;
      }
    }

    // Cleanup stale subscriptions
    if (staleEndpoints.length > 0) {
      await supabase
        .from('push_subscriptions')
        .delete()
        .in('endpoint', staleEndpoints);
    }

    return new Response(JSON.stringify({ sent, failed, total: subscriptions.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Send push error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
