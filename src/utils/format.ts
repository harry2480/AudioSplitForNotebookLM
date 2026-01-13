// Lightweight text/markdown to HTML helpers for Google Docs copy/download

const escapeHtml = (str: string): string =>
  str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// Very small subset Markdown renderer: headings, bold/italic, inline code, lists, paragraphs
export const markdownToHtml = (md: string): string => {
  const lines = md.replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];
  let inUl = false;
  let inOl = false;

  const closeLists = () => {
    if (inUl) { out.push('</ul>'); inUl = false; }
    if (inOl) { out.push('</ol>'); inOl = false; }
  };

  const renderInline = (s: string): string => {
    // escape first, then unescape code/format patterns
    let t = escapeHtml(s);
    // code `code`
    t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
    // bold **text** or __text__
    t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    t = t.replace(/__([^_]+)__/g, '<strong>$1</strong>');
    // italic *text* or _text_
    t = t.replace(/\*(?!\*)([^*]+)\*/g, '<em>$1</em>');
    t = t.replace(/_([^_]+)_/g, '<em>$1</em>');
    return t;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      closeLists();
      out.push('<p></p>');
      continue;
    }

    // headings # .. ######
    const hMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (hMatch) {
      closeLists();
      const level = hMatch[1].length;
      out.push(`<h${level}>${renderInline(hMatch[2])}</h${level}>`);
      continue;
    }

    // ordered list 1. text / 2) text
    const olMatch = line.match(/^([0-9]+)[\.)]\s+(.*)$/);
    if (olMatch) {
      if (!inOl) { closeLists(); out.push('<ol>'); inOl = true; }
      out.push(`<li>${renderInline(olMatch[2])}</li>`);
      continue;
    }

    // unordered list - * + text
    const ulMatch = line.match(/^(?:[-*+])\s+(.*)$/);
    if (ulMatch) {
      if (!inUl) { closeLists(); out.push('<ul>'); inUl = true; }
      out.push(`<li>${renderInline(ulMatch[1])}</li>`);
      continue;
    }

    // default paragraph
    closeLists();
    out.push(`<p>${renderInline(line)}</p>`);
  }

  closeLists();
  return out.join('\n');
};

// Convert plain text summary to simple HTML: treat lines starting with bullets as list
export const plainToHtml = (text: string): string => {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];
  let inUl = false;
  let inOl = false;

  const close = () => {
    if (inUl) { out.push('</ul>'); inUl = false; }
    if (inOl) { out.push('</ol>'); inOl = false; }
  };

  const isOl = (line: string) => /^\s*[0-9]+[\.)]\s+/.test(line);
  const isUl = (line: string) => /^\s*(?:[-*+]|・|▼)\s+/.test(line);

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) { close(); out.push('<p></p>'); continue; }
    if (isOl(line)) {
      if (!inOl) { close(); out.push('<ol>'); inOl = true; }
      out.push(`<li>${escapeHtml(line.replace(/^\s*[0-9]+[\.)]\s+/, ''))}</li>`);
      continue;
    }
    if (isUl(line)) {
      if (!inUl) { close(); out.push('<ul>'); inUl = true; }
      out.push(`<li>${escapeHtml(line.replace(/^\s*(?:[-*+]|・|▼)\s+/, ''))}</li>`);
      continue;
    }
    close();
    out.push(`<p>${escapeHtml(line)}</p>`);
  }
  close();
  return out.join('\n');
};

export const buildHtmlDocument = (contentHtml: string, title = 'Summary'): string => {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <style>
    body{font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans', 'Hiragino Kaku Gothic ProN', 'Yu Gothic UI', 'Yu Gothic', 'Meiryo', sans-serif; line-height:1.7; padding:24px;}
    h1,h2,h3,h4{margin:1.2em 0 .6em}
    p{margin:.4em 0}
    ul,ol{margin:.4em 0 .4em 1.2em}
    code{background:#f2f2f2; padding:.1em .3em; border-radius:4px}
  </style></head><body>${contentHtml}</body></html>`;
};

export const copyHtmlToClipboard = async (html: string, plainFallback: string): Promise<void> => {
  try {
    // Prefer rich clipboard with HTML + plain
    if (navigator.clipboard && (window as any).ClipboardItem) {
      const item = new (window as any).ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([plainFallback], { type: 'text/plain' }),
      });
      await navigator.clipboard.write([item]);
      return;
    }
  } catch {
    // fallthrough to plain
  }
  await navigator.clipboard.writeText(plainFallback);
};

