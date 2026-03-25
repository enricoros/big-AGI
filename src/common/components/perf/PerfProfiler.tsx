import * as React from 'react';

import { isBrowserPerfEnabled, perfRecordReactRender } from '~/common/util/perfRegistry';


export function PerfProfiler(props: {
  id: string;
  children: React.ReactNode;
}) {
  if (!isBrowserPerfEnabled())
    return <>{props.children}</>;

  return (
    <React.Profiler
      id={props.id}
      onRender={(_id, phase, actualDuration) => {
        perfRecordReactRender(props.id, phase, actualDuration);
      }}
    >
      {props.children}
    </React.Profiler>
  );
}
