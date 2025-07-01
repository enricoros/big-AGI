import * as React from 'react';

import { ScaledTextBlockRenderer } from '~/modules/blocks/ScaledTextBlockRenderer';

import type { ContentScaling } from '~/common/app.theme';
import type { DMessageRole } from '~/common/stores/chat/chat.message';
import { DataStreamViz } from '~/common/components/DataStreamViz';


// configuration
const DATASTREAM_VISUALIZATION_DELAY = Math.round(2 * Math.PI * 1000);


export function BlockPartPlaceholder(props: {
  placeholderText: string,
  messageRole: DMessageRole,
  contentScaling: ContentScaling,
  showAsItalic?: boolean,
  showAsDataStreamViz?: boolean,
}) {

  // state
  const [showVisualization, setShowVisualization] = React.useState(false);


  React.useEffect(() => {
    let timerId: ReturnType<typeof setTimeout> | undefined;

    if (props.showAsDataStreamViz)
      timerId = setTimeout(() => setShowVisualization(true), DATASTREAM_VISUALIZATION_DELAY);
    else
      setShowVisualization(false);

    return () => timerId && clearTimeout(timerId);
  }, [props.showAsDataStreamViz]);


  // Alternative placeholder visualization
  if (props.showAsDataStreamViz && showVisualization)
    return <DataStreamViz height={1 + 8 * 4} />;

  return (
    <ScaledTextBlockRenderer
      text={props.placeholderText}
      contentScaling={props.contentScaling}
      textRenderVariant='text'
      showAsItalic={props.showAsItalic}
    />
  );
}