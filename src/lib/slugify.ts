/**
 * Convert Vietnamese text to URL-safe slug
 * Example: "iPhone XS Max 512GB Đen (Space Gray)" → "iphone-xs-max-512gb-den-space-gray"
 */
const VIETNAMESE_MAP: Record<string, string> = {
  'à': 'a', 'á': 'a', 'ả': 'a', 'ã': 'a', 'ạ': 'a',
  'ă': 'a', 'ắ': 'a', 'ằ': 'a', 'ẳ': 'a', 'ẵ': 'a', 'ặ': 'a',
  'â': 'a', 'ấ': 'a', 'ầ': 'a', 'ẩ': 'a', 'ẫ': 'a', 'ậ': 'a',
  'đ': 'd',
  'è': 'e', 'é': 'e', 'ẻ': 'e', 'ẽ': 'e', 'ẹ': 'e',
  'ê': 'e', 'ế': 'e', 'ề': 'e', 'ể': 'e', 'ễ': 'e', 'ệ': 'e',
  'ì': 'i', 'í': 'i', 'ỉ': 'i', 'ĩ': 'i', 'ị': 'i',
  'ò': 'o', 'ó': 'o', 'ỏ': 'o', 'õ': 'o', 'ọ': 'o',
  'ô': 'o', 'ố': 'o', 'ồ': 'o', 'ổ': 'o', 'ỗ': 'o', 'ộ': 'o',
  'ơ': 'o', 'ớ': 'o', 'ờ': 'o', 'ở': 'o', 'ỡ': 'o', 'ợ': 'o',
  'ù': 'u', 'ú': 'u', 'ủ': 'u', 'ũ': 'u', 'ụ': 'u',
  'ư': 'u', 'ứ': 'u', 'ừ': 'u', 'ử': 'u', 'ữ': 'u', 'ự': 'u',
  'ỳ': 'y', 'ý': 'y', 'ỷ': 'y', 'ỹ': 'y', 'ỵ': 'y',
};

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .split('')
    .map(c => VIETNAMESE_MAP[c] || c)
    .join('')
    .replace(/[^a-z0-9\s-]/g, '') // remove non-alphanumeric
    .replace(/\s+/g, '-')          // spaces to hyphens
    .replace(/-+/g, '-')           // collapse multiple hyphens
    .replace(/^-|-$/g, '');        // trim hyphens
}

/**
 * Build a product URL path with category hierarchy
 * Format: /category-slug/subcategory-slug/product-slug
 * Appends short ID for reliable lookup
 */
export function buildProductPath(
  productName: string,
  productId: string,
  categoryName?: string | null,
  parentCategoryName?: string | null,
): string {
  const shortId = productId.slice(0, 8);
  const productSlug = slugify(productName);
  const parts: string[] = [];

  if (parentCategoryName) {
    parts.push(slugify(parentCategoryName));
  }
  if (categoryName) {
    parts.push(slugify(categoryName));
  }
  parts.push(`${productSlug}-${shortId}`);

  return '/' + parts.join('/');
}

/**
 * Extract product short ID from a slug path
 * The short ID is the last 8 chars after the final hyphen in the last segment
 */
export function extractProductIdFromPath(path: string): string | null {
  // Strip known page prefixes
  const cleaned = path.replace(/^\/(san-pham|tin-tuc)\/?/, '/');
  const segments = cleaned.replace(/^\//, '').split('/');
  const lastSegment = segments[segments.length - 1];
  if (!lastSegment) return null;
  
  // The short ID is appended: product-slug-SHORTID
  const match = lastSegment.match(/-([a-f0-9]{8})$/);
  return match ? match[1] : null;
}

/**
 * Map page view names to URL path segments
 */
const PAGE_PATH_MAP: Record<string, string> = {
  products: 'san-pham',
  news: 'tin-tuc',
  warranty: 'bao-hanh',
  'article-detail': 'tin-tuc',
  repair: 'sua-chua',
  tradein: 'thu-cu',
  installment: 'tra-gop',
  accessories: 'phu-kien',
  compare: 'so-sanh',
  pricelist: 'bang-gia',
  booking: 'dat-lich',
  branches: 'chi-nhanh',
  contact: 'lien-he',
  services: 'dich-vu',
  rooms: 'phong',
  courses: 'khoa-hoc',
  doctors: 'bac-si',
  collection: 'bo-suu-tap',
  promotion: 'khuyen-mai',
  reviews: 'danh-gia',
  'order-lookup': 'tra-cuu-don-hang',
};

const PATH_TO_PAGE_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(PAGE_PATH_MAP).map(([k, v]) => [v, k])
);

/**
 * Build a path-based URL for a page view
 */
export function buildPagePath(pageView: string): string {
  const segment = PAGE_PATH_MAP[pageView];
  return segment ? `/${segment}` : '/';
}

/**
 * Build a full product detail URL under /san-pham/
 */
export function buildProductDetailPath(
  productName: string,
  productId: string,
  categoryName?: string | null,
  parentCategoryName?: string | null,
): string {
  const shortId = productId.slice(0, 8);
  const productSlug = slugify(productName);
  const parts: string[] = ['san-pham'];

  if (parentCategoryName) {
    parts.push(slugify(parentCategoryName));
  }
  if (categoryName) {
    parts.push(slugify(categoryName));
  }
  parts.push(`${productSlug}-${shortId}`);

  return '/' + parts.join('/');
}

/**
 * Build a full article detail URL under /tin-tuc/
 */
export function buildArticlePath(
  articleTitle: string,
  articleId: string,
): string {
  const shortId = articleId.slice(0, 8);
  const articleSlug = slugify(articleTitle);
  return `/tin-tuc/${articleSlug}-${shortId}`;
}

/**
 * Detect page view and content ID from pathname
 * Returns { pageView, contentId } or null if path is root
 */
export function detectPageFromPath(path: string): { pageView: string; contentId: string | null } | null {
  const segments = path.replace(/^\//, '').split('/').filter(Boolean);
  if (segments.length === 0) return null;
  
  const firstSegment = segments[0];
  
  // Handle /product/FULL-UUID format (from CTV share links)
  if (firstSegment === 'product' && segments.length > 1) {
    const fullId = segments[1];
    // Full UUID or starts with 8-char hex
    const shortId = fullId.length >= 8 ? fullId.slice(0, 8) : null;
    return { pageView: 'products', contentId: shortId };
  }
  
  const pageView = PATH_TO_PAGE_MAP[firstSegment];
  if (!pageView) {
    // Could be a legacy product path (category/product-slug-ID)
    return null;
  }
  
  // Check if there's a content ID (product or article detail)
  if (segments.length > 1) {
    const lastSegment = segments[segments.length - 1];
    const match = lastSegment.match(/-([a-f0-9]{8})$/);
    const contentId = match ? match[1] : null;
    return { pageView, contentId };
  }
  
  return { pageView, contentId: null };
}
