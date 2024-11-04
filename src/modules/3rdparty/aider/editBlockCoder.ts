/*
 * This file includes code derived from Aider (https://github.com/paul-gauthier/aider)
 * Originally licensed under the Apache License, Version 2.0
 * Modifications and translations to JavaScript made by Enrico Ros
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import fs from 'fs';
import path from 'path';

interface Edit {
  path: string;
  original: string;
  updated: string;
}

class EditBlockCoder {
  private partialResponseContent: string;
  private fence: [string, string];
  private filenames: string[]; // List of valid filenames
  private io: IO;

  constructor(
    partialResponseContent: string,
    fence: [string, string],
    filenames: string[], // Pass in your list of filenames
    io: IO,
  ) {
    this.partialResponseContent = partialResponseContent;
    this.fence = fence;
    this.filenames = filenames;
    this.io = io;
  }

  /**
   * Identifies all edits from the content.
   */
  public getEdits(): Edit[] {
    const content = this.partialResponseContent;
    // Extract edits from the content
    const edits = findOriginalUpdateBlocks(
      content,
      this.fence,
      this.filenames,
    );

    return edits;
  }

  /**
   * Applies all edits to the respective files.
   */
  public applyEdits(edits: Edit[]): void {
    const failed: Edit[] = [];
    const passed: Edit[] = [];

    for (const edit of edits) {
      const { path: relativePath, original, updated } = edit;
      let fullPath = this.absRootPath(relativePath);

      if (!fs.existsSync(fullPath)) {
        console.warn(`File ${relativePath} does not exist. Skipping edit.`);
        failed.push(edit);
        continue;
      }

      let content = this.io.readText(fullPath);
      let newContent = doReplace(fullPath, content, original, updated, this.fence);

      if (newContent) {
        this.io.writeText(fullPath, newContent);
        passed.push(edit);
      } else {
        failed.push(edit);
      }
    }

    if (failed.length > 0) {
      this.handleFailedEdits(failed, passed);
    }
  }

  /**
   * Handles edits that failed to apply.
   */
  private handleFailedEdits(failed: Edit[], passed: Edit[]): void {
    const blocks = failed.length === 1 ? 'block' : 'blocks';
    let message = `# ${failed.length} SEARCH/REPLACE ${blocks} failed to match!\n`;

    for (const edit of failed) {
      const { path, original, updated } = edit;

      const fullPath = this.absRootPath(path);
      const content = this.io.readText(fullPath);

      message += `
## SearchReplaceNoExactMatch: This SEARCH block failed to exactly match lines in ${path}
<<<<<<< SEARCH
${original}=======
${updated}>>>>>>> REPLACE

`;
      const suggestion = findSimilarLines(original, content);
      if (suggestion) {
        message += `Did you mean to match some of these actual lines from ${path}?

${this.fence[0]}
${suggestion}
${this.fence[1]}

`;
      }

      if (updated && content.includes(updated)) {
        message += `Are you sure you need this SEARCH/REPLACE block?
The REPLACE lines are already in ${path}!

`;
      }
    }

    message += `The SEARCH section must exactly match an existing block of lines including all whitespace, comments, indentation, docstrings, etc.\n`;

    if (passed.length > 0) {
      const pblocks = passed.length === 1 ? 'block' : 'blocks';
      message += `
# The other ${passed.length} SEARCH/REPLACE ${pblocks} were applied successfully.
Don't re-send them.
Just reply with fixed versions of the ${blocks} above that failed to match.
`;
    }

    throw new Error(message);
  }

  /**
   * Resolves a relative path to an absolute path.
   */
  private absRootPath(relPath: string): string {
    // Replace with your application's root directory logic if needed
    return path.resolve(process.cwd(), relPath);
  }
}

// Helper classes and functions

/**
 * IO class for reading and writing files.
 */
class IO {
  public readText(filePath: string): string {
    return fs.readFileSync(filePath, 'utf8');
  }

  public writeText(filePath: string, content: string): void {
    fs.writeFileSync(filePath, content, 'utf8');
  }
}

/**
 * Parses the content to find original and updated blocks.
 */
function findOriginalUpdateBlocks(
  content: string,
  fence: [string, string],
  validFnames: string[] = [],
): Edit[] {
  const edits: Edit[] = [];
  const lines = content.split('\n');
  let i = 0;
  let currentFilename: string | null = null;

  const headPattern = /^<{5,9} SEARCH/;
  const dividerPattern = /^={5,9}$/;
  const updatedPattern = /^>{5,9} REPLACE/;

  while (i < lines.length) {
    let line = lines[i];

    // Handle SEARCH/REPLACE blocks
    if (headPattern.test(line.trim())) {
      let filename = findFilename(lines.slice(Math.max(0, i - 3), i), fence, validFnames);
      filename = filename || currentFilename;
      if (!filename) {
        throw new Error(`Bad/missing filename before the fence ${fence[0]}`);
      }
      currentFilename = filename;

      const originalText: string[] = [];
      i += 1;
      while (i < lines.length && !dividerPattern.test(lines[i].trim())) {
        originalText.push(lines[i]);
        i += 1;
      }
      if (i >= lines.length || !dividerPattern.test(lines[i].trim())) {
        throw new Error(`Expected '======='`);
      }

      const updatedText: string[] = [];
      i += 1;
      while (i < lines.length && !updatedPattern.test(lines[i].trim()) && !dividerPattern.test(lines[i].trim())) {
        updatedText.push(lines[i]);
        i += 1;
      }
      if (i >= lines.length || (!updatedPattern.test(lines[i].trim()) && !dividerPattern.test(lines[i].trim()))) {
        throw new Error(`Expected '>>>>>>> REPLACE' or '======='`);
      }

      edits.push({
        path: filename,
        original: originalText.join('\n'),
        updated: updatedText.join('\n'),
      });
    }
    i += 1;
  }

  return edits;
}

/**
 * Tries to find the filename from previous lines.
 */
function findFilename(
  lines: string[],
  fence: [string, string],
  validFnames: string[],
): string | null {
  const reversedLines = [...lines].reverse();
  const filenames: string[] = [];

  for (const line of reversedLines.slice(0, 3)) {
    const filename = stripFilename(line, fence);
    if (filename) filenames.push(filename);
    if (!line.startsWith(fence[0])) break;
  }

  if (filenames.length === 0) return null;

  // Check for exact match
  for (const fname of filenames) {
    if (validFnames.includes(fname)) return fname;
  }

  // Check for basename match
  for (const fname of filenames) {
    for (const vfname of validFnames) {
      if (fname === path.basename(vfname)) return vfname;
    }
  }

  // Return the first filename with an extension
  return filenames.find(fname => fname.includes('.')) || filenames[0];
}

/**
 * Strips wrapping characters from the filename.
 */
function stripFilename(filename: string, fence: [string, string]): string | null {
  filename = filename.trim();

  if (filename === '...') return null;

  if (filename.startsWith(fence[0])) return null;

  filename = filename.replace(/[:#`*]/g, '').trim();
  return filename || null;
}

/**
 * Performs the replacement in the file content.
 */
function doReplace(
  fname: string,
  content: string,
  beforeText: string,
  afterText: string,
  fence: [string, string],
): string | null {
  beforeText = stripQuotedWrapping(beforeText, fname, fence);
  afterText = stripQuotedWrapping(afterText, fname, fence);

  // Handle new file creation
  if (!fs.existsSync(fname) && !beforeText.trim()) {
    fs.writeFileSync(fname, '', 'utf8');
    content = '';
  }

  if (!content) return null;

  if (!beforeText.trim()) {
    // Append to existing file
    return content + afterText;
  } else {
    const newContent = replaceMostSimilarChunk(content, beforeText, afterText);
    return newContent || null;
  }
}

/**
 * Strips quoted wrapping from the text.
 */
function stripQuotedWrapping(
  text: string,
  fname: string | undefined,
  fence: [string, string],
): string {
  if (!text) return text;

  let lines = text.split('\n');

  if (fname && lines[0].trim().endsWith(path.basename(fname))) {
    lines.shift();
  }

  if (lines[0].startsWith(fence[0]) && lines[lines.length - 1].startsWith(fence[1])) {
    lines = lines.slice(1, -1);
  }

  let result = lines.join('\n');
  if (result && !result.endsWith('\n')) result += '\n';

  return result;
}

/**
 * Attempts to replace the most similar chunk in the content.
 */
function replaceMostSimilarChunk(
  whole: string,
  part: string,
  replace: string,
): string | null {
  const wholeLines = whole.endsWith('\n') ? whole : whole + '\n';
  const partLines = part.endsWith('\n') ? part : part + '\n';
  const replaceLines = replace.endsWith('\n') ? replace : replace + '\n';

  const wholeArray = wholeLines.split('\n');
  const partArray = partLines.split('\n');
  const replaceArray = replaceLines.split('\n');

  // Try for an exact match
  const result = perfectReplace(wholeArray, partArray, replaceArray);

  if (result) return result.join('\n');

  // Try matching while ignoring leading whitespace
  const whitespaceResult = replaceIgnoringLeadingWhitespace(wholeArray, partArray, replaceArray);

  if (whitespaceResult) return whitespaceResult.join('\n');

  return null;
}

/**
 * Performs a perfect replacement if an exact match is found.
 */
function perfectReplace(
  whole: string[],
  part: string[],
  replace: string[],
): string[] | null {
  const partStr = part.join('\n');
  for (let i = 0; i <= whole.length - part.length; i++) {
    const slice = whole.slice(i, i + part.length).join('\n');
    if (slice === partStr) {
      return [...whole.slice(0, i), ...replace, ...whole.slice(i + part.length)];
    }
  }
  return null;
}

/**
 * Replaces content while ignoring leading whitespace differences.
 */
function replaceIgnoringLeadingWhitespace(
  whole: string[],
  part: string[],
  replace: string[],
): string[] | null {
  for (let i = 0; i <= whole.length - part.length; i++) {
    const slice = whole.slice(i, i + part.length);
    const match = slice.every((line, idx) => line.trimStart() === part[idx].trimStart());
    if (match) {
      // Adjust leading whitespace based on the existing content
      const leadingWhitespace = slice[0].match(/^\s*/)?.[0] || '';
      const adjustedReplace = replace.map(line => leadingWhitespace + line.trimStart());
      return [...whole.slice(0, i), ...adjustedReplace, ...whole.slice(i + part.length)];
    }
  }
  return null;
}

/**
 * Finds similar lines in the content to provide suggestions.
 */
function findSimilarLines(
  searchLines: string,
  contentLines: string,
  threshold: number = 0.6,
): string {
  const searchArray = searchLines.split('\n');
  const contentArray = contentLines.split('\n');

  let bestRatio = 0;
  let bestMatch: string[] | null = null;
  let bestMatchIndex = -1;

  for (let i = 0; i <= contentArray.length - searchArray.length; i++) {
    const chunk = contentArray.slice(i, i + searchArray.length);
    const ratio = stringSimilarity(searchArray.join('\n'), chunk.join('\n'));
    if (ratio > bestRatio) {
      bestRatio = ratio;
      bestMatch = chunk;
      bestMatchIndex = i;
    }
  }

  if (bestRatio < threshold || !bestMatch) return '';

  // Show context around the best match
  const N = 5;
  const start = Math.max(0, bestMatchIndex - N);
  const end = Math.min(contentArray.length, bestMatchIndex + searchArray.length + N);

  return contentArray.slice(start, end).join('\n');
}

/**
 * Calculates the similarity between two strings.
 */
function stringSimilarity(str1: string, str2: string): number {
  let longer = str1;
  let shorter = str2;
  if (str1.length < str2.length) {
    longer = str2;
    shorter = str1;
  }
  const longerLength = longer.length;
  if (longerLength === 0) {
    return 1.0;
  }
  return (longerLength - editDistance(longer, shorter)) / longerLength;
}

/**
 * Computes the edit distance between two strings.
 */
function editDistance(s1: string, s2: string): number {
  s1 = s1.toLowerCase();
  s2 = s2.toLowerCase();

  const costs: number[] = [];
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0)
        costs[j] = j;
      else {
        if (j > 0) {
          let newValue = costs[j - 1];
          if (s1.charAt(i - 1) !== s2.charAt(j - 1))
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
    }
    if (i > 0)
      costs[s2.length] = lastValue;
  }
  return costs[s2.length];
}