// Extract file paths and find the common radix
export const extractFilePathsWithCommonRadix = (droppedText: string): string[] => {
  const splitDroppedText = droppedText.split(/[\r\n]+/);

  const filePaths = splitDroppedText
    .filter((path) => path.startsWith('file:'))
    .map((path) => path.slice(5));

  if (filePaths.length < 2)
    return [];

  const commonRadix = findCommonPrefix(filePaths);
  if (!commonRadix.endsWith('/'))
    return [];

  return filePaths.map((path) => path.slice(commonRadix.length));
};

// Find the common prefix of an array of strings
export const findCommonPrefix = (strings: string[]) => {
  if (!strings.length)
    return '';

  const sortedStrings = strings.slice().sort();
  const firstString = sortedStrings[0];
  const lastString = sortedStrings[sortedStrings.length - 1];

  let commonPrefix = '';
  for (let i = 0; i < firstString.length; i++) {
    if (firstString[i] === lastString[i]) {
      commonPrefix += firstString[i];
    } else {
      break;
    }
  }

  return commonPrefix;
};