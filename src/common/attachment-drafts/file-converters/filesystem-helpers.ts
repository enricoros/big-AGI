import type { FileWithHandle } from 'browser-fs-access';


/// Preservation of Handles/Files during data transfers

/**
 * Extracts file system handles or files from a list of data transfer items.
 * Note: the main purpose of this function is to get all the files/handles upfront in a datatransfer,
 * as those objects expire with async operations.
 */
export function extractFileSystemHandlesOrFiles(items: DataTransferItemList) {
  const results: (File | Promise<FileSystemFileHandle | FileSystemDirectoryHandle | null>)[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.kind !== 'file')
      continue;

    // extract file system handle if available
    if ('getAsFileSystemHandle' in item && typeof item.getAsFileSystemHandle === 'function') {
      try {
        const handle = item.getAsFileSystemHandle();
        if (handle)
          results.push(handle);
        continue;
      } catch (error) {
        console.error('Error getting file system handle:', error);
      }
    }

    // extract file if no handle available
    const file = item.getAsFile();
    if (file)
      results.push(file);
  }

  return results;
}

export function mightBeDirectory(file: File) {
  // Note: this doesn't even work, as Firefox reports directories with size > 0 on windows (e.g. 4096)
  return file.type === '' && file.size === 0;
}


/// Folder traversal

/**
 * Extending the `FileSystemDirectoryHandle` with a `values` method to iterate over the directory contents.
 * This is as defined in https://fs.spec.whatwg.org/#filesystemdirectoryhandle (File System Standard, Last Updated 28 June 2024).
 */
interface ExplorableFileSystemDirectoryHandle extends FileSystemDirectoryHandle {
  values?: () => AsyncIterable<FileSystemHandle>;
}

export async function getAllFilesFromDirectoryRecursively(directoryHandle: FileSystemDirectoryHandle): Promise<FileWithHandle[]> {
  const files: FileWithHandle[] = [];

  async function traverseDirectory(dirHandle: ExplorableFileSystemDirectoryHandle) {
    if ('values' in dirHandle && typeof dirHandle.values === 'function') {
      for await (const handle of dirHandle.values()) {
        if (handle.kind === 'file') {
          const fileHandle = handle as FileSystemFileHandle;
          const file = await fileHandle.getFile();
          (file as FileWithHandle).handle = fileHandle;
          files.push(file);
        } else if (handle.kind === 'directory') {
          const subDirHandle = handle as FileSystemDirectoryHandle;
          await traverseDirectory(subDirHandle);
        }
      }
    }
  }

  await traverseDirectory(directoryHandle);
  return files;
}


/// Extraction of files names from a common prefix

export function extractFilePathsFromCommonRadix(fileURIs: string[]): string[] {

  const filePaths = fileURIs
    .filter((path) => path.startsWith('file:'))
    .map((path) => path.slice(5));

  if (filePaths.length < 2)
    return [];

  const commonRadix = _findCommonPrefix(filePaths);
  if (!commonRadix.endsWith('/'))
    return [];

  return filePaths.map((path) => path.slice(commonRadix.length));
}

function _findCommonPrefix(strings: string[]) {
  if (!strings.length)
    return '';

  const sortedStrings = strings.slice().sort();
  const firstString = sortedStrings[0];
  const lastString = sortedStrings[sortedStrings.length - 1];

  let commonPrefix = '';
  for (let i = 0; i < firstString.length; i++) {
    if (firstString[i] === lastString[i]) {
      commonPrefix += firstString[i];
    } else {
      break;
    }
  }

  return commonPrefix;
}

