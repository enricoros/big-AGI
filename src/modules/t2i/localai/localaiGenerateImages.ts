// import { apiAsync } from '~/common/util/trpc.client';
//
// import type { DModelSourceId } from '~/modules/llms/store-llms';
// import { findAccessForSourceOrThrow } from '~/modules/llms/vendors/vendors.registry';
//
// /*
//  * FIXME: LocalAI t2i integration is VERY experimental and WILL NOT WORK at this time.
//  * This is just a skeleton that uses the OpenAI Transport to perform the same API call.
//  *
//  * To be continued.
//  */
//
// export async function localaiGenerateImages(modelSourceId: DModelSourceId, prompt: string, _count: number): Promise<string[]> {
//
//   // parallelize the image generation depending on how many images can a model generate
//   const imagePromises: Promise<string[]>[] = [];
//   while (_count > 0) {
//
//     // per-request count
//     const perRequestCount = 1; // Math.min(_count, isD3 ? 1 : 10);
//
//     const imageRefPromise = apiAsync.llmOpenAI.createImages.mutate({
//       access: findAccessForSourceOrThrow(modelSourceId),
//       config: {
//         prompt: prompt,
//         count: perRequestCount,
//         model: 'stablediffusion' as any, //  dalleModelId,
//         quality: 'hd', // dalleQuality,
//         responseFormat: 'b64_json',
//         size: '512x512', // dalleSize,
//         style: 'vivid', // dalleStyle,
//       },
//     }).then(images =>
//       // convert to markdown image references
//       images.map(({ imageUrl, altText }) => `![${altText}](${imageUrl})`),
//     );
//
//     imagePromises.push(imageRefPromise);
//     _count -= perRequestCount;
//   }
//
//   // run all image generation requests
//   const imageRefsBatchesResults = await Promise.allSettled(imagePromises);
//
//   // throw if ALL promises were rejected
//   const allRejected = imageRefsBatchesResults.every(result => result.status === 'rejected');
//   if (allRejected) {
//     const errorMessages = imageRefsBatchesResults
//       .map(result => {
//         const reason = (result as PromiseRejectedResult).reason as any; // TRPCClientError<TRPCErrorShape>;
//         return reason?.shape?.message || reason?.message || '';
//       })
//       .filter(message => !!message)
//       .join(', ');
//
//     throw new Error(`LocalAI image generation: ${errorMessages}`);
//   }
//
//   // take successful results and return as string[]
//   return imageRefsBatchesResults
//     .filter(result => result.status === 'fulfilled') // Only take fulfilled promises
//     .map(result => (result as PromiseFulfilledResult<string[]>).value) // Extract the value
//     .flat();
// }