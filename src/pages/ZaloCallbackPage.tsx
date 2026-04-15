import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Handles Zalo OAuth callback redirect.
 * Zalo redirects here with ?code=...&oa_id=...&state=...
 * This page posts the data back to the opener window and closes itself,
 * mirroring the edge function's GET handler behavior.
 */
export default function ZaloCallbackPage() {
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const code = searchParams.get('code') || '';
    const oaId = searchParams.get('oa_id') || '';
    const state = searchParams.get('state') || '';

    if (window.opener) {
      window.opener.postMessage({
        type: 'zalo-oauth-callback',
        code,
        oa_id: oaId,
        state,
      }, '*');
      setTimeout(() => window.close(), 1500);
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-muted-foreground">Đang kết nối Zalo OA...</p>
    </div>
  );
}
