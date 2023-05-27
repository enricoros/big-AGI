function wordWrap(text: string, width: number): string {
  let result = '';
  let lineLength = 0;

  text.split(' ').forEach((word) => {
    if (lineLength + word.length >= width) {
      result += '\n';
      lineLength = 0;
    }
    result += word + ' ';
    lineLength += word.length + 1;
  });

  return result;
}
