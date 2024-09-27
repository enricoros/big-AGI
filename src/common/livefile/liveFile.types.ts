export interface LiveFile {
  // literals
  readonly id: LiveFileId;                 // Unique identifier for the LiveFile
  readonly fsHandle: FileSystemFileHandle; // File system handle for file operations

  // last-reloaded content of the file
  content: string | null;         // File content (null if not loaded / last loading failed)

  // metadata
  name: string;                   // File name
  type: string;                   // MIME type of the file
  size: number;                   // File size in bytes
  lastModified: number;           // Last modification timestamp
  created: number;                // Creation timestamp of the LiveFile (not the file itself)

  // dynamic state
  isLoading: boolean;             // Whether the file is currently being loaded
  isSaving: boolean;              // Whether the file is currently being saved
  error: string | null;           // Any error message related to file operations

  // unused
  // references: Set<string>;        // IDs of components/conversations referencing this file

}

export type LiveFileId = string;

// cherry pick some fields from LiveFile
export type LiveFileMetadata = Pick<LiveFile,
  | 'id'                          // Unique identifier matching the LiveFile
  | 'name'                        // File name
  | 'type'                        // MIME type of the file
  | 'size'                        // File size in bytes
  | 'lastModified'                // Last modification timestamp
  | 'created'                     // Creation timestamp of the LiveFile
> & {
  isPairingValid: boolean;        // Whether the file has a valid file system handle and can be operated on
  // referenceCount: number;         // Number of references to this file
};
