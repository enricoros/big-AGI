import { nanoid } from 'nanoid';

// This is here to index all the UUIDs in the application
type UidScope =
  | 'attachment-draft'
  | 'beam-fusion'
  | 'beam-preset-config'
  | 'beam-ray'
  | 'chat-block'
  | 'chat-dconversation'
  | 'chat-dmessage'
  | 'chat-dfragment'
  | 'chat-ephemerals-item'
  | 'chat-folders-item'
  | 'chat-pane'
  | 'dblob-asset'
  | 'draw-prompt'
  | 'livefile-item'
  | 'persona-creator-chain'
  | 'persona-simple'
  | 'processing-queue-task'
  | 'server-storage-deletion-key'
  | 'server-storage-id'
  | 'server-storage-owner'
  | 'snackbar-item'
  ;

/**
 * Application-wide unique identifier generator
 * @param _scope Does not influcence the ID generation, but is used to index all the IDs in the application
 */
export function agiUuid(_scope: Exclude<UidScope, 'chat-dfragment'>) {
  return nanoid();
}

/*
 * Smaller version of the above, without claims of uniqueness
 */
export function agiId(scope: Extract<UidScope, 'chat-dfragment' | 'chat-block'>) {
  // if (scope === 'chat-dfragment')
  //   return 'f-' + nanoid(8);
  return nanoid(scope === 'chat-dfragment' ? 8 : 16);
}

/*
 * Seldomly used
 */
export function agiCustomId(digits: number) {
  return nanoid(digits);
}

/*
// Similar to the above but makes sure there's no collision with the given list of IDs
export function agiUuidUncollided(scope: Extract<UidScope, 'chat-dfragment'>, existingIds: string[]) {
  const characters = scope === 'chat-dfragment' ? 8 : 21;
  let id: string;
  do {
    id = nanoid(characters);
  } while (existingIds.includes(id));
  return id;
}
*/

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