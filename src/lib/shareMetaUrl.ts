export type ShareMetaType = 'product' | 'article' | 'store';

interface BuildMetaShareUrlParams {
  tenantId?: string | null;
  type: ShareMetaType;
  id: string;
  redirectUrl: string;
}

export function buildMetaShareUrl({ tenantId, type, id, redirectUrl }: BuildMetaShareUrlParams): string {
  if (!redirectUrl) return redirectUrl;

  const backendUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!backendUrl) return redirectUrl;

  try {
    const metaUrl = new URL(`${backendUrl}/functions/v1/og-meta`);
    metaUrl.searchParams.set('type', type);
    metaUrl.searchParams.set('id', id);
    if (tenantId) {
      metaUrl.searchParams.set('tenant_id', tenantId);
    }
    metaUrl.searchParams.set('url', redirectUrl);
    metaUrl.searchParams.set('v', Date.now().toString());
    return metaUrl.toString();
  } catch {
    return redirectUrl;
  }
}
