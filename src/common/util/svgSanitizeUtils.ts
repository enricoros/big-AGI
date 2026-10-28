import DOMPurify, { type DOMPurify as DOMPurifyInstance } from 'dompurify';


// SMIL animation can rewrite href/on* attributes at runtime (e.g. <set attributeName="href" to="javascript:...">)
const FORBID_TAGS = ['script', 'foreignObject', 'iframe', 'embed', 'object', 'animate', 'animateMotion', 'animateTransform', 'set', 'discard', 'handler', 'listener'];
const URL_ATTRS = new Set(['href', 'xlink:href', 'src']);
const CSS_URL_REGEX = /url\(\s*(['"]?)\s*([^)'"]*)\1\s*\)/gi;

let _instances: { fragmentOnly: DOMPurifyInstance, withLinks: DOMPurifyInstance } | null = null;


function _isAllowedUrl(value: string, allowExternalLinks: boolean): boolean {
  const v = value.trim();
  if (v.startsWith('#')) return true;
  return allowExternalLinks && /^https?:\/\//i.test(v);
}

function _neutralizeCssUrls(css: string): string {
  return css.replace(CSS_URL_REGEX, (full, _q: string, url: string) => url.trim().startsWith('#') ? full : 'none');
}

function _createInstance(allowExternalLinks: boolean): DOMPurifyInstance {
  const purify = DOMPurify(window);
  purify.addHook('uponSanitizeAttribute', (_node, data) => {
    const name = data.attrName.toLowerCase();
    if (URL_ATTRS.has(name)) {
      if (!_isAllowedUrl(data.attrValue, allowExternalLinks))
        data.keepAttr = false;
    } else if (name === 'style') {
      data.attrValue = _neutralizeCssUrls(data.attrValue);
    }
  });
  purify.addHook('uponSanitizeElement', (node, data) => {
    if (data.tagName === 'style' && node.textContent)
      node.textContent = _neutralizeCssUrls(node.textContent);
  });
  return purify;
}


/**
 * DOM-based sanitizer for untrusted SVG markup (LLM output, remote renderers) before live DOM injection.
 * Uses the DOMPurify SVG profile; drops script, foreignObject, SMIL animation and on* handlers.
 * href/xlink:href/src are kept only for '#fragment' refs, plus http(s) links if allowExternalLinks.
 * CSS url() is kept only for '#fragment' refs (no external fetches).
 * Returns an empty string outside the browser.
 */
export function sanitizeSvgMarkup(svg: string, options?: { allowExternalLinks?: boolean }): string {
  if (typeof window === 'undefined' || !svg) return '';
  if (!_instances)
    _instances = { fragmentOnly: _createInstance(false), withLinks: _createInstance(true) };
  const purify = options?.allowExternalLinks ? _instances.withLinks : _instances.fragmentOnly;
  return purify.sanitize(svg, {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS,
  });
}
