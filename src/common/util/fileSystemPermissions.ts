/**
 * Centralized file system permission utilities for handling FileSystemHandle permissions.
 * These utilities provide a DRY approach to permission checking and requesting across the codebase.
 *
 * The File System Access API requires explicit permission checks when accessing files,
 * especially when handles are retrieved from storage (e.g., IndexedDB or localStorage).
 * Microsoft Edge 141+ enforces stricter permission checks compared to Chrome.
 */

/**
 * Permission mode for file system operations
 */
export type FileSystemPermissionMode = 'read' | 'readwrite';

/**
 * Result of a permission check/request operation
 */
export interface PermissionResult {
  granted: boolean;
  error?: string;
}

/**
 * Verifies and optionally requests permission to access a file system handle.
 *
 * This function follows the recommended pattern from MDN:
 * 1. First checks if permission is already granted (non-interactive)
 * 2. If not granted and requestIfNeeded is true, prompts the user
 * 3. Returns the result without throwing exceptions
 *
 * @param handle - The FileSystemHandle (file or directory) to check permissions for
 * @param mode - Permission mode: 'read' for read-only, 'readwrite' for read-write access
 * @param requestIfNeeded - If true, will prompt user for permission when not already granted
 * @returns PermissionResult indicating if permission was granted and any error message
 */
export async function verifyFileSystemPermission(
  handle: FileSystemHandle,
  mode: FileSystemPermissionMode = 'read',
  requestIfNeeded: boolean = true
): Promise<PermissionResult> {

  // Check if permission APIs are available (they should be in modern browsers supporting File System Access)
  if (!('queryPermission' in handle) || typeof handle.queryPermission !== 'function') {
    // Fallback for browsers that support File System Access but not permission APIs
    // This is rare but possible in older versions
    console.warn('FileSystemHandle.queryPermission not supported, assuming permission granted');
    return { granted: true };
  }

  const permissionDescriptor = { mode } as PermissionDescriptor;

  try {
    // Step 1: Check current permission state without prompting
    const currentPermission = await handle.queryPermission(permissionDescriptor);

    if (currentPermission === 'granted') {
      return { granted: true };
    }

    // Step 2: Request permission if needed and available
    if (requestIfNeeded && 'requestPermission' in handle && typeof handle.requestPermission === 'function') {
      const requestedPermission = await handle.requestPermission(permissionDescriptor);

      if (requestedPermission === 'granted') {
        return { granted: true };
      }

      // User explicitly denied permission
      return {
        granted: false,
        error: 'Permission denied by user. Please grant access when prompted.'
      };
    }

    // Permission not granted and we couldn't/didn't request it
    return {
      granted: false,
      error: mode === 'readwrite'
        ? 'Write permission required. Please re-select the file to grant access.'
        : 'Read permission required. Please re-select the file to grant access.'
    };

  } catch (error) {
    // Handle any unexpected errors during permission operations
    const errorMessage = error instanceof Error ? error.message : 'Unknown permission error';
    console.error('Permission check failed:', errorMessage);

    return {
      granted: false,
      error: `Permission check failed: ${errorMessage}`
    };
  }
}

/**
 * Safely gets a File from a FileSystemFileHandle with permission checking.
 *
 * This is a convenience wrapper that:
 * 1. Checks/requests read permission
 * 2. Calls getFile() if permission is granted
 * 3. Returns null with error info if permission is denied or operation fails
 *
 * @param fileHandle - The FileSystemFileHandle to read from
 * @param requestPermission - If true, will prompt user for permission when not already granted
 * @returns The File object if successful, or null if permission denied or error occurred
 */
export async function getFileWithPermission(
  fileHandle: FileSystemFileHandle,
  requestPermission: boolean = true
): Promise<{ file: File; error?: never } | { file: null; error: string }> {

  // Check read permission
  const permissionResult = await verifyFileSystemPermission(fileHandle, 'read', requestPermission);

  if (!permissionResult.granted) {
    return {
      file: null,
      error: permissionResult.error || 'Read permission denied'
    };
  }

  try {
    // Permission granted, attempt to get the file
    const file = await fileHandle.getFile();
    return { file };
  } catch (error) {
    // Even with permission, getFile() might fail for other reasons (file deleted, etc.)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Check if this is still a permission error (Edge might throw here instead of during permission check)
    if (error instanceof DOMException && error.name === 'NotAllowedError') {
      return {
        file: null,
        error: 'Permission denied. Please re-select the file to grant access.'
      };
    }

    return {
      file: null,
      error: `Failed to read file: ${errorMessage}`
    };
  }
}

/**
 * Safely creates a writable stream from a FileSystemFileHandle with permission checking.
 *
 * This is a convenience wrapper that:
 * 1. Checks/requests readwrite permission
 * 2. Calls createWritable() if permission is granted
 * 3. Returns null with error info if permission is denied or operation fails
 *
 * @param fileHandle - The FileSystemFileHandle to write to
 * @param requestPermission - If true, will prompt user for permission when not already granted
 * @returns The FileSystemWritableFileStream if successful, or null with error if failed
 */
export async function createWritableWithPermission(
  fileHandle: FileSystemFileHandle,
  requestPermission: boolean = true
): Promise<{ writable: FileSystemWritableFileStream; error?: never } | { writable: null; error: string }> {

  // Check readwrite permission
  const permissionResult = await verifyFileSystemPermission(fileHandle, 'readwrite', requestPermission);

  if (!permissionResult.granted) {
    return {
      writable: null,
      error: permissionResult.error || 'Write permission denied'
    };
  }

  try {
    // Permission granted, attempt to create writable
    const writable = await fileHandle.createWritable();
    return { writable };
  } catch (error) {
    // Even with permission, createWritable() might fail for other reasons
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Check if this is still a permission error
    if (error instanceof DOMException && error.name === 'NotAllowedError') {
      return {
        writable: null,
        error: 'Write permission denied. Please re-select the file to grant access.'
      };
    }

    return {
      writable: null,
      error: `Failed to create writable: ${errorMessage}`
    };
  }
}