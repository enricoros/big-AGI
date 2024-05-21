import { v4 as uuidv4 } from 'uuid';


// Blob

enum DBlobMimeType {
  IMG_PNG = 'image/png', IMG_JPEG = 'image/jpeg',
  AUDIO_MPEG = 'audio/mpeg', AUDIO_WAV = 'audio/wav',
  // VIDEO_MP4 = 'video/mp4',
  // DOCUMENT_PDF = 'application/pdf', DOCUMENT_PLAIN = 'text/plain', DOCUMENT_HTML = 'text/html',
  // ...
}

interface DBlobData<M extends DBlobMimeType> {
  mimeType: M; // | ArrayBuffer; // Base64 encoded content or ArrayBuffer
  base64: string; // Base64 encoded content
  size?: number; // Size in bytes (optional)
  altMimeType?: DBlobMimeType; // Alternative MIME type for the input (optional)
  altData?: string; // Alternative data for the input (optional)
}


// Item Origin

interface UploadOrigin {
  origin: 'upload';
  dir: 'out';
  source: 'attachment'; // 'attachment' | 'message' | 'note' | 'task' | 'event' | 'contact' | 'file' | 'url' | 'text' | 'ego'..
  fileName: string;
  fileSize?: number; // Size of the uploaded file (optional)
  fileType?: string; // Type of the uploaded file (optional)
  attachmentMessageId?: string; // ID of the message that the attachment is associated with (optional)
}

interface GeneratedOrigin {
  origin: 'generated';
  dir: 'in';
  source: 'ai-text-to-image';
  generatorName: string;
  parameters: { [key: string]: any }; // Parameters used for generation
  generatedAt?: string; // When was generated (optional ISO date)
}

/*interface UrlOrigin {
  source: 'url';
  dir: OriginDirection;
  url: string; // URL of the source
  // refUrl: string; // Reference URL
  fetchedAt?: string; // When the URL was fetched (optional ISO date)
}

interface FileOrigin {
  source: 'file';
  dir: OriginDirection;
  filePath: string;
  fileLastModifiedAt?: string; // Modified date of the file (optional ISO date)
}

interface TextOrigin {
  source: 'text';
  dir: OriginDirection;
  method: 'clipboard-read' | 'drop' | 'paste';
  textPlain?: string; // Plain text content (optional)
  textHtml?: string; // HTML text content (optional)
  capturedAt?: string; // Time when the text was captured (optional ISO date)
}

interface EgoOrigin {
  dir: OriginDirection;
  source: 'ego';
  label: string; // Label for the ego message
  blockTitle: string; // Title of the block
  textPlain: string; // Plain text content
  messageId?: string; // ID of the message (optional)
}*/

// Union type for ItemDataOrigin
type ItemDataOrigin = UploadOrigin | GeneratedOrigin;


// Item Base type

interface DBlobBase<TType extends DBlobMetaDataType, TMime extends DBlobMimeType, TMeta extends Record<string, any>> {
  id: string; // Unique identifier
  type: TType; // Type of item, used for discrimination

  label: string; // Textual representation
  data: DBlobData<TMime>; // Original data as a BlobData object
  origin: ItemDataOrigin; // Source of the data (e.g., "upload", "generated")

  createdAt: Date; // Creation date
  updatedAt: Date; // Last updated date

  metadata: TMeta; // Flexible metadata for specific .type(s)
  cache: Record<string, DBlobData<DBlobMimeType>>; // Cached conversions as BlobData objects
}

export function createDBlobBase<TType extends DBlobMetaDataType, TMime extends DBlobMimeType, TMeta extends Record<string, any>>(type: TType, label: string, data: DBlobData<TMime>, origin: ItemDataOrigin, metadata: TMeta): DBlobBase<TType, TMime, TMeta> {
  return {
    id: uuidv4(),
    type,
    label,
    data,
    origin,
    createdAt: new Date(),
    updatedAt: new Date(),
    metadata,
    cache: {},
  };
}


// Item Specialization

export enum DBlobMetaDataType {
  IMAGE = 'image',
  AUDIO = 'audio',
  // VIDEO = 'video',
  // DOCUMENT = 'document',
  // EGO = 'ego',
}

interface ImageMetadata {
  width: number;
  height: number;
  averageColor?: string; // Average html color of the image (optional)
  author?: string; // Author of the image (optional)
  tags?: string[]; // Tags associated with the image (optional)
  description?: string; // Description of the image (optional)
}

interface AudioMetadata {
  duration: number; // Duration in seconds
  sampleRate: number; // Sample rate of the audio
  bitrate?: number; // Bitrate of the audio (optional)
  channels?: number; // Number of audio channels (optional)
  // artist?: string; // Artist of the audio (optional)
  // album?: string; // Album of the audio (optional)
  // genre?: string; // Genre of the audio (optional)
}

/*interface VideoMetadata {
  width: number;
  height: number;
  duration: number; // Duration in seconds
  frameRate?: number; // Frame rate of the video (optional)
  bitrate?: number; // Bitrate of the video (optional)
  codec?: string; // Codec used for the video (optional)
  // director?: string; // Director of the video (optional)
  // cast?: string[]; // Cast members of the video (optional)
  // genre?: string; // Genre of the video (optional)
}

interface DocumentMetadata {
  pageCount: number; // Number of pages in the document
  author?: string; // Author of the document (optional)
  title?: string; // Title of the document (optional)
  subject?: string; // Subject of the document (optional)
  keywords?: string[]; // Keywords associated with the document (optional)
}*/


// Item Data

export type DBlobImageItem = DBlobBase<DBlobMetaDataType.IMAGE, DBlobMimeType.IMG_PNG | DBlobMimeType.IMG_JPEG, ImageMetadata>;
export type DBlobAudioItem = DBlobBase<DBlobMetaDataType.AUDIO, DBlobMimeType.AUDIO_MPEG | DBlobMimeType.AUDIO_WAV, AudioMetadata>;
// type DBlobVideoItem = DBlobBase<ItemDataType.VIDEO, BlobMimeType.VIDEO_MP4, VideoMetadata>;
// type DBlobDocumentItem = DBlobBase<ItemDataType.DOCUMENT, BlobMimeType.DOCUMENT_PDF, DocumentMetadata>;
// type DBlobTextItem = DBlobBase<ItemDataType.TEXT, BlobMimeType.DOCUMENT_PLAIN, {}>;


// DB Item Data

export type DBlobItem = DBlobImageItem | DBlobAudioItem; // | DBlobVideoItem | DBlobDocumentItem | DBlobTextItem | DBlobEgoItem;

export function createDBlobImageItem(label: string, data: DBlobImageItem['data'], origin: ItemDataOrigin, metadata: ImageMetadata): DBlobImageItem {
  return createDBlobBase(DBlobMetaDataType.IMAGE, label, data, origin, metadata);
}

export type DBlobDBItem = DBlobItem & {
  uId: '1';
  wId: '1';
  cId: 'global';
}
