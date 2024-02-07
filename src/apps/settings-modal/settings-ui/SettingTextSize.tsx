import * as React from 'react';

import { FormControl, IconButton, Step, Stepper } from '@mui/joy';

import type { UIMessageTextSize } from '~/common/state/store-ui';
import { FormLabelStart } from '~/common/components/forms/FormLabelStart';


export function SettingTextSize({ textSize, onChangeTextSize }: {
  textSize: UIMessageTextSize,
  onChangeTextSize: (size: UIMessageTextSize) => void,
}) {
  return (
    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
      <FormLabelStart title='Text Size'
                      description={textSize === 'xs' ? 'Extra Small' : textSize === 'sm' ? 'Small' : 'Default'} />
      <Stepper sx={{
        maxWidth: 160,
        width: '100%',
        fontWeight: 'initial',
        '--Step-connectorThickness': '2px',
        '--StepIndicator-size': '2rem',
      }}>
        {(['xs', 'sm', 'md'] as UIMessageTextSize[]).map(sizeKey => {
          const isActive = sizeKey === textSize;
          return (
            <Step
              key={sizeKey}
              onClick={() => onChangeTextSize(sizeKey)}
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
                  {'Aa' /* Nothing says 'font' more than this */ }
                </IconButton>
              }
            />
          );
        })}
      </Stepper>
    </FormControl>
  );
}