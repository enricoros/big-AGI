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
  | 'variform-variable'
  | 'vector-device-id10'
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
export function agiId(scope: Extract<UidScope, 'chat-dfragment' | 'chat-block' | 'vector-device-id10'>) {
  switch (scope) {
    case 'chat-block':
      return nanoid(16);
    case 'chat-dfragment':
      return nanoid(8);
    case 'vector-device-id10':
      return nanoid(10);
  }
}

/*
 * Seldomly used
 */
export function agiCustomId(digits: number) {
  return nanoid(digits);
}


// UUID v4 generation - because in DBs the lookup is faster, although it takes more bytes as a string

type UuidV4Scope =
  | 'conversation-2'
  | 'persona-2'
  ;


/**
 * Generates a UUID v4 using the Web Crypto API
 * @returns A standard UUID v4 string (e.g., '123e4567-e89b-12d3-a456-426614174000')
 */
export function agiUuidV4(_scope: UuidV4Scope): string {
  // for modern browsers and Node.js
  if (typeof crypto !== 'undefined' && crypto.randomUUID)
    return crypto.randomUUID();

  // fallback for missing crypto.randomUUID
  const randomValues = new Uint8Array(16);
  crypto.getRandomValues(randomValues);

  // Set version (4) and variant (RFC4122)
  randomValues[6] = (randomValues[6] & 0x0f) | 0x40;
  randomValues[8] = (randomValues[8] & 0x3f) | 0x80;

  // Convert to hex string and format as UUID
  const hex = Array.from(randomValues)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Converts a nanoid to a UUID v4 format string. The conversion is:
 * - Deterministic (same nanoid always produces the same UUID)
 * - Maintains randomness properties
 * - Produces valid UUID v4 format (8-4-4-4-12 characters)
 */
export function nanoidToUuidV4(nanoid: string, _scope: 'convert-stored-chat-v1'): string {
  // 1. Create a consistent hash from the nanoid
  const hash = new Uint8Array(16);
  for (let i = 0; i < nanoid.length; i++) {
    // Simple but consistent hash function
    hash[i % 16] ^= nanoid.charCodeAt(i);
  }

  // 2. Ensure UUID v4 format requirements
  // Version 4 UUID has these requirements:
  // - bit 6-7 of clock_seq_hi_and_reserved to 0b10 (RFC 4122)
  // - bit 12-15 of time_hi_and_version to 0b0100 (version 4)
  hash[6] = (hash[6] & 0x0f) | 0x40;  // Version 4
  hash[8] = (hash[8] & 0x3f) | 0x80;  // RFC 4122 variant

  // 3. Convert to hex string
  const hexArray = Array.from(hash).map(b => b.toString(16).padStart(2, '0'));

  // 4. Format as UUID (8-4-4-4-12)
  return [
    hexArray.slice(0, 4).join(''),
    hexArray.slice(4, 6).join(''),
    hexArray.slice(6, 8).join(''),
    hexArray.slice(8, 10).join(''),
    hexArray.slice(10, 16).join(''),
  ].join('-');
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