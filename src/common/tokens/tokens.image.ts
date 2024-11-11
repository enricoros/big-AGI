import type { DLLM } from '~/common/stores/llms/llms.types';


export function imageTokensForLLM(width: number | undefined, height: number | undefined, debugTitle: string | undefined, llm: DLLM) {
  // for the guidelines, see `attachment.pipeline.ts` (lists the latest URLs)
  // Note: we may resolve the service or use the access, for non-OpenAI services even if they're on the OpenAI protocol
  switch (llm.vId) {
    case 'openai':
      // missing values
      if (!width || !height) {
        console.log(`Missing width or height for openai image tokens calculation (${debugTitle || 'no title'})`);
        return 85;
      }
      // 'detail: low' mode, has an image of (or up to) 512x512 -> 85 tokens
      if (width <= 512 && height <= 512)
        return 85;
      // 'detail: high' mode, cover the image with 512x512 patches of 170 tokens, in addition to the 85
      const patchesX = Math.ceil(width / 512);
      const patchesY = Math.ceil(height / 512);
      return 85 + patchesX * patchesY * 170;

    case 'anthropic':
      // Recommended image sizes:
      // https://docs.anthropic.com/en/docs/build-with-claude/vision
      // - Max: 1568px on long edge
      // - Optimal: ≤1.15 megapixels (e.g., 1092x1092, 951x1268, 896x1344, 819x1456, 784x1568)
      // - Min: >200px on both edges

      // Max case as fallback
      if (!width || !height) {
        // console.log(`Missing width or height for Anthropic image tokens calculation (${debugTitle || 'no title'})`);
        return 1600;
      }

      // Calculate tokens based on image size
      const megapixels = (width * height) / 1000000;
      const tokens = Math.min(Math.round((width * height) / 750), 1600);

      // Max case for oversized images
      if (megapixels > 1.15) {
        // console.log(`Image exceeds recommended size for Anthropic (${debugTitle || 'no title'})`);
        return 1600;
      }
      // if (width < 200 || height < 200) {
      //   console.log(`Image may be too small for optimal Anthropic performance (${debugTitle || 'no title'})`);
      // }

      return tokens;

    case 'googleai':
      // Inferred from the Gemini Videos description, but not sure
      return 258;

    default:
      console.log(`[DEV] Unhandled token preview for image with llm: ${llm.vId}`);
      return 0;
  }
}
