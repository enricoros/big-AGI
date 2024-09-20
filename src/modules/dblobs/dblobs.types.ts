import { agiUuid } from '~/common/util/idUtils';


// DB - Assets

/**
 * This is the asset when stored/loaded in the DB. Carries some more context out of band from the asset itself.
 */
export type DBlobDBAsset = {
  contextId: DBlobDBContextId;
  scopeId: DBlobDBScopeId;
} & DBlobAsset;

export type DBlobDBContextId = 'global';
export type DBlobDBScopeId = 'app-chat' | 'app-draw' | 'attachment-drafts';


// Assets

export type DBlobAsset = DBlobImageAsset | DBlobAudioAsset; // | DBlobVideoAsset | DBlobDocumentAsset | DBlobTextAsset;

export type DBlobImageAsset = DBlobAssetImplV1<
  /* assetType: */ DBlobAssetType.IMAGE,
  /* data: <mime> */ DBlobMimeType.IMG_PNG | DBlobMimeType.IMG_JPEG | DBlobMimeType.IMG_WEBP,
  /* metadata: */ ImageAssetMetadata
>;

export type DBlobAudioAsset = DBlobAssetImplV1<
  /* assetType: */ DBlobAssetType.AUDIO,
  /* data: <mime> */ DBlobMimeType.AUDIO_MPEG | DBlobMimeType.AUDIO_WAV,
  /* metadata: */ AudioAssetMetadata
>;

// type DBlobVideoAsset = DBlobAssetImplV1<DBlobAssetType.VIDEO, DBlobDataMimeType.VIDEO_MP4, VideoAssetMetadata>;
// type DBlobDocumentAsset = DBlobAssetImplV1<DBlobAssetType.DOCUMENT, DBlobDataMimeType.DOCUMENT_PDF, DocumentAssetMetadata>;
// type DBlobTextAsset = DBlobAssetImplV1<DBlobAssetType.TEXT, DBlobDataMimeType.DOCUMENT_PLAIN, {}>;


// DB - Asset Generic Type

interface DBlobAssetImplV1<TAssetType extends DBlobAssetType, TMime extends DBlobMimeType, TMeta extends Record<string, any>> {
  id: DBlobAssetId; // Unique identifier
  assetType: TAssetType; // Type of asset, used for discrimination

  label: string; // Textual representation
  data: DBlobAssetData<TMime>; // Original data as a BlobData object
  origin: DBlobAssetOrigin; // Source of the data (e.g., "upload", "generated")

  createdAt: Date; // Creation date
  updatedAt: Date; // Last updated date

  metadata: TMeta; // Flexible metadata for specific .type(s)
  // cache: Record<string, DBlobData<DBlobMimeType>>; // Cached conversions as BlobData objects
  cache: {
    thumb256?: DBlobAssetData<DBlobMimeType.IMG_WEBP | DBlobMimeType.IMG_JPEG>; // Cache for the thumbnail-256 conversion
  };
}

export type DBlobAssetId = string;

export enum DBlobAssetType {
  IMAGE = 'image',
  AUDIO = 'audio',
  // VIDEO = 'video',
  // DOCUMENT = 'document',
  // EGO = 'ego',
}


// Asset Data

interface DBlobAssetData<M extends DBlobMimeType> {
  mimeType: M;
  base64: string; // Base64 encoded content (not a data URL)
  // NOTE: the data url will be "data:${mimeType};base64,${base64}"
  // size?: number; // Size in bytes (optional)
  altMimeType?: DBlobMimeType; // Alternative MIME type for the input (optional)
  altData?: string; // Alternative data for the input (optional)
}

export enum DBlobMimeType {
  IMG_PNG = 'image/png', IMG_JPEG = 'image/jpeg', IMG_WEBP = 'image/webp',
  AUDIO_MPEG = 'audio/mpeg', AUDIO_WAV = 'audio/wav',
  // VIDEO_MP4 = 'video/mp4',
  // DOCUMENT_PDF = 'application/pdf', DOCUMENT_PLAIN = 'text/plain', DOCUMENT_HTML = 'text/html',
}


// Asset Origin

type DBlobAssetOrigin = UserOrigin | GeneratedOrigin;

interface UserOrigin {
  ot: 'user';
  source: 'attachment'; // 'attachment' | 'message' | 'note' | 'task' | 'event' | 'contact' | 'file' | 'url' | 'text' | 'ego'..
  media: string; // file: 'camera' | 'screencapture' | 'file-open' | 'clipboard-read' | 'drop' | 'paste',  url: 'url',  'unknown'
  url?: string;
  fileName?: string;
  // fileSize?: number; // Size of the uploaded file (optional)
  // fileType?: string; // Type of the uploaded file (optional)
  attachmentMessageId?: string; // ID of the message that the attachment is associated with (optional)
}

interface GeneratedOrigin {
  ot: 'generated';
  source: 'ai-text-to-image';
  generatorName: string;
  prompt: string; // Prompt used for generation
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


// Asset Metadata

interface ImageAssetMetadata {
  width: number;
  height: number;
  averageColor?: string; // Average html color of the image (optional)
  author?: string; // Author of the image (optional)
  tags?: string[]; // Tags associated with the image (optional)
  description?: string; // Description of the image (optional)
}

interface AudioAssetMetadata {
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


// DB Item Data

export function _createAssetObject<TType extends DBlobAssetType, TMime extends DBlobMimeType, TMeta extends Record<string, any>>(
  assetType: TType,
  label: string,
  data: DBlobAssetData<TMime>,
  origin: DBlobAssetOrigin,
  metadata: TMeta,
): DBlobAssetImplV1<TType, TMime, TMeta> {
  const creationDate = new Date();
  return {
    id: agiUuid('dblob-asset'),
    assetType,
    label,
    data,
    origin,
    createdAt: creationDate,
    updatedAt: creationDate,
    metadata,
    cache: {},
  };
}
