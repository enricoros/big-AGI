// Future Testing Code
//
// const sampleFC: boolean = false; // aixModel.id.indexOf('models/gemini') === -1;
// const sampleCE: boolean = false; // aixModel.id.indexOf('models/gemini') !== -1;
// if (sampleFC) {
//   aixChatGenerate.tools = [
//     {
//       type: 'function_call',
//       function_call: {
//         name: 'get_capybara_info_given_name_and_color',
//         description: 'Get the info about capybaras. Call one each per name.',
//         input_schema: {
//           properties: {
//             'name': {
//               type: 'string',
//               description: 'The name of the capybara',
//               enum: ['enrico', 'coolio'],
//             },
//             'color': {
//               type: 'string',
//               description: 'The color of the capybara. Mandatory!!',
//             },
//             // 'story': {
//             //   type: 'string',
//             //   description: 'A fantastic story about the capybara. Please 10 characters maximum.',
//             // },
//           },
//           required: ['name'],
//         },
//       },
//     },
//   ];
// }
// if (sampleCE) {
//   aixChatGenerate.tools = [
//     {
//       type: 'code_execution',
//       variant: 'gemini_auto_inline',
//     },
//   ];
// }

/**
 * OpenAI-specific moderation check. This is a separate function, as it's not part of the
 * streaming chat generation, but it's a pre-check before we even start the streaming.
 *
 * @returns null if the message is safe, or a string with the user message if it's not safe
 */
/* NOTE: NOT PORTED TO AIX YET, this was the former "LLMS" implementation
async function _openAIModerationCheck(access: OpenAIAccessSchema, lastMessage: ... | null): Promise<string | null> {
  if (!lastMessage || lastMessage.role !== 'user')
    return null;

  try {
    const moderationResult = await apiAsync.llmOpenAI.moderation.mutate({
      access, text: lastMessage.content,
    });
    const issues = moderationResult.results.reduce((acc, result) => {
      if (result.flagged) {
        Object
          .entries(result.categories)
          .filter(([_, value]) => value)
          .forEach(([key, _]) => acc.add(key));
      }
      return acc;
    }, new Set<string>());

    // if there's any perceived violation, we stop here
    if (issues.size) {
      const categoriesText = [...issues].map(c => `\`${c}\``).join(', ');
      // do not proceed with the streaming request
      return `[Moderation] I an unable to provide a response to your query as it violated the following categories of the OpenAI usage policies: ${categoriesText}.\nFor further explanation please visit https://platform.openai.com/docs/guides/moderation/moderation`;
    }
  } catch (error: any) {
    // as the moderation check was requested, we cannot proceed in case of error
    return '[Issue] There was an error while checking for harmful content. ' + error?.toString();
  }

  // moderation check was successful
  return null;
}
*/