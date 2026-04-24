import DOMPurify from 'dompurify';

/**
 * Sanitize HTML từ Rich Text Editor để hiển thị trên website.
 * Giữ lại đầy đủ các thẻ và thuộc tính cần thiết cho bảng (table) và style inline,
 * đảm bảo nội dung hiển thị y hệt như trong trình soạn thảo.
 */
export function sanitizeRichHtml(html: string | null | undefined): string {
  if (!html) return '';
  return DOMPurify.sanitize(html, {
    ADD_TAGS: ['table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col'],
    ADD_ATTR: [
      'colspan', 'rowspan', 'align', 'valign', 'style',
      'width', 'height', 'bgcolor', 'cellspacing', 'cellpadding', 'border',
      'target', 'rel', 'class',
    ],
  });
}
