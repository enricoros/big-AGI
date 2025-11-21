import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Button, ColorPaletteProp } from '@mui/joy';

import type { ContentScaling } from '~/common/app.theme';
import type { InterleavedFragment } from '~/common/stores/chat/hooks/useFragmentBuckets';
import { DMessageTextPart, isTextContentFragment } from '~/common/stores/chat/chat.fragments';


// configuration
const OPTION_ACTIVE_COLOR: ColorPaletteProp = 'neutral';
const OPTION_DEBUG_PARSER = false;
const OPTION_MAX_LENGTH = 100;
const OPTION_MAX_OPTIONS = 8;
const OPTION_MIN_OPTIONS = 2;

/*
const containerSx: SxProps = {
  marginInlineStart: 1.5,
  // backgroundColor: `${OPTION_ACTIVE_COLOR}.softBg`,
  // borderRadius: 'lg',
  // p: 1,

  // layout
  // display: 'flex',
  // flexDirection: 'column',
  // gap: 1,
};
*/
const optionGroupSx: SxProps = {
  marginInlineStart: 1.5,

  // flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: 0,
};

const optionSx: SxProps = {
  // style
  fontWeight: 'normal',
  // px: 1.5,
  py: 0.5,
  minHeight: '1rem',
  color: 'text.primary',
  // borderRadius: 'sm',
  borderRadius: '1rem',
  // width: '100%',
  textAlign: 'inherit',

  // layout
  justifyContent: 'flex-start',
};


export function optionsExtractFromFragments_dangerModifyFragment(enabled: boolean, fragments: InterleavedFragment[]): { fragments: InterleavedFragment[], options: string[] } {
  if (enabled && fragments.length) {
    const fragment = fragments[fragments.length - 1];
    if (isTextContentFragment(fragment)) {
      const parsed = _parseOptionsFromText(fragment.part.text);
      if (parsed) {
        return {
          fragments: [...fragments.slice(0, fragments.length - 1), {
            ...fragment,
            part: {
              ...fragment.part,
              text: parsed.beforeText,
            } satisfies DMessageTextPart,
          }],
          options: parsed.options,
        };
      }
    }
  }
  return { fragments: fragments, options: [] };
}


const debugParser = (...args: any[]) => console.log('[DEV] parseOptions:', ...args);

/**
 * Hand rolled parser to extract options from a text string.
 * We check if the string is followed by '- ...' or '1. ...' list items.
 * We also check if the former string ends with ':' or '?', which indicates the start of an option list.
 * If any condition is not met, we abort parsing.
 */
function _parseOptionsFromText(text: string): { beforeText: string; options: string[] } | null {

  const options: string[] = [];
  let remainingText = text.trimEnd();
  let inOL = false;
  let inUL = false;
  let nlCount = 0;

  while (true) {

    // get the last line of text (-1 is okay, as it's the last line)
    const prevNewlineIdx = remainingText.lastIndexOf('\n');
    const chunk = remainingText.slice(prevNewlineIdx + 1);

    // check if it's a list item
    if (chunk.startsWith('- ') || chunk.startsWith('* ') || chunk.startsWith('+ ') || chunk.startsWith('• ')) {
      if (inOL) {
        if (OPTION_DEBUG_PARSER) debugParser('switched from OL to UL (end)');
        return null;
      }
      inUL = true;
      nlCount = 0;
      if (chunk.length > OPTION_MAX_LENGTH) {
        if (OPTION_DEBUG_PARSER) debugParser('UL option too long (end)');
        return null;
      }
      // only for UL we want to remove the list marker
      options.unshift(chunk.slice(2));
    } else if (/^\d+\.\s/.test(chunk)) {
      if (inUL) {
        if (OPTION_DEBUG_PARSER) debugParser('switched from UL to OL (end)');
        return null;
      }
      inOL = true;
      nlCount = 0;
      if (chunk.length > OPTION_MAX_LENGTH) {
        if (OPTION_DEBUG_PARSER) debugParser('OL option too long (end)');
        return null;
      }
      options.unshift(chunk);
    } else if (chunk.trim() === '') {
      nlCount++;
      if (nlCount > 1) {
        if (OPTION_DEBUG_PARSER) debugParser('two newlines (end)');
        return null;
      }
    } else if (remainingText.endsWith(':') || remainingText.endsWith('?') /*|| remainingText.endsWith('.')*/) {
      if (options.length >= OPTION_MIN_OPTIONS) {
        if (OPTION_DEBUG_PARSER) debugParser('found options (end)', remainingText);
        return { beforeText: remainingText, options };
      }
      if (OPTION_DEBUG_PARSER) debugParser('not enough options (end)');
      return null;
    } else {
      if (OPTION_DEBUG_PARSER) debugParser('not a list item (end)');
      return null;
    }

    // end when too many options
    if (options.length > OPTION_MAX_OPTIONS) {
      if (OPTION_DEBUG_PARSER) debugParser('too many options (end)');
      return null;
    }

    if (prevNewlineIdx === -1) {
      if (OPTION_DEBUG_PARSER) debugParser('no more newlines (end)');
      return null;
    }
    remainingText = remainingText.slice(0, prevNewlineIdx);
    if (OPTION_DEBUG_PARSER) debugParser({ prevNewlineIdx, chunk, remainingText });
  }
}

export function BlockOpOptions(props: {
  contentScaling: ContentScaling,
  options: string[],
  onContinue: (continueText: null | string) => void,
}) {
  const buttonSx = React.useMemo(() => ({ ...optionSx, fontSize: props.contentScaling }), [props.contentScaling]);
  return (
    <Box sx={optionGroupSx}>
      {props.options.map((option, index) => (
        <Button
          key={index}
          color={OPTION_ACTIVE_COLOR}
          variant='soft'
          size={props.contentScaling === 'md' ? 'md' : 'sm'}
          onClick={() => props.onContinue(option.endsWith('?') ? option.slice(0, -1) : option)}
          sx={buttonSx}
        >
          {option}
        </Button>
      ))}
    </Box>
  );
}


// PARSER TESTING
/*
const createFragment = (text: string): DMessageFragment => createTextContentFragment(text);

const runTest = (input: string, expectedBeforeText: string | null, expectedOptions: string[]) => {
  const fragments = [createFragment(input)];
  const { renderContentOrVoidFragments, renderOptions } = optionsExtractFromFragments_dangerModifyFragment(true, fragments);

  if (!expectedBeforeText) {
    // expect no parsing/modification
    assert.deepStrictEqual(renderContentOrVoidFragments, fragments);
    assert.deepStrictEqual(renderOptions, []);
    return;
  }

  // expect successful parsing
  assert.strictEqual(((renderContentOrVoidFragments[0] as DMessageContentFragment).part as any).text, expectedBeforeText);
  assert.deepStrictEqual(renderOptions, expectedOptions);
};

describe('Options Parser', () => {

  describe('Basic Functionality', () => {
    it('should not parse when disabled', () => {
      const fragments = [createFragment('Choose:\n1. Option A\n2. Option B')];
      const result = optionsExtractFromFragments_dangerModifyFragment(false, fragments);
      assert.deepStrictEqual(result.renderContentOrVoidFragments, fragments);
      assert.deepStrictEqual(result.renderOptions, []);
    });

    it('should handle empty fragments', () => {
      const result = optionsExtractFromFragments_dangerModifyFragment(true, []);
      assert.deepStrictEqual(result.renderContentOrVoidFragments, []);
      assert.deepStrictEqual(result.renderOptions, []);
    });
  });

  describe('Unordered Lists', () => {
    it('should parse simple unordered list', () => {
      runTest(
        'Choose one:\n- Option A\n- Option B\n- Option C',
        'Choose one:',
        ['Option A', 'Option B', 'Option C'],
      );
    });

    it('should parse with asterisks', () => {
      runTest(
        'Pick one:\n* First\n* Second',
        'Pick one:',
        ['First', 'Second'],
      );
    });

    it('should parse with plus signs', () => {
      runTest(
        'Select:\n+ One\n+ Two',
        'Select:',
        ['One', 'Two'],
      );
    });

    it('should fail on mixed list markers', () => {
      runTest(
        'Choose:\n- First\n1. Second',
        null,
        [],
      );
    });
  });

  describe('Ordered Lists', () => {
    it('should parse simple ordered list', () => {
      runTest(
        'Select one:\n1. First option\n2. Second option',
        'Select one:',
        ['1. First option', '2. Second option'],
      );
    });

    it('should handle non-sequential numbers', () => {
      runTest(
        'Pick:\n1. First\n3. Third',
        'Pick:',
        ['1. First', '3. Third'],
      );
    });
  });

  describe('List Requirements', () => {
    it('should require minimum options', () => {
      runTest(
        'Choose:\n- Just one option',
        null,
        [],
      );
    });

    it('should limit maximum options', () => {
      runTest(
        'Many:\n- One\n- Two\n- Three\n- Four\n- Five\n- Six',
        null,
        [],
      );
    });

    it('should require prompt ending with : or ?', () => {
      runTest(
        'Options\n- One\n- Two',
        null,
        [],
      );
    });

    it('should accept question mark ending', () => {
      runTest(
        'Which one?\n- Option A\n- Option B',
        'Which one?',
        ['Option A', 'Option B'],
      );
    });
  });

  describe('Formatting Rules', () => {
    it('should handle extra whitespace', () => {
      runTest(
        'Choose:\n\n- Option A\n\n- Option B',
        'Choose:',
        ['Option A', 'Option B'],
      );
    });

    it('should reject options exceeding length limit', () => {
      runTest(
        'Pick:\n- ' + 'A'.repeat(101),
        null,
        [],
      );
    });

    it('should maintain original text when no list found', () => {
      const text = 'Just a regular message without options';
      runTest(text, null, []);
    });
  });

  describe('Mixed Content', () => {
    it('should handle text before options', () => {
      runTest(
        'This is a long explanation.\nHere are your choices:\n- Option A\n- Option B',
        'This is a long explanation.\nHere are your choices:',
        ['Option A', 'Option B'],
      );
    });

    it('should reject mixed list types', () => {
      runTest(
        'Choose:\n1. First\n- Second',
        null,
        [],
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty input', () => runTest('', null, []));
    it('should handle empty input', () => runTest('\n', null, []));
    it('should handle empty input', () => runTest('\n\n', null, []));
    it('should handle empty input', () => runTest('\na\n', null, []));
    it('should handle empty input', () => runTest('a\n\n', null, []));
    it('should handle empty input', () => runTest('\n\na', null, []));
    it('should handle empty input', () => runTest('\na', null, []));
    it('should handle empty input', () => runTest('a', null, []));
    it('should handle empty input', () => runTest('test:\n- aa', null, []));

    it('should handle empty options', () => {
      runTest(
        'Choose:\n- \n- ',
        null,
        [],
      );
    });

    it('should handle single character options', () => {
      runTest(
        'Pick:\n- A\n- B',
        'Pick:',
        ['A', 'B'],
      );
    });

    it('should handle options with special characters', () => {
      runTest(
        'Select:\n- Option #1!\n- Option @2?',
        'Select:',
        ['Option #1!', 'Option @2?'],
      );
    });
  });

});
*/