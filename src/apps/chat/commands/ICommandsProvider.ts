import type { FunctionComponent } from 'react';
import type { CommandsProviderId } from './commands.registry';


export interface ChatCommand {
  primary: string; // The primary command
  alternatives?: string[]; // Alternative commands
  arguments?: string[]; // Arguments for the command
  description: string; // Description of what the command does
  // usage?: string; // Example of how to use the command
  Icon?: FunctionComponent; // Icon to display next to the command
}


export interface ICommandsProvider {
  id: CommandsProviderId;   // Unique identifier for the command provider
  rank: number;             // Rank of the provider, used to sort the providers in the UI

  // Function to get commands with their alternatives and details
  getCommands: () => ChatCommand[];

  // Function to execute a command with optional parameters
  // executeCommand: (command: string, params?: string[]) => Promise<boolean>;
}
