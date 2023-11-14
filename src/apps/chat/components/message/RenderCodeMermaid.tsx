import * as React from 'react';

import { Box } from '@mui/joy';

import { appTheme } from '~/common/app.theme';


const RenderMermaidDynamic = React.lazy(async () => {

  // dynamic import
  const { default: mermaidAPI } = await import('mermaid');

  mermaidAPI.initialize({
    startOnLoad: false,

    // gfx options
    fontFamily: appTheme.fontFamily.code,
    altFontFamily: appTheme.fontFamily.body,

    // style configuration
    fontSize: 8,
    htmlLabels: true,
    securityLevel: 'loose',
    theme: 'forest',

    // per-chart configuration
    mindmap: { useMaxWidth: false },
    flowchart: { useMaxWidth: false },
    sequence: { useMaxWidth: false },
    timeline: { useMaxWidth: false },
    class: { useMaxWidth: false },
    state: { useMaxWidth: false },
    pie: { useMaxWidth: false },
    er: { useMaxWidth: false },
    gantt: { useMaxWidth: false },
    gitGraph: { useMaxWidth: false },
  });


  const MermaidDiagram = React.memo((props: { mermaidCode: string }) => {

    // state
    const isMounted = React.useRef(false);
    const [svgCode, setSvgCode] = React.useState<string | null>(null);
    const [error, setError] = React.useState<string | null>(null);
    const mermaidContainerRef = React.useRef<HTMLDivElement>(null);


    // [effect] re-render on code changes
    React.useEffect(() => {

      const updateSvgCode = () =>
        mermaidAPI
          .render(
            `mermaid-${Math.random().toString(36).substring(2, 9)}`,
            props.mermaidCode,
            mermaidContainerRef.current!,
          )
          .then(({ svg /*, bindFunctions*/ }) => {
            if (mermaidContainerRef.current && isMounted.current) {
              setSvgCode(svg);
              // bindFunctions?.(mermaidContainerRef.current);
            }
          })
          .catch((error) =>
            console.error('Mermaid rendering failed:', error),
          );

      // mounting state and 'strict mode' debounce
      isMounted.current = true;
      const timeout = setTimeout(updateSvgCode, 0);
      return () => {
        isMounted.current = false;
        clearTimeout(timeout);
      };
    }, [props.mermaidCode]);


    if (error)
      return <div>Error: {error}</div>;

    return (
      <Box
        component='div'
        ref={mermaidContainerRef}
        dangerouslySetInnerHTML={{ __html: svgCode || 'Loading Diagram...' }}
      />
    );
  });

  MermaidDiagram.displayName = 'MermaidDiagram';

  return { default: MermaidDiagram };
});

export const RenderCodeMermaid = (props: { mermaidCode: string }) =>
  <React.Suspense fallback={<div>Summoning Mermaids...</div>}>
    <RenderMermaidDynamic mermaidCode={props.mermaidCode} />
  </React.Suspense>;
