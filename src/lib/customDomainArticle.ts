const OLD_PHONE_REGEX = /0(?:\s|&nbsp;|\.|-)*396(?:\s|&nbsp;|\.|-)*793(?:\s|&nbsp;|\.|-)*883/gi;

export function sanitizeCustomDomainArticle(article: string): string {
  return article
    .replace(OLD_PHONE_REGEX, '')
    .replace(/📞\s*(?=<\/p>)/gi, '');
}