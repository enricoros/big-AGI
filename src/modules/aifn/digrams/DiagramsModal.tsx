import * as React from 'react';

import { GoodModal } from '~/common/components/GoodModal';


export interface DiagramConfig {
  conversationId: string;
  messageId: string,
  text: string;
}

export function DiagramsModal(props: {
  config: DiagramConfig,
  onClose: () => void;
}) {

  return (
    <GoodModal open title='Concept breakdown' onClose={props.onClose}>
      Test
    </GoodModal>
  );

}