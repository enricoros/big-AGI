import * as React from 'react';

import { FormSwitchControl } from './FormSwitchControl';


/**
 * Reusable toggle for enabling client-side API fetch.
 * Appears with animation when client key is present.
 */
export function SetupFormClientSideToggle(props: {
  visible: boolean;
  checked: boolean;
  onChange: (on: boolean) => void;
  helpText: string;
  disabled?: boolean;
}) {

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateRows: props.visible ? '1fr' : '0fr',
        transition: 'grid-template-rows 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      <div style={{ overflow: 'hidden' }}>
        <FormSwitchControl
          title='Direct Connection'
          description={props.checked ? 'Connect from browser' : 'Via server (default)'}
          tooltip={props.helpText}
          checked={props.checked}
          onChange={props.onChange}
          disabled={props.disabled}
        />
      </div>
    </div>
  );
}
