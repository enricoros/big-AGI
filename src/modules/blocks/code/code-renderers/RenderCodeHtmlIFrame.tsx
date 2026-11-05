import * as React from 'react';


const simpleCssReset = `
*, *::before, *::after { box-sizing: border-box; }
body, html { margin: 0; padding: 0; }
body { min-height: 100vh; line-height: 1.5; -webkit-font-smoothing: antialiased; }
img, picture, svg, video { display: block;max-width: 100%; }
`;

export const blocksRenderHTMLIFrameCss: React.CSSProperties = {
  flexGrow: 1,
  width: '100%',
  height: '54svh',
  border: 'none',
  boxSizing: 'border-box',
  maxWidth: '100%',
  maxHeight: '100%',
} as const;

const blocksRenderHTMLIFrameFullScreenCss: React.CSSProperties = {
  ...blocksRenderHTMLIFrameCss,
  height: undefined,
  flex: 1,
} as const;


/**
 * Runs inside the frame before any page script. The parent cannot reach an opaque-origin document, so whatever the
 * frame needs travels with the HTML:
 * - storage: an opaque origin has no localStorage or sessionStorage (the getters throw SecurityError), and generated
 *   pages commonly read them at startup. Installs an in-memory stand-in, only where the native getter throws. State
 *   lives as long as the document, which is all a sandboxed page should keep
 * - arrow keys: prevents them from scrolling the parent page
 */
const frameBootstrapScript = `<script>(function(){
function S(){var m=Object.create(null);return{getItem:function(k){return k in m?m[k]:null},setItem:function(k,v){m[k]=String(v)},removeItem:function(k){delete m[k]},clear:function(){m=Object.create(null)},key:function(i){var ks=Object.keys(m);return i<ks.length?ks[i]:null},get length(){return Object.keys(m).length}}}
function need(n){try{return !window[n]}catch(e){return true}}
try{if(need('localStorage'))Object.defineProperty(window,'localStorage',{value:S(),configurable:true,enumerable:true});if(need('sessionStorage'))Object.defineProperty(window,'sessionStorage',{value:S(),configurable:true,enumerable:true})}catch(e){}
document.addEventListener('keydown',function(e){if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].indexOf(e.key)!==-1)e.preventDefault()});
})()</script>`;

function _prepareSrcDoc(htmlString: string): string {
  // Note: not sanitizing (e.g. DOMPurify), or it would remove the JS code which is what makes the HTML interactive.
  // Isolation comes from the sandbox: without 'allow-same-origin' the frame has an opaque origin.

  // Inject the CSS reset
  const modifiedHtml = htmlString.replace(/<style/i, `<style>${simpleCssReset}</style><style`);

  // Bootstrap right after a leading <!DOCTYPE> (or first): ahead of every page script, and out of reach of an unclosed tag at the end
  const doctypeLength = modifiedHtml.match(/^\s*<!doctype[^>]*>/i)?.[0].length ?? 0;
  return modifiedHtml.slice(0, doctypeLength) + frameBootstrapScript + modifiedHtml.slice(doctypeLength);
}

export function RenderCodeHtmlIFrame(props: { htmlCode: string, isFullscreen?: boolean }) {

  // state
  const [srcDoc, setSrcDoc] = React.useState<{ html: string, gen: number } | null>(null);
  const firstRender = React.useRef(true);

  React.useEffect(() => {
    if (!props.htmlCode)
      return;

    // Immediately render the first time, but delay subsequent renders
    const delay = firstRender.current ? 0 : 200;
    firstRender.current = false;

    // Coalesce the rendering of the HTML content to prevent flickering and work around the React StrictMode
    const timeoutId = setTimeout(() => setSrcDoc(prev => ({ html: _prepareSrcDoc(props.htmlCode), gen: (prev?.gen ?? 0) + 1 })), delay);

    return () => clearTimeout(timeoutId);
  }, [props.htmlCode]);

  return (
    <iframe
      // fresh element per document: setting srcdoc on a live iframe pushes a history entry per update (Chrome, Safari), a new iframe's first navigation does not, at no measured cost
      key={srcDoc?.gen ?? 0}
      style={props.isFullscreen ? blocksRenderHTMLIFrameFullScreenCss : blocksRenderHTMLIFrameCss}
      title='Sandboxed Web Content'
      aria-label='Interactive content frame'
      srcDoc={srcDoc?.html}
      sandbox='allow-scripts allow-forms' // no 'allow-same-origin': opaque origin, no access to the app's storage or DOM
      loading='lazy' // do not load until visible in the viewport
    />
  );
}
