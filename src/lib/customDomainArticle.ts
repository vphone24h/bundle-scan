const OLD_PHONE_REGEX = /0(?:\s|&nbsp;|\.|-)*396(?:\s|&nbsp;|\.|-)*793(?:\s|&nbsp;|\.|-)*883/gi;

// Strip the "liên hệ Admin" trailing section from article HTML since the component renders its own contact block
const CONTACT_SECTION_REGEX = /👉\s*Để kích hoạt tính năng[^<]*(?:<[^>]*>)*/gi;

export function sanitizeCustomDomainArticle(article: string): string {
  return article
    .replace(OLD_PHONE_REGEX, '')
    .replace(/📞\s*(?=<\/p>)/gi, '')
    .replace(CONTACT_SECTION_REGEX, '');
}
