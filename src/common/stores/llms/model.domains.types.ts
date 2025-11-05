/**
 * Stored type - edit with care
 */
export type DModelDomainId =
  |
  /**
   * Primary Chat model - used in the Chat window, inferred from .messages[].generator, or set on the Persona
   */
  'primaryChat'
  |
  /**
   * Code Editor - used in the Code Editor, for applying code changes -- currently, only Sonnet 3.5 is recommended
   */
  'codeApply'
  |
  /**
   * Fast Utility model; must have function calling, but we won't enforce in the code for now until all LLMs are correctly identified as FC or not - used for quick responses and simple tasks
   */
  'fastUtil'
  |
  /**
   * Image Captioning model - used to generate detailed text descriptions of images before sending to primary chat model
   */
  'imageCaption'
  ;