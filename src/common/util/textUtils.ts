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
