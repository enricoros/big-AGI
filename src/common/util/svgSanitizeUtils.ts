import DOMPurify, { type Config as DOMPurifyConfig } from 'dompurify';


/**
 * DOM-based sanitizer for untrusted SVG markup (LLM output, remote renderers) before live DOM injection.
 * Uses the DOMPurify SVG profile; drops script, foreignObject and on* handlers.
 * href/xlink:href/src are kept only for '#fragment' refs, plus http(s) links if allowExternalLinks (opened in a new tab).
 * <use>, <mpath> and SMIL animations reference '#fragment' only (DOMPurify drops <use>, <animate> and <set> by default);
 * an animation of href/src/on* loses its target. <image> may also embed a raster data: URL.
 * <style> rules are confined to the SVG they come with; CSS url() is kept only for '#fragment' refs (no external fetches).
 * Returns an empty string outside the browser.
 */
export function sanitizeSvgMarkup(svg: string, options?: { allowExternalLinks?: boolean }): string {
  if (typeof window === 'undefined' || !svg) return '';
  _sanitize ??= _createSanitizer();
  return _sanitize(svg, options?.allowExternalLinks === true);
}


/// --- DOMPurify --- ///

type SvgSanitizer = (svg: string, externalLinks: boolean) => string;

let _sanitize: SvgSanitizer | null = null;

const PURIFY_CONFIG: DOMPurifyConfig = {
  USE_PROFILES: { svg: true, svgFilters: true },
  FORBID_TAGS: ['script', 'foreignObject', 'iframe', 'embed', 'object', 'discard', 'handler', 'listener'],
  ADD_TAGS: ['use', 'animate', 'set'],
  ADD_ATTR: ['from', 'to', 'calcMode', 'role'], // SMIL: DOMPurify keeps 'values' but not these, leaving most animations inert
  // the default strips ids named like document properties (id="body", "head", "title"), breaking url(#body) and <use>;
  // it guards against clobbering by named HTML elements (form, img, embed, ...), none of which this profile lets through
  SANITIZE_DOM: false,
};

function _createSanitizer(): SvgSanitizer {
  const purify = DOMPurify(window);
  let call: { externalLinks: boolean, cssScope: CssScope } | null = null; // the call in progress: hooks take no arguments

  purify.addHook('uponSanitizeAttribute', (node, data) => {
    if (!call) return;
    const tagName = node.nodeName.toLowerCase();
    const attrName = data.attrName.toLowerCase();
    if (URL_ATTRS.has(attrName)) {
      if (!_isAllowedUrl(tagName, data.attrValue, call.externalLinks))
        data.keepAttr = false;
    } else if (attrName === 'attributename' && ANIMATION_TAGS.has(tagName)) {
      if (!_isSafeAnimationTarget(data.attrValue))
        data.keepAttr = false; // without a target the animation does nothing
    } else if (attrName === 'style') {
      data.attrValue = _neutralizeCssUrls(data.attrValue);
    }
  });

  purify.addHook('uponSanitizeElement', (node, data) => {
    if (!call) return;
    if (data.tagName === 'style' && node.textContent)
      node.textContent = _neutralizeCssUrls(_scopeCss(node.textContent, call.cssScope));
  });

  purify.addHook('afterSanitizeAttributes', (node) => {
    if (!call) return;
    const tagName = node.nodeName.toLowerCase();
    const isTopLevel = node.parentNode?.nodeName === 'BODY';
    if (isTopLevel)
      node.setAttribute(CSS_SCOPE_ATTR, call.cssScope.id);
    // models often omit it: fine inline, but the markup then fails as a standalone image (PNG export)
    if (isTopLevel && tagName === 'svg' && !node.hasAttribute('xmlns'))
      node.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    // DOMPurify drops 'target': without it a link inside a diagram navigates the app away
    if (tagName === 'a' && _isHttpUrl(node.getAttribute('href') ?? node.getAttribute('xlink:href'))) {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer');
    }
  });

  return (svg, externalLinks) => {
    call = { externalLinks, cssScope: _createCssScope() };
    try {
      return purify.sanitize(svg, PURIFY_CONFIG);
    } finally {
      call = null;
    }
  };
}


/// --- URLs --- ///

const URL_ATTRS = new Set(['href', 'xlink:href', 'src']);
const FRAGMENT_ONLY_TAGS = new Set(['use', 'mpath']); // they point at an element of this document, as animations do
const HTTP_URL_REGEX = /^https?:\/\//i;
const IMAGE_DATA_URL_REGEX = /^data:image\/(png|jpeg|gif|webp);base64,/i; // embedded pictures, e.g. PlantUML icon sprites

function _isAllowedUrl(tagName: string, value: string, externalLinks: boolean): boolean {
  const url = value.trim();
  if (url.startsWith('#')) return true;
  if (FRAGMENT_ONLY_TAGS.has(tagName) || ANIMATION_TAGS.has(tagName)) return false;
  if (tagName === 'image' && IMAGE_DATA_URL_REGEX.test(url)) return true;
  return externalLinks && HTTP_URL_REGEX.test(url);
}

function _isHttpUrl(value: string | null): boolean {
  return !!value && HTTP_URL_REGEX.test(value.trim());
}


/// --- SMIL animation --- ///

// kept because models animate with it, but it can rewrite attributes at runtime
const ANIMATION_TAGS = new Set(['animate', 'animatecolor', 'animatemotion', 'animatetransform', 'set']);

/** An animation may not target a URL or a handler (e.g. <set attributeName="href" to="javascript:...">) */
function _isSafeAnimationTarget(attributeName: string): boolean {
  const name = attributeName.trim().toLowerCase();
  const localName = name.slice(name.lastIndexOf(':') + 1); // any namespace prefix, not only 'xlink:'
  return localName !== 'href' && localName !== 'src' && !localName.startsWith('on');
}


/// --- CSS --- ///

const CSS_URL_REGEX = /url\(\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|([^)'"]*))\s*\)/gi; // double-quoted, single-quoted or bare
const CSS_SCOPE_ATTR = 'data-svg-scope';

interface CssScope {
  id: string;       // value of CSS_SCOPE_ATTR on the top-level elements
  selector: string; // matches those elements
}

let _cssScopeCount = 0;

function _createCssScope(): CssScope {
  const id = 's' + (++_cssScopeCount).toString(36);
  return { id, selector: `[${CSS_SCOPE_ATTR}="${id}"]` };
}

function _neutralizeCssUrls(css: string): string {
  return css.replace(CSS_URL_REGEX, (full, dq?: string, sq?: string, bare?: string) => (dq ?? sq ?? bare ?? '').trim().startsWith('#') ? full : 'none');
}

/**
 * Confines an SVG's stylesheet to that SVG. The SVG is inline in the page, so a rule such as `text { ... }` or
 * `* { ... }` would otherwise restyle the app and every other SVG. Each selector is ANDed with "the marked root, or
 * inside it", through :where() so its specificity and the SVG's own cascade stay as written; ':root' means the SVG
 * itself, as in a standalone file. Parsed by the browser's CSS parser: a constructed sheet ignores @import, and
 * at-rules other than @keyframes and the conditional groups are dropped (@font-face could redefine a font the app
 * uses; its url() sources are neutralized anyway).
 */
function _scopeCss(css: string, scope: CssScope): string {
  let sheet: CSSStyleSheet;
  try {
    sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
  } catch {
    return css; // no constructable stylesheets: unscoped, as it always was
  }
  _scopeCssRules(sheet, scope);
  return Array.from(sheet.cssRules, rule => rule.cssText).join('\n');
}

function _scopeCssRules(group: CSSStyleSheet | CSSGroupingRule, scope: CssScope): void {
  for (let i = group.cssRules.length - 1; i >= 0; i--) {
    const rule = group.cssRules[i];
    if (rule instanceof CSSStyleRule) {
      rule.selectorText = _splitSelectorList(rule.selectorText)
        .map(selector => `${selector.replace(/:root\b/g, scope.selector)}:where(${scope.selector}, ${scope.selector} *)`)
        .join(', ');
      if (!rule.selectorText.includes(scope.selector))
        group.deleteRule(i); // the parser refused the selector and kept the old one: no unscoped rule gets out
    } else if (rule instanceof CSSMediaRule || rule instanceof CSSSupportsRule) {
      _scopeCssRules(rule, scope);
    } else if (!(rule instanceof CSSKeyframesRule)) {
      group.deleteRule(i);
    }
  }
}

/** 'a, b:is(c, d), [e=","]' -> ['a', 'b:is(c, d)', '[e=","]']: commas inside brackets and strings do not separate */
function _splitSelectorList(selectorText: string): string[] {
  const selectors: string[] = [];
  let depth = 0, quote = '', start = 0;
  for (let i = 0; i < selectorText.length; i++) {
    const char = selectorText[i];
    if (char === '\\') i++; // escaped character
    else if (quote) quote = char === quote ? '' : quote;
    else if (char === '"' || char === '\'') quote = char;
    else if (char === '(' || char === '[') depth++;
    else if (char === ')' || char === ']') depth--;
    else if (char === ',' && depth === 0) {
      selectors.push(selectorText.slice(start, i).trim());
      start = i + 1;
    }
  }
  selectors.push(selectorText.slice(start).trim());
  return selectors;
}
