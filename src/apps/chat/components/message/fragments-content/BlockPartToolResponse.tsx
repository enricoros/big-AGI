import * as React from 'react';

import { BlocksContainer } from '~/modules/blocks/BlocksContainers';

import type { ContentScaling } from '~/common/app.theme';
import type { DMessageToolResponsePart } from '~/common/stores/chat/chat.fragments';

import { KeyValueData, KeyValueGrid } from './BlockPartToolInvocation';


export function BlockPartToolResponse(props: {
  toolResponsePart: DMessageToolResponsePart,
  contentScaling: ContentScaling,
  onDoubleClick?: (event: React.MouseEvent) => void;
}) {

  const part = props.toolResponsePart;

  const kvData: KeyValueData = React.useMemo(() => {
    switch (part.response.type) {
      case 'function_call':
        return [
          { label: 'Id', value: part.id },
          { label: 'Name', value: <strong>{part.response.name}</strong> },
          { label: 'Response', value: part.response.result, asCode: true },
          ...(!part.error ? [] : [{ label: 'Error', value: part.error }]),
          { label: 'Environment', value: part.environment },
        ];
      case 'code_execution':
        return [
          { label: 'Id', value: part.id },
          { label: 'Response', value: part.response.result, asCode: true },
          ...(!part.error ? [] : [{ label: 'Error', value: part.error }]),
          { label: 'Executor', value: part.response.executor },
          { label: 'Environment', value: part.environment },
        ];
    }
  }, [part]);

  return (
    <BlocksContainer onDoubleClick={props.onDoubleClick}>
      <KeyValueGrid
        data={kvData}
        contentScaling={props.contentScaling}
        color={part.error ? 'danger' : 'primary'}
      />
    </BlocksContainer>
  );
}
