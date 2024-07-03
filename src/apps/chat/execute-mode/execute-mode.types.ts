/**
 * Mode: how to treat the input from the Composer
 * Was: ChatModeId
 */
export type ChatExecuteMode =
  | 'append-user'
  | 'beam-content'
  | 'generate-content'
  | 'generate-image'
  | 'generate-text-v1'
  | 'react-content'
  ;
