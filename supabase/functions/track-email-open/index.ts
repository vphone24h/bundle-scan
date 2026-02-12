import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// 1x1 transparent PNG pixel
const PIXEL = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41,
  0x54, 0x78, 0x9c, 0x62, 0x00, 0x00, 0x00, 0x02,
  0x00, 0x01, 0xe2, 0x21, 0xbc, 0x33, 0x00, 0x00,
  0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42,
  0x60, 0x82,
])

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const historyId = url.searchParams.get('id')
  const email = url.searchParams.get('e')

  // Always return the pixel, even on error
  const pixelResponse = () => new Response(PIXEL, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Access-Control-Allow-Origin': '*',
    },
  })

  if (!historyId || !email) {
    return pixelResponse()
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const ip = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown'
    const userAgent = req.headers.get('user-agent') || 'unknown'

    // Upsert - only record first open
    await supabaseAdmin.from('email_opens').upsert(
      {
        email_history_id: historyId,
        recipient_email: email,
        ip_address: ip,
        user_agent: userAgent,
      },
      { onConflict: 'email_history_id,recipient_email', ignoreDuplicates: true }
    )
  } catch (err) {
    console.error('Track email open error:', err)
  }

  return pixelResponse()
})
