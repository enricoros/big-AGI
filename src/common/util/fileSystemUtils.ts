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
