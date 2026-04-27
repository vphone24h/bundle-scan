import DOMPurify from 'dompurify';

/**
 * Sanitize HTML từ Rich Text Editor để hiển thị trên website.
 * Giữ lại đầy đủ các thẻ và thuộc tính cần thiết cho bảng (table) và style inline,
 * đảm bảo nội dung hiển thị y hệt như trong trình soạn thảo.
 */
export function sanitizeRichHtml(html: string | null | undefined): string {
  if (!html) return '';
  const clean = DOMPurify.sanitize(html, {
    ADD_TAGS: ['table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col'],
    ADD_ATTR: [
      'colspan', 'rowspan', 'align', 'valign', 'style',
      'width', 'height', 'bgcolor', 'cellspacing', 'cellpadding', 'border',
      'target', 'rel', 'class',
    ],
  });
  return mergeImageOnlyBlocks(clean);
}

/**
 * Tự động gộp các block (P/DIV) liên tiếp mà chỉ chứa ảnh thành 1 hàng flex
 * để hiển thị nhiều ảnh trên cùng 1 dòng (giống behavior trong editor).
 */
function mergeImageOnlyBlocks(html: string): string {
  if (typeof window === 'undefined' || !html) return html;
  try {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;

    const isImageOnly = (el: Element): boolean => {
      if (!(el instanceof HTMLElement)) return false;
      if (!/^(P|DIV)$/.test(el.tagName)) return false;
      // Bỏ qua nếu đã là rte-image-row (đã gộp)
      if (el.classList.contains('rte-image-row')) return false;
      const imgs = el.querySelectorAll('img');
      if (imgs.length === 0) return false;
      const text = (el.textContent || '').replace(/\u200B/g, '').trim();
      return text.length === 0;
    };

    const styleImg = (img: HTMLImageElement) => {
      img.style.flex = '1 1 0';
      img.style.minWidth = '0';
      img.style.maxWidth = '100%';
      img.style.height = 'auto';
      if (!img.style.borderRadius) img.style.borderRadius = '8px';
      if (!img.style.objectFit) img.style.objectFit = 'cover';
      img.style.cursor = 'pointer';
      img.style.margin = '0';
    };

    // Cũng chuẩn hóa các .rte-image-row đã có sẵn
    wrapper.querySelectorAll('.rte-image-row img').forEach((img) => styleImg(img as HTMLImageElement));

    // Quét và gộp các block ảnh-đơn liên tiếp
    const children = Array.from(wrapper.children);
    let i = 0;
    while (i < children.length) {
      const el = children[i];
      if (isImageOnly(el)) {
        const group: Element[] = [el];
        let j = i + 1;
        while (j < children.length && isImageOnly(children[j])) {
          group.push(children[j]);
          j++;
        }
        if (group.length >= 2) {
          const row = document.createElement('div');
          row.className = 'rte-image-row';
          row.setAttribute(
            'style',
            'display:flex;flex-wrap:wrap;gap:6px;margin:8px 0;align-items:flex-start;'
          );
          group.forEach((g) => {
            g.querySelectorAll('img').forEach((img) => {
              styleImg(img as HTMLImageElement);
              row.appendChild(img);
            });
          });
          group[0].replaceWith(row);
          for (let k = 1; k < group.length; k++) group[k].remove();
        }
        i = j;
      } else {
        i++;
      }
    }

    return wrapper.innerHTML;
  } catch {
    return html;
  }
}
