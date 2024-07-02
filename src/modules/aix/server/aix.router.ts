import { createTRPCRouter, publicProcedure } from '~/server/api/trpc.server';

import { aixChatGenerateInputSchema } from '../shared/aix.shared.chat';


// const chatStreamingInputSchema = z.object({
//   access: z.discriminatedUnion('dialect', [anthropicAccessSchema, geminiAccessSchema, ollamaAccessSchema, openAIAccessSchema]),
//   model: openAIModelSchema,
//   history: openAIHistorySchema,
//   tools: llmsToolsSchema.optional(),
//   context: llmsStreamingContextSchema,
// });

// const chatStreamingOutputSchema = z.object({
//   test: z.string(),
//   me: z.number(),
// });


function getRandomSize(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Pre-generate a large random string to use as a source
const RANDOM_SOURCE = (() => {
  const unicodeRanges = [
    [0x0000, 0x007F],   // Basic Latin
    [0x0080, 0x00FF],   // Latin-1 Supplement
    [0x0100, 0x017F],   // Latin Extended-A
    [0x0180, 0x024F],   // Latin Extended-B
    [0x0250, 0x02AF],   // IPA Extensions
    [0x02B0, 0x02FF],   // Spacing Modifier Letters
    [0x0300, 0x036F],   // Combining Diacritical Marks
    [0x0370, 0x03FF],   // Greek and Coptic
    [0x0400, 0x04FF],   // Cyrillic
    [0x0500, 0x052F],   // Cyrillic Supplement
    [0x0530, 0x058F],   // Armenian
    [0x0590, 0x05FF],   // Hebrew
    [0x0600, 0x06FF],   // Arabic
    [0x0700, 0x074F],   // Syriac
    [0x0780, 0x07BF],   // Thaana
    [0x0900, 0x097F],   // Devanagari
    [0x0980, 0x09FF],   // Bengali
    [0x0A00, 0x0A7F],   // Gurmukhi
    [0x0A80, 0x0AFF],   // Gujarati
    [0x0B00, 0x0B7F],   // Oriya
    [0x0B80, 0x0BFF],   // Tamil
    [0x0C00, 0x0C7F],   // Telugu
    [0x0C80, 0x0CFF],   // Kannada
    [0x0D00, 0x0D7F],   // Malayalam
    [0x0D80, 0x0DFF],   // Sinhala
    [0x0E00, 0x0E7F],   // Thai
    [0x0E80, 0x0EFF],   // Lao
    [0x0F00, 0x0FFF],   // Tibetan
    [0x1000, 0x109F],   // Myanmar
    [0x10A0, 0x10FF],   // Georgian
    [0x1100, 0x11FF],   // Hangul Jamo
    [0x1200, 0x137F],   // Ethiopic
    [0x13A0, 0x13FF],   // Cherokee
    [0x1400, 0x167F],   // Unified Canadian Aboriginal Syllabics
    [0x1680, 0x169F],   // Ogham
    [0x16A0, 0x16FF],   // Runic
    [0x1700, 0x171F],   // Tagalog
    [0x1720, 0x173F],   // Hanunoo
    [0x1740, 0x175F],   // Buhid
    [0x1760, 0x177F],   // Tagbanwa
    [0x1780, 0x17FF],   // Khmer
    [0x1800, 0x18AF],   // Mongolian
    [0x1900, 0x194F],   // Limbu
    [0x1950, 0x197F],   // Tai Le
    [0x19E0, 0x19FF],   // Khmer Symbols
    [0x1D00, 0x1D7F],   // Phonetic Extensions
    [0x1E00, 0x1EFF],   // Latin Extended Additional
    [0x1F00, 0x1FFF],   // Greek Extended
    [0x2000, 0x206F],   // General Punctuation
    [0x2070, 0x209F],   // Superscripts and Subscripts
    [0x20A0, 0x20CF],   // Currency Symbols
    [0x20D0, 0x20FF],   // Combining Diacritical Marks for Symbols
    [0x2100, 0x214F],   // Letterlike Symbols
    [0x2150, 0x218F],   // Number Forms
    [0x2190, 0x21FF],   // Arrows
    [0x2200, 0x22FF],   // Mathematical Operators
    [0x2300, 0x23FF],   // Miscellaneous Technical
    [0x2400, 0x243F],   // Control Pictures
    [0x2440, 0x245F],   // Optical Character Recognition
    [0x2460, 0x24FF],   // Enclosed Alphanumerics
    [0x2500, 0x257F],   // Box Drawing
    [0x2580, 0x259F],   // Block Elements
    [0x25A0, 0x25FF],   // Geometric Shapes
    [0x2600, 0x26FF],   // Miscellaneous Symbols
    [0x2700, 0x27BF],   // Dingbats
    [0x3000, 0x303F],   // CJK Symbols and Punctuation
    [0x3040, 0x309F],   // Hiragana
    [0x30A0, 0x30FF],   // Katakana
    [0x3100, 0x312F],   // Bopomofo
    [0x3130, 0x318F],   // Hangul Compatibility Jamo
    [0x3190, 0x319F],   // Kanbun
    [0x31A0, 0x31BF],   // Bopomofo Extended
    [0x31F0, 0x31FF],   // Katakana Phonetic Extensions
    [0x3200, 0x32FF],   // Enclosed CJK Letters and Months
    [0x3300, 0x33FF],   // CJK Compatibility
    [0x3400, 0x4DBF],   // CJK Unified Ideographs Extension A
    [0x4E00, 0x9FFF],   // CJK Unified Ideographs
    [0xA000, 0xA48F],   // Yi Syllables
    [0xA490, 0xA4CF],   // Yi Radicals
    [0xAC00, 0xD7AF],   // Hangul Syllables
    [0xD800, 0xDB7F],   // High Surrogates
    [0xDB80, 0xDBFF],   // High Private Use Surrogates
    [0xDC00, 0xDFFF],   // Low Surrogates
    [0xE000, 0xF8FF],   // Private Use Area
    [0xF900, 0xFAFF],   // CJK Compatibility Ideographs
    [0xFB00, 0xFB4F],   // Alphabetic Presentation Forms
    [0xFB50, 0xFDFF],   // Arabic Presentation Forms-A
    [0xFE00, 0xFE0F],   // Variation Selectors
    [0xFE20, 0xFE2F],   // Combining Half Marks
    [0xFE30, 0xFE4F],   // CJK Compatibility Forms
    [0xFE50, 0xFE6F],   // Small Form Variants
    [0xFE70, 0xFEFF],   // Arabic Presentation Forms-B
    [0xFF00, 0xFFEF],   // Halfwidth and Fullwidth Forms
    [0xFFF0, 0xFFFF]    // Specials
  ];

  let result = '';
  for (let i = 0; i < 10 * 1024 * 1024; i++) { // 10MB of random data
    const rangeIndex = Math.floor(Math.random() * unicodeRanges.length);
    const [start, end] = unicodeRanges[rangeIndex];
    const codePoint = Math.floor(Math.random() * (end - start + 1)) + start;
    result += String.fromCodePoint(codePoint);
  }
  return result;
})();

function generateRandomBase64(size: number): string {
  if (size <= RANDOM_SOURCE.length) {
    const startIndex = Math.floor(Math.random() * (RANDOM_SOURCE.length - size));
    return RANDOM_SOURCE.slice(startIndex, startIndex + size);
  } else {
    let result = '';
    while (result.length < size) {
      result += RANDOM_SOURCE;
    }
    return result.slice(0, size);
  }
}

function simpleChecksum(str: string): number {
  let sum = 0;
  for (let i = 0; i < str.length; i++) {
    sum = (sum + str.charCodeAt(i)) & 0xFFFFFFFF; // Keep it a 32-bit integer
  }
  return sum;
}

const UNICODE_TEST_STRING = `
abcdefghijklmnopqrstuvwxyz1234
我的气球里有鳗鱼你知道吗这是一个很长的句子
абвгдеёжзийклмнопрстуфхцчшщъыьэюя
ابتثجحخدذرزسشصضطظعغفقكلمنهوي
अआइईउऊऋऌऍऎएऐऑऒओऔकखगघङचछजझञटठडढण
αβγδεζηθικλμνξοπρστυφχψωΑΒΓΔΕΖΗΘ
가나다라마바사아자차카타파하거너더러머버서
אבגדהוזחטיכלמנסעפצקרשתךםןףץ
あいうえおかきくけこさしすせそたちつてとなにぬねの
กขฃคฅฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภ
աբգդեզէըթժիլխծկհձղճմյնշոչպջռսվտրցւփ
অআইঈউঊঋঌএঐওঔকখগঘঙচছজঝঞটঠডঢণতথদধন
აბგდევზთიკლმნოპჟრსტუფქღყშჩცძწჭხჯჰ
અઆઇઈઉઊઋઌઍએઐઑઓઔકખગઘઙચછજઝઞટઠડઢણ
ಅಆಇಈಉಊಋಌಎಏಐಒಓಔಕಖಗಘಙಚಛಜಝಞಟಠಡಢಣ
അആഇഈഉഊഋഌഎഏഐഒഓഔകഖഗഘങചഛജഝഞടഠഡ
அஆஇஈஉஊஎஏஐஒஓஔகஙசஞடணதநனபமயரலவழளறன
అआइईउऊऋऌఎఏఐఒఓఔకఖగఘఙచఛజఝఞటఠడఢణ
ཀཁགངཅཆཇཉཏཐདནཔཕབམཙཚཛཝཞཟའཡརལཤསཧཨ
ሀለሐመሠረሰሸቀበተኀነአከወዐዘየደገጠጰጸፀፈፐ
`;


export const aixRouter = createTRPCRouter({

  streamingChatGenerate: publicProcedure
    .input(aixChatGenerateInputSchema)
    // .output(llmsChatGenerateWithFunctionsOutputSchema)
    .mutation(async function* ({ input: { tools, toolPolicy } }) {

      console.log('Input received, starting generation', tools);

      const minSize = 1; // 1 byte
      const maxSize = 10 * 1024 * 1024; // 10 MB max
      const numObjects = 10;
      let sequenceNumber = 1;

      const sizes = [minSize, maxSize];
      for (let i = 0; i < numObjects - 2; i++) {
        sizes.push(getRandomSize(minSize, maxSize));
      }
      sizes.sort(() => Math.random() - 0.5);

      console.log(`Sizes generated: ${sizes.join(', ')} bytes`);

      for (const size of sizes) {
        const base64Data = generateRandomBase64(size);
        const checksum = simpleChecksum(base64Data);

        console.log(`Sequence: ${sequenceNumber}, Size: ${size} bytes, Checksum: ${checksum}`);

        yield {
          data: base64Data,
          size: size,
          checksum: checksum,
          sequenceNumber: sequenceNumber++,
        };

        // Small delay to allow for better streaming behavior
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      yield {
        partial: UNICODE_TEST_STRING,
      };


      // Burst of small packets
      console.log('Generating burst of small packets');
      for (let i = 0; i < 1000; i++) {
        const size = getRandomSize(1, 100); // Small size between 1 and 100 bytes
        const base64Data = generateRandomBase64(size);
        const checksum = simpleChecksum(base64Data);

        console.log(`Sequence: ${sequenceNumber}, Size: ${size} bytes, Checksum: ${checksum}`);

        yield {
          owner: 'enrico',
        };

        yield {
          data: base64Data,
          size: size,
          checksum: checksum,
          sequenceNumber: sequenceNumber++,
        };

        // No delay between small packets to simulate burst
      }

      // Intertwined small and large packets
      console.log('Generating intertwined small and large packets');
      for (let i = 0; i < 20; i++) {
        // Small packet
        let size = getRandomSize(1, 100);
        let base64Data = generateRandomBase64(size);
        let checksum = simpleChecksum(base64Data);

        console.log(`Sequence: ${sequenceNumber}, Size: ${size} bytes, Checksum: ${checksum}`);

        yield {
          data: base64Data,
          size: size,
          checksum: checksum,
          sequenceNumber: sequenceNumber++,
        };

        // Large packet
        size = getRandomSize(1 * 1024 * 1024, 10 * 1024 * 1024); // 1MB to 10MB
        base64Data = generateRandomBase64(size);
        checksum = simpleChecksum(base64Data);

        console.log(`Sequence: ${sequenceNumber}, Size: ${size} bytes, Checksum: ${checksum}`);

        yield {
          data: base64Data,
          size: size,
          checksum: checksum,
          sequenceNumber: sequenceNumber++,
        };

        await new Promise(resolve => setTimeout(resolve, 10));
      }

      return sequenceNumber - 1;

    }),

});
