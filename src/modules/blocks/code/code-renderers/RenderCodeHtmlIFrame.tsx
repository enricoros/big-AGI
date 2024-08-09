import * as React from 'react';


const simpleCssReset = `
*, *::before, *::after { box-sizing: border-box; }
body, html { margin: 0; padding: 0; }
body { min-height: 100vh; line-height: 1.5; -webkit-font-smoothing: antialiased; }
img, picture, svg, video { display: block;max-width: 100%; }
`;

const customIFrameCss: React.CSSProperties = {
  flexGrow: 1,
  width: '100%',
  height: '54svh',
  border: 'none',
  boxSizing: 'border-box',
  maxWidth: '100%',
  maxHeight: '100%',
};

function _renderHtmlInIFrame(iframeDoc: Document, htmlString: string) {
  // Note: not using this for now (2024-06-15), or it would remove the JS code
  // which is what makes the HTML interactive.
  // Sanitize the HTML string to remove any potentially harmful content
  // const sanitizedHtml = DOMPurify.sanitize(props.htmlString);

  // Inject the CSS reset
  const modifiedHtml = htmlString.replace(/<style/i, `<style>${simpleCssReset}</style><style`);

  // Write the HTML to the iframe
  iframeDoc.open();
  try {
    iframeDoc.write(modifiedHtml);
  } catch (error) {
    console.error('Error writing to iframe:', error);
  }
  iframeDoc.close();

  // Enhanced Security with Content Security Policy
  // NOTE: 2024-06-15 disabled until we understand exactly all the implications
  // In theory we want script from self, images from everywhere, and styles from self
  // const meta = iframeDoc.createElement('meta');
  // meta.httpEquiv = 'Content-Security-Policy';
  // // meta.content = 'default-src \'self\'; script-src \'self\';';
  // meta.content = 'script-src \'self\' \'unsafe-inline\';';
  // iframeDoc.head.appendChild(meta);

  // Adding this event listener to prevent arrow keys from scrolling the parent page
  iframeDoc.addEventListener('keydown', (event: any) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
      event.preventDefault();
    }
  });
}

export function RenderCodeHtmlIFrame(props: { htmlCode: string }) {

  // state
  const iframeRef = React.useRef<HTMLIFrameElement>(null);
  const firstRender = React.useRef(true);

  React.useEffect(() => {
    if (!props.htmlCode)
      return;

    // Immediately render the first time, but delay subsequent renders
    const delay = firstRender.current ? 0 : 200;
    firstRender.current = false;

    // Coalesce the rendering of the HTML content to prevent flickering and work around the React StrictMode
    const timeoutId = setTimeout(() => {
      const iframeDoc = iframeRef.current?.contentWindow?.document;
      iframeDoc && !!props.htmlCode && _renderHtmlInIFrame(iframeDoc, props.htmlCode);
    }, delay);

    return () => clearTimeout(timeoutId);
  }, [props.htmlCode]);

  return (
    <iframe
      ref={iframeRef}
      style={customIFrameCss}
      title='Sandboxed Web Content'
      aria-label='Interactive content frame'
      sandbox='allow-scripts allow-same-origin allow-forms' // restrict to only these
      loading='lazy' // do not load until visible in the viewport
    />
  );
}
