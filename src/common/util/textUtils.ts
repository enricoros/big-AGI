import { v4 as uuidv4 } from 'uuid';


export function capitalizeFirstLetter(string: string) {
  return string?.length ? (string.charAt(0).toUpperCase() + string.slice(1)) : string;
}


export function ellipsizeFront(text: string, maxLength: number) {
  if (text.length <= maxLength)
    return text;
  return '…' + text.slice(-(maxLength - 1));
}

export function ellipsizeMiddle(text: string, maxLength: number) {
  if (text.length <= maxLength)
    return text;
  const half = Math.floor(maxLength / 2);
  return text.slice(0, half) + '…' + text.slice(-(maxLength - half - 1));
}


export function createBase36Uid(checkDuplicates: string[]): string {
  let id = '';
  do {
    id = Math.random().toString(36).substring(2, 10);
  } while (checkDuplicates.includes(id));
  return id;
}


export function uuid4base64(): string {
  return uuidToBase64(uuidv4());
}

function uuidToBase64(uuid: string): string {
  // Remove hyphens from the UUID
  const cleanUuid = uuid.replace(/-/g, '');

  // Convert the cleaned UUID to a byte array
  const uuidBytes = new Uint8Array(16);
  for (let i = 0; i < 32; i += 2) {
    uuidBytes[i / 2] = parseInt(cleanUuid.substring(i, i + 2), 16);
  }

  // Convert byte array to a Base64 string
  const base64 = btoa(String.fromCharCode.apply(null, uuidBytes as any));

  // Optionally remove '=' padding if not required by your application
  return base64.replace(/=+$/, '');
}
