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
  const segments = path.replace(/^\//, '').split('/');
  const lastSegment = segments[segments.length - 1];
  if (!lastSegment) return null;
  
  // The short ID is appended: product-slug-SHORTID
  const match = lastSegment.match(/-([a-f0-9]{8})$/);
  return match ? match[1] : null;
}
