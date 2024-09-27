import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';

import { FormControl, IconButton, Step, Stepper } from '@mui/joy';

import type { ContentScaling } from '~/common/app.theme';
import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { useUIPreferencesStore } from '~/common/state/store-ui';


export function SettingUIContentScaling(props: { noLabel?: boolean }) {

  // external state
  const [contentScaling, setContentScaling] = useUIPreferencesStore(useShallow(state => [state.contentScaling, state.setContentScaling]));

  return (
    <FormControl orientation='horizontal' sx={{ justifyContent: props.noLabel ? 'center' : 'space-between' }}>
      {!props.noLabel && (
        <FormLabelStart
          title='Text Size'
          description={contentScaling === 'xs' ? 'Dense' : contentScaling === 'sm' ? 'Default' : 'Larger'}
        />
      )}
      <Stepper sx={{
        maxWidth: 160,
        width: '100%',
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
                    // 400 would be more representative because it's the default, but being in a button we're 500 (md) instead of 400.
                    //     However it's good to have that extra confidence when choosing a lower font size, as then while reading text
                    //     the 400 makes lots of sense.
                    // fontWeight: ...400?,
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