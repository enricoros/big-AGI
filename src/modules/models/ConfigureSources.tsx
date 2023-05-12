import * as React from 'react';

import { Chip, IconButton, Radio, RadioGroup } from '@mui/joy';
import CheckIcon from '@mui/icons-material/Check';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

import { DModelSource, DModelSourceId } from '@/modules/models/store-models';
import { LocalAISource } from '@/modules/models/localai/LocalAISource';
import { OpenAISource } from '@/modules/models/openai/OpenAISource';


export function ConfigureSources(props: {
  llmSources: DModelSource[],
  selectedSourceId: DModelSourceId | null,
  setSelectedSourceId: (sourceId: DModelSourceId | null) => void,
  onDeleteSourceId: (sourceId: DModelSourceId) => void,
}) {

  const sourceItems = React.useMemo(() => props.llmSources.map(source => {
    const checked = source.sourceId === props.selectedSourceId;
    return {
      source,
      component: (
        <Chip
          key={source.sourceId}
          variant={checked ? 'soft' : 'plain'}
          color={checked ? 'primary' : 'neutral'}
          size='lg'
          startDecorator={
            checked && <CheckIcon sx={{ zIndex: 1, pointerEvents: 'none' }} />
            // configured
            //   ? <CheckIcon sx={{ zIndex: 1, pointerEvents: 'none' }} />
            //   : <CheckBoxOutlineBlankOutlinedIcon sx={{ zIndex: 1, pointerEvents: 'none' }} />
          }
        >
          <Radio
            variant='outlined'
            checked={checked}
            // color={checked ? 'danger' : 'warning'}
            disableIcon
            overlay
            label={source.label}
            value={source.sourceId}
          />
        </Chip>
      ),
    };
  }), [props.llmSources, props.selectedSourceId]);

  const selectedSource = sourceItems.find(item => item.source.sourceId === props.selectedSourceId);

  let vendorConfigComponent: React.JSX.Element | null = null;
  if (selectedSource) {
    switch (selectedSource.source.sourceId) {
      case 'openai':
        vendorConfigComponent = <OpenAISource />;
        break;
      case 'google_vertex':
        break;
      case 'anthropic':
        break;
      case 'localai':
        vendorConfigComponent = <LocalAISource />;
        break;
    }
  }

  const enableDeleteButton = !!props.setSelectedSourceId && sourceItems.length >= 2;

  return <>

    {/* Configuration Items */}
    <RadioGroup
      overlay
      value={props.selectedSourceId}
      onChange={event => props.setSelectedSourceId(event.target.value)}
      sx={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}
    >
      {sourceItems.map(item => item.component)}

      {/* Delete Configuration Button */}
      <IconButton
        variant='plain' color='neutral'
        disabled={!enableDeleteButton}
        onClick={() => props.onDeleteSourceId(props.selectedSourceId!)}
        sx={{ ml: 'auto' }}
      >
        <DeleteOutlineIcon />
      </IconButton>
    </RadioGroup>

    {/* Selected Item Configuration */}
    {vendorConfigComponent}

  </>;
}