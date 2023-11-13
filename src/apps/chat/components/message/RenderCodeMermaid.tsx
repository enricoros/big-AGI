import * as React from 'react';
import type { MermaidConfig } from 'mermaid';

import { Box } from '@mui/joy';
import { SxProps } from '@mui/system';


const RenderMermaidDynamic = React.lazy(async () => {
  const { default: mermaidAPI } = await import('mermaid');
  const { default: DOMPurify } = await import('dompurify');

  const mermaidConfig: MermaidConfig = {
    startOnLoad: false,
    theme: 'default',
    // ... any other Mermaid configuration options
  };

  mermaidAPI.initialize(mermaidConfig);

  const MermaidDiagram = React.memo((props: { mermaidCode: string }) => {

    // state
    const [svgCode, setSvgCode] = React.useState<string | null>(null);
    const [error, setError] = React.useState<string | null>(null);
    const mermaidContainerRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
      let isMounted = true;

      // Generate a unique ID for each diagram
      const id = `mermaid-${Math.random().toString(36).substring(2, 9)}`;

      // Render the diagram

      mermaidAPI
        .render(id, props.mermaidCode)
        .then(renderResult => {
          if (!isMounted) return;
          const svg = DOMPurify.sanitize(renderResult.svg);
          setSvgCode(svg);
          // if (mermaidContainerRef.current)
          //   renderResult.bindFunctions?.(mermaidContainerRef.current);
        })
        .catch(error => {
          console.error('Mermaid rendering failed:', error);
          setError('Mermaid rendering issue: ' + JSON.stringify(error));
        })
        .finally(() => {
          // ...
        });

      return () => {
        isMounted = false;
      };
    }, [props.mermaidCode]);

    if (error)
      return <div>Error: {error}</div>;

    return (
      <Box component='div'
           ref={mermaidContainerRef}
           dangerouslySetInnerHTML={{ __html: svgCode || 'Loading diagram...' }}
      />
    );
  });

  // Assign a displayName to the component for better debugging
  MermaidDiagram.displayName = 'MermaidDiagram';

  return { default: MermaidDiagram };
});

export const RenderCodeMermaid = (props: { mermaidCode: string }) =>
  <React.Suspense fallback={<div>Summoning Mermaids...</div>}>
    <RenderMermaidDynamic mermaidCode={props.mermaidCode} />
  </React.Suspense>;
