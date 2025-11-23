/**
 * Main import orchestration function
 * Coordinates the full import pipeline: parse -> validate -> transform -> import
 */

import { useChatStore } from '~/common/stores/chat/store-chats';
import type { DConversation } from '~/common/stores/chat/chat.conversation';
import type { ImportResult, ImportContext } from './data.types';

import { calculateFileHash, attachLineage } from './data.lineage';
import { validateConversations, sanitizeConversation } from './pipeline/import.validator';
import { resolveAllConflictsByRename } from './pipeline/import.conflict-resolver';


/**
 * Import options
 */
export interface ImportOptions {
  dryRun?: boolean;              // If true, validate but don't actually import
  preventClash?: boolean;        // If true, rename conflicting IDs
  sanitize?: boolean;            // If true, attempt to repair invalid data
}


/**
 * Generic import function for any vendor data
 */
export async function importVendorData(
  file: File,
  parseFile: (file: File) => Promise<any>,
  transformToConversations: (data: any) => Promise<any>,
  vendorId: string,
  options: ImportOptions = {},
): Promise<ImportResult> {

  const {
    dryRun = false,
    preventClash = true,
    sanitize = true,
  } = options;

  // Initialize result
  const context: ImportContext = {
    fileName: file.name,
    fileSize: file.size,
    fileHash: await calculateFileHash(file),
    importedAt: Date.now(),
    vendorId,
  };

  const result: ImportResult = {
    success: false,
    conversations: [],
    warnings: [],
    errors: [],
    stats: {
      conversationsImported: 0,
      messagesImported: 0,
      foldersImported: 0,
      charactersImported: 0,
      unsupportedItemsSkipped: 0,
    },
    context,
  };

  try {
    // Step 1: Parse the file
    const parseResult = await parseFile(file);

    if (!parseResult.success || !parseResult.data) {
      result.errors.push({
        type: 'parse-error',
        message: parseResult.error || 'Failed to parse file',
        fatal: true,
      });
      return result;
    }

    result.warnings.push(...parseResult.warnings);

    // Step 2: Transform to conversations
    const transformResult = await transformToConversations(parseResult.data);

    if (!transformResult.conversations || transformResult.conversations.length === 0) {
      result.errors.push({
        type: 'transform-error',
        message: 'No conversations found in file',
        fatal: true,
      });
      return result;
    }

    let conversations = transformResult.conversations;
    result.warnings.push(...transformResult.warnings);

    if (transformResult.unsupportedFeatures?.length > 0) {
      result.warnings.push({
        type: 'unsupported-feature',
        message: `Unsupported features: ${transformResult.unsupportedFeatures.join(', ')}`,
      });
      result.stats.unsupportedItemsSkipped = transformResult.unsupportedFeatures.length;
    }

    // Step 3: Sanitize if requested
    if (sanitize) {
      conversations = conversations.map(sanitizeConversation);
    }

    // Step 4: Validate
    const validationResult = validateConversations(conversations);
    result.warnings.push(...validationResult.warnings);
    result.errors.push(...validationResult.errors);

    if (!validationResult.valid) {
      result.errors.push({
        type: 'validation-error',
        message: 'Validation failed - see errors above',
        fatal: true,
      });
      return result;
    }

    // Step 5: Resolve conflicts
    if (preventClash) {
      const existingConversations = useChatStore.getState().conversations;
      conversations = resolveAllConflictsByRename(conversations, existingConversations);
    }

    // Step 6: Attach lineage metadata
    for (const conversation of conversations) {
      const originalId = (conversation.metadata as any)?.typingmind?.chatId || conversation.id;
      attachLineage(conversation, context, originalId);
    }

    // Step 7: Calculate stats
    result.stats.conversationsImported = conversations.length;
    result.stats.messagesImported = conversations.reduce(
      (sum: number, conv: DConversation) => sum + conv.messages.length,
      0,
    );
    result.stats.charactersImported = conversations.reduce(
      (sum: number, conv: DConversation) => sum + conv.messages.reduce(
        (msgSum: number, msg) => msgSum + msg.fragments.reduce(
          (fragSum: number, frag) => {
            const text = (frag as any).part?.text;
            return fragSum + (typeof text === 'string' ? text.length : 0);
          },
          0,
        ),
        0,
      ),
      0,
    );

    // Step 8: Import (if not dry run)
    if (!dryRun) {
      const chatStore = useChatStore.getState();
      for (const conversation of conversations) {
        chatStore.importConversation(conversation, preventClash);
      }
    }

    result.conversations = conversations;
    result.success = true;

    return result;

  } catch (error) {
    result.errors.push({
      type: 'parse-error',
      message: error instanceof Error ? error.message : 'Unknown error',
      fatal: true,
    });
    return result;
  }
}
