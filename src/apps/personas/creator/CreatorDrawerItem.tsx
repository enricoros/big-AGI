import * as React from 'react';
import TimeAgo from 'react-timeago';

import { Box, Checkbox, IconButton, ListItemButton, ListItemDecorator, Typography } from '@mui/joy';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import YouTubeIcon from '@mui/icons-material/YouTube';

import type { SimplePersona } from '../store-app-personas';


export function CreatorDrawerItem(props: {
  item: SimplePersona,
  isActive: boolean,
  isSelected: boolean,
  isSelection: boolean,
  onClick: (event: React.MouseEvent) => void,
  onDelete: (simplePersonaId: string) => void,
}) {

  // state
  const [deleteArmed, setDeleteArmed] = React.useState(false);


  // derived

  const { item, isActive } = props;

  const thumbnailUrl = item.pictureUrl || ((item.inputProvenance?.type === 'youtube' && item.inputProvenance.thumbnailUrl) ? item.inputProvenance.thumbnailUrl : undefined);

  const icon = thumbnailUrl
    ? <picture style={{ lineHeight: 0 }}><img src={thumbnailUrl} alt='Simple Persona Thumbnail' width={20} height={20} /></picture>
    : item.inputProvenance?.type === 'text'
      ? <TextFieldsIcon />
      : item.inputProvenance?.type === 'youtube'
        ? <YouTubeIcon />
        : undefined;


  return (
    <ListItemButton
      variant={isActive ? 'soft' : undefined}
      onClick={props.onClick}
      sx={{
        '&:hover > button': { opacity: 1 },
      }}
    >
      {/* Symbol or Thumbnail picture */}
      <ListItemDecorator>
        {props.isSelection ? (
          <Checkbox checked={props.isSelected} />
        ) : icon}
      </ListItemDecorator>

      <Box sx={{ overflow: 'hidden' }}>

        {/* Title or System prompt (ellipsized) */}
        <Typography level='title-sm' className='agi-ellipsize'>
          {item.name || (item.systemPrompt?.slice(0, 40) + '...')}
        </Typography>

        {/* creation Model */}
        {/*{!!item.llmLabel && <Typography level='body-xs' sx={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>*/}
        {/*  {item.llmLabel}*/}
        {/*</Typography>}*/}

        {/* creation Date */}
        <Typography level='body-xs'>
          {!!item.creationDate && <TimeAgo date={item.creationDate} />}
        </Typography>

      </Box>


      {/* Delete Arming */}
      {!props.isSelection && !deleteArmed && (
        <IconButton
          variant={isActive ? 'solid' : 'outlined'}
          size='sm'
          sx={{ opacity: { xs: 1, sm: 0 }, transition: 'opacity 0.2s' }}
          onClick={() => setDeleteArmed(on => !on)}
        >
          <DeleteOutlineIcon />
        </IconButton>
      )}

      {/* Delete / Cancel buttons */}
      {!props.isSelection && deleteArmed && <>
        <IconButton size='sm' variant='solid' color='danger' onClick={() => props.onDelete(item.id)}>
          <DeleteOutlineIcon />
        </IconButton>
        <IconButton size='sm' variant='solid' color='neutral' onClick={() => setDeleteArmed(false)}>
          <CloseRoundedIcon />
        </IconButton>
      </>}

    </ListItemButton>
  );
}