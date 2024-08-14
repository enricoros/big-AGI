import type { FileWithHandle } from 'browser-fs-access';


/**
 * Extending the `FileSystemDirectoryHandle` with a `values` method to iterate over the directory contents.
 * This is as defined in https://fs.spec.whatwg.org/#filesystemdirectoryhandle (File System Standard, Last Updated 28 June 2024).
 */
interface ExplorableFileSystemDirectoryHandle extends FileSystemDirectoryHandle {
  values?: () => AsyncIterable<FileSystemFileHandle | FileSystemDirectoryHandle | null>;
}

interface FileWithHandleAndPath {
  fileWithHandle: FileWithHandle;
  relativeName: string;
}

/**
 * Recursively get all files from a directory, returning an array of `FileWithHandleAndPath` objects,
 * where the handles are all FileSystemFileHandle objects (allows for LiveFile support).
 */
export async function getAllFilesFromDirectoryRecursively(directoryHandle: FileSystemDirectoryHandle): Promise<FileWithHandleAndPath[]> {
  const list: FileWithHandleAndPath[] = [];
  const separator = '/';

  async function traverseDirectory(dirHandle: ExplorableFileSystemDirectoryHandle, path: string = '') {
    if ('values' in dirHandle && typeof dirHandle.values === 'function') {
      for await (const handle of dirHandle.values()) {
        if (!handle) continue;
        const relativePath = path ? `${path}${separator}${handle.name}` : handle.name;

        if (handle.kind === 'file') {
          const fileWithHandle = await handle.getFile() as FileWithHandle;
          fileWithHandle.handle = handle;
          list.push({
            fileWithHandle: fileWithHandle,
            relativeName: relativePath,
          });
        } else if (handle.kind === 'directory') {
          await traverseDirectory(handle, relativePath);
        }
      }
    }
  }

  await traverseDirectory(directoryHandle);
  return list;
}


/// Helpers for handling DataTransfer items that contain File System Handles, and we need to pre-get all the promises to files/handles upfront.

/*
 * Note: was File | Promise<Handles | null>, but we added and extra File fallback in the promise
 * to handle cases where the handle is null (e.g. Chrome screen captures), which would break the
 * downstream logic.
 */
type FileOrFileHandlePromise = Promise<FileSystemFileHandle | FileSystemDirectoryHandle | File | null> | File;

/**
 * Extracts file system handles or files from a list of data transfer items.
 * Note: the main purpose of this function is to get all the files/handles **upfront** in a
 * datatransfer, as those objects expire with async operations.
 */
export function getDataTransferFilesOrPromises(items: DataTransferItemList, fallbackAsFiles: boolean): FileOrFileHandlePromise[] {
  const results: FileOrFileHandlePromise[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.kind !== 'file')
      continue;

    // Try to get file system handle if available and not forced to use file
    if ('getAsFileSystemHandle' in item && typeof item.getAsFileSystemHandle === 'function') {
      try {
        const fsHandle = item.getAsFileSystemHandle() as Promise<FileSystemFileHandle | FileSystemDirectoryHandle | null>;
        if (fsHandle)
          results.push(fsHandle.then(handleOrNull => {
            // if null, return a File instead - note that this is a fallback, as we prefer to get the handle
            // but when pasing screen captures from Chrome, the handle will be null, while the file shall
            // still be retrievable.
            return handleOrNull || item.getAsFile();
          }));
        continue;
      } catch (error) {
        console.error('Error getting file system handle:', error);
      }
    }

    // Fallback to getAsFile
    if (fallbackAsFiles) {
      const file = item.getAsFile();
      if (file)
        results.push(file);
    }
  }

  return results;
}


/**
 * Utility function to get the first file system handle from a DataTransfer object.
 * Note that a DataTransfer object can contain multiple files, but we assume the first is the one.
 */
export async function getFirstFileSystemFileHandle(dataTransfer: DataTransfer): Promise<FileSystemFileHandle | null> {

  // get FileSystemFileHandle objects from the DataTransfer
  const fileOrFSHandlePromises = getDataTransferFilesOrPromises(dataTransfer.items, false);
  if (!fileOrFSHandlePromises.length)
    return null;

  // resolve the promises to get the actual files/handles
  const filesOrHandles = await Promise.all(fileOrFSHandlePromises);
  for (let filesOrHandle of filesOrHandles)
    if (!(filesOrHandle instanceof File) && filesOrHandle?.kind === 'file' && filesOrHandle)
      return filesOrHandle;

  // no file system handle found
  return null;
}
