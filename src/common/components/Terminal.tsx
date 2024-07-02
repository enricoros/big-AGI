import React from 'react';
import { ReactTerminal, TerminalContextProvider } from 'react-terminal';

/* https://github.com/bony2023/react-terminal */

export const commandHandler = (command: string) =>
  fetch(`api/terminal/commands`, { method: 'POST', body: JSON.stringify({ command }) });

export function Terminal() {
  const commands = {
    whoami: 'guest',
    cd: (directory: string = '~') => `changed path to ${directory}`,
  };

  return (
    <ReactTerminal
      commands={commands}
      handler={commandHandler}
      //   themes={{
      //     'my-custom-theme': {
      //       themeBGColor: '#272B36',
      //       themeToolbarColor: '#DBDBDB',
      //       themeColor: '#FFFEFC',
      //       themePromptColor: '#a917a8',
      //     },
      //   }}
      prompt=" $ "
      theme="dracula"
      //   theme="my-custom-theme"
    />
  );
}
