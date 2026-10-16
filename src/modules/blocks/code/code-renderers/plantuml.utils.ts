// Check if CompressionStream is supported in this browser
//const hasCompressionStream = typeof CompressionStream !== 'undefined';

export async function encodeWithCompressionStream(text: string): Promise<string> {

  // string -> Uint8Array
  const inputData = new TextEncoder().encode(text);

  // deflate compression, without header
  const compressedStream = new ReadableStream({
    start(controller) {
      controller.enqueue(inputData);
      controller.close();
    },
  }).pipeThrough(new CompressionStream('deflate-raw'));

  // read compressed chunks
  const reader = compressedStream.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  // combine compressed chunks
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const compressed = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    compressed.set(chunk, offset);
    offset += chunk.length;
  }

  // custom base64~like PlantUML encoding
  return plantUmlEncode64(compressed);
}


function plantUmlEncode64(data: Uint8Array): string {
  let result = '';
  for (let i = 0; i < data.length; i += 3) {
    if (i + 2 === data.length) {
      result += append3bytes(data[i], data[i + 1], 0);
    } else if (i + 1 === data.length) {
      result += append3bytes(data[i], 0, 0);
    } else {
      result += append3bytes(data[i], data[i + 1], data[i + 2]);
    }
  }
  return result;
}

function append3bytes(b1: number, b2: number, b3: number): string {
  const c1 = b1 >> 2;
  const c2 = ((b1 & 0x3) << 4) | (b2 >> 4);
  const c3 = ((b2 & 0xF) << 2) | (b3 >> 6);
  const c4 = b3 & 0x3F;
  return encode6bit(c1 & 0x3F) + encode6bit(c2 & 0x3F) +
    encode6bit(c3 & 0x3F) + encode6bit(c4 & 0x3F);
}

function encode6bit(b: number): string {
  if (b < 10) return String.fromCharCode(48 + b); // 0-9
  b -= 10;
  if (b < 26) return String.fromCharCode(65 + b); // A-Z
  b -= 26;
  if (b < 26) return String.fromCharCode(97 + b); // a-z
  b -= 26;
  return b === 0 ? '-' : b === 1 ? '_' : '?';
}

// Fallback for browsers without CompressionStream
// function hexEncode(text: string): string {
//   let hex = '~h';
//   for (let i = 0; i < text.length; i++) {
//     const charCode = text.charCodeAt(i);
//     hex += (charCode < 16 ? '0' : '') + charCode.toString(16);
//   }
//   return hex;
// }


const PLANTUML_THEMES = ['plain', 'blueprint', 'crt-amber', 'aws-orange', 'superhero', 'hacker', 'sketchy', 'vibrant', 'mars']; // good-looking, high-contrast, and diverse themes for PlantUML


/**
 * Two-state toggle the layout direction of a PlantUML diagram: default (top-to-bottom) vs. left-to-right
 */
export function plantUMLCodeToggleDirection(code: string): string {
  // Match directives on their own lines, never phrases inside labels or comments.
  const leftToRight = /^[\t ]*left to right direction[\t ]*(?:\r?\n|$)/im;
  if (leftToRight.test(code))
    return code.replace(leftToRight, '');

  const cleanCode = code.replace(/^[\t ]*top to bottom direction[\t ]*(?:\r?\n|$)/im, '');
  return cleanCode.replace(/^([\t ]*@start\w+[^\r\n]*)(\r?\n|$)/im,
    (_, header: string, lineEnd: string) => `${header}${lineEnd || '\n'}left to right direction${lineEnd}`);

}


/**
 * Cycles through a predefined list of PlantUML themes, including removing it.
 */
export function plantUMLCodeCycleTheme(code: string): string {
  const themeRegex = /^([\t ]*!theme[\t ]+)([a-zA-Z0-9_-]+)[\t ]*(?=\r?$)/im;
  const match = code.match(themeRegex);
  const currentTheme = match ? match[2].toLowerCase() : null;

  // no theme: apply first
  if (!currentTheme)
    return code.replace(/^([\t ]*@start\w+[^\r\n]*)(\r?\n|$)/im,
      (_, header: string, lineEnd: string) => `${header}${lineEnd || '\n'}!theme ${PLANTUML_THEMES[0]}${lineEnd}`);

  // unknown theme: replace with first known theme
  const currentIndex = PLANTUML_THEMES.indexOf(currentTheme);
  if (currentIndex === -1)
    return code.replace(themeRegex, `$1${PLANTUML_THEMES[0]}`);

  // last theme: remove the theme directive
  if (currentIndex === PLANTUML_THEMES.length - 1)
    return code.replace(/^[\t ]*!theme[\t ]+[a-zA-Z0-9_-]+[\t ]*(?:\r?\n|$)/im, '');

  // advance theme
  return code.replace(themeRegex, `$1${PLANTUML_THEMES[currentIndex + 1]}`);
}
