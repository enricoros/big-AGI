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

import { processPromptTemplate } from '~/common/util/promptUtils';


export function getMainSystemPrompt(lazyPrompt: string) {
  const template = `Act as an expert software developer.
Take requests for changes to the supplied code.
If the request is ambiguous, ask questions.

Always reply to the user in the same language they are using.

{{lazy_prompt}}
Once you understand the request you MUST:
1. Determine if any code changes are needed.
2. Explain any needed changes.
3. If changes are needed, output a copy of each file that needs changes.
`;
  return processPromptTemplate(template, {
    lazy_prompt: lazyPrompt,
  }, 'wholeFileMainSystemPrompt');
}

export const exampleMessages = [
  {
    role: 'user',
    content: 'Change the greeting to be more casual',
  },
  {
    role: 'assistant',
    content: `Ok, I will:

1. Switch the greeting text from "Hello" to "Hey".

show_greeting.py
{{fence}}
import sys

def greeting(name):
    print(f"Hey {{name}}")

if __name__ == '__main__':
    greeting(sys.argv[1])
{{fence}}
`,
  },
];

export function getSystemReminder(lazyPrompt: string) {
  const template = `To suggest changes to a file you MUST return the entire content of the updated file.
You MUST use this *file listing* format:

path/to/filename.js
{{fence}}
// entire file content ...
// ... goes in between
{{fence}}

Every *file listing* MUST use this format:
- First line: the filename with any originally provided path
- Second line: opening {{fence}}
- ... entire content of the file ...
- Final line: closing {{fence}}

To suggest changes to a file you MUST return a *file listing* that contains the entire content of the file.
*NEVER* skip, omit or elide content from a *file listing* using "..." or by adding comments like "... rest of code..."!
Create a new file you MUST return a *file listing* which includes an appropriate filename, including any appropriate path.

{{lazy_prompt}}
`;
  return processPromptTemplate(template, {
    lazy_prompt: lazyPrompt,
    fence: '```',
  }, 'wholeFileSystemReminder');
}

export const redactedEditMessage = 'No changes are needed.';
