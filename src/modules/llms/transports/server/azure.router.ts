// Wire schemas

  /* Azure: Chat generation */
  /*chatGenerate: publicProcedure
    .input(azureChatGenerateSchema)
    .output(openAIChatGenerateOutputSchema)
    .mutation(async ({ input }) => {

      const { access, model, history } = input;

      // https://eoai1uc1.openai.azure.com/openai/deployments/my-gpt-35-turbo-1/chat/completions?api-version=2023-07-01-preview
      // https://eoai1uc1.openai.azure.com/openai/deployments?api-version=2023-03-15-preview

      const wireCompletions = await azureOpenAIPOST<OpenAI.Wire.ChatCompletion.Response, OpenAI.Wire.ChatCompletion.Request>(
        access.azureEndpoint, access.azureKey,
        openAIChatCompletionPayload(model, history, null, null, 1, false),
        //  '/v1/chat/completions',
        `/openai/deployments/${input.model.id}/chat/completions?api-version=2023-09-01-preview`,
      );

      // expect a single output
      if (wireCompletions?.choices?.length !== 1)
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `[Azure OpenAI Issue] Expected 1 completion, got ${wireCompletions?.choices?.length}` });
      let { message, finish_reason } = wireCompletions.choices[0];

      // LocalAI hack/workaround, until https://github.com/go-skynet/LocalAI/issues/788 is fixed
      if (finish_reason === undefined)
        finish_reason = 'stop';

      // check for a function output
      // return parseChatGenerateOutput(message as OpenAI.Wire.ChatCompletion.ResponseMessage, finish_reason);
      return {
        role: 'assistant',
        content: message.content || '',
        finish_reason: finish_reason as 'stop' | 'length',
      };
    }),
*/