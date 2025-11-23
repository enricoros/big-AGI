# TypingMind Import - Unsupported Features

This document lists features from TypingMind exports that are not currently supported in Big-AGI import.

## Currently Unsupported

### 1. User Prompts / Custom Instructions
- **TypingMind Feature**: Custom user prompts and instructions
- **Status**: Not imported
- **Workaround**: Manually recreate in Big-AGI settings or personas
- **Future**: May be mapped to Big-AGI personas system

### 2. User Characters / Personas
- **TypingMind Feature**: User-created characters with custom personalities
- **Status**: Not imported
- **Workaround**: Manually recreate using Big-AGI personas feature
- **Future**: Should map to Big-AGI personas system

### 3. Folder Hierarchy
- **TypingMind Feature**: Nested folder organization
- **Status**: Folder IDs are preserved in metadata but not displayed
- **Workaround**: Folder references are stored and can be used for future organization
- **Future**: Will be mapped to Big-AGI folder system

### 4. Model Preferences
- **TypingMind Feature**: Per-chat model selection
- **Status**: Model information is preserved in metadata but not applied
- **Workaround**: Manually select models in Big-AGI
- **Future**: May restore model preferences

### 5. Attachments / Images
- **TypingMind Feature**: Image and file attachments in messages
- **Status**: Image URLs are lost in content normalization
- **Workaround**: Images must be re-uploaded
- **Future**: Should support image reference preservation

### 6. Message Metadata
- **TypingMind Feature**: Token counts, costs, timing data
- **Status**: Not preserved
- **Workaround**: Big-AGI will recalculate token counts
- **Future**: May preserve historical metadata

## Partially Supported

### 1. Message Content
- **Text content**: Fully supported
- **Multi-part content**: Text parts are concatenated
- **Code blocks**: Preserved as-is
- **Formatting**: Markdown formatting preserved

### 2. Timestamps
- **Created timestamps**: Fully supported
- **Updated timestamps**: Converted to conversation update time
- **Timezone handling**: Preserved via ISO 8601 format

### 3. Message Roles
- **User messages**: Fully supported
- **Assistant messages**: Fully supported
- **System messages**: Fully supported
- **Function/tool messages**: Not present in TypingMind exports

## Fully Supported

### 1. Conversations
- Chat ID preservation
- Chat titles
- Creation and update timestamps
- Message history

### 2. Messages
- Role (user/assistant/system)
- Text content
- Message order
- UUIDs

### 3. Data Lineage
- Original file hash tracking
- Re-import detection
- Original ID preservation

## Migration Notes

When migrating from TypingMind to Big-AGI:

1. **Export your data** from TypingMind settings
2. **Review custom prompts** and recreate as Big-AGI personas
3. **Note folder structure** - consider recreating in Big-AGI
4. **Import the JSON file** - conversations will be preserved
5. **Review imported chats** - verify content and organization

## Reporting Issues

If you encounter issues with TypingMind imports:

1. Check that your export file is valid JSON
2. Ensure you're using the latest TypingMind export format
3. Review the import warnings and errors
4. Report issues with sample data (remove sensitive content)
