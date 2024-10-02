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

import { aiderCoderPrompts } from './coderPrompts';
import { exampleMessages, getMainSystemPrompt, getNoShellCmdPrompt, getSystemReminder } from './editBlockPrompts';

type ChatMessage = {
  role: 'user' | 'assistant' | 'system';
  text: string;
}

/**
 * Builds a EditBlock-style prompt.
 *
 * @param userMessage The request from the user.
 * @param platformMessage example: 'The user will apply the edits automatically without further review.'
 * @param isModelLazy False for powerful models.
 * @param useSystemPrompt True to put the main system prompt as a system message.
 */
export function getEditBlockDiffPrompt(userMessage: string, platformMessage: string, isModelLazy: boolean, useSystemPrompt: boolean): ChatMessage[] {
  const history: ChatMessage[] = [];

  // 1. main system prompt
  const lazyPrompt = isModelLazy ? aiderCoderPrompts.lazyPrompt : '';
  const noShellPrompt = getNoShellCmdPrompt(platformMessage);
  let mainSysPrompt = getMainSystemPrompt(lazyPrompt, noShellPrompt);
  if (exampleMessages.length > 0) {
    mainSysPrompt += '\n# Example conversations:\n\n';
    for (const example of exampleMessages)
      mainSysPrompt += `## ${example.role.toUpperCase()}: ${example.content}\n\n`;
  }
  // mainSysPrompt = mainSysPrompt.trim();
  const mainSysReminder = getSystemReminder(lazyPrompt, '');
  mainSysPrompt += '\n' + mainSysReminder;

  if (useSystemPrompt)
    history.push({
      role: 'system', text: mainSysPrompt,
    });
  else
    history.push({
      role: 'user', text: mainSysPrompt,
    }, {
      role: 'assistant', text: 'Ok.',
    });

  // [...] examples, readonly_files, repo, done, **chat_files**, **cur**, **reminder**

  // 6. chat_files
  history.push({
    role: 'user', text: aiderCoderPrompts.filesNoFullFilesWithRepoMap,
  }, {
    role: 'assistant', text: aiderCoderPrompts.filesNoFullFilesWithRepoMapReply,
  });

  // 7. cur + reminder
  userMessage = userMessage + '\n' + getSystemReminder(lazyPrompt, '');
  history.push({
    role: 'user', text: userMessage,
  });

  return history;
}