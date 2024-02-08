import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { FormControl, IconButton, Step, Stepper } from '@mui/joy';

import type { ContentScaling } from '~/common/app.theme';
import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { useUIPreferencesStore } from '~/common/state/store-ui';


export function SettingContentScaling(props: { noLabel?: boolean }) {

  // external state
  const [contentScaling, setContentScaling] = useUIPreferencesStore(state => [state.contentScaling, state.setContentScaling], shallow);

  return (
    <FormControl orientation='horizontal' sx={{ justifyContent: props.noLabel ? 'center' : 'space-between' }}>
      {!props.noLabel && (
        <FormLabelStart title='Text Size'
                        description={contentScaling === 'xs' ? 'Extra Small' : contentScaling === 'sm' ? 'Small' : 'Default'} />
      )}
      <Stepper sx={{
        maxWidth: 160,
        width: '100%',
        fontWeight: 'initial',
        '--Step-connectorThickness': '2px',
        '--StepIndicator-size': '2rem',
      }}>
        {(['xs', 'sm', 'md'] as ContentScaling[]).map(sizeKey => {
          const isActive = sizeKey === contentScaling;
          return (
            <Step
              key={sizeKey}
              onClick={() => setContentScaling(sizeKey)}
              indicator={
                <IconButton
                  size='sm'
                  variant={isActive ? 'outlined' : 'soft'}
                  // color={isActive ? 'primary' : 'neutral'}
                  sx={{
                    // style
                    fontSize: sizeKey,
                    // borderRadius: !isActive ? '50%' : undefined,
                    borderRadius: '50%',
                    width: '1rem',
                    height: '1rem',
                    // style when active
                    '--variant-borderWidth': '2px',
                    borderColor: 'primary.solidBg',
                  }}
                >
                  {'Aa' /* Nothing says 'font' more than this */}
                </IconButton>
              }
            />
          );
        })}
      </Stepper>
    </FormControl>
  );
}