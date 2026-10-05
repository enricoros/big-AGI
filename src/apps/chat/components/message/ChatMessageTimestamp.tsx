import * as React from 'react';

import { Typography } from '@mui/joy';

import { prettyDuration } from '~/common/util/timeUtils';

import { formatMessageTimestampDate, getMessageTimestamp, type MessageTimestampSource } from './message.timestamp';


/** Timestamp content for the message footer. Visibility policy belongs to the list. */
export function ChatMessageTimestamp(props: {
  message: MessageTimestampSource,
  onShowInfo: () => void,
}) {

  const timestamp = getMessageTimestamp(props.message);
  if (!timestamp) return null;

  const { at, label, durationMs } = timestamp;
  const fromUser = props.message.role === 'user';
  const duration = durationMs === undefined ? null : prettyDuration(durationMs, true);

  return (
    <Typography
      component='button'
      type='button'
      level='body-xs'
      aria-haspopup='dialog'
      onClick={props.onShowInfo}
      onDoubleClick={event => event.stopPropagation()}
      sx={{
        alignSelf: fromUser ? 'flex-end' : 'flex-start',
        mx: 1.5, mt: 0.5, mb: 0.5, p: 0,
        border: 0, background: 'none',
        color: fromUser ? 'primary.softColor' : 'neutral.softColor',
        opacity: 0.7,
        textAlign: fromUser ? 'right' : 'left',
        cursor: 'pointer',
        '&:hover, &:focus-visible': { opacity: 1 },
        '&:focus-visible': { outline: '2px solid currentColor', outlineOffset: '3px', borderRadius: 'xs' },
      }}
    >
      {label}{' '}
      <time dateTime={new Date(at).toISOString()}>{formatMessageTimestampDate(at, Date.now())}</time>
      {duration && <span style={{ whiteSpace: 'nowrap' }}> · took {duration}</span>}
    </Typography>
  );
}
