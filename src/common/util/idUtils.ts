import { nanoid } from 'nanoid';

// This is here to index all the UUIDs in the application
type UidScope =
  | 'attachment-draft'
  | 'beam-fusion'
  | 'beam-preset-config'
  | 'beam-ray'
  | 'chat-dconversation'
  | 'chat-dmessage'
  | 'chat-ephemerals-item'
  | 'chat-folders-item'
  | 'chat-pane'
  | 'dblob-asset'
  | 'draw-prompt'
  | 'persona-creator-chain'
  | 'persona-simple'
  | 'processing-queue-task'
  | 'server-storage-deletion-key'
  | 'server-storage-owner'
  | 'snackbar-item'
  ;

/**
 * Application-wide unique identifier generator
 * @param _scope Does not influcence the ID generation, but is used to index all the IDs in the application
 */
export function agiUuid(_scope: UidScope) {
  return nanoid();
}


/*
import { v4 as uuidv4 } from 'uuid';

export function createBase64UuidV4(): string {
  return uuidToBase64(uuidv4());
}

function uuidToBase64(uuid: string): string {
  // Remove hyphens from the UUID
  const cleanUuid = uuid.replaceAll('-', '');

  // Convert the cleaned UUID to a byte array
  const uuidBytes = new Uint8Array(16);
  for (let i = 0; i < 32; i += 2)
    uuidBytes[i / 2] = parseInt(cleanUuid.substring(i, i + 2), 16);

  // Convert byte array to a Base64 string
  const base64 = btoa(String.fromCharCode.apply(null, uuidBytes as any));

  // Remove '=' end padding
  return base64.replace(/=+$/, '');
}
 */