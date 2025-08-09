import { Release } from '~/common/app.release';


/// --- Base64 -> X --- ///

// Convert a base64 string to a Uint8Array (byte array).
export function convert_Base64_To_UInt8Array(base64: string, debugCaller: string): Uint8Array<ArrayBuffer> {
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

    // Convert binary string to Uint8Array - MODERNIZED from:
    // const bytes = new Uint8Array(binaryString.length);
    // for (let i = 0; i < binaryString.length; i++)
    //   bytes[i] = binaryString.charCodeAt(i);
    return Uint8Array.from(binaryString, char => char.charCodeAt(0));

  } catch (error) {
    Release.IsNodeDevBuild && console.warn(`[DEV] convert_Base64_To_UInt8Array: Conversion failed in (${debugCaller}):`, error);
    throw new Error(`Base64 decode failed (${debugCaller})`);
  }
}

/**
 * Convert a base64 string + its mimetype to a Blob.
 * @param base64 Base64 encoded string - the function will warn if this is a data URL instead.
 * @param blobMimeType MIME type of the resulting Blob, e.g. 'image/png', 'audio/wav', etc.
 * @param debugCaller User-visible label for debugging purposes, e.g. 'Voice Recorder'
 */
export async function convert_Base64WithMimeType_To_Blob(base64: string, blobMimeType: string, debugCaller: string): Promise<Blob> {
  try {
    // First attempt: Use our UInt8Array conversion
    try {
      // Validate base64 string - allow empty strings as they are valid
      if (base64 == null) {
        // noinspection ExceptionCaughtLocallyJS
        throw new Error('Invalid base64 data');
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
          throw new Error(`Fetch Blob failed (${response.status})`);
        }

        // Empty blob from successful fetch is valid - represents empty content
        return await response.blob();
      } catch (fallbackError) {
        Release.IsNodeDevBuild && console.warn(`[DEV] convert_Base64_To_Blob: Both methods failed in (${debugCaller}):`, { primaryError, fallbackError });
        // noinspection ExceptionCaughtLocallyJS
        throw primaryError; // Rethrow original error for consistency
      }
    }

  } catch (error) {
    Release.IsNodeDevBuild && console.warn(`[DEV] convert_Base64_To_Blob: Conversion failed in (${debugCaller}):`, error);
    throw new Error(`Base64 to Blob failed (${debugCaller})`);
  }
}

// Convert (encode) separate base64 data and MIME type to a base64 data URL.
export function convert_Base64WithMimeType_To_Base64DataURL(base64Data: string, mimeType: string, debugCaller: string): string {
  try {
    if (base64Data == null) {
      // noinspection ExceptionCaughtLocallyJS
      throw new Error('Invalid base64 data');
    }

    if (typeof (mimeType as unknown) !== 'string' || !mimeType.trim()) {
      // noinspection ExceptionCaughtLocallyJS
      throw new Error('Invalid MIME type');
    }

    // Ensure base64Data doesn't already have data URL prefix
    if (base64Data.startsWith('data:')) {
      // noinspection ExceptionCaughtLocallyJS
      throw new Error(`Already a data URL`);
    }

    // Construct the data URL
    return `data:${mimeType};base64,${base64Data}`;

  } catch (error) {
    Release.IsNodeDevBuild && console.warn(`[DEV] convert_Base64WithMimeType_To_Base64DataURL: Conversion failed in (${debugCaller}):`, error);
    throw new Error(`Data URL creation failed (${debugCaller})`);
  }
}


/// --- Base64 Data URL <-> X --- ///

// Convert a base64 data URL (e.g. 'data:image/png;base64,iVBOUgAA...') to separate base64 data and MIME type.
export function convert_Base64DataURL_To_Base64WithMimeType(dataUrl: string, debugCaller: string): { base64Data: string, mimeType: string } {
  try {
    if (typeof (dataUrl as unknown) !== 'string') {
      // noinspection ExceptionCaughtLocallyJS
      throw new Error('Invalid data URL');
    }

    if (!dataUrl.startsWith('data:')) {
      // noinspection ExceptionCaughtLocallyJS
      throw new Error('Not a data URL');
    }

    // Parse the data URL format: data:[<mediatype>][;base64],<data>
    const commaIndex = dataUrl.indexOf(',');
    if (commaIndex === -1) {
      // noinspection ExceptionCaughtLocallyJS
      throw new Error('Invalid data URL format');
    }

    const header = dataUrl.substring(5, commaIndex); // Skip "data:" prefix
    const base64Data = dataUrl.substring(commaIndex + 1);

    // Parse the header to extract MIME type
    let mimeType = '';
    if (header.includes(';base64')) {
      // Format: data:image/png;base64,
      mimeType = header.replace(';base64', '');
    } else {
      // Format without explicit base64 encoding (assume it's base64 anyway)
      Release.IsNodeDevBuild && console.warn(`[DEV] convert_Base64DataURL_To_Base64WithMimeType: Data URL in (${debugCaller}) doesn't specify base64 encoding, assuming base64`);
      mimeType = header;
    }

    // Default MIME type if empty
    if (!mimeType.trim()) {
      // noinspection ExceptionCaughtLocallyJS
      throw new Error(`Missing MIME type`);
    }

    return { base64Data, mimeType };
  } catch (error) {
    Release.IsNodeDevBuild && console.warn(`[DEV] convert_Base64DataURL_To_Base64WithMimeType: Conversion failed in (${debugCaller}):`, error);
    throw new Error(`Data URL parse failed (${debugCaller})`);
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
      throw new Error('Malformed data URL');
    }
    // Empty base64 result from empty blob is valid - represents empty content
    return base64DataURL.substring(commaIndex + 1);
  } catch (error) {
    Release.IsNodeDevBuild && console.warn(`[DEV] convert_Blob_To_Base64: Conversion failed in (${debugCaller}):`, error);
    throw new Error(`Blob to base64 failed (${debugCaller})`);
  }
}

// Convert a Blob to a base64 data URL string. [Fast] uses the FileReader API
export async function convert_Blob_To_Base64DataURL(blob: Blob, debugCaller: string): Promise<string> {
  try {
    if (!((blob as unknown) instanceof Blob)) {
      // noinspection ExceptionCaughtLocallyJS
      throw new Error('Invalid blob');
    }

    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string')
          resolve(reader.result);
        else
          reject(new Error('FileReader error'));
      };
      reader.onerror = () => reject(new Error(`FileReader failed`));
      reader.onabort = () => reject(new Error('FileReader aborted'));
      reader.readAsDataURL(blob);
    });

  } catch (error) {
    Release.IsNodeDevBuild && console.warn(`[DEV] convert_Blob_To_Base64DataURL: Conversion failed in (${debugCaller}):`, error);
    throw new Error(`Blob read failed (${debugCaller})`);
  }
}

// Convert a Blob to a Uint8Array (byte array)
export async function convert_Blob_To_UInt8Array(blob: Blob, debugCaller: string): Promise<Uint8Array> {
  try {
    if (!((blob as unknown) instanceof Blob)) {
      // noinspection ExceptionCaughtLocallyJS
      throw new Error('Invalid blob');
    }

    const arrayBuffer = await blob.arrayBuffer();
    return new Uint8Array(arrayBuffer);

  } catch (error) {
    Release.IsNodeDevBuild && console.warn(`[DEV] convert_Blob_To_UInt8Array: Conversion failed in (${debugCaller}):`, error);
    throw new Error(`Blob to bytes failed (${debugCaller})`);
  }
}


/// --- UInt8Array -> X --- ///

// Convert a Uint8Array (byte array) to a Blob
export function convert_UInt8ArrayWithMimeType_To_Blob(bytes: Uint8Array<ArrayBuffer>, blobMimeType: string, debugCaller: string): Blob {
  try {
    if (!((bytes as unknown) instanceof Uint8Array)) {
      // noinspection ExceptionCaughtLocallyJS
      throw new Error('Invalid byte array');
    }

    return new Blob([bytes], { type: blobMimeType });

  } catch (error) {
    Release.IsNodeDevBuild && console.warn(`[DEV] convert_UInt8Array_To_Blob: Conversion failed in (${debugCaller}):`, error);
    throw new Error(`Bytes to Blob failed (${debugCaller})`);
  }
}

// Convert a Uint8Array (byte array) to a base64 string - SLOW? - minimize usage
export function convert_UInt8Array_To_Base64(bytes: Uint8Array, debugCaller: string): string {
  try {
    if (!((bytes as unknown) instanceof Uint8Array)) {
      // noinspection ExceptionCaughtLocallyJS
      throw new Error('Invalid byte array');
    }

    // Handle empty array case
    if (bytes.length === 0)
      return '';

    // Method 1: Using Buffer (if available in Node.js environment)
    if (typeof Buffer !== 'undefined')
      return Buffer.from(bytes).toString('base64');

    // Method 2: Current implementation with apply fix
    let binaryString = '';
    const chunkSize = 0x8000; // 32KB chunks
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize); // subarray is more efficient than slice
      binaryString += String.fromCharCode.apply(null, Array.from(chunk));
    }
    return btoa(binaryString); // binary string to base64
  } catch (error) {
    Release.IsNodeDevBuild && console.warn(`[DEV] convert_UInt8Array_To_Base64: Conversion failed in (${debugCaller}):`, error);
    throw new Error(`Bytes to base64 failed (${debugCaller})`);
  }
}
