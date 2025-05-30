import { Release } from '~/common/app.release';


/// --- Base64 -> X --- ///

// Convert a base64 string to a Uint8Array (byte array).
export function convert_Base64_To_UInt8Array(base64: string, debugCaller: string): Uint8Array {
  try {
    // Remove data URL prefix if present - shall NOT happen
    let base64Data = base64;
    if (base64Data.startsWith('data:')) {
      Release.IsNodeDevBuild && console.warn(`[DEV] convert_Base64_To_UInt8Array: Detected data URL format in (${debugCaller}). Consider passing pure base64 instead.`);
      base64Data = base64Data.replace(/^data:[^;]+;base64,/, '');
    }

    // NOTE: we don't check for an empty string as it's valid and can convert

    // Decode base64 to binary string
    let binaryString: string;
    try {
      binaryString = atob(base64Data);
    } catch (errorD1) {
      Release.IsNodeDevBuild && console.warn(`[DEV] convert_Base64_To_UInt8Array: Failed to decode base64 in (${debugCaller}), attempting cleanup:`, errorD1);

      // Attempt to clean and fix the base64 string
      const cleanedBase64 = base64Data.replace(/[^A-Za-z0-9+/]/g, '');
      const paddingNeeded = (4 - (cleanedBase64.length % 4)) % 4;
      const paddedBase64 = cleanedBase64 + '='.repeat(paddingNeeded);
      binaryString = atob(paddedBase64);
    }

    // Convert binary string to Uint8Array
    // Other impl?: Uint8Array.from(binaryString, char => char.charCodeAt(0)) // not sure if this is faster and supports all browsers
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++)
      bytes[i] = binaryString.charCodeAt(i);

    return bytes;
  } catch (error) {
    Release.IsNodeDevBuild && console.warn(`[DEV] convert_Base64_To_UInt8Array: Conversion failed in (${debugCaller}):`, error);
    throw new Error(`Failed to convert base64 to byte array in (${debugCaller}): ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Convert a base64 string + its mimetype to a Blob.
 * @param base64 Base64 encoded string - the function will warn if this is a data URL instead.
 * @param blobMimeType MIME type of the resulting Blob, e.g. 'image/png', 'audio/wav', etc.
 * @param debugCaller User-visible label for debugging purposes, e.g. 'Voice Recorder'
 */
export async function convert_Base64_To_Blob(base64: string, blobMimeType: string, debugCaller: string): Promise<Blob> {
  try {
    // First attempt: Use our UInt8Array conversion
    try {
      // Validate base64 string
      if (!base64 || !base64.length) {
        // noinspection ExceptionCaughtLocallyJS
        throw new Error('Empty base64 data');
      }

      // Convert base64 to byte array
      const bytes = convert_Base64_To_UInt8Array(base64, debugCaller);

      // Convert byte array to blob (note, not reusing the dedicated function because it doesn't accept empty byte arrays)
      return new Blob([bytes], { type: blobMimeType });

    } catch (primaryError) {
      // Approach 2: Fallback using fetch with data URL
      Release.IsNodeDevBuild && console.warn(`[DEV] convert_Base64_To_Blob: Primary method failed in (${debugCaller}), trying fallback:`, primaryError);

      try {
        // Extract base64 data and handle data URL prefix
        let base64Data = base64;
        if (base64Data.startsWith('data:'))
          base64Data = base64Data.replace(/^data:[^;]+;base64,/, '');

        const dataUrl = `data:${blobMimeType};base64,${base64Data}`;
        const response = await fetch(dataUrl);
        if (!response.ok) {
          // noinspection ExceptionCaughtLocallyJS
          throw new Error(`Fetch failed with status: ${response.status}`);
        }

        const blob = await response.blob();
        if (blob.size === 0) {
          // noinspection ExceptionCaughtLocallyJS
          throw new Error('Fallback produced empty blob');
        }

        return blob;
      } catch (fallbackError) {
        Release.IsNodeDevBuild && console.warn(`[DEV] convert_Base64_To_Blob: Both methods failed in (${debugCaller}):`, { primaryError, fallbackError });
        // noinspection ExceptionCaughtLocallyJS
        throw primaryError; // Rethrow original error for consistency
      }
    }

  } catch (error) {
    Release.IsNodeDevBuild && console.warn(`[DEV] convert_Base64_To_Blob: Conversion failed in (${debugCaller}):`, error);
    throw new Error(`Failed to convert base64 to Blob in (${debugCaller}): ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}


/// --- Blob -> X --- ///

// Convert a Blob to a base64 string (without data URL prefix).
export async function convert_Blob_To_Base64(blob: Blob, debugCaller: string): Promise<string> {
  try {
    const base64DataURL = await convert_Blob_To_Base64DataURL(blob, debugCaller);
    // Extract base64 part from data URL
    const commaIndex = base64DataURL.indexOf(',');
    if (commaIndex === -1) {
      // noinspection ExceptionCaughtLocallyJS
      throw new Error('Invalid data URL format: missing comma');
    }
    const base64 = base64DataURL.substring(commaIndex + 1);
    if (!base64 || base64.length === 0) {
      // noinspection ExceptionCaughtLocallyJS
      throw new Error('Empty base64 data');
    }
    return base64;
  } catch (error) {
    Release.IsNodeDevBuild && console.warn(`[DEV] convert_Blob_To_Base64: Conversion failed in (${debugCaller}):`, error);
    throw new Error(`Failed to convert Blob to base64 in (${debugCaller}): ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Convert a Blob to a base64 data URL string. [Fast] uses the FileReader API
async function convert_Blob_To_Base64DataURL(blob: Blob, debugCaller: string): Promise<string> {
  try {
    if (!blob || !(blob instanceof Blob) || blob.size === 0) {
      // noinspection ExceptionCaughtLocallyJS
      throw new Error('Empty or invalid blob');
    }

    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string')
          resolve(reader.result);
        else
          reject(new Error('FileReader returned non-string result'));
      };
      reader.onerror = () => reject(new Error(`FileReader failed: ${reader.error?.message || 'Unknown error'}`));
      reader.onabort = () => reject(new Error('FileReader operation was aborted'));
      reader.readAsDataURL(blob);
    });

  } catch (error) {
    Release.IsNodeDevBuild && console.warn(`[DEV] convert_Blob_To_Base64DataURL: Conversion failed in (${debugCaller}):`, error);
    throw new Error(`Failed to convert Blob to data URL in (${debugCaller}): ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Convert a Blob to a Uint8Array (byte array)
export async function convert_Blob_To_UInt8Array(blob: Blob, debugCaller: string): Promise<Uint8Array> {
  try {
    if (!blob || blob.size === 0) {
      // noinspection ExceptionCaughtLocallyJS
      throw new Error('Empty or invalid blob');
    }

    const arrayBuffer = await blob.arrayBuffer();
    return new Uint8Array(arrayBuffer);

  } catch (error) {
    Release.IsNodeDevBuild && console.warn(`[DEV] convert_Blob_To_UInt8Array: Conversion failed in (${debugCaller}):`, error);
    throw new Error(`Failed to convert Blob to byte array in (${debugCaller}): ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}


/// --- UInt8Array -> X --- ///

// Convert a Uint8Array (byte array) to a Blob
export function convert_UInt8Array_To_Blob(bytes: Uint8Array, blobMimeType: string, debugCaller: string): Blob {
  try {
    if (!bytes || bytes.length === 0) {
      // noinspection ExceptionCaughtLocallyJS
      throw new Error('Empty or invalid byte array');
    }

    return new Blob([bytes], { type: blobMimeType });

  } catch (error) {
    Release.IsNodeDevBuild && console.warn(`[DEV] convert_UInt8Array_To_Blob: Conversion failed in (${debugCaller}):`, error);
    throw new Error(`Failed to convert byte array to Blob in (${debugCaller}): ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// // Convert a Uint8Array (byte array) to a base64 string
// export function convert_UInt8Array_To_Base64(bytes: Uint8Array, debugCaller: string): string {
//   try {
//     if (!bytes || bytes.length === 0) {
//       // noinspection ExceptionCaughtLocallyJS
//       throw new Error('Empty or invalid byte array');
//     }
//
//     // Convert byte array to binary string
//     let binaryString = '';
//     const chunkSize = 0x8000; // 32KB chunks
//     for (let i = 0; i < bytes.length; i += chunkSize) {
//       const chunk = bytes.slice(i, i + chunkSize);
//       binaryString += String.fromCharCode.apply(null, Array.from(chunk));
//     }
//
//     // Convert binary string to base64
//     return btoa(binaryString);
//
//   } catch (error) {
//     Release.IsNodeDevBuild && console.warn(`[DEV] convert_UInt8Array_To_Base64: Conversion failed in (${debugCaller}):`, error);
//     throw new Error(`Failed to convert byte array to base64 in (${debugCaller}): ${error instanceof Error ? error.message : 'Unknown error'}`);
//   }
// }
