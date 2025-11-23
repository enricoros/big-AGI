/**
 * Data import module
 * Provides a modular system for importing conversations from various sources
 */

// Core types
export type {
  ImportSourceId,
  ImportSource,
  ImportContext,
  ImportResult,
  ImportWarning,
  ImportError,
  ImportStats,
  ConflictResolutionStrategy,
  ConflictInfo,
} from './data.types';

// Lineage tracking
export {
  calculateFileHash,
  attachLineage,
  getLineage,
  isFromFile,
  detectReimport,
  updateLineageForReimport,
} from './data.lineage';

export type { DConversationLineage } from './data.lineage';

// Import orchestration
export { importVendorData } from './data.import';
export type { ImportOptions } from './data.import';

// Vendor types
export type {
  VendorId,
  IDataVendor,
  ParseResult,
  TransformResult,
  ValidationResult,
} from './vendors/vendor.types';

// Vendor registry
export {
  registerDataVendor,
  getDataVendor,
  getAllDataVendors,
  hasDataVendor,
} from './vendors/vendor.registry';

// UI components
export { DataImportModal } from './ui/DataImportModal';
export { ImportConfirmStep } from './ui/ImportConfirmStep';
export { ImportResultModal } from './ui/ImportResultModal';

// TypingMind vendor
export { importTypingMindData } from './vendors/typingmind/typingmind.import-function';
export { TypingMindImporter } from './vendors/typingmind/typingmind.importer';
