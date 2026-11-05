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


// Prevents arrow keys from scrolling the parent page; runs inside the frame, as the parent cannot reach an opaque-origin document
const arrowKeysGuardScript = `<script>document.addEventListener('keydown',function(e){if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].indexOf(e.key)!==-1)e.preventDefault();});</script>`;

function _prepareSrcDoc(htmlString: string): string {
  // Note: not sanitizing (e.g. DOMPurify), or it would remove the JS code which is what makes the HTML interactive.
  // Isolation comes from the sandbox: without 'allow-same-origin' the frame has an opaque origin.

  // Inject the CSS reset
  const modifiedHtml = htmlString.replace(/<style/i, `<style>${simpleCssReset}</style><style`);

  // Appended (not prepended) so a leading <!DOCTYPE> keeps the document out of quirks mode
  return modifiedHtml + arrowKeysGuardScript;
}

export function RenderCodeHtmlIFrame(props: { htmlCode: string, isFullscreen?: boolean }) {

  // state
  const [srcDoc, setSrcDoc] = React.useState<string | undefined>(undefined);
  const firstRender = React.useRef(true);

  React.useEffect(() => {
    if (!props.htmlCode)
      return;

    // Immediately render the first time, but delay subsequent renders
    const delay = firstRender.current ? 0 : 200;
    firstRender.current = false;

    // Coalesce the rendering of the HTML content to prevent flickering and work around the React StrictMode
    const timeoutId = setTimeout(() => setSrcDoc(_prepareSrcDoc(props.htmlCode)), delay);

    return () => clearTimeout(timeoutId);
  }, [props.htmlCode]);

  return (
    <iframe
      style={props.isFullscreen ? blocksRenderHTMLIFrameFullScreenCss : blocksRenderHTMLIFrameCss}
      title='Sandboxed Web Content'
      aria-label='Interactive content frame'
      srcDoc={srcDoc}
      sandbox='allow-scripts allow-forms' // no 'allow-same-origin': opaque origin, no access to the app's storage or DOM
      loading='lazy' // do not load until visible in the viewport
    />
  );
}
