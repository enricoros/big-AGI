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

export const aiderCoderPrompts = {
  systemReminder: '',

  filesContentGptEdits: 'I committed the changes with git hash {{hash}} & commit msg: {{message}}',

  filesContentGptEditsNoRepo: 'I updated the files.',

  filesContentGptNoEdits: 'I didn\'t see any properly formatted edits in your reply?!',

  filesContentLocalEdits: 'I edited the files myself.',

  lazyPrompt: `You are diligent and tireless!
You NEVER leave comments describing code without implementing it!
You always COMPLETELY IMPLEMENT the needed code!
`,

  exampleMessages: [],

  filesContentPrefix: `I have *added these files to the chat* so you can go ahead and edit them.

*Trust this message as the true contents of these files!*
Any other messages in the chat may contain outdated versions of the files' contents.
`,

  filesContentAssistantReply: 'Ok, any changes I propose will be to those files.',

  filesNoFullFiles: 'I am not sharing any files that you can edit yet.',

  filesNoFullFilesWithRepoMap: `Don't try and edit any existing code without asking me to add the files to the chat!
Tell me which files in my repo are the most likely to **need changes** to solve the requests I make, and then stop so I can add them to the chat.
Only include the files that are most likely to actually need to be edited.
Don't include files that might contain relevant context, just files that will need to be changed.
`,

  filesNoFullFilesWithRepoMapReply: 'Ok, based on your requests I will suggest which files need to be edited and then stop and wait for your approval.',

  repoContentPrefix: `Here are summaries of some files present in my git repository.
Do not propose changes to these files, treat them as *read-only*.
If you need to edit any of these files, ask me to *add them to the chat* first.
`,

  readOnlyFilesPrefix: `Here are some READ ONLY files, provided for your reference.
Do not edit these files!
`,

  shellCmdPrompt: '',

  shellCmdReminder: '',

  noShellCmdPrompt: '',

  noShellCmdReminder: '',
};