/**
 * The published content travels inside the HTML page, in
 *   <script id="younes-content" type="application/json">…</script>
 * so the site has it before its first paint. JSON can't close that tag,
 * open a comment or break a line in a way the HTML parser would act on -
 * once these characters are escaped. Used by the API (production) and the
 * Vite dev server (development).
 */
export const CONTENT_ELEMENT_ID = 'younes-content';

/** the escapes, as their six-character JSON forms */
const ESCAPES: Record<string, string> = {
  '<': '\\u003c',
  '>': '\\u003e',
  '&': '\\u0026',
  [String.fromCharCode(0x2028)]: '\\u2028',
  [String.fromCharCode(0x2029)]: '\\u2029',
};
const UNSAFE = new RegExp(`[<>&${String.fromCharCode(0x2028)}${String.fromCharCode(0x2029)}]`, 'g');

export function serializeForHtml(value: unknown): string {
  return JSON.stringify(value).replace(UNSAFE, (c) => ESCAPES[c]);
}

export function contentScriptTag(value: unknown): string {
  return `<script id="${CONTENT_ELEMENT_ID}" type="application/json">${serializeForHtml(value)}</script>`;
}

/** put the content into a page, just before </head> (once) */
export function injectContent(html: string, value: unknown): string {
  if (html.includes(`id="${CONTENT_ELEMENT_ID}"`)) return html;
  return html.replace('</head>', `${contentScriptTag(value)}\n</head>`);
}
