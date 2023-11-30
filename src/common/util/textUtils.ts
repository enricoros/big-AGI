export function capitalizeFirstLetter(string: string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

export function createBase36Uid(checkDuplicates: string[]): string {
  let id = '';
  do {
    id = Math.random().toString(36).substring(2, 10);
  } while (checkDuplicates.includes(id));
  return id;
}