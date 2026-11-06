<!--
  Upstream snapshot - DO NOT EDIT - run _upstream/sync.sh to refresh
  Source: https://ai.google.dev/api/interactions-api.md.txt
  Synced: 2026-11-06
  Consumed by: gemini.interactions.wiretypes.ts, gemini.interactions.parser.ts, gemini.interactionsCreate.ts, gemini.interactionsPoller.ts
  Companion: ./gemini.interactions.guide.md (the Interactions API guide)
-->

> ## AI Agent Context
> Get the complete documentation index at: https://aistudio.google.com/llms.txt
> Use this file to discover all available pages.
> For the full documentation in a single file, fetch: https://aistudio.google.com/llms-full.txt

# Gemini Interactions API

{% callout type="note" %}
  **Recommended:** The **Interactions API** is the recommended standard API for all new projects and applications using Gemini. It is optimized for agentic workflows, server-side state management, and real-time conversations.

{% /callout %}

{% callout type="note" %}
  You are viewing the beta version of the Interactions API. Endpoints are under `/v1beta/`. The stable [v1 version](/api-reference/interactions-api?api-version=v1) is also available.

{% /callout %}

The Gemini Interactions API allows developers to build generative AI applications using Gemini models. Gemini is our most capable model, built from the ground up to be multimodal. It can generalize and seamlessly understand, operate across, and combine different types of information including language, images, audio, video, and code. You can use the Gemini API for use cases like reasoning across text and images, content generation, dialogue agents, summarization and classification systems, and more.

## Methods  {% id="methods" %}

{% table %}
  * Method
  * HTTP request

  ---

  * [Creating an interaction](/api-reference/interactions-api/create-interaction)
  *     {% mark class="http-post" %}{% icon name="north_east" /%}`POST`{% /mark %} `/v1beta/interactions`

    Creates a new interaction.


  ---

  * [Canceling an interaction](/api-reference/interactions-api/cancel-interaction-by-id)
  *     {% mark class="http-post" %}{% icon name="north_east" /%}`POST`{% /mark %} `/v1beta/interactions/{id}/cancel`

    Cancels an interaction by id.


  ---

  * [Getting an interaction](/api-reference/interactions-api/get-interaction-by-id)
  *     {% mark class="http-get" %}{% icon name="south_west" /%}`GET`{% /mark %} `/v1beta/interactions/{id}`

    Retrieves the full details of a single interaction based on its `Interaction.id`.


  ---

  * [Deleting an interaction](/api-reference/interactions-api/delete-interaction)
  *     {% mark class="http-delete" %}{% icon name="close" /%}`DELETE`{% /mark %} `/v1beta/interactions/{id}`

    Deletes the interaction by id.

{% /table %}

## Resources  {% id="resources" %}

### Interaction  {% id="Resource:Interaction" %}

The Interaction resource.

{% two-column-layout %}
  {% left-column %}
  **Properties:**

  {% section class="api-ref-property-list" %}
  **id**: {% mark %}required{% /mark %} `string`

  Output only. A unique identifier for the interaction completion.

  {% hr /%}

  {% details %}
  {% summary %}
  **status**: {% mark %}required{% /mark %} `string enum`

  Output only. The status of the interaction.

  {% /summary %}

  Possible values:

  - `in_progress`: The interaction is in progress.
  - `requires_action`: The interaction requires action/input from the user.
  - `completed`: The interaction is completed.
  - `failed`: The interaction failed.
  - `cancelled`: The interaction was cancelled.
  - `incomplete`: The interaction is completed, but contains incomplete results (e.g. hitting max_tokens).
  - `requires_continuation`: The interaction requires at least one more request for it to be completed. The next request should set the continuation_token to the one returned by this request.

  {% /details %}

  {% hr /%}

  **created**: {% mark %}required{% /mark %} `string`

  Output only. The time at which the response was created in ISO 8601 format (YYYY-MM-DDThh:mm:ssZ).

  {% hr /%}

  **updated**: {% mark %}required{% /mark %} `string`

  Output only. The time at which the response was last updated in ISO 8601 format (YYYY-MM-DDThh:mm:ssZ).

  {% hr /%}

  **steps**: {% mark %}required{% /mark %} [`Step`](/api-reference/interactions-api#Resource:Step) `array`

  Output only. The steps that make up the interaction, when included in the response.

  {% hr /%}

  {% details %}
  {% summary %}
  **model**: `ModelOption`

  The name of the `Model` used for generating the interaction.

  {% /summary %}

  Possible values:

  - `gemma-4-26b-a4b-it`: Gemma 4 26B A4B IT
  - `gemma-4-31b-it`: Gemma 4 31B IT
  - `gemini-flash-latest`: Latest release of Gemini Flash
  - `gemini-flash-lite-latest`: Latest release of Gemini Flash-Lite
  - `gemini-pro-latest`: Latest release of Gemini Pro
  - `gemini-2.5-flash`: Our first hybrid reasoning model which supports a 1M token context window and has thinking budgets.
  - `gemini-2.5-pro`: Our state-of-the-art multipurpose model, which excels at coding and complex reasoning tasks.
  - `gemini-2.5-flash-lite`: Our smallest and most cost effective model, built for at scale usage.
  - `gemini-3.5-flash-lite`: Gemini 3.5 Flash-Lite - Our fastest, most cost-effective 3.5 model for high-throughput execution.
  - `gemini-2.5-flash-image`: Our native image generation model, optimized for speed, flexibility, and contextual understanding. Text input and output is priced the same as 2.5 Flash.
  - `gemini-3-flash-preview`: Our most intelligent model built for speed, combining frontier intelligence with superior search and grounding.
  - `gemini-3.1-pro-preview`: Our latest SOTA reasoning model with unprecedented depth and nuance, and powerful multimodal understanding and coding capabilities.
  - `gemini-3.1-pro-preview-customtools`: Gemini 3.1 Pro Preview optimized for custom tool usage
  - `gemini-3.1-flash-lite`: Our most cost-efficient model, optimized for high-volume agentic tasks, translation, and simple data processing.
  - `gemini-3.1-flash-lite-image`: Gemini 3.1 Flash Lite Image.
  - `gemini-3-pro-image`: Gemini 3 Pro Image
  - `nano-banana-pro-preview`: Gemini 3 Pro Image Preview
  - `gemini-3.1-flash-image`: Gemini 3.1 Flash Image.
  - `gemini-nano-banana-2.1`: Gemini Nano Banana 2.1.
  - `gemini-3.1-flash-tts-preview`: Gemini 3.1 Flash TTS: Powerful, low-latency speech generation. Enjoy natural outputs, steerable prompts, and new expressive audio tags for precise narration control.
  - `gemini-3.5-flash`: Gemini 3.5 Flash - Our earlier Flash model, built for speed and foundational performance across routine, high-throughput workloads.
  - `gemini-3.6-flash`: Gemini 3.6 Flash - Our previous generation Flash model, balancing speed and multimodal capabilities across general agentic and everyday tasks.
  - `gemini-3.7-flash`: Gemini 3.7 Flash - Our high-speed, efficient Flash model built for everyday coding, agentic tool use, and reliable multi-step execution.
  - `gemini-3.8-flash`: Gemini 3.8 Flash - Our most intelligent Flash model, engineered for long-horizon software engineering, autonomous agents, and complex enterprise workflows.
  - `gemini-3.8-flash-tts`: Gemini 3.8 Flash TTS - Flagship TTS model for Voice Design and dual-speaker screenplay control. Prompt custom vocal personas, direct line-by-line delivery, and add vocal bursts.
  - `gemini-3.8-flash-lite-tts`: Gemini 3.8 Flash Lite TTS - High-speed and cost-efficient, ideal for rapid dubbing, media localization, and high-throughput voice agents. Direct replacement for gemini-3.1-flash-tts-preview.
  - `lyria-3-clip-preview`: Our low-latency, music generation model optimized for high-fidelity audio clips and precise rhythmic control.
  - `lyria-3-pro-preview`: Our advanced, full-song generative model with deep compositional understanding, optimized for precise structural control and complex transitions across diverse musical styles.
  - `gemini-robotics-er-1.6-preview`: Gemini Robotics-ER 1.6 Preview
  - `gemini-robotics-er-2-preview`: Gemini Robotics Embodied Reasoning 2 Preview
  - `lyria-3.5`: Our flagship music generation model, optimized for full-length songs with complex structural coherence.
  - `gemini-omni-1.1-flash`: Our high-performance multimodal model designed for fast, conversational video generation, editing, and cinematic control.
  - `gemini-omni-flash-preview`: Preview release of our multimodal model for conversational video generation, editing, and cinematic control.

  {% /details %}

  {% hr /%}

  {% details %}
  {% summary %}
  **generation_config**: `GenerationConfig`

  Input only. Configuration parameters for the model interaction.

  {% /summary %}

  **seed**: `integer`

  Seed used in decoding for reproducibility.

  **stop_sequences**: `string array`

  A list of character sequences that will stop output interaction.

  {% details %}
  {% summary %}
  **tool_choice**: [`ToolChoiceConfig`](/api-reference/interactions-api#Resource:ToolChoiceConfig) or `string enum`

  The tool choice configuration.

  {% /summary %}

  **Possible Types:** {% class="api-ref-label" %}

  {% details %}
  {% summary %}
  **[ToolChoiceConfig](/api-reference/interactions-api#Resource:ToolChoiceConfig)**

  {% /summary %}

  The tool choice configuration containing allowed tools.

  {% details %}
  {% summary %}
  **allowed_tools**: `AllowedTools`

  The allowed tools.

  {% /summary %}

  {% details %}
  {% summary %}
  **mode**: `string enum`

  The mode of the tool choice.

  {% /summary %}

  Possible values:

  - `auto`: Auto tool choice.
  - `any`: Any tool choice.
  - `none`: No tool choice.
  - `validated`: Validated tool choice.

  {% /details %}

  **tools**: `string array`

  The names of the allowed tools.

  {% /details %}

  {% /details %}

  {% details %}
  {% summary %}
  **string enum**

  {% /summary %}

  Possible values:

  - `auto`: Auto tool choice.
  - `any`: Any tool choice.
  - `none`: No tool choice.
  - `validated`: Validated tool choice.

  {% /details %}

  {% /details %}

  {% details %}
  {% summary %}
  **thinking_level**: `ThinkingLevel`

  The level of thought tokens that the model should generate.

  {% /summary %}

  Possible values:

  - `minimal`: Little to no thinking.
  - `low`: Low thinking level.
  - `medium`: Medium thinking level.
  - `high`: High thinking level.

  {% /details %}

  {% details %}
  {% summary %}
  **thinking_summaries**: `ThinkingSummaries`

  Whether to include thought summaries in the response.

  {% /summary %}

  Possible values:

  - `auto`: Auto thinking summaries.
  - `none`: No thinking summaries.

  {% /details %}

  **max_output_tokens**: `integer`

  The maximum number of tokens to include in the response.

  {% details %}
  {% summary %}
  **video_config**: `VideoConfig`

  Configuration for video generation.

  {% /summary %}

  {% details %}
  {% summary %}
  **task**: `string enum`

  Optional task mode for video generation. If not specified, the model automatically determines the appropriate mode based on the provided text prompt and input media.

  {% /summary %}

  Possible values:

  - `text_to_video`: Generates video solely from a text prompt.
  - `image_to_video`: Generates video from one or two source images. The first image defines the starting frame, and the optional second image defines the ending frame.
  - `reference_to_video`: Generates video using reference media (such as images, audio, or video).
  - `edit`: Modifies an existing input video.
  - `extend`: Extends an existing input video.

  {% /details %}

  {% /details %}

  {% details %}
  {% summary %}
  **transcription_config**: `TranscriptionConfig`

  Optional. Configuration for speech recognition (transcription). If present, ASR is enabled.

  {% /summary %}

  **language_codes**: `string array`

  Optional. BCP-47 language codes providing hints about the languages present in the audio. If omitted or empty, defaults to automatic language detection.

  **custom_vocabulary**: `string array`

  Optional. A list of custom vocabulary phrases to bias the speech recognition model toward recognizing specific terms.

  {% details %}
  {% summary %}
  **mode**: `TranscriptionMode` or `string enum`

  Discriminated transcription mode options or enum.

  {% /summary %}

  **Possible Types:** {% class="api-ref-label" %}

  {% details %}
  {% summary %}
  **SmartTranscriptionMode**

  {% /summary %}

  Configuration for smart transcription mode.

  **type**: {% mark %}required{% /mark %} `object`

  Value: `smart`

  **source_text**: `string`

  The source text to be edited or rewritten via voice instructions. When provided, the model performs voice-driven editing and outputs the finalized replacement text.

  {% /details %}

  {% details %}
  {% summary %}
  **VerbatimTranscriptionMode**

  {% /summary %}

  Configuration for verbatim transcription mode.

  **type**: {% mark %}required{% /mark %} `object`

  Value: `verbatim`

  **timestamp_granularities**: `string array`

  Optional. The granularity of timestamps to include in the transcription output. Supported values: "word". If empty, no timestamps are generated.

  **diarization_mode**: `string`

  Optional. Configures speaker diarization. Supported values: "speaker".

  {% /details %}

  {% details %}
  {% summary %}
  **string enum**

  {% /summary %}

  Possible values:

  - `verbatim`: Verbatim transcription mode.
  - `smart`: Smart transcription mode.

  {% /details %}

  {% /details %}

  {% /details %}

  {% details %}
  {% summary %}
  **structured_speech_config**: `SpeakerConfig` or `SpeechConfig array`

  Speech and multi-speaker configuration.

  {% /summary %}

  **Possible Types:** {% class="api-ref-label" %}

  {% details %}
  {% summary %}
  **SpeakerConfig**

  {% /summary %}

  Configuration for multi-speaker and speech generation.

  {% details %}
  {% summary %}
  **speakers**: `SpeechConfig array`

  Individual speaker configurations.

  {% /summary %}

  **voice**: `string`

  The voice of the speaker.

  **language**: `string`

  The language of the speech.

  **speaker**: `string`

  The speaker's name, it should match the speaker name given in the prompt.

  {% /details %}

  {% /details %}

  {% details %}
  {% summary %}
  **SpeechConfig array**

  {% /summary %}

  The configuration for speech interaction.

  **voice**: `string`

  The voice of the speaker.

  **language**: `string`

  The language of the speech.

  **speaker**: `string`

  The speaker's name, it should match the speaker name given in the prompt.

  {% /details %}

  {% /details %}

  {% /details %}

  {% hr /%}

  **system_instruction**: `string`

  System instruction for the interaction.

  {% hr /%}

  **tools**: [`Tool`](/api-reference/interactions-api#Resource:Tool) `array`

  A list of tool declarations the model may call during interaction.

  {% hr /%}

  **input**: [`Content`](/api-reference/interactions-api#Resource:Content) or [`Content`](/api-reference/interactions-api#Resource:Content) `array` or [`Step`](/api-reference/interactions-api#Resource:Step) `array` or `string`

  The input for the interaction.

  {% hr /%}

  {% details %}
  {% summary %}
  **usage**: `Usage`

  Output only. Statistics on the interaction request's token usage.

  {% /summary %}

  **total_input_tokens**: `integer`

  Number of tokens in the prompt (context).

  **initial_input_tokens**: `integer`

  Number of input tokens used in the first turn of this interaction.

  {% details %}
  {% summary %}
  **input_tokens_by_modality**: `ModalityTokens array`

  A breakdown of input token usage by modality.

  {% /summary %}

  {% details %}
  {% summary %}
  **modality**: `ResponseModality`

  The modality associated with the token count.

  {% /summary %}

  Possible values:

  - `text`: Indicates the model should return text.
  - `image`: Indicates the model should return images.
  - `audio`: Indicates the model should return audio.
  - `video`: Indicates the model should return video.
  - `document`: Indicates the model should return documents.

  {% /details %}

  **tokens**: `integer`

  Number of tokens for the modality.

  {% /details %}

  **total_cached_tokens**: `integer`

  Number of tokens in the cached part of the prompt (the cached content).

  {% details %}
  {% summary %}
  **cached_tokens_by_modality**: `ModalityTokens array`

  A breakdown of cached token usage by modality.

  {% /summary %}

  {% details %}
  {% summary %}
  **modality**: `ResponseModality`

  The modality associated with the token count.

  {% /summary %}

  Possible values:

  - `text`: Indicates the model should return text.
  - `image`: Indicates the model should return images.
  - `audio`: Indicates the model should return audio.
  - `video`: Indicates the model should return video.
  - `document`: Indicates the model should return documents.

  {% /details %}

  **tokens**: `integer`

  Number of tokens for the modality.

  {% /details %}

  **total_output_tokens**: `integer`

  Total number of tokens across all the generated responses.

  {% details %}
  {% summary %}
  **output_tokens_by_modality**: `ModalityTokens array`

  A breakdown of output token usage by modality.

  {% /summary %}

  {% details %}
  {% summary %}
  **modality**: `ResponseModality`

  The modality associated with the token count.

  {% /summary %}

  Possible values:

  - `text`: Indicates the model should return text.
  - `image`: Indicates the model should return images.
  - `audio`: Indicates the model should return audio.
  - `video`: Indicates the model should return video.
  - `document`: Indicates the model should return documents.

  {% /details %}

  **tokens**: `integer`

  Number of tokens for the modality.

  {% /details %}

  **total_tool_use_tokens**: `integer`

  Number of tokens present in tool-use prompt(s).

  {% details %}
  {% summary %}
  **tool_use_tokens_by_modality**: `ModalityTokens array`

  A breakdown of tool-use token usage by modality.

  {% /summary %}

  {% details %}
  {% summary %}
  **modality**: `ResponseModality`

  The modality associated with the token count.

  {% /summary %}

  Possible values:

  - `text`: Indicates the model should return text.
  - `image`: Indicates the model should return images.
  - `audio`: Indicates the model should return audio.
  - `video`: Indicates the model should return video.
  - `document`: Indicates the model should return documents.

  {% /details %}

  **tokens**: `integer`

  Number of tokens for the modality.

  {% /details %}

  **total_thought_tokens**: `integer`

  Number of tokens of thoughts for thinking models.

  **total_tokens**: `integer`

  Total token count for the interaction request (prompt + responses + other internal tokens).

  {% details %}
  {% summary %}
  **grounding_tool_count**: `GroundingToolCount array`

  Grounding tool count.

  {% /summary %}

  {% details %}
  {% summary %}
  **type**: `string enum`

  The grounding tool type associated with the count.

  {% /summary %}

  Possible values:

  - `google_search`: Grounding with Google Web Search and Image Search, & Web Grounding for Enterprise.
  - `google_maps`: Grounding with Google Maps.

  {% /details %}

  **count**: `integer`

  The number of grounding tool counts.

  {% /details %}

  {% /details %}

  {% hr /%}

  {% details %}
  {% summary %}
  **response_format**: [`ResponseFormat`](/api-reference/interactions-api#Resource:ResponseFormat) or [`ResponseFormat`](/api-reference/interactions-api#Resource:ResponseFormat) `array`

  Enforces that the generated response is a JSON object that complies with the JSON schema specified in this field.

  {% /summary %}

  **Possible Types:** {% class="api-ref-label" %}

  {% details %}
  {% summary %}
  **[ResponseFormat](/api-reference/interactions-api#Resource:ResponseFormat)**

  {% /summary %}

  {% /details %}

  {% details %}
  {% summary %}
  **[ResponseFormat](/api-reference/interactions-api#Resource:ResponseFormat) array**

  {% /summary %}

  A list where each item is one of: `AudioResponseFormat`, `ImageResponseFormat`, `TextResponseFormat`, `VideoResponseFormat`.

  {% /details %}

  {% /details %}

  {% hr /%}

  **previous_interaction_id**: `string`

  The ID of the previous interaction, if any.

  {% hr /%}

  {% details %}
  {% summary %}
  **environment**: [`EnvironmentConfig`](/api-reference/interactions-api#Resource:EnvironmentConfig) or `string`

  The environment configuration for the interaction. Can be an object specifying remote environment sources or a string referencing an existing environment ID.

  {% /summary %}

  **Possible Types:** {% class="api-ref-label" %}

  {% details %}
  {% summary %}
  **[EnvironmentConfig](/api-reference/interactions-api#Resource:EnvironmentConfig)**

  {% /summary %}

  Configuration for a custom environment.

  **type**: {% mark %}required{% /mark %} `object`

  Value: `remote`

  {% details %}
  {% summary %}
  **sources**: `Source array`

  {% /summary %}

  {% details %}
  {% summary %}
  **type**: `string enum`

  {% /summary %}

  Possible values:

  - `gcs`: A Cloud Storage bucket.
  - `inline`: Inline content.
  - `repository`: A generic repository. The protocol prefix in the source URL identifies the provider (e.g., github://, gcs://).

  {% /details %}

  **source**: `string`

  The source of the environment. For Cloud Storage, this is the Cloud Storage path. For GitHub, this is the GitHub path.

  **target**: `string`

  Where the source should appear in the environment.

  **content**: `string`

  The inline content if `type` is `INLINE`.

  **encoding**: `string`

  Optional encoding for inline content (e.g. `base64`).

  {% /details %}

  {% details %}
  {% summary %}
  **network**: [`EnvironmentNetworkEgressAllowlist`](/api-reference/interactions-api#Resource:EnvironmentNetworkEgressAllowlist) or `string enum`

  Network configuration for the environment.

  {% /summary %}

  **Possible Types:** {% class="api-ref-label" %}

  {% details %}
  {% summary %}
  **[EnvironmentNetworkEgressAllowlist](/api-reference/interactions-api#Resource:EnvironmentNetworkEgressAllowlist)**

  {% /summary %}

  Network egress configuration for the environment.

  {% details %}
  {% summary %}
  **allowlist**: `EgressRule array` or `string enum`

  List of allowed domains and their configurations. Set to `"disabled"` to block all network egress.

  {% /summary %}

  **Possible Types:** {% class="api-ref-label" %}

  {% details %}
  {% summary %}
  **EgressRule array**

  {% /summary %}

  A single domain allowlist rule with optional header injection.

  **domain**: {% mark %}required{% /mark %} `string`

  Domain to allow outbound requests to. Supports wildcards (e.g. '*.googleapis.com'). Use '*' to allow all domains.

  **transform**: `object`

  Headers to inject into requests matching this rule. Key: header name (e.g., "Authorization"). Value: header value (e.g., "Bearer your-token").

  **credential**: `string`

  Optional. Reference to a server-managed Credential resource by ID.

  {% /details %}

  {% details %}
  {% summary %}
  **string enum**

  {% /summary %}

  Possible values:

  - `disabled`: All network egress is blocked.

  {% /details %}

  {% /details %}

  {% /details %}

  {% details %}
  {% summary %}
  **string enum**

  {% /summary %}

  Possible values:

  - `disabled`: All network egress is blocked.

  {% /details %}

  {% /details %}

  **environment_id**: `string`

  Optional. The environment ID for the interaction. If specified, the request will update the existing environment instead of creating a new one.

  {% details %}
  {% summary %}
  **env**: `object` or `string`

  Environment variables to set in the sandbox environment.

  {% /summary %}

  **Possible Types:** {% class="api-ref-label" %}

  {% details %}
  {% summary %}
  **string**

  {% /summary %}

  A direct string value.

  {% /details %}

  {% /details %}

  {% /details %}

  {% details %}
  {% summary %}
  **string**

  {% /summary %}

  A direct string value.

  {% /details %}

  {% /details %}

  {% hr /%}

  **environment_id**: `string`

  Output only. The environment ID for the interaction. Only populated if environment config is set in the request.

  {% hr /%}

  {% details %}
  {% summary %}
  **service_tier**: `ServiceTier`

  The service tier for the interaction.

  {% /summary %}

  Possible values:

  - `flex`: Flex service tier.
  - `standard`: Standard service tier.
  - `priority`: Priority service tier.

  {% /details %}

  {% hr /%}

  {% details %}
  {% summary %}
  **webhook_config**: `WebhookConfig`

  Optional. Webhook configuration for receiving notifications when the interaction completes.

  {% /summary %}

  **uris**: `string array`

  Optional. If set, these webhook URIs will be used for webhook events instead of the registered webhooks.

  **user_metadata**: `object`

  Optional. The user metadata that will be returned on each event emission to the webhooks.

  {% /details %}

  {% hr /%}

  {% details %}
  {% summary %}
  **safety_settings**: `SafetySetting array`

  Safety settings for the interaction.

  {% /summary %}

  {% details %}
  {% summary %}
  **type**: {% mark %}required{% /mark %} `HarmCategory`

  The type of harm category to be blocked.

  {% /summary %}

  Possible values:

  - `hate_speech`: Content that promotes violence or incites hatred against individuals or groups based on certain attributes.
  - `dangerous_content`: Content that promotes, facilitates, or enables dangerous activities.
  - `harassment`: Abusive, threatening, or content intended to bully, torment, or ridicule.
  - `sexually_explicit`: Content that contains sexually explicit material.
  - `jailbreak`: Prompts designed to bypass safety filters.

  {% /details %}

  {% details %}
  {% summary %}
  **threshold**: {% mark %}required{% /mark %} `string enum`

  The threshold for blocking content. If the harm probability exceeds this threshold, the content will be blocked.

  {% /summary %}

  Possible values:

  - `block_low_and_above`: Block content with a low harm probability or higher.
  - `block_medium_and_above`: Block content with a medium harm probability or higher.
  - `block_only_high`: Block content with a high harm probability.
  - `off`: Turn off the safety filter entirely.

  {% /details %}

  {% details %}
  {% summary %}
  **method**: `string enum`

  Optional. The method for blocking content. If not specified, the default behavior is to use the probability score.

  {% /summary %}

  Possible values:

  - `severity`: The harm block method uses both probability and severity scores.
  - `probability`: The harm block method uses the probability score.

  {% /details %}

  {% /details %}

  {% hr /%}

  **labels**: `object`

  The labels with user-defined metadata for the request. Label keys and values can be no longer than 63 characters (Unicode codepoints) and can only contain lowercase letters, numeric characters, underscores, and dashes. International characters are allowed. Label values are optional. Label keys must start with a letter.

  {% hr /%}

  {% details %}
  {% summary %}
  **errors**: `Error array`

  Output only. Diagnostic faults / platform errors recorded on the interaction.

  {% /summary %}

  **code**: `string`

  A URI that identifies the error type.

  **message**: `string`

  A human-readable error message.

  {% /details %}

  {% hr /%}

  **continuation_token**: `string`

  Opaque token to resume a long decode. Output: set when status is REQUIRES_CONTINUATION and decoding can be resumed. Input: pass the latest token back unchanged in CreateInteraction to continue decoding.

  {% hr /%}

  **stream**: `boolean`

  Input only. Whether the interaction will be streamed.

  {% hr /%}

  **store**: `boolean`

  Input only. Whether to store the response and request for later retrieval.

  {% hr /%}

  **background**: `boolean`

  Input only. Whether to run the model interaction in the background.

  {% hr /%}

  {% details %}
  {% summary %}
  **agent**: `AgentOption`

  The name of the `Agent` used for generating the interaction.

  {% /summary %}

  Possible values:

  - `deep-research-preview-04-2026`: Gemini Deep Research Agent
  - `deep-research-max-preview-04-2026`: Gemini Deep Research Max Agent
  - `antigravity-preview-05-2026`: Use the Antigravity managed agent to perform multi-step tasks that require reasoning, file operations, and tool use.

  {% /details %}

  {% hr /%}

  {% details %}
  {% summary %}
  **agent_config**: `AntigravityAgentConfig` or `DeepResearchAgentConfig` or `DynamicAgentConfig`

  Configuration parameters for the agent interaction.

  {% /summary %}

  **Possible Types:** {% class="api-ref-label" %}

  {% details %}
  {% summary %}
  **AntigravityAgentConfig**

  {% /summary %}

  Configuration for the Antigravity agent runtime. Provides server-side control over the agent's execution environment and tool configuration.

  **type**: {% mark %}required{% /mark %} `object`

  Value: `antigravity`

  **model**: `string`

  The model to use for agent reasoning.

  **max_total_tokens**: `string`

  Max total tokens for the agent run.

  {% /details %}

  {% details %}
  {% summary %}
  **DeepResearchAgentConfig**

  {% /summary %}

  Configuration for the Deep Research agent.

  **type**: {% mark %}required{% /mark %} `object`

  Value: `deep-research`

  {% details %}
  {% summary %}
  **thinking_summaries**: `ThinkingSummaries`

  Whether to include thought summaries in the response.

  {% /summary %}

  Possible values:

  - `auto`: Auto thinking summaries.
  - `none`: No thinking summaries.

  {% /details %}

  {% details %}
  {% summary %}
  **visualization**: `string enum`

  Whether to include visualizations in the response.

  {% /summary %}

  Possible values:

  - `off`: Do not include visualizations.
  - `auto`: Automatically include visualizations.

  {% /details %}

  **collaborative_planning**: `boolean`

  Enables human-in-the-loop planning for the Deep Research agent. If set to true, the Deep Research agent will provide a research plan in its response. The agent will then proceed only if the user confirms the plan in the next turn.

  {% /details %}

  {% details %}
  {% summary %}
  **DynamicAgentConfig**

  {% /summary %}

  Configuration for dynamic agents.

  **type**: {% mark %}required{% /mark %} `object`

  Value: `dynamic`

  {% /details %}

  {% /details %}

  {% hr /%}

  **max_total_tokens**: `string`

  Max total tokens for the agent run.

  {% /section %}

  {% /left-column %}

  {% right-column class="sticky" %}
  **Example**

  ```json
  {
    "created": "2025-12-04T15:01:45Z",
    "id": "v1_ChdXS0l4YWZXTk9xbk0xZThQczhEcmlROBIXV0tJeGFmV05PcW5NMWU4UHM4RHJpUTg",
    "model": "gemini-3.6-flash",
    "object": "interaction",
    "status": "completed",
    "steps": [
      {
        "type": "model_output",
        "content": [
          {
            "type": "text",
            "text": "Hello! I'm doing well, functioning as expected. Thank you for asking! How are you doing today?"
          }
        ]
      }
    ],
    "updated": "2025-12-04T15:01:45Z",
    "usage": {
      "input_tokens_by_modality": [
        {
          "modality": "text",
          "tokens": 7
        }
      ],
      "total_cached_tokens": 0,
      "total_input_tokens": 7,
      "total_output_tokens": 23,
      "total_thought_tokens": 49,
      "total_tokens": 79,
      "total_tool_use_tokens": 0
    }
  }
  ```

  {% /right-column %}

{% /two-column-layout %}

## Data Models  {% id="data-models" %}

### Content  {% id="Resource:Content" %}

The content of the response.

**Polymorphic Types:**

{% details %}
  {% summary %}
  **AudioContent**

  {% /summary %}

  An audio content block.

  {% two-column-layout %}
  {% left-column %}
  {% section class="api-ref-property-list" %}
  **type**: {% mark %}required{% /mark %} `object`

  Value: `audio`

  {% hr /%}

  **data**: `string`

  The audio content.

  {% hr /%}

  **uri**: `string`

  The URI of the audio.

  {% hr /%}

  **channels**: `integer`

  The number of audio channels.

  {% hr /%}

  **sample_rate**: `integer`

  The sample rate of the audio.

  {% hr /%}

  {% details %}
  {% summary %}
  **mime_type**: `string enum`

  The mime type of the audio.

  {% /summary %}

  Possible values:

  - `audio/wav`: WAV audio format
  - `audio/mp3`: MP3 audio format
  - `audio/aiff`: AIFF audio format
  - `audio/aac`: AAC audio format
  - `audio/ogg`: OGG audio format
  - `audio/flac`: FLAC audio format
  - `audio/mpeg`: MPEG audio format
  - `audio/m4a`: M4A audio format
  - `audio/l16`: L16 audio format
  - `audio/opus`: OPUS audio format
  - `audio/alaw`: ALAW audio format
  - `audio/mulaw`: MULAW audio format
  - `audio/webm`: WEBM audio format

  {% /details %}

  {% /section %}

  {% /left-column %}

  {% right-column class="sticky" %}
  **Example**

  **Audio**

  ```json
  {
    "type": "audio",
    "data": "BASE64_ENCODED_AUDIO",
    "mime_type": "audio/wav"
  }
  ```

  {% /right-column %}

  {% /two-column-layout %}

{% /details %}

{% details %}
  {% summary %}
  **DocumentContent**

  {% /summary %}

  A document content block.

  {% two-column-layout %}
  {% left-column %}
  {% section class="api-ref-property-list" %}
  **type**: {% mark %}required{% /mark %} `object`

  Value: `document`

  {% hr /%}

  **data**: `string`

  The document content.

  {% hr /%}

  **uri**: `string`

  The URI of the document.

  {% hr /%}

  {% details %}
  {% summary %}
  **mime_type**: `string enum`

  The mime type of the document.

  {% /summary %}

  Possible values:

  - `application/pdf`: PDF document format
  - `text/csv`: CSV document format
  - `application/vnd.openxmlformats-officedocument.presentationml.presentation`: PPTX presentation format
  - `application/vnd.ms-powerpoint`: PPT presentation format
  - `application/vnd.oasis.opendocument.presentation`: ODP presentation format
  - `application/vnd.openxmlformats-officedocument.wordprocessingml.document`: DOCX document format
  - `application/msword`: DOC document format
  - `application/vnd.openxmlformats-officedocument.wordprocessingml.template`: DOTX document template format
  - `application/vnd.oasis.opendocument.text`: ODT document format
  - `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`: XLSX spreadsheet format
  - `application/vnd.ms-excel`: XLS spreadsheet format
  - `application/vnd.oasis.opendocument.spreadsheet`: ODS spreadsheet format

  {% /details %}

  {% /section %}

  {% /left-column %}

  {% right-column class="sticky" %}
  **Example**

  **Document**

  ```json
  {
    "type": "document",
    "data": "BASE64_ENCODED_DOCUMENT",
    "mime_type": "application/pdf"
  }
  ```

  {% /right-column %}

  {% /two-column-layout %}

{% /details %}

{% details %}
  {% summary %}
  **[ImageContent](/api-reference/interactions-api#Resource:ImageContent)**

  {% /summary %}

  An image content block.

  {% two-column-layout %}
  {% left-column %}
  {% section class="api-ref-property-list" %}
  **type**: {% mark %}required{% /mark %} `object`

  Value: `image`

  {% hr /%}

  **data**: `string`

  The image content.

  {% hr /%}

  **uri**: `string`

  The URI of the image.

  {% hr /%}

  {% details %}
  {% summary %}
  **resolution**: `MediaResolution`

  The resolution of the media.

  {% /summary %}

  Possible values:

  - `low`: Low resolution.
  - `medium`: Medium resolution.
  - `high`: High resolution.
  - `ultra_high`: Ultra high resolution.

  {% /details %}

  {% hr /%}

  {% details %}
  {% summary %}
  **mime_type**: `string enum`

  The mime type of the image.

  {% /summary %}

  Possible values:

  - `image/png`: PNG image format
  - `image/jpeg`: JPEG image format
  - `image/webp`: WebP image format
  - `image/heic`: HEIC image format
  - `image/heif`: HEIF image format
  - `image/gif`: GIF image format
  - `image/bmp`: BMP image format
  - `image/tiff`: TIFF image format

  {% /details %}

  {% /section %}

  {% /left-column %}

  {% right-column class="sticky" %}
  **Example**

  **Image**

  ```json
  {
    "type": "image",
    "data": "BASE64_ENCODED_IMAGE",
    "mime_type": "image/png"
  }
  ```

  {% /right-column %}

  {% /two-column-layout %}

{% /details %}

{% details %}
  {% summary %}
  **[TextContent](/api-reference/interactions-api#Resource:TextContent)**

  {% /summary %}

  A text content block.

  {% two-column-layout %}
  {% left-column %}
  {% section class="api-ref-property-list" %}
  **text**: {% mark %}required{% /mark %} `string`

  The text content.

  {% hr /%}

  **type**: {% mark %}required{% /mark %} `object`

  Value: `text`

  {% hr /%}

  {% details %}
  {% summary %}
  **annotations**: `Annotation array`

  Citation information for model-generated content.

  {% /summary %}

  **Possible Types:** {% class="api-ref-label" %}

  {% details %}
  {% summary %}
  **FileCitation**

  {% /summary %}

  A file citation annotation.

  **type**: {% mark %}required{% /mark %} `object`

  Value: `file_citation`

  **document_uri**: `string`

  The URI of the file.

  **file_name**: `string`

  The name of the file.

  **source**: `string`

  Source attributed for a portion of the text.

  **custom_metadata**: `object`

  User provided metadata about the retrieved context.

  **page_number**: `integer`

  Page number of the cited document, if applicable.

  **media_id**: `string`

  Media ID in-case of image citations, if applicable.

  **start_index**: `integer`

  Start of segment of the response that is attributed to this source. Index indicates the start of the segment, measured in bytes.

  **end_index**: `integer`

  End of the attributed segment, exclusive.

  {% /details %}

  {% details %}
  {% summary %}
  **PlaceCitation**

  {% /summary %}

  A place citation annotation.

  **type**: {% mark %}required{% /mark %} `object`

  Value: `place_citation`

  **place_id**: `string`

  The ID of the place, in `places/{place_id}` format.

  **name**: `string`

  Title of the place.

  **url**: `string`

  URI reference of the place.

  {% details %}
  {% summary %}
  **review_snippets**: `ReviewSnippet array`

  Snippets of reviews that are used to generate answers about the features of a given place in Google Maps.

  {% /summary %}

  **title**: `string`

  Title of the review.

  **url**: `string`

  A link that corresponds to the user review on Google Maps.

  **review_id**: `string`

  The ID of the review snippet.

  {% /details %}

  **start_index**: `integer`

  Start of segment of the response that is attributed to this source. Index indicates the start of the segment, measured in bytes.

  **end_index**: `integer`

  End of the attributed segment, exclusive.

  {% /details %}

  {% details %}
  {% summary %}
  **SpeechAnnotation**

  {% /summary %}

  Speech annotation for text content.

  **type**: {% mark %}required{% /mark %} `object`

  Value: `speech_metadata`

  **speaker**: `string`

  The speaker to associate with this turn.

  **style**: `string`

  Style instruction for the speech synthesis.

  **start_index**: `integer`

  Start of segment of the response that is attributed to this source. Index indicates the start of the segment, measured in bytes.

  **end_index**: `integer`

  End of the attributed segment, exclusive.

  {% /details %}

  {% details %}
  {% summary %}
  **UrlCitation**

  {% /summary %}

  A URL citation annotation.

  **type**: {% mark %}required{% /mark %} `object`

  Value: `url_citation`

  **url**: `string`

  The URL.

  **title**: `string`

  The title of the URL.

  **start_index**: `integer`

  Start of segment of the response that is attributed to this source. Index indicates the start of the segment, measured in bytes.

  **end_index**: `integer`

  End of the attributed segment, exclusive.

  {% /details %}

  {% details %}
  {% summary %}
  **WordInfo**

  {% /summary %}

  Word-level ASR annotation for transcription output. Carries the word text, optional timing, and optional speaker attribution.

  **type**: {% mark %}required{% /mark %} `object`

  Value: `word_info`

  **text**: `string`

  The transcribed word.

  **start_offset**: `string`

  Start offset in time of the word relative to the start of the audio. Present when timestamp_granularities contains "word".

  **end_offset**: `string`

  End offset in time of the word relative to the start of the audio. Present when timestamp_granularities contains "word".

  **speaker**: `string`

  Optional. Speaker label for this word (e.g. "spk_1", "spk_2"). Present when diarization_mode is set in TranscriptionConfig.

  **start_index**: `integer`

  Start of segment of the response that is attributed to this source. Index indicates the start of the segment, measured in bytes.

  **end_index**: `integer`

  End of the attributed segment, exclusive.

  {% /details %}

  {% /details %}

  {% /section %}

  {% /left-column %}

  {% right-column class="sticky" %}
  **Example**

  **Text**

  ```json
  {
    "type": "text",
    "text": "Hello, how are you?"
  }
  ```

  {% /right-column %}

  {% /two-column-layout %}

{% /details %}

{% details %}
  {% summary %}
  **VideoContent**

  {% /summary %}

  A video content block.

  {% two-column-layout %}
  {% left-column %}
  {% section class="api-ref-property-list" %}
  **type**: {% mark %}required{% /mark %} `object`

  Value: `video`

  {% hr /%}

  **data**: `string`

  The video content.

  {% hr /%}

  **uri**: `string`

  The URI of the video.

  {% hr /%}

  {% details %}
  {% summary %}
  **resolution**: `MediaResolution`

  The resolution of the media.

  {% /summary %}

  Possible values:

  - `low`: Low resolution.
  - `medium`: Medium resolution.
  - `high`: High resolution.
  - `ultra_high`: Ultra high resolution.

  {% /details %}

  {% hr /%}

  {% details %}
  {% summary %}
  **processing**: `MediaProcessing` or `string enum`

  How the model processes this video for understanding.

  {% /summary %}

  **Possible Types:** {% class="api-ref-label" %}

  {% details %}
  {% summary %}
  **MediaProcessing**

  {% /summary %}

  **type**: {% mark %}required{% /mark %} `object`

  Value: `static`

  **start_offset**: `string`

  Optional. Segment start time. Specified as a decimal number of seconds followed by an 's' suffix, e.g., "10.5s". Must be non-negative.

  **end_offset**: `string`

  Optional. Segment end time. Specified as a decimal number of seconds followed by an 's' suffix, e.g., "30s". Must be non-negative and greater than `start_offset` if `start_offset` is set.

  **fps**: `number`

  Optional. Video frame-rate sampling density.

  {% /details %}

  {% details %}
  {% summary %}
  **string enum**

  {% /summary %}

  Possible values:

  - `static`: Fixed-rate frame extraction. All frames placed in context.
  - `agentic`: Model-driven dynamic navigation.

  {% /details %}

  {% /details %}

  {% hr /%}

  **name**: `string`

  A user-defined name for this content block. Can be referenced by the model in the final response.

  {% hr /%}

  {% details %}
  {% summary %}
  **mime_type**: `string enum`

  The mime type of the video.

  {% /summary %}

  Possible values:

  - `video/mp4`: MP4 video format
  - `video/mpeg`: MPEG video format
  - `video/mpg`: MPG video format
  - `video/mov`: MOV video format
  - `video/avi`: AVI video format
  - `video/x-flv`: FLV video format
  - `video/webm`: WebM video format
  - `video/wmv`: WMV video format
  - `video/3gpp`: 3GPP video format

  {% /details %}

  {% /section %}

  {% /left-column %}

  {% right-column class="sticky" %}
  **Example**

  **Video**

  ```json
  {
    "type": "video",
    "uri": "https://www.youtube.com/watch?v=9hE5-98ZeCg"
  }
  ```

  {% /right-column %}

  {% /two-column-layout %}

{% /details %}

### Tool  {% id="Resource:Tool" %}

A tool that can be used by the model.

**Polymorphic Types:**

{% details %}
  {% summary %}
  **CodeExecution**

  {% /summary %}

  A tool that can be used by the model to execute code.

  {% two-column-layout %}
  {% left-column %}
  {% section class="api-ref-property-list" %}
  **type**: {% mark %}required{% /mark %} `object`

  Value: `code_execution`

  {% /section %}

  {% /left-column %}

  {% right-column class="sticky" %}
  **Example**

  {% tabs %}
  {% tab label="REST" %}
  ```sh
  curl -X POST https://generativelanguage.googleapis.com/v1beta/interactions \
    -H "x-goog-api-key: $GEMINI_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{
      "model": "gemini-3.8-flash",
      "tools": [{
        "type": "code_execution"
      }],
      "input": "Calculate the first 10 Fibonacci numbers"
    }'
  ```

  {% /tab %}

  {% tab label="Python" %}
  ```python
  from google import genai
  
  client = genai.Client()
  response = client.interactions.create(
      model="gemini-3.8-flash",
      tools=[{"type": "code_execution"}],
      input="Calculate the first 10 Fibonacci numbers",
  )
  print(response.output_text)
  ```

  {% /tab %}

  {% tab label="JavaScript" %}
  ```javascript
  import {GoogleGenAI} from '@google/genai';
  
  const ai = new GoogleGenAI({});
  const interaction = await ai.interactions.create({
    model: 'gemini-3.8-flash',
    tools: [{type: 'code_execution'}],
    input: 'Calculate the first 10 Fibonacci numbers',
  });
  console.log(interaction.output_text);
  ```

  {% /tab %}

  {% tab label="Java" %}
  ```java
  import com.google.genai.Client;
  import com.google.genai.gaos.models.interactions.CodeExecution;
  import com.google.genai.gaos.models.operations.CreateInteractionRequestBody;
  import com.google.genai.gaos.models.operations.CreateInteractionResponse;
  import com.google.genai.gaos.models.interactions.CreateModelInteraction;
  import com.google.genai.gaos.models.interactions.Interaction;
  import com.google.genai.gaos.models.interactions.InteractionsInput;
  
  Client client = new Client();
  CreateModelInteraction params =
      CreateModelInteraction.builder()
          .model("gemini-3.8-flash")
          .tools(List.of(new CodeExecution()))
          .input(InteractionsInput.of("Calculate the first 10 Fibonacci numbers"))
          .build();
  CreateInteractionResponse response =
      client.interactions.create(CreateInteractionRequestBody.of(params));
  Interaction interaction =
      response.interaction().orElseThrow(() -> new RuntimeException("No interaction returned"));
  System.out.println(interaction.outputText().orElse(""));
  ```

  {% /tab %}

  {% tab label="code_execution" %}
  ```go
  package main
  
  import (
      "context"
      "fmt"
      "log"
      "google.golang.org/genai"
      gaos_interactions "google.golang.org/genai/interactions/models/interactions"
      "google.golang.org/genai/interactions/models/operations"
  )
  
  func main() {
      ctx := context.Background()
      client, err := genai.NewClient(ctx, nil)
      if err != nil {
          log.Fatal(err)
      }
  
      tool := gaos_interactions.NewTool(gaos_interactions.CodeExecution{})
  
      body := operations.NewCreateInteractionRequestBody(gaos_interactions.CreateModelInteraction{
          Model: gaos_interactions.Model("gemini-3.8-flash"),
          Input: genai.Ptr(gaos_interactions.NewInteractionsInput("Calculate the first 10 Fibonacci numbers")),
          Tools: []gaos_interactions.Tool{tool},
      })
  
      req := operations.CreateInteractionRequest{
          Body: body,
      }
  
      res, err := client.Interactions.Create(ctx, req)
      if err != nil {
          log.Fatal(err)
      }
  
      if res.Interaction != nil && res.Interaction.OutputText != nil {
          fmt.Println(*res.Interaction.OutputText)
      }
  }
  ```

  {% /tab %}

  {% /tabs %}

  {% /right-column %}

  {% /two-column-layout %}

{% /details %}

{% details %}
  {% summary %}
  **ComputerUse**

  {% /summary %}

  A tool that can be used by the model to interact with the computer.

  {% two-column-layout %}
  {% left-column %}
  {% section class="api-ref-property-list" %}
  **type**: {% mark %}required{% /mark %} `object`

  Value: `computer_use`

  {% hr /%}

  {% details %}
  {% summary %}
  **environment**: `string enum`

  The environment being operated.

  {% /summary %}

  Possible values:

  - `browser`: Operates in a web browser.
  - `mobile`: Operates in a mobile environment.
  - `desktop`: Operates in a desktop environment.

  {% /details %}

  {% hr /%}

  **excluded_predefined_functions**: `string array`

  The list of predefined functions that are excluded from the model call.

  {% hr /%}

  **enable_prompt_injection_detection**: `boolean`

  Whether enable the prompt injection detection check on computer-use request.

  {% hr /%}

  {% details %}
  {% summary %}
  **disabled_safety_policies**: `string enum array`

  Optional. Disabled safety policies for computer use.

  {% /summary %}

  Possible values:

  - `financial_transactions`: Safety policy for financial transactions.
  - `sensitive_data_modification`: Safety policy for sensitive data modification.
  - `communication_tool`: Safety policy for communication tools (e.g. Gmail, Chat, Meet).
  - `account_creation`: Safety policy for account creation.
  - `data_modification`: Safety policy for data modification.
  - `user_consent_management`: Safety policy for user consent management.
  - `legal_terms_and_agreements`: Safety policy for legal terms and agreements.

  {% /details %}

  {% /section %}

  {% /left-column %}

  {% right-column class="sticky" %}
  **Example**

  {% tabs %}
  {% tab label="REST" %}
  ```sh
  curl -X POST https://generativelanguage.googleapis.com/v1beta/interactions \
    -H "x-goog-api-key: $GEMINI_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{
      "model": "gemini-2.5-computer-use-preview-10-2025",
      "tools": [{
        "type": "computer_use"
      }],
      "input": "Find a flight to Tokyo"
    }'
  ```

  {% /tab %}

  {% tab label="Python" %}
  ```python
  from google import genai
  
  client = genai.Client()
  response = client.interactions.create(
      model="gemini-2.5-computer-use-preview-10-2025",
      tools=[{"type": "computer_use"}],
      input="Find a flight to Tokyo",
  )
  print(response.output_text)
  ```

  {% /tab %}

  {% tab label="JavaScript" %}
  ```javascript
  import {GoogleGenAI} from '@google/genai';
  
  const ai = new GoogleGenAI({});
  const interaction = await ai.interactions.create({
    model: 'gemini-2.5-computer-use-preview-10-2025',
    tools: [{type: 'computer_use'}],
    input: 'Find a flight to Tokyo',
  });
  console.log(interaction.output_text);
  ```

  {% /tab %}

  {% tab label="Java" %}
  ```java
  import com.google.genai.Client;
  import com.google.genai.gaos.models.interactions.ComputerUse;
  import com.google.genai.gaos.models.operations.CreateInteractionRequestBody;
  import com.google.genai.gaos.models.operations.CreateInteractionResponse;
  import com.google.genai.gaos.models.interactions.CreateModelInteraction;
  import com.google.genai.gaos.models.interactions.Interaction;
  import com.google.genai.gaos.models.interactions.InteractionsInput;
  
  Client client = new Client();
  CreateModelInteraction params =
      CreateModelInteraction.builder()
          .model("gemini-2.5-computer-use-preview-10-2025")
          .tools(List.of(new ComputerUse()))
          .input(InteractionsInput.of("Find a flight to Tokyo"))
          .build();
  CreateInteractionResponse response =
      client.interactions.create(CreateInteractionRequestBody.of(params));
  Interaction interaction =
      response.interaction().orElseThrow(() -> new RuntimeException("No interaction returned"));
  System.out.println(interaction.outputText().orElse(""));
  ```

  {% /tab %}

  {% tab label="computer_use" %}
  ```go
  package main
  
  import (
      "context"
      "fmt"
      "log"
      "google.golang.org/genai"
      gaos_interactions "google.golang.org/genai/interactions/models/interactions"
      "google.golang.org/genai/interactions/models/operations"
  )
  
  func main() {
      ctx := context.Background()
      client, err := genai.NewClient(ctx, nil)
      if err != nil {
          log.Fatal(err)
      }
  
      tool := gaos_interactions.NewTool(gaos_interactions.ComputerUse{})
  
      body := operations.NewCreateInteractionRequestBody(gaos_interactions.CreateModelInteraction{
          Model: gaos_interactions.Model("gemini-2.5-computer-use-preview-10-2025"),
          Input: genai.Ptr(gaos_interactions.NewInteractionsInput("Find a flight to Tokyo")),
          Tools: []gaos_interactions.Tool{tool},
      })
  
      req := operations.CreateInteractionRequest{
          Body: body,
      }
  
      res, err := client.Interactions.Create(ctx, req)
      if err != nil {
          log.Fatal(err)
      }
  
      if res.Interaction != nil && res.Interaction.OutputText != nil {
          fmt.Println(*res.Interaction.OutputText)
      }
  }
  ```

  {% /tab %}

  {% /tabs %}

  {% /right-column %}

  {% /two-column-layout %}

{% /details %}

{% details %}
  {% summary %}
  **FileSearch**

  {% /summary %}

  A tool that can be used by the model to search files.

  {% two-column-layout %}
  {% left-column %}
  {% section class="api-ref-property-list" %}
  **type**: {% mark %}required{% /mark %} `object`

  Value: `file_search`

  {% hr /%}

  **file_search_store_names**: `string array`

  The file search store names to search.

  {% hr /%}

  **top_k**: `integer`

  The number of semantic retrieval chunks to retrieve.

  {% hr /%}

  **metadata_filter**: `string`

  Metadata filter to apply to the semantic retrieval documents and chunks.

  {% /section %}

  {% /left-column %}

  {% right-column class="sticky" %}
  **Example**

  {% tabs %}
  {% tab label="REST" %}
  ```sh
  curl -X POST https://generativelanguage.googleapis.com/v1beta/interactions \
    -H "x-goog-api-key: $GEMINI_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{
      "model": "gemini-3.8-flash",
      "tools": [{
        "type": "file_search",
        "file_search_store_names": ["fileSearchStores/m64d1sevsr4y-xfyawui3fxqg"]
      }],
      "input": "Who is the author of the book?"
    }'
  ```

  {% /tab %}

  {% tab label="Python" %}
  ```python
  from google import genai
  
  client = genai.Client()
  
  # Create a file search store so we have a valid one to use.
  store = client.file_search_stores.create()
  
  response = client.interactions.create(
      model="gemini-3.8-flash",
      tools=[
          {"type": "file_search", "file_search_store_names": [store.name]}
      ],
      input="What documents are available?",
  )
  print(response.output_text)
  ```

  {% /tab %}

  {% tab label="JavaScript" %}
  ```javascript
  import {GoogleGenAI} from '@google/genai';
  
  const ai = new GoogleGenAI({});
  
  // Create a file search store so we have a valid one to use.
  const store = await ai.fileSearchStores.create({});
  if (!store.name) {
    throw new Error('Store creation failed: Name is undefined');
  }
  
  const interaction = await ai.interactions.create({
    model: 'gemini-3.8-flash',
    tools: [
      {
        type: 'file_search',
        file_search_store_names: [store.name],
      },
    ],
    input: 'What documents are available?',
  });
  console.log(interaction.output_text);
  ```

  {% /tab %}

  {% tab label="Java" %}
  ```java
  import com.google.genai.Client;
  import com.google.genai.types.CreateFileSearchStoreConfig;
  import com.google.genai.gaos.models.operations.CreateInteractionRequestBody;
  import com.google.genai.gaos.models.operations.CreateInteractionResponse;
  import com.google.genai.gaos.models.interactions.CreateModelInteraction;
  import com.google.genai.gaos.models.interactions.FileSearch;
  import com.google.genai.types.FileSearchStore;
  import com.google.genai.gaos.models.interactions.Interaction;
  import com.google.genai.gaos.models.interactions.InteractionsInput;
  
  Client client = new Client();
  
  // Create a file search store so we have a valid one to use.
  FileSearchStore store =
      client.fileSearchStores.create(CreateFileSearchStoreConfig.builder().build());
  String storeName = store.name().orElseThrow();
  
  FileSearch tool = FileSearch.builder().fileSearchStoreNames(List.of(storeName)).build();
  CreateModelInteraction params =
      CreateModelInteraction.builder()
          .model("gemini-3.8-flash")
          .tools(List.of(tool))
          .input(InteractionsInput.of("What documents are available?"))
          .build();
  CreateInteractionResponse response =
      client.interactions.create(CreateInteractionRequestBody.of(params));
  Interaction interaction =
      response.interaction().orElseThrow(() -> new RuntimeException("No interaction returned"));
  System.out.println(interaction.outputText().orElse(""));
  ```

  {% /tab %}

  {% tab label="file_search" %}
  ```go
  package main
  
  import (
      "context"
      "fmt"
      "log"
      "google.golang.org/genai"
      gaos_interactions "google.golang.org/genai/interactions/models/interactions"
      "google.golang.org/genai/interactions/models/operations"
  )
  
  func main() {
      ctx := context.Background()
      client, err := genai.NewClient(ctx, nil)
      if err != nil {
          log.Fatal(err)
      }
  
  
      tool := gaos_interactions.NewTool(gaos_interactions.FileSearch{
          FileSearchStoreNames: []string{store.Name},
      })
  
      body := operations.NewCreateInteractionRequestBody(gaos_interactions.CreateModelInteraction{
          Model: gaos_interactions.Model("gemini-3.8-flash"),
          Input: genai.Ptr(gaos_interactions.NewInteractionsInput("What documents are available?")),
          Tools: []gaos_interactions.Tool{tool},
      })
  
      req := operations.CreateInteractionRequest{
          Body: body,
      }
  
      res, err := client.Interactions.Create(ctx, req)
      if err != nil {
          log.Fatal(err)
      }
  
      if res.Interaction != nil && res.Interaction.OutputText != nil {
          fmt.Println(*res.Interaction.OutputText)
      }
  }
  ```

  {% /tab %}

  {% /tabs %}

  {% /right-column %}

  {% /two-column-layout %}

{% /details %}

{% details %}
  {% summary %}
  **Function**

  {% /summary %}

  A tool that can be used by the model.

  {% two-column-layout %}
  {% left-column %}
  {% section class="api-ref-property-list" %}
  **type**: {% mark %}required{% /mark %} `object`

  Value: `function`

  {% hr /%}

  **name**: `string`

  The name of the function.

  {% hr /%}

  **description**: `string`

  A description of the function.

  {% hr /%}

  **parameters**: `object`

  The JSON Schema for the function's parameters. Supports a subset of JSON Schema. `minLength`, `maxLength`, `minProperties`, `maxProperties`, `uniqueItems`, `contains`, `minContains`, and `maxContains` are ignored and not enforced.

  {% /section %}

  {% /left-column %}

  {% right-column class="sticky" %}
  **Example**

  {% tabs %}
  {% tab label="REST" %}
  ```sh
  curl -X POST https://generativelanguage.googleapis.com/v1beta/interactions \
    -H "x-goog-api-key: $GEMINI_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{
      "model": "gemini-3.8-flash",
      "tools": [{
        "type": "function",
        "name": "get_weather",
        "description": "Get the current weather in a given location",
        "parameters": {
          "type": "object",
          "properties": {
            "location": {
              "type": "string",
              "description": "The city and state, e.g. San Francisco, CA"
            }
          },
          "required": ["location"]
        }
      }],
      "input": "What is the weather like in Boston, MA?"
    }'
  ```

  {% /tab %}

  {% tab label="Python" %}
  ```python
  from google import genai
  
  client = genai.Client()
  response = client.interactions.create(
      model="gemini-3.8-flash",
      tools=[{
          "type": "function",
          "name": "get_weather",
          "description": "Get the current weather in a given location",
          "parameters": {
              "type": "object",
              "properties": {
                  "location": {
                      "type": "string",
                      "description": (
                          "The city and state, e.g. San Francisco, CA"
                      ),
                  }
              },
              "required": ["location"],
          },
      }],
      input="What is the weather like in Boston?",
  )
  print(response.steps[-1])
  ```

  {% /tab %}

  {% tab label="JavaScript" %}
  ```javascript
  import {GoogleGenAI} from '@google/genai';
  
  const ai = new GoogleGenAI({});
  const interaction = await ai.interactions.create({
    model: 'gemini-3.8-flash',
    tools: [
      {
        type: 'function',
        name: 'get_weather',
        description: 'Get the current weather in a given location',
        parameters: {
          type: 'object',
          properties: {
            location: {
              type: 'string',
              description: 'The city and state, e.g. San Francisco, CA',
            },
          },
          required: ['location'],
        },
      },
    ],
    input: 'What is the weather like in Boston?',
  });
  console.log(interaction.steps.at(-1));
  ```

  {% /tab %}

  {% tab label="Java" %}
  ```java
  import com.google.genai.Client;
  import com.google.genai.gaos.models.operations.CreateInteractionRequestBody;
  import com.google.genai.gaos.models.operations.CreateInteractionResponse;
  import com.google.genai.gaos.models.interactions.CreateModelInteraction;
  import com.google.genai.gaos.models.interactions.Function;
  import com.google.genai.gaos.models.interactions.Interaction;
  import com.google.genai.gaos.models.interactions.InteractionsInput;
  import com.google.genai.gaos.models.interactions.Step;
  
  Client client = new Client();
  Map<String, Object> parameters =
      Map.of(
          "type", "object",
          "properties",
              Map.of(
                  "location",
                  Map.of(
                      "type", "string",
                      "description", "The city and state, e.g. San Francisco, CA")),
          "required", List.of("location"));
  Function functionTool =
      Function.builder()
          .name("get_weather")
          .description("Get the current weather in a given location")
          .parameters(parameters)
          .build();
  CreateModelInteraction params =
      CreateModelInteraction.builder()
          .model("gemini-3.8-flash")
          .tools(List.of(functionTool))
          .input(InteractionsInput.of("What is the weather like in Boston?"))
          .build();
  CreateInteractionResponse response =
      client.interactions.create(CreateInteractionRequestBody.of(params));
  Interaction interaction =
      response.interaction().orElseThrow(() -> new RuntimeException("No interaction returned"));
  List<Step> steps = interaction.steps().orElse(List.of());
  if (!steps.isEmpty()) {
    System.out.println(steps.get(steps.size() - 1));
  }
  ```

  {% /tab %}

  {% tab label="function_calling" %}
  ```go
  package main
  
  import (
      "context"
      "fmt"
      "log"
      "google.golang.org/genai"
      gaos_interactions "google.golang.org/genai/interactions/models/interactions"
      "google.golang.org/genai/interactions/models/operations"
  )
  
  func main() {
      ctx := context.Background()
      client, err := genai.NewClient(ctx, nil)
      if err != nil {
          log.Fatal(err)
      }
  
      function := gaos_interactions.Function{
          Name:        genai.Ptr("get_weather"),
          Description: genai.Ptr("Get the current weather in a given location"),
          Parameters: map[string]any{
              "type": "object",
              "properties": map[string]any{
                  "location": map[string]any{
                      "type":        "string",
                      "description": "The city and state, e.g. San Francisco, CA",
                  },
              },
              "required": []string{"location"},
          },
      }
  
      tool := gaos_interactions.NewTool(function)
  
      body := operations.NewCreateInteractionRequestBody(gaos_interactions.CreateModelInteraction{
          Model: gaos_interactions.Model("gemini-3.8-flash"),
          Input: genai.Ptr(gaos_interactions.NewInteractionsInput("What is the weather like in Boston, MA?")),
          Tools: []gaos_interactions.Tool{tool},
      })
  
      req := operations.CreateInteractionRequest{
          Body: body,
      }
  
      res, err := client.Interactions.Create(ctx, req)
      if err != nil {
          log.Fatal(err)
      }
  
      if res.Interaction != nil {
          for _, step := range res.Interaction.Steps {
              if step.FunctionCallStep != nil {
                  fmt.Println("Function Call:", step.FunctionCallStep.Name)
                  fmt.Println("Arguments:", step.FunctionCallStep.Arguments)
              }
          }
      }
  }
  ```

  {% /tab %}

  {% /tabs %}

  {% /right-column %}

  {% /two-column-layout %}

{% /details %}

{% details %}
  {% summary %}
  **GoogleMaps**

  {% /summary %}

  A tool that can be used by the model to call Google Maps.

  {% two-column-layout %}
  {% left-column %}
  {% section class="api-ref-property-list" %}
  **type**: {% mark %}required{% /mark %} `object`

  Value: `google_maps`

  {% hr /%}

  **enable_widget**: `boolean`

  Whether to return a widget context token in the tool call result of the response.

  {% hr /%}

  **latitude**: `number`

  The latitude of the user's location.

  {% hr /%}

  **longitude**: `number`

  The longitude of the user's location.

  {% /section %}

  {% /left-column %}

  {% right-column class="sticky" %}
  **Example**

  {% tabs %}
  {% tab label="REST" %}
  ```sh
  curl -X POST https://generativelanguage.googleapis.com/v1beta/interactions \
    -H "x-goog-api-key: $GEMINI_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{
      "model": "gemini-3.8-flash",
      "tools": [{
        "type": "google_maps",
        "latitude": 37.7749,
        "longitude": -122.4194
      }],
      "input": "What is the best food near me?"
    }'
  ```

  {% /tab %}

  {% tab label="Python" %}
  ```python
  from google import genai
  
  client = genai.Client()
  response = client.interactions.create(
      model="gemini-3.8-flash",
      tools=[
          {"type": "google_maps", "latitude": 37.7749, "longitude": -122.4194}
      ],
      input="What is the best food near me?",
  )
  print(response.output_text)
  ```

  {% /tab %}

  {% tab label="JavaScript" %}
  ```javascript
  import {GoogleGenAI} from '@google/genai';
  
  const ai = new GoogleGenAI({});
  const interaction = await ai.interactions.create({
    model: 'gemini-3.8-flash',
    tools: [
      {
        type: 'google_maps',
        latitude: 37.7749,
        longitude: -122.4194,
      },
    ],
    input: 'What is the best food near me?',
  });
  console.log(interaction.output_text);
  ```

  {% /tab %}

  {% tab label="Java" %}
  ```java
  import com.google.genai.Client;
  import com.google.genai.gaos.models.operations.CreateInteractionRequestBody;
  import com.google.genai.gaos.models.operations.CreateInteractionResponse;
  import com.google.genai.gaos.models.interactions.CreateModelInteraction;
  import com.google.genai.gaos.models.interactions.GoogleMaps;
  import com.google.genai.gaos.models.interactions.Interaction;
  import com.google.genai.gaos.models.interactions.InteractionsInput;
  
  Client client = new Client();
  GoogleMaps tool = GoogleMaps.builder().latitude(37.7749).longitude(-122.4194).build();
  CreateModelInteraction params =
      CreateModelInteraction.builder()
          .model("gemini-3.8-flash")
          .tools(List.of(tool))
          .input(InteractionsInput.of("What is the best food near me?"))
          .build();
  CreateInteractionResponse response =
      client.interactions.create(CreateInteractionRequestBody.of(params));
  Interaction interaction =
      response.interaction().orElseThrow(() -> new RuntimeException("No interaction returned"));
  System.out.println(interaction.outputText().orElse(""));
  ```

  {% /tab %}

  {% tab label="google_maps" %}
  ```go
  package main
  
  import (
      "context"
      "fmt"
      "log"
      "google.golang.org/genai"
      gaos_interactions "google.golang.org/genai/interactions/models/interactions"
      "google.golang.org/genai/interactions/models/operations"
  )
  
  func main() {
      ctx := context.Background()
      client, err := genai.NewClient(ctx, nil)
      if err != nil {
          log.Fatal(err)
      }
  
      tool := gaos_interactions.NewTool(gaos_interactions.GoogleMaps{
          Latitude:  genai.Ptr(37.7749),
          Longitude: genai.Ptr(-122.4194),
      })
  
      body := operations.NewCreateInteractionRequestBody(gaos_interactions.CreateModelInteraction{
          Model: gaos_interactions.Model("gemini-3.8-flash"),
          Input: genai.Ptr(gaos_interactions.NewInteractionsInput("What is the best food near me?")),
          Tools: []gaos_interactions.Tool{tool},
      })
  
      req := operations.CreateInteractionRequest{
          Body: body,
      }
  
      res, err := client.Interactions.Create(ctx, req)
      if err != nil {
          log.Fatal(err)
      }
  
      if res.Interaction != nil && res.Interaction.OutputText != nil {
          fmt.Println(*res.Interaction.OutputText)
      }
  }
  ```

  {% /tab %}

  {% /tabs %}

  {% /right-column %}

  {% /two-column-layout %}

{% /details %}

{% details %}
  {% summary %}
  **GoogleSearch**

  {% /summary %}

  A tool that can be used by the model to search Google.

  {% two-column-layout %}
  {% left-column %}
  {% section class="api-ref-property-list" %}
  **type**: {% mark %}required{% /mark %} `object`

  Value: `google_search`

  {% hr /%}

  {% details %}
  {% summary %}
  **search_types**: `string enum array`

  The types of search grounding to enable.

  {% /summary %}

  Possible values:

  - `web_search`: Setting this field enables web search. Only text results are returned.
  - `image_search`: Setting this field enables image search. Image bytes are returned.

  {% /details %}

  {% /section %}

  {% /left-column %}

  {% right-column class="sticky" %}
  **Example**

  {% tabs %}
  {% tab label="REST" %}
  ```sh
  curl -X POST https://generativelanguage.googleapis.com/v1beta/interactions \
    -H "x-goog-api-key: $GEMINI_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{
      "model": "gemini-3.8-flash",
      "tools": [{
        "type": "google_search"
      }],
      "input": "Who is the current president of France?"
    }'
  ```

  {% /tab %}

  {% tab label="Python" %}
  ```python
  from google import genai
  
  client = genai.Client()
  response = client.interactions.create(
      model="gemini-3.8-flash",
      tools=[{"type": "google_search"}],
      input="Who is the current president of France?",
  )
  print(response.output_text)
  ```

  {% /tab %}

  {% tab label="JavaScript" %}
  ```javascript
  import {GoogleGenAI} from '@google/genai';
  
  const ai = new GoogleGenAI({});
  const interaction = await ai.interactions.create({
    model: 'gemini-3.8-flash',
    tools: [{type: 'google_search'}],
    input: 'Who is the current president of France?',
  });
  console.log(interaction.output_text);
  ```

  {% /tab %}

  {% tab label="Java" %}
  ```java
  import com.google.genai.Client;
  import com.google.genai.gaos.models.operations.CreateInteractionRequestBody;
  import com.google.genai.gaos.models.operations.CreateInteractionResponse;
  import com.google.genai.gaos.models.interactions.CreateModelInteraction;
  import com.google.genai.gaos.models.interactions.GoogleSearch;
  import com.google.genai.gaos.models.interactions.Interaction;
  import com.google.genai.gaos.models.interactions.InteractionsInput;
  
  Client client = new Client();
  CreateModelInteraction params =
      CreateModelInteraction.builder()
          .model("gemini-3.8-flash")
          .tools(List.of(new GoogleSearch()))
          .input(InteractionsInput.of("Who is the current president of France?"))
          .build();
  CreateInteractionResponse response =
      client.interactions.create(CreateInteractionRequestBody.of(params));
  Interaction interaction =
      response.interaction().orElseThrow(() -> new RuntimeException("No interaction returned"));
  System.out.println(interaction.outputText().orElse(""));
  ```

  {% /tab %}

  {% tab label="google_search" %}
  ```go
  package main
  
  import (
      "context"
      "fmt"
      "log"
      "google.golang.org/genai"
      gaos_interactions "google.golang.org/genai/interactions/models/interactions"
      "google.golang.org/genai/interactions/models/operations"
  )
  
  func main() {
      ctx := context.Background()
      client, err := genai.NewClient(ctx, nil)
      if err != nil {
          log.Fatal(err)
      }
  
      tool := gaos_interactions.NewTool(gaos_interactions.GoogleSearch{})
  
      body := operations.NewCreateInteractionRequestBody(gaos_interactions.CreateModelInteraction{
          Model: gaos_interactions.Model("gemini-3.8-flash"),
          Input: genai.Ptr(gaos_interactions.NewInteractionsInput("Who is the current president of France?")),
          Tools: []gaos_interactions.Tool{tool},
      })
  
      req := operations.CreateInteractionRequest{
          Body: body,
      }
  
      res, err := client.Interactions.Create(ctx, req)
      if err != nil {
          log.Fatal(err)
      }
  
      if res.Interaction != nil && res.Interaction.OutputText != nil {
          fmt.Println(*res.Interaction.OutputText)
      }
  }
  ```

  {% /tab %}

  {% /tabs %}

  {% /right-column %}

  {% /two-column-layout %}

{% /details %}

{% details %}
  {% summary %}
  **McpServer**

  {% /summary %}

  A MCPServer is a server that can be called by the model to perform actions.

  {% two-column-layout %}
  {% left-column %}
  {% section class="api-ref-property-list" %}
  **type**: {% mark %}required{% /mark %} `object`

  Value: `mcp_server`

  {% hr /%}

  **name**: `string`

  The name of the MCPServer.

  {% hr /%}

  **url**: `string`

  The full URL for the MCPServer endpoint. Example: "https://api.example.com/mcp"

  {% hr /%}

  **headers**: `object`

  Optional: Fields for authentication headers, timeouts, etc., if needed.

  {% hr /%}

  {% details %}
  {% summary %}
  **allowed_tools**: `AllowedTools array`

  The allowed tools.

  {% /summary %}

  {% details %}
  {% summary %}
  **mode**: `string enum`

  The mode of the tool choice.

  {% /summary %}

  Possible values:

  - `auto`: Auto tool choice.
  - `any`: Any tool choice.
  - `none`: No tool choice.
  - `validated`: Validated tool choice.

  {% /details %}

  **tools**: `string array`

  The names of the allowed tools.

  {% /details %}

  {% /section %}

  {% /left-column %}

  {% right-column class="sticky" %}
  **Example**

  {% tabs %}
  {% tab label="REST" %}
  ```sh
  curl -X POST https://generativelanguage.googleapis.com/v1beta/interactions \
    -H "x-goog-api-key: $GEMINI_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{
      "model": "gemini-3.8-flash",
      "tools": [{
        "type": "mcp_server",
        "name": "weather_service",
        "url": "https://gemini-api-demos.uc.r.appspot.com/mcp"
      }],
      "input": "Today is 12-05-2025, what is the temperature today in London?"
    }'
  ```

  {% /tab %}

  {% tab label="Python" %}
  ```python
  import os
  
  from google import genai
  
  client = genai.Client()
  response = client.interactions.create(
      model="gemini-3.8-flash",
      tools=[{
          "type": "mcp_server",
          "name": "weather_service",
          "url": "https://gemini-api-demos.uc.r.appspot.com/mcp",
      }],
      input="Today is 12-05-2025, what is the temperature today in London?",
  )
  print(response.output_text)
  ```

  {% /tab %}

  {% tab label="JavaScript" %}
  ```javascript
  import {GoogleGenAI} from '@google/genai';
  
  const ai = new GoogleGenAI({});
  const interaction = await ai.interactions.create({
    model: 'gemini-3.8-flash',
    tools: [
      {
        type: 'mcp_server',
        name: 'weather_service',
        url: 'https://gemini-api-demos.uc.r.appspot.com/mcp',
      },
    ],
    input: 'Today is 12-05-2025, what is the temperature today in London?',
  });
  console.log(interaction.output_text);
  ```

  {% /tab %}

  {% tab label="Java" %}
  ```java
  import com.google.genai.Client;
  import com.google.genai.gaos.models.operations.CreateInteractionRequestBody;
  import com.google.genai.gaos.models.operations.CreateInteractionResponse;
  import com.google.genai.gaos.models.interactions.CreateModelInteraction;
  import com.google.genai.gaos.models.interactions.Interaction;
  import com.google.genai.gaos.models.interactions.InteractionsInput;
  import com.google.genai.gaos.models.interactions.MCPServer;
  
  Client client = new Client();
  MCPServer mcpTool =
      MCPServer.builder()
          .name("weather_service")
          .url("https://gemini-api-demos.uc.r.appspot.com/mcp")
          .build();
  CreateModelInteraction params =
      CreateModelInteraction.builder()
          .model("gemini-3.8-flash")
          .tools(List.of(mcpTool))
          .input(
              InteractionsInput.of(
                  "Today is 12-05-2025, what is the temperature today in London?"))
          .build();
  CreateInteractionResponse response =
      client.interactions.create(CreateInteractionRequestBody.of(params));
  Interaction interaction =
      response.interaction().orElseThrow(() -> new RuntimeException("No interaction returned"));
  System.out.println(interaction.outputText().orElse(""));
  ```

  {% /tab %}

  {% tab label="mcp_server" %}
  ```go
  package main
  
  import (
      "context"
      "fmt"
      "log"
      "os"
      "google.golang.org/genai"
      gaos_interactions "google.golang.org/genai/interactions/models/interactions"
      "google.golang.org/genai/interactions/models/operations"
  )
  
  func main() {
      ctx := context.Background()
      client, err := genai.NewClient(ctx, nil)
      if err != nil {
          log.Fatal(err)
      }
  
      mcpServer := gaos_interactions.MCPServer{
          Name: genai.Ptr("weather_service"),
          URL:  genai.Ptr("https://gemini-api-demos.uc.r.appspot.com/mcp"),
      }
      tool := gaos_interactions.NewTool(mcpServer)
  
      body := operations.NewCreateInteractionRequestBody(gaos_interactions.CreateModelInteraction{
          Model: gaos_interactions.Model("gemini-3.8-flash"),
          Input: genai.Ptr(gaos_interactions.NewInteractionsInput("Today is 12-05-2025, what is the temperature today in London?")),
          Tools: []gaos_interactions.Tool{tool},
      })
  
      req := operations.CreateInteractionRequest{
          Body: body,
      }
  
      res, err := client.Interactions.Create(ctx, req)
      if err != nil {
          log.Fatal(err)
      }
  
      if res.Interaction != nil && res.Interaction.OutputText != nil {
          fmt.Println(*res.Interaction.OutputText)
      }
  }
  ```

  {% /tab %}

  {% /tabs %}

  {% /right-column %}

  {% /two-column-layout %}

{% /details %}

{% details %}
  {% summary %}
  **UrlContext**

  {% /summary %}

  A tool that can be used by the model to fetch URL context.

  {% two-column-layout %}
  {% left-column %}
  {% section class="api-ref-property-list" %}
  **type**: {% mark %}required{% /mark %} `object`

  Value: `url_context`

  {% /section %}

  {% /left-column %}

  {% right-column class="sticky" %}
  **Example**

  {% tabs %}
  {% tab label="REST" %}
  ```sh
  curl -X POST https://generativelanguage.googleapis.com/v1beta/interactions \
    -H "x-goog-api-key: $GEMINI_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{
      "model": "gemini-3.8-flash",
      "tools": [{
        "type": "url_context"
      }],
      "input": "Summarize https://www.example.com"
    }'
  ```

  {% /tab %}

  {% tab label="Python" %}
  ```python
  from google import genai
  
  client = genai.Client()
  response = client.interactions.create(
      model="gemini-3.8-flash",
      tools=[{"type": "url_context"}],
      input="Summarize https://www.example.com",
  )
  print(response.output_text)
  ```

  {% /tab %}

  {% tab label="JavaScript" %}
  ```javascript
  import {GoogleGenAI} from '@google/genai';
  
  const ai = new GoogleGenAI({});
  const interaction = await ai.interactions.create({
    model: 'gemini-3.8-flash',
    tools: [{type: 'url_context'}],
    input: 'Summarize https://www.example.com',
  });
  console.log(interaction.output_text);
  ```

  {% /tab %}

  {% tab label="Java" %}
  ```java
  import com.google.genai.Client;
  import com.google.genai.gaos.models.operations.CreateInteractionRequestBody;
  import com.google.genai.gaos.models.operations.CreateInteractionResponse;
  import com.google.genai.gaos.models.interactions.CreateModelInteraction;
  import com.google.genai.gaos.models.interactions.Interaction;
  import com.google.genai.gaos.models.interactions.InteractionsInput;
  import com.google.genai.gaos.models.interactions.URLContext;
  
  Client client = new Client();
  CreateModelInteraction params =
      CreateModelInteraction.builder()
          .model("gemini-3.8-flash")
          .tools(List.of(new URLContext()))
          .input(InteractionsInput.of("Summarize https://www.example.com"))
          .build();
  CreateInteractionResponse response =
      client.interactions.create(CreateInteractionRequestBody.of(params));
  Interaction interaction =
      response.interaction().orElseThrow(() -> new RuntimeException("No interaction returned"));
  System.out.println(interaction.outputText().orElse(""));
  ```

  {% /tab %}

  {% tab label="url_context" %}
  ```go
  package main
  
  import (
      "context"
      "fmt"
      "log"
      "google.golang.org/genai"
      gaos_interactions "google.golang.org/genai/interactions/models/interactions"
      "google.golang.org/genai/interactions/models/operations"
  )
  
  func main() {
      ctx := context.Background()
      client, err := genai.NewClient(ctx, nil)
      if err != nil {
          log.Fatal(err)
      }
  
      tool := gaos_interactions.NewTool(gaos_interactions.URLContext{})
  
      body := operations.NewCreateInteractionRequestBody(gaos_interactions.CreateModelInteraction{
          Model: gaos_interactions.Model("gemini-3.8-flash"),
          Input: genai.Ptr(gaos_interactions.NewInteractionsInput("Summarize https://www.example.com")),
          Tools: []gaos_interactions.Tool{tool},
      })
  
      req := operations.CreateInteractionRequest{
          Body: body,
      }
  
      res, err := client.Interactions.Create(ctx, req)
      if err != nil {
          log.Fatal(err)
      }
  
      if res.Interaction != nil && res.Interaction.OutputText != nil {
          fmt.Println(*res.Interaction.OutputText)
      }
  }
  ```

  {% /tab %}

  {% /tabs %}

  {% /right-column %}

  {% /two-column-layout %}

{% /details %}

### InteractionSseEvent  {% id="Resource:InteractionSseEvent" %}

**Polymorphic Types:**

{% details %}
  {% summary %}
  **ErrorEvent**

  {% /summary %}

  {% two-column-layout %}
  {% left-column %}
  {% section class="api-ref-property-list" %}
  **event_type**: {% mark %}required{% /mark %} `object`

  Value: `error`

  {% hr /%}

  {% details %}
  {% summary %}
  **error**: `Error`

  {% /summary %}

  **code**: `string`

  A URI that identifies the error type.

  **message**: `string`

  A human-readable error message.

  {% /details %}

  {% hr /%}

  **event_id**: `string`

  The event_id token to be used to resume the interaction stream, from this event.

  {% /section %}

  {% /left-column %}

  {% right-column class="sticky" %}
  **Example**

  **Error Event**

  ```json
  {
    "error": {
      "code": "not_found",
      "message": "Failed to get completed interaction: Result not found."
    },
    "event_type": "error"
  }
  ```

  {% /right-column %}

  {% /two-column-layout %}

{% /details %}

{% details %}
  {% summary %}
  **InteractionCompletedEvent**

  {% /summary %}

  Signals that the Interaction completed. Sent when the Interaction receives
  Complete/Cancel or naturally terminates. No more input can be sent to the
  Interaction after this.

  {% two-column-layout %}
  {% left-column %}
  {% section class="api-ref-property-list" %}
  {% details %}
  {% summary %}
  **interaction**: {% mark %}required{% /mark %} `InteractionSseEventInteraction`

  Partial completed interaction resource emitted at the end of the stream.

  {% /summary %}

  **id**: {% mark %}required{% /mark %} `string`

  Output only. A unique identifier for the interaction completion.

  {% details %}
  {% summary %}
  **status**: {% mark %}required{% /mark %} `string enum`

  Output only. The status of the interaction.

  {% /summary %}

  Possible values:

  - `in_progress`: The interaction is in progress.
  - `requires_action`: The interaction requires action/input from the user.
  - `completed`: The interaction is completed.
  - `failed`: The interaction failed.
  - `cancelled`: The interaction was cancelled.
  - `incomplete`: The interaction is completed, but contains incomplete results (e.g. hitting max_tokens).

  {% /details %}

  **model**: `string`

  The model that will complete your prompt.

  **created**: `string`

  Output only. The time at which the response was created in ISO 8601 format.

  **updated**: `string`

  Output only. The time at which the response was last updated in ISO 8601 format.

  {% details %}
  {% summary %}
  **usage**: `Usage`

  Output only. Statistics on the interaction request's token usage.

  {% /summary %}

  **total_input_tokens**: `integer`

  Number of tokens in the prompt (context).

  **initial_input_tokens**: `integer`

  Number of input tokens used in the first turn of this interaction.

  {% details %}
  {% summary %}
  **input_tokens_by_modality**: `ModalityTokens array`

  A breakdown of input token usage by modality.

  {% /summary %}

  {% details %}
  {% summary %}
  **modality**: `ResponseModality`

  The modality associated with the token count.

  {% /summary %}

  Possible values:

  - `text`: Indicates the model should return text.
  - `image`: Indicates the model should return images.
  - `audio`: Indicates the model should return audio.
  - `video`: Indicates the model should return video.
  - `document`: Indicates the model should return documents.

  {% /details %}

  **tokens**: `integer`

  Number of tokens for the modality.

  {% /details %}

  **total_cached_tokens**: `integer`

  Number of tokens in the cached part of the prompt (the cached content).

  {% details %}
  {% summary %}
  **cached_tokens_by_modality**: `ModalityTokens array`

  A breakdown of cached token usage by modality.

  {% /summary %}

  {% details %}
  {% summary %}
  **modality**: `ResponseModality`

  The modality associated with the token count.

  {% /summary %}

  Possible values:

  - `text`: Indicates the model should return text.
  - `image`: Indicates the model should return images.
  - `audio`: Indicates the model should return audio.
  - `video`: Indicates the model should return video.
  - `document`: Indicates the model should return documents.

  {% /details %}

  **tokens**: `integer`

  Number of tokens for the modality.

  {% /details %}

  **total_output_tokens**: `integer`

  Total number of tokens across all the generated responses.

  {% details %}
  {% summary %}
  **output_tokens_by_modality**: `ModalityTokens array`

  A breakdown of output token usage by modality.

  {% /summary %}

  {% details %}
  {% summary %}
  **modality**: `ResponseModality`

  The modality associated with the token count.

  {% /summary %}

  Possible values:

  - `text`: Indicates the model should return text.
  - `image`: Indicates the model should return images.
  - `audio`: Indicates the model should return audio.
  - `video`: Indicates the model should return video.
  - `document`: Indicates the model should return documents.

  {% /details %}

  **tokens**: `integer`

  Number of tokens for the modality.

  {% /details %}

  **total_tool_use_tokens**: `integer`

  Number of tokens present in tool-use prompt(s).

  {% details %}
  {% summary %}
  **tool_use_tokens_by_modality**: `ModalityTokens array`

  A breakdown of tool-use token usage by modality.

  {% /summary %}

  {% details %}
  {% summary %}
  **modality**: `ResponseModality`

  The modality associated with the token count.

  {% /summary %}

  Possible values:

  - `text`: Indicates the model should return text.
  - `image`: Indicates the model should return images.
  - `audio`: Indicates the model should return audio.
  - `video`: Indicates the model should return video.
  - `document`: Indicates the model should return documents.

  {% /details %}

  **tokens**: `integer`

  Number of tokens for the modality.

  {% /details %}

  **total_thought_tokens**: `integer`

  Number of tokens of thoughts for thinking models.

  **total_tokens**: `integer`

  Total token count for the interaction request (prompt + responses + other internal tokens).

  {% details %}
  {% summary %}
  **grounding_tool_count**: `GroundingToolCount array`

  Grounding tool count.

  {% /summary %}

  {% details %}
  {% summary %}
  **type**: `string enum`

  The grounding tool type associated with the count.

  {% /summary %}

  Possible values:

  - `google_search`: Grounding with Google Web Search and Image Search, & Web Grounding for Enterprise.
  - `google_maps`: Grounding with Google Maps.

  {% /details %}

  **count**: `integer`

  The number of grounding tool counts.

  {% /details %}

  {% /details %}

  {% details %}
  {% summary %}
  **service_tier**: `ServiceTier`

  The service tier for the interaction.

  {% /summary %}

  Possible values:

  - `flex`: Flex service tier.
  - `standard`: Standard service tier.
  - `priority`: Priority service tier.

  {% /details %}

  **steps**: [`Step`](/api-reference/interactions-api#Resource:Step) `array`

  Output only. The steps that make up the interaction, if included in this event.

  **continuation_token**: `string`

  Opaque token to resume a long decode. Output: set when status is INCOMPLETE and decoding can be resumed. Input: pass the latest token back unchanged in CreateInteraction to continue decoding.

  **agent**: `string`

  The agent to interact with.

  **object**: `string`

  Output only. The resource type.

  {% /details %}

  {% hr /%}

  **event_type**: {% mark %}required{% /mark %} `object`

  Value: `interaction.completed`

  {% hr /%}

  **event_id**: `string`

  The event_id token to be used to resume the interaction stream, from this event.

  {% /section %}

  {% /left-column %}

  {% right-column class="sticky" %}
  **Example**

  {% tabs %}
  {% tab label="Interaction Completed" %}
  ```json
  {
    "event_id": "evt_123",
    "event_type": "interaction.completed",
    "interaction": {
      "created": "2025-12-04T15:01:45Z",
      "id": "v1_ChdXS0l4YWZXTk9xbk0xZThQczhEcmlROBIXV0tJeGFmV05PcW5NMWU4UHM4RHJpUTg",
      "model": "gemini-3.6-flash",
      "status": "completed",
      "updated": "2025-12-04T15:01:45Z"
    }
  }
  ```

  {% /tab %}

  {% tab label="Interaction Completed" %}
  ```json
  {
    "event_id": "evt_123",
    "event_type": "interaction.completed",
    "interaction": {
      "created": "2025-12-04T15:01:45Z",
      "id": "v1_ChdXS0l4YWZXTk9xbk0xZThQczhEcmlROBIXV0tJeGFmV05PcW5NMWU4UHM4RHJpUTg",
      "model": "gemini-3-flash-preview",
      "object": "interaction",
      "status": "completed",
      "updated": "2025-12-04T15:01:45Z"
    }
  }
  ```

  {% /tab %}

  {% /tabs %}

  {% /right-column %}

  {% /two-column-layout %}

{% /details %}

{% details %}
  {% summary %}
  **InteractionCreatedEvent**

  {% /summary %}

  Server response confirming that a new interaction was created.

  {% two-column-layout %}
  {% left-column %}
  {% section class="api-ref-property-list" %}
  {% details %}
  {% summary %}
  **interaction**: {% mark %}required{% /mark %} `InteractionSseEventInteraction`

  Partial interaction resource emitted when the stream is created.

  {% /summary %}

  **id**: {% mark %}required{% /mark %} `string`

  Output only. A unique identifier for the interaction completion.

  {% details %}
  {% summary %}
  **status**: {% mark %}required{% /mark %} `string enum`

  Output only. The status of the interaction.

  {% /summary %}

  Possible values:

  - `in_progress`: The interaction is in progress.
  - `requires_action`: The interaction requires action/input from the user.
  - `completed`: The interaction is completed.
  - `failed`: The interaction failed.
  - `cancelled`: The interaction was cancelled.
  - `incomplete`: The interaction is completed, but contains incomplete results (e.g. hitting max_tokens).

  {% /details %}

  **model**: `string`

  The model that will complete your prompt.

  **created**: `string`

  Output only. The time at which the response was created in ISO 8601 format.

  **updated**: `string`

  Output only. The time at which the response was last updated in ISO 8601 format.

  {% details %}
  {% summary %}
  **usage**: `Usage`

  Output only. Statistics on the interaction request's token usage.

  {% /summary %}

  **total_input_tokens**: `integer`

  Number of tokens in the prompt (context).

  **initial_input_tokens**: `integer`

  Number of input tokens used in the first turn of this interaction.

  {% details %}
  {% summary %}
  **input_tokens_by_modality**: `ModalityTokens array`

  A breakdown of input token usage by modality.

  {% /summary %}

  {% details %}
  {% summary %}
  **modality**: `ResponseModality`

  The modality associated with the token count.

  {% /summary %}

  Possible values:

  - `text`: Indicates the model should return text.
  - `image`: Indicates the model should return images.
  - `audio`: Indicates the model should return audio.
  - `video`: Indicates the model should return video.
  - `document`: Indicates the model should return documents.

  {% /details %}

  **tokens**: `integer`

  Number of tokens for the modality.

  {% /details %}

  **total_cached_tokens**: `integer`

  Number of tokens in the cached part of the prompt (the cached content).

  {% details %}
  {% summary %}
  **cached_tokens_by_modality**: `ModalityTokens array`

  A breakdown of cached token usage by modality.

  {% /summary %}

  {% details %}
  {% summary %}
  **modality**: `ResponseModality`

  The modality associated with the token count.

  {% /summary %}

  Possible values:

  - `text`: Indicates the model should return text.
  - `image`: Indicates the model should return images.
  - `audio`: Indicates the model should return audio.
  - `video`: Indicates the model should return video.
  - `document`: Indicates the model should return documents.

  {% /details %}

  **tokens**: `integer`

  Number of tokens for the modality.

  {% /details %}

  **total_output_tokens**: `integer`

  Total number of tokens across all the generated responses.

  {% details %}
  {% summary %}
  **output_tokens_by_modality**: `ModalityTokens array`

  A breakdown of output token usage by modality.

  {% /summary %}

  {% details %}
  {% summary %}
  **modality**: `ResponseModality`

  The modality associated with the token count.

  {% /summary %}

  Possible values:

  - `text`: Indicates the model should return text.
  - `image`: Indicates the model should return images.
  - `audio`: Indicates the model should return audio.
  - `video`: Indicates the model should return video.
  - `document`: Indicates the model should return documents.

  {% /details %}

  **tokens**: `integer`

  Number of tokens for the modality.

  {% /details %}

  **total_tool_use_tokens**: `integer`

  Number of tokens present in tool-use prompt(s).

  {% details %}
  {% summary %}
  **tool_use_tokens_by_modality**: `ModalityTokens array`

  A breakdown of tool-use token usage by modality.

  {% /summary %}

  {% details %}
  {% summary %}
  **modality**: `ResponseModality`

  The modality associated with the token count.

  {% /summary %}

  Possible values:

  - `text`: Indicates the model should return text.
  - `image`: Indicates the model should return images.
  - `audio`: Indicates the model should return audio.
  - `video`: Indicates the model should return video.
  - `document`: Indicates the model should return documents.

  {% /details %}

  **tokens**: `integer`

  Number of tokens for the modality.

  {% /details %}

  **total_thought_tokens**: `integer`

  Number of tokens of thoughts for thinking models.

  **total_tokens**: `integer`

  Total token count for the interaction request (prompt + responses + other internal tokens).

  {% details %}
  {% summary %}
  **grounding_tool_count**: `GroundingToolCount array`

  Grounding tool count.

  {% /summary %}

  {% details %}
  {% summary %}
  **type**: `string enum`

  The grounding tool type associated with the count.

  {% /summary %}

  Possible values:

  - `google_search`: Grounding with Google Web Search and Image Search, & Web Grounding for Enterprise.
  - `google_maps`: Grounding with Google Maps.

  {% /details %}

  **count**: `integer`

  The number of grounding tool counts.

  {% /details %}

  {% /details %}

  {% details %}
  {% summary %}
  **service_tier**: `ServiceTier`

  The service tier for the interaction.

  {% /summary %}

  Possible values:

  - `flex`: Flex service tier.
  - `standard`: Standard service tier.
  - `priority`: Priority service tier.

  {% /details %}

  **steps**: [`Step`](/api-reference/interactions-api#Resource:Step) `array`

  Output only. The steps that make up the interaction, if included in this event.

  **continuation_token**: `string`

  Opaque token to resume a long decode. Output: set when status is INCOMPLETE and decoding can be resumed. Input: pass the latest token back unchanged in CreateInteraction to continue decoding.

  **agent**: `string`

  The agent to interact with.

  **object**: `string`

  Output only. The resource type.

  {% /details %}

  {% hr /%}

  **event_type**: {% mark %}required{% /mark %} `object`

  Value: `interaction.created`

  {% hr /%}

  **event_id**: `string`

  The event_id token to be used to resume the interaction stream, from this event.

  {% /section %}

  {% /left-column %}

  {% right-column class="sticky" %}
  **Example**

  {% tabs %}
  {% tab label="Interaction Created" %}
  ```json
  {
    "event_id": "evt_123",
    "event_type": "interaction.created",
    "interaction": {
      "created": "2025-12-04T15:01:45Z",
      "id": "v1_ChdXS0l4YWZXTk9xbk0xZThQczhEcmlROBIXV0tJeGFmV05PcW5NMWU4UHM4RHJpUTg",
      "model": "gemini-3.6-flash",
      "status": "in_progress",
      "updated": "2025-12-04T15:01:45Z"
    }
  }
  ```

  {% /tab %}

  {% tab label="Interaction Created" %}
  ```json
  {
    "event_id": "evt_123",
    "event_type": "interaction.created",
    "interaction": {
      "id": "v1_ChdXS0l4YWZXTk9xbk0xZThQczhEcmlROBIXV0tJeGFmV05PcW5NMWU4UHM4RHJpUTg",
      "model": "gemini-3-flash-preview",
      "object": "interaction",
      "status": "in_progress"
    }
  }
  ```

  {% /tab %}

  {% /tabs %}

  {% /right-column %}

  {% /two-column-layout %}

{% /details %}

{% details %}
  {% summary %}
  **InteractionStatusUpdate**

  {% /summary %}

  {% two-column-layout %}
  {% left-column %}
  {% section class="api-ref-property-list" %}
  **interaction_id**: {% mark %}required{% /mark %} `string`

  {% hr /%}

  {% details %}
  {% summary %}
  **status**: {% mark %}required{% /mark %} `string enum`

  {% /summary %}

  Possible values:

  - `in_progress`: The interaction is in progress.
  - `requires_action`: The interaction requires action/input from the user.
  - `completed`: The interaction is completed.
  - `failed`: The interaction failed.
  - `cancelled`: The interaction was cancelled.
  - `incomplete`: The interaction is completed, but contains incomplete results (e.g. hitting max_tokens).
  - `requires_continuation`: The interaction requires at least one more request for it to be completed. The next request should set the continuation_token to the one returned by this request.

  {% /details %}

  {% hr /%}

  **event_type**: {% mark %}required{% /mark %} `object`

  Value: `interaction.status_update`

  {% hr /%}

  **continuation_token**: `string`

  An optional opaque continuation token used to resume decoding from the latest checkpoint after a disconnected stream.

  {% hr /%}

  {% details %}
  {% summary %}
  **usage**: `Usage`

  Model usage statistics up to this checkpoint.

  {% /summary %}

  **total_input_tokens**: `integer`

  Number of tokens in the prompt (context).

  **initial_input_tokens**: `integer`

  Number of input tokens used in the first turn of this interaction.

  {% details %}
  {% summary %}
  **input_tokens_by_modality**: `ModalityTokens array`

  A breakdown of input token usage by modality.

  {% /summary %}

  {% details %}
  {% summary %}
  **modality**: `ResponseModality`

  The modality associated with the token count.

  {% /summary %}

  Possible values:

  - `text`: Indicates the model should return text.
  - `image`: Indicates the model should return images.
  - `audio`: Indicates the model should return audio.
  - `video`: Indicates the model should return video.
  - `document`: Indicates the model should return documents.

  {% /details %}

  **tokens**: `integer`

  Number of tokens for the modality.

  {% /details %}

  **total_cached_tokens**: `integer`

  Number of tokens in the cached part of the prompt (the cached content).

  {% details %}
  {% summary %}
  **cached_tokens_by_modality**: `ModalityTokens array`

  A breakdown of cached token usage by modality.

  {% /summary %}

  {% details %}
  {% summary %}
  **modality**: `ResponseModality`

  The modality associated with the token count.

  {% /summary %}

  Possible values:

  - `text`: Indicates the model should return text.
  - `image`: Indicates the model should return images.
  - `audio`: Indicates the model should return audio.
  - `video`: Indicates the model should return video.
  - `document`: Indicates the model should return documents.

  {% /details %}

  **tokens**: `integer`

  Number of tokens for the modality.

  {% /details %}

  **total_output_tokens**: `integer`

  Total number of tokens across all the generated responses.

  {% details %}
  {% summary %}
  **output_tokens_by_modality**: `ModalityTokens array`

  A breakdown of output token usage by modality.

  {% /summary %}

  {% details %}
  {% summary %}
  **modality**: `ResponseModality`

  The modality associated with the token count.

  {% /summary %}

  Possible values:

  - `text`: Indicates the model should return text.
  - `image`: Indicates the model should return images.
  - `audio`: Indicates the model should return audio.
  - `video`: Indicates the model should return video.
  - `document`: Indicates the model should return documents.

  {% /details %}

  **tokens**: `integer`

  Number of tokens for the modality.

  {% /details %}

  **total_tool_use_tokens**: `integer`

  Number of tokens present in tool-use prompt(s).

  {% details %}
  {% summary %}
  **tool_use_tokens_by_modality**: `ModalityTokens array`

  A breakdown of tool-use token usage by modality.

  {% /summary %}

  {% details %}
  {% summary %}
  **modality**: `ResponseModality`

  The modality associated with the token count.

  {% /summary %}

  Possible values:

  - `text`: Indicates the model should return text.
  - `image`: Indicates the model should return images.
  - `audio`: Indicates the model should return audio.
  - `video`: Indicates the model should return video.
  - `document`: Indicates the model should return documents.

  {% /details %}

  **tokens**: `integer`

  Number of tokens for the modality.

  {% /details %}

  **total_thought_tokens**: `integer`

  Number of tokens of thoughts for thinking models.

  **total_tokens**: `integer`

  Total token count for the interaction request (prompt + responses + other internal tokens).

  {% details %}
  {% summary %}
  **grounding_tool_count**: `GroundingToolCount array`

  Grounding tool count.

  {% /summary %}

  {% details %}
  {% summary %}
  **type**: `string enum`

  The grounding tool type associated with the count.

  {% /summary %}

  Possible values:

  - `google_search`: Grounding with Google Web Search and Image Search, & Web Grounding for Enterprise.
  - `google_maps`: Grounding with Google Maps.

  {% /details %}

  **count**: `integer`

  The number of grounding tool counts.

  {% /details %}

  {% /details %}

  {% hr /%}

  **event_id**: `string`

  The event_id token to be used to resume the interaction stream, from this event.

  {% /section %}

  {% /left-column %}

  {% right-column class="sticky" %}
  **Example**

  **Interaction Status Update**

  ```json
  {
    "event_type": "interaction.status_update",
    "interaction_id": "v1_ChdTMjQ0YWJ5TUF1TzcxZThQdjRpcnFRcxIXUzI0NGFieU1BdU83MWU4UHY0aXJxUXM",
    "status": "in_progress"
  }
  ```

  {% /right-column %}

  {% /two-column-layout %}

{% /details %}

{% details %}
  {% summary %}
  **StepDelta**

  {% /summary %}

  {% two-column-layout %}
  {% left-column %}
  {% section class="api-ref-property-list" %}
  **index**: {% mark %}required{% /mark %} `integer`

  {% hr /%}

  {% details %}
  {% summary %}
  **delta**: {% mark %}required{% /mark %} `StepDeltaData`

  {% /summary %}

  **Possible Types:** {% class="api-ref-label" %}

  {% details %}
  {% summary %}
  **ArgumentsDelta**

  {% /summary %}

  **type**: {% mark %}required{% /mark %} `object`

  Value: `arguments_delta`

  **arguments**: `string`

  {% /details %}

  {% details %}
  {% summary %}
  **AudioDelta**

  {% /summary %}

  **type**: {% mark %}required{% /mark %} `object`

  Value: `audio`

  {% details %}
  {% summary %}
  **mime_type**: `string enum`

  {% /summary %}

  Possible values:

  - `audio/wav`: WAV audio format
  - `audio/mp3`: MP3 audio format
  - `audio/aiff`: AIFF audio format
  - `audio/aac`: AAC audio format
  - `audio/ogg`: OGG audio format
  - `audio/flac`: FLAC audio format
  - `audio/mpeg`: MPEG audio format
  - `audio/m4a`: M4A audio format
  - `audio/l16`: L16 audio format
  - `audio/opus`: OPUS audio format
  - `audio/alaw`: ALAW audio format
  - `audio/mulaw`: MULAW audio format
  - `audio/webm`: WEBM audio format

  {% /details %}

  **data**: `string`

  **uri**: `string`

  **sample_rate**: `integer`

  The sample rate of the audio.

  **channels**: `integer`

  The number of audio channels.

  {% /details %}

  {% details %}
  {% summary %}
  **CodeExecutionCallDelta**

  {% /summary %}

  {% details %}
  {% summary %}
  **arguments**: {% mark %}required{% /mark %} `CodeExecutionCallArguments`

  {% /summary %}

  {% details %}
  {% summary %}
  **language**: `string enum`

  Programming language of the `code`.

  {% /summary %}

  Possible values:

  - `python`: Python >= 3.10, with numpy and simpy available.
  - `bash`: Bash. Only available for Gemini 3.0 model or above.

  {% /details %}

  **code**: `string`

  The code to be executed.

  {% /details %}

  **type**: {% mark %}required{% /mark %} `object`

  Value: `code_execution_call`

  **signature**: `string`

  A signature hash for backend validation.

  {% /details %}

  {% details %}
  {% summary %}
  **CodeExecutionResultDelta**

  {% /summary %}

  **result**: {% mark %}required{% /mark %} `string`

  **type**: {% mark %}required{% /mark %} `object`

  Value: `code_execution_result`

  **is_error**: `boolean`

  **signature**: `string`

  A signature hash for backend validation.

  {% /details %}

  {% details %}
  {% summary %}
  **DocumentDelta**

  {% /summary %}

  **type**: {% mark %}required{% /mark %} `object`

  Value: `document`

  {% details %}
  {% summary %}
  **mime_type**: `string enum`

  {% /summary %}

  Possible values:

  - `application/pdf`: PDF document format
  - `text/csv`: CSV document format
  - `application/vnd.openxmlformats-officedocument.presentationml.presentation`: PPTX presentation format
  - `application/vnd.ms-powerpoint`: PPT presentation format
  - `application/vnd.oasis.opendocument.presentation`: ODP presentation format
  - `application/vnd.openxmlformats-officedocument.wordprocessingml.document`: DOCX document format
  - `application/msword`: DOC document format
  - `application/vnd.openxmlformats-officedocument.wordprocessingml.template`: DOTX document template format
  - `application/vnd.oasis.opendocument.text`: ODT document format
  - `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`: XLSX spreadsheet format
  - `application/vnd.ms-excel`: XLS spreadsheet format
  - `application/vnd.oasis.opendocument.spreadsheet`: ODS spreadsheet format

  {% /details %}

  **data**: `string`

  **uri**: `string`

  {% /details %}

  {% details %}
  {% summary %}
  **FileSearchCallDelta**

  {% /summary %}

  **type**: {% mark %}required{% /mark %} `object`

  Value: `file_search_call`

  **signature**: `string`

  A signature hash for backend validation.

  {% /details %}

  {% details %}
  {% summary %}
  **FileSearchResultDelta**

  {% /summary %}

  {% details %}
  {% summary %}
  **result**: {% mark %}required{% /mark %} `FileSearchResult array`

  {% /summary %}

  {% /details %}

  **type**: {% mark %}required{% /mark %} `object`

  Value: `file_search_result`

  **signature**: `string`

  A signature hash for backend validation.

  {% /details %}

  {% details %}
  {% summary %}
  **FunctionResultDelta**

  {% /summary %}

  {% details %}
  {% summary %}
  **result**: {% mark %}required{% /mark %} `(`[`ImageContent`](/api-reference/interactions-api#Resource:ImageContent) or [`TextContent`](/api-reference/interactions-api#Resource:TextContent)`) array` or `object` or `string`

  {% /summary %}

  **Possible Types:** {% class="api-ref-label" %}

  {% details %}
  {% summary %}
  **([ImageContent](/api-reference/interactions-api#Resource:ImageContent) or [TextContent](/api-reference/interactions-api#Resource:TextContent)) array**

  {% /summary %}

  A list where each item is one of: [`ImageContent`](/api-reference/interactions-api#Resource:ImageContent), [`TextContent`](/api-reference/interactions-api#Resource:TextContent).

  {% /details %}

  {% details %}
  {% summary %}
  **string**

  {% /summary %}

  A direct string value.

  {% /details %}

  {% /details %}

  **type**: {% mark %}required{% /mark %} `object`

  Value: `function_result`

  **name**: `string`

  **is_error**: `boolean`

  {% /details %}

  {% details %}
  {% summary %}
  **GoogleMapsCallDelta**

  {% /summary %}

  **type**: {% mark %}required{% /mark %} `object`

  Value: `google_maps_call`

  {% details %}
  {% summary %}
  **arguments**: `GoogleMapsCallArguments`

  The arguments to pass to the Google Maps tool.

  {% /summary %}

  **queries**: `string array`

  The queries to be executed.

  {% /details %}

  **signature**: `string`

  A signature hash for backend validation.

  {% /details %}

  {% details %}
  {% summary %}
  **GoogleMapsResultDelta**

  {% /summary %}

  **type**: {% mark %}required{% /mark %} `object`

  Value: `google_maps_result`

  {% details %}
  {% summary %}
  **result**: `GoogleMapsResult array`

  The results of the Google Maps.

  {% /summary %}

  {% details %}
  {% summary %}
  **places**: `Places array`

  The places that were found.

  {% /summary %}

  **place_id**: `string`

  The ID of the place, in `places/{place_id}` format.

  **name**: `string`

  Title of the place.

  **url**: `string`

  URI reference of the place.

  {% details %}
  {% summary %}
  **review_snippets**: `ReviewSnippet array`

  Snippets of reviews that are used to generate answers about the features of a given place in Google Maps.

  {% /summary %}

  **title**: `string`

  Title of the review.

  **url**: `string`

  A link that corresponds to the user review on Google Maps.

  **review_id**: `string`

  The ID of the review snippet.

  {% /details %}

  {% /details %}

  **widget_context_token**: `string`

  Resource name of the Google Maps widget context token.

  {% /details %}

  **signature**: `string`

  A signature hash for backend validation.

  {% /details %}

  {% details %}
  {% summary %}
  **GoogleSearchCallDelta**

  {% /summary %}

  {% details %}
  {% summary %}
  **arguments**: {% mark %}required{% /mark %} `GoogleSearchCallArguments`

  {% /summary %}

  **queries**: `string array`

  Web search queries for the following-up web search.

  {% /details %}

  **type**: {% mark %}required{% /mark %} `object`

  Value: `google_search_call`

  **signature**: `string`

  A signature hash for backend validation.

  {% /details %}

  {% details %}
  {% summary %}
  **GoogleSearchResultDelta**

  {% /summary %}

  {% details %}
  {% summary %}
  **result**: {% mark %}required{% /mark %} `GoogleSearchResult array`

  {% /summary %}

  **search_suggestions**: `string`

  Web content snippet that can be embedded in a web page or an app webview.

  {% /details %}

  **type**: {% mark %}required{% /mark %} `object`

  Value: `google_search_result`

  **is_error**: `boolean`

  **signature**: `string`

  A signature hash for backend validation.

  {% /details %}

  {% details %}
  {% summary %}
  **ImageDelta**

  {% /summary %}

  **type**: {% mark %}required{% /mark %} `object`

  Value: `image`

  {% details %}
  {% summary %}
  **mime_type**: `string enum`

  {% /summary %}

  Possible values:

  - `image/png`: PNG image format
  - `image/jpeg`: JPEG image format
  - `image/webp`: WebP image format
  - `image/heic`: HEIC image format
  - `image/heif`: HEIF image format
  - `image/gif`: GIF image format
  - `image/bmp`: BMP image format
  - `image/tiff`: TIFF image format

  {% /details %}

  **data**: `string`

  **uri**: `string`

  {% details %}
  {% summary %}
  **resolution**: `MediaResolution`

  The resolution of the media.

  {% /summary %}

  Possible values:

  - `low`: Low resolution.
  - `medium`: Medium resolution.
  - `high`: High resolution.
  - `ultra_high`: Ultra high resolution.

  {% /details %}

  {% /details %}

  {% details %}
  {% summary %}
  **McpServerToolCallDelta**

  {% /summary %}

  **name**: {% mark %}required{% /mark %} `string`

  **server_name**: {% mark %}required{% /mark %} `string`

  **arguments**: {% mark %}required{% /mark %} `object`

  **type**: {% mark %}required{% /mark %} `object`

  Value: `mcp_server_tool_call`

  {% /details %}

  {% details %}
  {% summary %}
  **McpServerToolResultDelta**

  {% /summary %}

  {% details %}
  {% summary %}
  **result**: {% mark %}required{% /mark %} `(`[`ImageContent`](/api-reference/interactions-api#Resource:ImageContent) or [`TextContent`](/api-reference/interactions-api#Resource:TextContent)`) array` or `object` or `string`

  {% /summary %}

  **Possible Types:** {% class="api-ref-label" %}

  {% details %}
  {% summary %}
  **([ImageContent](/api-reference/interactions-api#Resource:ImageContent) or [TextContent](/api-reference/interactions-api#Resource:TextContent)) array**

  {% /summary %}

  A list where each item is one of: [`ImageContent`](/api-reference/interactions-api#Resource:ImageContent), [`TextContent`](/api-reference/interactions-api#Resource:TextContent).

  {% /details %}

  {% details %}
  {% summary %}
  **string**

  {% /summary %}

  A direct string value.

  {% /details %}

  {% /details %}

  **type**: {% mark %}required{% /mark %} `object`

  Value: `mcp_server_tool_result`

  **name**: `string`

  **server_name**: `string`

  {% /details %}

  {% details %}
  {% summary %}
  **ProcessingCallDelta**

  {% /summary %}

  Streaming delta for a server-initiated media processing step.

  **type**: {% mark %}required{% /mark %} `object`

  Value: `processing_call`

  **signature**: `string`

  A signature hash for backend validation.

  {% /details %}

  {% details %}
  {% summary %}
  **ProcessingResultDelta**

  {% /summary %}

  Streaming delta for the result of a server-initiated media processing step.

  **type**: {% mark %}required{% /mark %} `object`

  Value: `processing_result`

  **signature**: `string`

  A signature hash for backend validation.

  {% /details %}

  {% details %}
  {% summary %}
  **TextAnnotationDelta**

  {% /summary %}

  **type**: {% mark %}required{% /mark %} `object`

  Value: `text_annotation_delta`

  {% details %}
  {% summary %}
  **annotations**: `Annotation array`

  Citation information for model-generated content.

  {% /summary %}

  **Possible Types:** {% class="api-ref-label" %}

  {% details %}
  {% summary %}
  **FileCitation**

  {% /summary %}

  A file citation annotation.

  **type**: {% mark %}required{% /mark %} `object`

  Value: `file_citation`

  **document_uri**: `string`

  The URI of the file.

  **file_name**: `string`

  The name of the file.

  **source**: `string`

  Source attributed for a portion of the text.

  **custom_metadata**: `object`

  User provided metadata about the retrieved context.

  **page_number**: `integer`

  Page number of the cited document, if applicable.

  **media_id**: `string`

  Media ID in-case of image citations, if applicable.

  **start_index**: `integer`

  Start of segment of the response that is attributed to this source. Index indicates the start of the segment, measured in bytes.

  **end_index**: `integer`

  End of the attributed segment, exclusive.

  {% /details %}

  {% details %}
  {% summary %}
  **PlaceCitation**

  {% /summary %}

  A place citation annotation.

  **type**: {% mark %}required{% /mark %} `object`

  Value: `place_citation`

  **place_id**: `string`

  The ID of the place, in `places/{place_id}` format.

  **name**: `string`

  Title of the place.

  **url**: `string`

  URI reference of the place.

  {% details %}
  {% summary %}
  **review_snippets**: `ReviewSnippet array`

  Snippets of reviews that are used to generate answers about the features of a given place in Google Maps.

  {% /summary %}

  **title**: `string`

  Title of the review.

  **url**: `string`

  A link that corresponds to the user review on Google Maps.

  **review_id**: `string`

  The ID of the review snippet.

  {% /details %}

  **start_index**: `integer`

  Start of segment of the response that is attributed to this source. Index indicates the start of the segment, measured in bytes.

  **end_index**: `integer`

  End of the attributed segment, exclusive.

  {% /details %}

  {% details %}
  {% summary %}
  **SpeechAnnotation**

  {% /summary %}

  Speech annotation for text content.

  **type**: {% mark %}required{% /mark %} `object`

  Value: `speech_metadata`

  **speaker**: `string`

  The speaker to associate with this turn.

  **style**: `string`

  Style instruction for the speech synthesis.

  **start_index**: `integer`

  Start of segment of the response that is attributed to this source. Index indicates the start of the segment, measured in bytes.

  **end_index**: `integer`

  End of the attributed segment, exclusive.

  {% /details %}

  {% details %}
  {% summary %}
  **UrlCitation**

  {% /summary %}

  A URL citation annotation.

  **type**: {% mark %}required{% /mark %} `object`

  Value: `url_citation`

  **url**: `string`

  The URL.

  **title**: `string`

  The title of the URL.

  **start_index**: `integer`

  Start of segment of the response that is attributed to this source. Index indicates the start of the segment, measured in bytes.

  **end_index**: `integer`

  End of the attributed segment, exclusive.

  {% /details %}

  {% details %}
  {% summary %}
  **WordInfo**

  {% /summary %}

  Word-level ASR annotation for transcription output. Carries the word text, optional timing, and optional speaker attribution.

  **type**: {% mark %}required{% /mark %} `object`

  Value: `word_info`

  **text**: `string`

  The transcribed word.

  **start_offset**: `string`

  Start offset in time of the word relative to the start of the audio. Present when timestamp_granularities contains "word".

  **end_offset**: `string`

  End offset in time of the word relative to the start of the audio. Present when timestamp_granularities contains "word".

  **speaker**: `string`

  Optional. Speaker label for this word (e.g. "spk_1", "spk_2"). Present when diarization_mode is set in TranscriptionConfig.

  **start_index**: `integer`

  Start of segment of the response that is attributed to this source. Index indicates the start of the segment, measured in bytes.

  **end_index**: `integer`

  End of the attributed segment, exclusive.

  {% /details %}

  {% /details %}

  {% /details %}

  {% details %}
  {% summary %}
  **TextDelta**

  {% /summary %}

  **text**: {% mark %}required{% /mark %} `string`

  **type**: {% mark %}required{% /mark %} `object`

  Value: `text`

  {% /details %}

  {% details %}
  {% summary %}
  **ThoughtSignatureDelta**

  {% /summary %}

  **type**: {% mark %}required{% /mark %} `object`

  Value: `thought_signature`

  **signature**: `string`

  Signature to match the backend source to be part of the generation.

  {% /details %}

  {% details %}
  {% summary %}
  **ThoughtSummaryDelta**

  {% /summary %}

  **type**: {% mark %}required{% /mark %} `object`

  Value: `thought_summary`

  **content**: [`Content`](/api-reference/interactions-api#Resource:Content)

  A new summary item to be added to the thought.

  {% /details %}

  {% details %}
  {% summary %}
  **UrlContextCallDelta**

  {% /summary %}

  {% details %}
  {% summary %}
  **arguments**: {% mark %}required{% /mark %} `UrlContextCallArguments`

  {% /summary %}

  **urls**: `string array`

  The URLs to fetch.

  {% /details %}

  **type**: {% mark %}required{% /mark %} `object`

  Value: `url_context_call`

  **signature**: `string`

  A signature hash for backend validation.

  {% /details %}

  {% details %}
  {% summary %}
  **UrlContextResultDelta**

  {% /summary %}

  {% details %}
  {% summary %}
  **result**: {% mark %}required{% /mark %} `UrlContextResult array`

  {% /summary %}

  **url**: `string`

  The URL that was fetched.

  {% details %}
  {% summary %}
  **status**: `string enum`

  The status of the URL retrieval.

  {% /summary %}

  Possible values:

  - `success`: Url retrieval is successful.
  - `error`: Url retrieval is failed due to error.
  - `paywall`: Url retrieval is failed because the content is behind paywall.
  - `unsafe`: Url retrieval is failed because the content is unsafe.

  {% /details %}

  {% /details %}

  **type**: {% mark %}required{% /mark %} `object`

  Value: `url_context_result`

  **is_error**: `boolean`

  **signature**: `string`

  A signature hash for backend validation.

  {% /details %}

  {% details %}
  {% summary %}
  **VideoDelta**

  {% /summary %}

  **type**: {% mark %}required{% /mark %} `object`

  Value: `video`

  {% details %}
  {% summary %}
  **mime_type**: `string enum`

  {% /summary %}

  Possible values:

  - `video/mp4`: MP4 video format
  - `video/mpeg`: MPEG video format
  - `video/mpg`: MPG video format
  - `video/mov`: MOV video format
  - `video/avi`: AVI video format
  - `video/x-flv`: FLV video format
  - `video/webm`: WebM video format
  - `video/wmv`: WMV video format
  - `video/3gpp`: 3GPP video format
  - `video/jpeg2000`: JPEG 2000 video format

  {% /details %}

  **data**: `string`

  **uri**: `string`

  {% details %}
  {% summary %}
  **resolution**: `MediaResolution`

  The resolution of the media.

  {% /summary %}

  Possible values:

  - `low`: Low resolution.
  - `medium`: Medium resolution.
  - `high`: High resolution.
  - `ultra_high`: Ultra high resolution.

  {% /details %}

  {% /details %}

  {% /details %}

  {% hr /%}

  **event_type**: {% mark %}required{% /mark %} `object`

  Value: `step.delta`

  {% hr /%}

  **event_id**: `string`

  The event_id token to be used to resume the interaction stream, from this event.

  {% hr /%}

  {% details %}
  {% summary %}
  **metadata**: `StepDeltaMetadata`

  {% /summary %}

  {% details %}
  {% summary %}
  **total_usage**: `Usage`

  Statistics on the interaction request's token usage.

  {% /summary %}

  **total_input_tokens**: `integer`

  Number of tokens in the prompt (context).

  **initial_input_tokens**: `integer`

  Number of input tokens used in the first turn of this interaction.

  {% details %}
  {% summary %}
  **input_tokens_by_modality**: `ModalityTokens array`

  A breakdown of input token usage by modality.

  {% /summary %}

  {% details %}
  {% summary %}
  **modality**: `ResponseModality`

  The modality associated with the token count.

  {% /summary %}

  Possible values:

  - `text`: Indicates the model should return text.
  - `image`: Indicates the model should return images.
  - `audio`: Indicates the model should return audio.
  - `video`: Indicates the model should return video.
  - `document`: Indicates the model should return documents.

  {% /details %}

  **tokens**: `integer`

  Number of tokens for the modality.

  {% /details %}

  **total_cached_tokens**: `integer`

  Number of tokens in the cached part of the prompt (the cached content).

  {% details %}
  {% summary %}
  **cached_tokens_by_modality**: `ModalityTokens array`

  A breakdown of cached token usage by modality.

  {% /summary %}

  {% details %}
  {% summary %}
  **modality**: `ResponseModality`

  The modality associated with the token count.

  {% /summary %}

  Possible values:

  - `text`: Indicates the model should return text.
  - `image`: Indicates the model should return images.
  - `audio`: Indicates the model should return audio.
  - `video`: Indicates the model should return video.
  - `document`: Indicates the model should return documents.

  {% /details %}

  **tokens**: `integer`

  Number of tokens for the modality.

  {% /details %}

  **total_output_tokens**: `integer`

  Total number of tokens across all the generated responses.

  {% details %}
  {% summary %}
  **output_tokens_by_modality**: `ModalityTokens array`

  A breakdown of output token usage by modality.

  {% /summary %}

  {% details %}
  {% summary %}
  **modality**: `ResponseModality`

  The modality associated with the token count.

  {% /summary %}

  Possible values:

  - `text`: Indicates the model should return text.
  - `image`: Indicates the model should return images.
  - `audio`: Indicates the model should return audio.
  - `video`: Indicates the model should return video.
  - `document`: Indicates the model should return documents.

  {% /details %}

  **tokens**: `integer`

  Number of tokens for the modality.

  {% /details %}

  **total_tool_use_tokens**: `integer`

  Number of tokens present in tool-use prompt(s).

  {% details %}
  {% summary %}
  **tool_use_tokens_by_modality**: `ModalityTokens array`

  A breakdown of tool-use token usage by modality.

  {% /summary %}

  {% details %}
  {% summary %}
  **modality**: `ResponseModality`

  The modality associated with the token count.

  {% /summary %}

  Possible values:

  - `text`: Indicates the model should return text.
  - `image`: Indicates the model should return images.
  - `audio`: Indicates the model should return audio.
  - `video`: Indicates the model should return video.
  - `document`: Indicates the model should return documents.

  {% /details %}

  **tokens**: `integer`

  Number of tokens for the modality.

  {% /details %}

  **total_thought_tokens**: `integer`

  Number of tokens of thoughts for thinking models.

  **total_tokens**: `integer`

  Total token count for the interaction request (prompt + responses + other internal tokens).

  {% details %}
  {% summary %}
  **grounding_tool_count**: `GroundingToolCount array`

  Grounding tool count.

  {% /summary %}

  {% details %}
  {% summary %}
  **type**: `string enum`

  The grounding tool type associated with the count.

  {% /summary %}

  Possible values:

  - `google_search`: Grounding with Google Web Search and Image Search, & Web Grounding for Enterprise.
  - `google_maps`: Grounding with Google Maps.

  {% /details %}

  **count**: `integer`

  The number of grounding tool counts.

  {% /details %}

  {% /details %}

  {% /details %}

  {% /section %}

  {% /left-column %}

  {% right-column class="sticky" %}
  **Example**

  **Step Delta**

  ```json
  {
    "delta": {
      "type": "text",
      "text": "Hello"
    },
    "event_type": "step.delta",
    "index": 0
  }
  ```

  {% /right-column %}

  {% /two-column-layout %}

{% /details %}

{% details %}
  {% summary %}
  **StepStart**

  {% /summary %}

  {% two-column-layout %}
  {% left-column %}
  {% section class="api-ref-property-list" %}
  **index**: {% mark %}required{% /mark %} `integer`

  {% hr /%}

  **step**: {% mark %}required{% /mark %} [`Step`](/api-reference/interactions-api#Resource:Step)

  {% hr /%}

  **event_type**: {% mark %}required{% /mark %} `object`

  Value: `step.start`

  {% hr /%}

  **event_id**: `string`

  The event_id token to be used to resume the interaction stream, from this event.

  {% /section %}

  {% /left-column %}

  {% right-column class="sticky" %}
  **Example**

  **Step Start**

  ```json
  {
    "event_type": "step.start",
    "index": 0,
    "step": {
      "type": "model_output"
    }
  }
  ```

  {% /right-column %}

  {% /two-column-layout %}

{% /details %}

{% details %}
  {% summary %}
  **StepStop**

  {% /summary %}

  {% two-column-layout %}
  {% left-column %}
  {% section class="api-ref-property-list" %}
  **index**: {% mark %}required{% /mark %} `integer`

  {% hr /%}

  **event_type**: {% mark %}required{% /mark %} `object`

  Value: `step.stop`

  {% hr /%}

  {% details %}
  {% summary %}
  **usage**: `Usage`

  Cumulative model usage stats from the start of the session.

  {% /summary %}

  **total_input_tokens**: `integer`

  Number of tokens in the prompt (context).

  **initial_input_tokens**: `integer`

  Number of input tokens used in the first turn of this interaction.

  {% details %}
  {% summary %}
  **input_tokens_by_modality**: `ModalityTokens array`

  A breakdown of input token usage by modality.

  {% /summary %}

  {% details %}
  {% summary %}
  **modality**: `ResponseModality`

  The modality associated with the token count.

  {% /summary %}

  Possible values:

  - `text`: Indicates the model should return text.
  - `image`: Indicates the model should return images.
  - `audio`: Indicates the model should return audio.
  - `video`: Indicates the model should return video.
  - `document`: Indicates the model should return documents.

  {% /details %}

  **tokens**: `integer`

  Number of tokens for the modality.

  {% /details %}

  **total_cached_tokens**: `integer`

  Number of tokens in the cached part of the prompt (the cached content).

  {% details %}
  {% summary %}
  **cached_tokens_by_modality**: `ModalityTokens array`

  A breakdown of cached token usage by modality.

  {% /summary %}

  {% details %}
  {% summary %}
  **modality**: `ResponseModality`

  The modality associated with the token count.

  {% /summary %}

  Possible values:

  - `text`: Indicates the model should return text.
  - `image`: Indicates the model should return images.
  - `audio`: Indicates the model should return audio.
  - `video`: Indicates the model should return video.
  - `document`: Indicates the model should return documents.

  {% /details %}

  **tokens**: `integer`

  Number of tokens for the modality.

  {% /details %}

  **total_output_tokens**: `integer`

  Total number of tokens across all the generated responses.

  {% details %}
  {% summary %}
  **output_tokens_by_modality**: `ModalityTokens array`

  A breakdown of output token usage by modality.

  {% /summary %}

  {% details %}
  {% summary %}
  **modality**: `ResponseModality`

  The modality associated with the token count.

  {% /summary %}

  Possible values:

  - `text`: Indicates the model should return text.
  - `image`: Indicates the model should return images.
  - `audio`: Indicates the model should return audio.
  - `video`: Indicates the model should return video.
  - `document`: Indicates the model should return documents.

  {% /details %}

  **tokens**: `integer`

  Number of tokens for the modality.

  {% /details %}

  **total_tool_use_tokens**: `integer`

  Number of tokens present in tool-use prompt(s).

  {% details %}
  {% summary %}
  **tool_use_tokens_by_modality**: `ModalityTokens array`

  A breakdown of tool-use token usage by modality.

  {% /summary %}

  {% details %}
  {% summary %}
  **modality**: `ResponseModality`

  The modality associated with the token count.

  {% /summary %}

  Possible values:

  - `text`: Indicates the model should return text.
  - `image`: Indicates the model should return images.
  - `audio`: Indicates the model should return audio.
  - `video`: Indicates the model should return video.
  - `document`: Indicates the model should return documents.

  {% /details %}

  **tokens**: `integer`

  Number of tokens for the modality.

  {% /details %}

  **total_thought_tokens**: `integer`

  Number of tokens of thoughts for thinking models.

  **total_tokens**: `integer`

  Total token count for the interaction request (prompt + responses + other internal tokens).

  {% details %}
  {% summary %}
  **grounding_tool_count**: `GroundingToolCount array`

  Grounding tool count.

  {% /summary %}

  {% details %}
  {% summary %}
  **type**: `string enum`

  The grounding tool type associated with the count.

  {% /summary %}

  Possible values:

  - `google_search`: Grounding with Google Web Search and Image Search, & Web Grounding for Enterprise.
  - `google_maps`: Grounding with Google Maps.

  {% /details %}

  **count**: `integer`

  The number of grounding tool counts.

  {% /details %}

  {% /details %}

  {% hr /%}

  {% details %}
  {% summary %}
  **step_usage**: `Usage`

  Model usage stats for this specific step.

  {% /summary %}

  **total_input_tokens**: `integer`

  Number of tokens in the prompt (context).

  **initial_input_tokens**: `integer`

  Number of input tokens used in the first turn of this interaction.

  {% details %}
  {% summary %}
  **input_tokens_by_modality**: `ModalityTokens array`

  A breakdown of input token usage by modality.

  {% /summary %}

  {% details %}
  {% summary %}
  **modality**: `ResponseModality`

  The modality associated with the token count.

  {% /summary %}

  Possible values:

  - `text`: Indicates the model should return text.
  - `image`: Indicates the model should return images.
  - `audio`: Indicates the model should return audio.
  - `video`: Indicates the model should return video.
  - `document`: Indicates the model should return documents.

  {% /details %}

  **tokens**: `integer`

  Number of tokens for the modality.

  {% /details %}

  **total_cached_tokens**: `integer`

  Number of tokens in the cached part of the prompt (the cached content).

  {% details %}
  {% summary %}
  **cached_tokens_by_modality**: `ModalityTokens array`

  A breakdown of cached token usage by modality.

  {% /summary %}

  {% details %}
  {% summary %}
  **modality**: `ResponseModality`

  The modality associated with the token count.

  {% /summary %}

  Possible values:

  - `text`: Indicates the model should return text.
  - `image`: Indicates the model should return images.
  - `audio`: Indicates the model should return audio.
  - `video`: Indicates the model should return video.
  - `document`: Indicates the model should return documents.

  {% /details %}

  **tokens**: `integer`

  Number of tokens for the modality.

  {% /details %}

  **total_output_tokens**: `integer`

  Total number of tokens across all the generated responses.

  {% details %}
  {% summary %}
  **output_tokens_by_modality**: `ModalityTokens array`

  A breakdown of output token usage by modality.

  {% /summary %}

  {% details %}
  {% summary %}
  **modality**: `ResponseModality`

  The modality associated with the token count.

  {% /summary %}

  Possible values:

  - `text`: Indicates the model should return text.
  - `image`: Indicates the model should return images.
  - `audio`: Indicates the model should return audio.
  - `video`: Indicates the model should return video.
  - `document`: Indicates the model should return documents.

  {% /details %}

  **tokens**: `integer`

  Number of tokens for the modality.

  {% /details %}

  **total_tool_use_tokens**: `integer`

  Number of tokens present in tool-use prompt(s).

  {% details %}
  {% summary %}
  **tool_use_tokens_by_modality**: `ModalityTokens array`

  A breakdown of tool-use token usage by modality.

  {% /summary %}

  {% details %}
  {% summary %}
  **modality**: `ResponseModality`

  The modality associated with the token count.

  {% /summary %}

  Possible values:

  - `text`: Indicates the model should return text.
  - `image`: Indicates the model should return images.
  - `audio`: Indicates the model should return audio.
  - `video`: Indicates the model should return video.
  - `document`: Indicates the model should return documents.

  {% /details %}

  **tokens**: `integer`

  Number of tokens for the modality.

  {% /details %}

  **total_thought_tokens**: `integer`

  Number of tokens of thoughts for thinking models.

  **total_tokens**: `integer`

  Total token count for the interaction request (prompt + responses + other internal tokens).

  {% details %}
  {% summary %}
  **grounding_tool_count**: `GroundingToolCount array`

  Grounding tool count.

  {% /summary %}

  {% details %}
  {% summary %}
  **type**: `string enum`

  The grounding tool type associated with the count.

  {% /summary %}

  Possible values:

  - `google_search`: Grounding with Google Web Search and Image Search, & Web Grounding for Enterprise.
  - `google_maps`: Grounding with Google Maps.

  {% /details %}

  **count**: `integer`

  The number of grounding tool counts.

  {% /details %}

  {% /details %}

  {% hr /%}

  **event_id**: `string`

  The event_id token to be used to resume the interaction stream, from this event.

  {% /section %}

  {% /left-column %}

  {% right-column class="sticky" %}
  **Example**

  **Step Stop**

  ```json
  {
    "event_type": "step.stop",
    "index": 0
  }
  ```

  {% /right-column %}

  {% /two-column-layout %}

{% /details %}

### ResponseFormat  {% id="Resource:ResponseFormat" %}

**Polymorphic Types:**

{% details %}
  {% summary %}
  **AudioResponseFormat**

  {% /summary %}

  Configuration for audio output format.

  {% two-column-layout %}
  {% left-column %}
  {% section class="api-ref-property-list" %}
  **type**: {% mark %}required{% /mark %} `object`

  Value: `audio`

  {% hr /%}

  {% details %}
  {% summary %}
  **mime_type**: `string enum`

  The MIME type of the audio output.

  {% /summary %}

  Possible values:

  - `audio/mp3`: MP3 audio format.
  - `audio/ogg_opus`: OGG Opus audio format.
  - `audio/l16`: Raw PCM (L16) audio format.
  - `audio/wav`: WAV audio format.
  - `audio/alaw`: A-law audio format.
  - `audio/mulaw`: Mu-law audio format.

  {% /details %}

  {% hr /%}

  {% details %}
  {% summary %}
  **delivery**: `string enum`

  The delivery mode for the audio output.

  {% /summary %}

  Possible values:

  - `inline`: Audio data is returned inline in the response.
  - `uri`: Audio data is returned as a URI.

  {% /details %}

  {% hr /%}

  **sample_rate**: `integer`

  Sample rate in Hz.

  {% hr /%}

  **bit_rate**: `integer`

  Bit rate in bits per second (bps). Only applicable for compressed formats (MP3, Opus).

  {% /section %}

  {% /left-column %}

  {% right-column class="sticky" %}
  **Example**

  **Audio Output**

  ```json
  {
    "type": "audio",
    "sample_rate": 24000
  }
  ```

  {% /right-column %}

  {% /two-column-layout %}

{% /details %}

{% details %}
  {% summary %}
  **ImageResponseFormat**

  {% /summary %}

  Configuration for image output format.

  {% two-column-layout %}
  {% left-column %}
  {% section class="api-ref-property-list" %}
  **type**: {% mark %}required{% /mark %} `object`

  Value: `image`

  {% hr /%}

  {% details %}
  {% summary %}
  **mime_type**: `string enum`

  The MIME type of the image output.

  {% /summary %}

  Possible values:

  - `image/jpeg`: JPEG image format.

  {% /details %}

  {% hr /%}

  {% details %}
  {% summary %}
  **delivery**: `string enum`

  The delivery mode for the image output.

  {% /summary %}

  Possible values:

  - `inline`: Image data is returned inline in the response.
  - `uri`: Image data is returned as a URI.

  {% /details %}

  {% hr /%}

  {% details %}
  {% summary %}
  **aspect_ratio**: `string enum`

  The aspect ratio for the image output.

  {% /summary %}

  Possible values:

  - `1:1`: 1:1 aspect ratio.
  - `2:3`: 2:3 aspect ratio.
  - `3:2`: 3:2 aspect ratio.
  - `3:4`: 3:4 aspect ratio.
  - `4:3`: 4:3 aspect ratio.
  - `4:5`: 4:5 aspect ratio.
  - `5:4`: 5:4 aspect ratio.
  - `9:16`: 9:16 aspect ratio.
  - `16:9`: 16:9 aspect ratio.
  - `21:9`: 21:9 aspect ratio.
  - `1:8`: 1:8 aspect ratio.
  - `8:1`: 8:1 aspect ratio.
  - `1:4`: 1:4 aspect ratio.
  - `4:1`: 4:1 aspect ratio.

  {% /details %}

  {% hr /%}

  {% details %}
  {% summary %}
  **image_size**: `string enum`

  The size of the image output.

  {% /summary %}

  Possible values:

  - `512`: 512px image size.
  - `1K`: 1K image size.
  - `2K`: 2K image size.
  - `4K`: 4K image size.

  {% /details %}

  {% /section %}

  {% /left-column %}

  {% right-column class="sticky" %}
  **Example**

  **Image Output**

  ```json
  {
    "type": "image",
    "aspect_ratio": "16:9",
    "image_size": "1K",
    "mime_type": "image/jpeg"
  }
  ```

  {% /right-column %}

  {% /two-column-layout %}

{% /details %}

{% details %}
  {% summary %}
  **TextResponseFormat**

  {% /summary %}

  Configuration for text output format.

  {% two-column-layout %}
  {% left-column %}
  {% section class="api-ref-property-list" %}
  **type**: {% mark %}required{% /mark %} `object`

  Value: `text`

  {% hr /%}

  {% details %}
  {% summary %}
  **mime_type**: `string enum`

  The MIME type of the text output.

  {% /summary %}

  Possible values:

  - `application/json`: JSON output format.
  - `text/plain`: Plain text output format.

  {% /details %}

  {% hr /%}

  **schema**: `object`

  The JSON schema that the output should conform to. Only applicable when mime_type is application/json. Supports a subset of JSON Schema. `minLength`, `maxLength`, `minProperties`, `maxProperties`, `uniqueItems`, `contains`, `minContains`, and `maxContains` are ignored and not enforced; validate these in your application. `minItems` and `maxItems` are enforced. Schemas that are too complex to enforce (for example, large `maxItems` on nested arrays) return a 400 INVALID_ARGUMENT error.

  {% /section %}

  {% /left-column %}

  {% right-column class="sticky" %}
  **Example**

  **Text Output (JSON Schema)**

  ```json
  {
    "type": "text",
    "mime_type": "application/json",
    "schema": {
      "type": "object",
      "properties": {
        "ingredients": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "recipe_name": {
          "type": "string"
        }
      },
      "required": [
        "ingredients",
        "recipe_name"
      ]
    }
  }
  ```

  {% /right-column %}

  {% /two-column-layout %}

{% /details %}

{% details %}
  {% summary %}
  **VideoResponseFormat**

  {% /summary %}

  Configuration for video output format.

  {% two-column-layout %}
  {% left-column %}
  {% section class="api-ref-property-list" %}
  **type**: {% mark %}required{% /mark %} `object`

  Value: `video`

  {% hr /%}

  {% details %}
  {% summary %}
  **delivery**: `string enum`

  The delivery mode for the video output.

  {% /summary %}

  Possible values:

  - `inline`: Video data is returned inline in the response.
  - `uri`: Video data is returned as a URI.

  {% /details %}

  {% hr /%}

  {% details %}
  {% summary %}
  **aspect_ratio**: `string enum`

  The aspect ratio for the video output.

  {% /summary %}

  Possible values:

  - `16:9`: 16:9 aspect ratio.
  - `9:16`: 9:16 aspect ratio.

  {% /details %}

  {% hr /%}

  **duration**: `string`

  The duration for the video output.

  {% hr /%}

  {% details %}
  {% summary %}
  **resolution**: `string enum`

  The video output resolution. Defaults to 720p.

  {% /summary %}

  Possible values:

  - `360p`: 360p resolution.
  - `720p`: 720p resolution.
  - `1080p`: 1080p resolution.
  - `4k`: 4K resolution.

  {% /details %}

  {% /section %}

  {% /left-column %}

  {% right-column class="sticky" %}
  **Example**

  **Video Output**

  ```json
  {
    "type": "video",
    "aspect_ratio": "16:9",
    "delivery": "inline"
  }
  ```

  {% /right-column %}

  {% /two-column-layout %}

{% /details %}

### Step  {% id="Resource:Step" %}

A step in the interaction.

**Polymorphic Types:**

{% details %}
  {% summary %}
  **CodeExecutionCallStep**

  {% /summary %}

  Code execution call step.

  {% two-column-layout %}
  {% left-column %}
  {% section class="api-ref-property-list" %}
  {% details %}
  {% summary %}
  **arguments**: {% mark %}required{% /mark %} `CodeExecutionCallStepArguments`

  The arguments to pass to the code execution.

  {% /summary %}

  {% details %}
  {% summary %}
  **language**: `string enum`

  Programming language of the `code`.

  {% /summary %}

  Possible values:

  - `python`: Python >= 3.10, with numpy and simpy available.
  - `bash`: Bash. Only available for Gemini 3.0 model or above.

  {% /details %}

  **code**: `string`

  The code to be executed.

  {% /details %}

  {% hr /%}

  **id**: {% mark %}required{% /mark %} `string`

  A unique ID for this specific tool call.

  {% hr /%}

  **type**: {% mark %}required{% /mark %} `object`

  Value: `code_execution_call`

  {% hr /%}

  **signature**: `string`

  A signature hash for backend validation.

  {% /section %}

  {% /left-column %}

  {% right-column class="sticky" %}
  **Example**

  **CodeExecutionCallStep**

  ```json
  {
    "type": "code_execution_call",
    "arguments": {
      "code": "print(sum(range(1, 11)))"
    },
    "id": "code_call_71021"
  }
  ```

  {% /right-column %}

  {% /two-column-layout %}

{% /details %}

{% details %}
  {% summary %}
  **CodeExecutionResultStep**

  {% /summary %}

  Code execution result step.

  {% two-column-layout %}
  {% left-column %}
  {% section class="api-ref-property-list" %}
  {% details %}
  {% summary %}
  **result**: {% mark %}required{% /mark %} [`Content`](/api-reference/interactions-api#Resource:Content) `array` or `string`

  The output of the code execution.

  {% /summary %}

  **Possible Types:** {% class="api-ref-label" %}

  {% details %}
  {% summary %}
  **[Content](/api-reference/interactions-api#Resource:Content) array**

  {% /summary %}

  The contents of the list.

  {% /details %}

  {% details %}
  {% summary %}
  **string**

  {% /summary %}

  A direct string value.

  {% /details %}

  {% /details %}

  {% hr /%}

  **call_id**: {% mark %}required{% /mark %} `string`

  ID to match the ID from the function call block.

  {% hr /%}

  **type**: {% mark %}required{% /mark %} `object`

  Value: `code_execution_result`

  {% hr /%}

  **is_error**: `boolean`

  Whether the code execution resulted in an error.

  {% hr /%}

  **signature**: `string`

  A signature hash for backend validation.

  {% /section %}

  {% /left-column %}

  {% right-column class="sticky" %}
  **Example**

  **CodeExecutionResultStep**

  ```json
  {
    "type": "code_execution_result",
    "call_id": "code_call_71021",
    "result": "55\n"
  }
  ```

  {% /right-column %}

  {% /two-column-layout %}

{% /details %}

{% details %}
  {% summary %}
  **FileSearchCallStep**

  {% /summary %}

  File Search call step.

  {% two-column-layout %}
  {% left-column %}
  {% section class="api-ref-property-list" %}
  **id**: {% mark %}required{% /mark %} `string`

  A unique ID for this specific tool call.

  {% hr /%}

  **type**: {% mark %}required{% /mark %} `object`

  Value: `file_search_call`

  {% hr /%}

  **signature**: `string`

  A signature hash for backend validation.

  {% /section %}

  {% /left-column %}

  {% right-column class="sticky" %}
  **Example**

  **FileSearchCallStep**

  ```json
  {
    "type": "file_search_call",
    "id": "file_call_88192"
  }
  ```

  {% /right-column %}

  {% /two-column-layout %}

{% /details %}

{% details %}
  {% summary %}
  **FileSearchResultStep**

  {% /summary %}

  File Search result step.

  {% two-column-layout %}
  {% left-column %}
  {% section class="api-ref-property-list" %}
  **call_id**: {% mark %}required{% /mark %} `string`

  ID to match the ID from the function call block.

  {% hr /%}

  **type**: {% mark %}required{% /mark %} `object`

  Value: `file_search_result`

  {% hr /%}

  **signature**: `string`

  A signature hash for backend validation.

  {% /section %}

  {% /left-column %}

  {% right-column class="sticky" %}
  **Example**

  **FileSearchResultStep**

  ```json
  {
    "type": "file_search_result",
    "call_id": "file_call_88192"
  }
  ```

  {% /right-column %}

  {% /two-column-layout %}

{% /details %}

{% details %}
  {% summary %}
  **FunctionCallStep**

  {% /summary %}

  A function tool call step.

  {% two-column-layout %}
  {% left-column %}
  {% section class="api-ref-property-list" %}
  **name**: {% mark %}required{% /mark %} `string`

  The name of the tool to call.

  {% hr /%}

  **arguments**: {% mark %}required{% /mark %} `object`

  The arguments to pass to the function.

  {% hr /%}

  **id**: {% mark %}required{% /mark %} `string`

  A unique ID for this specific tool call.

  {% hr /%}

  **type**: {% mark %}required{% /mark %} `object`

  Value: `function_call`

  {% /section %}

  {% /left-column %}

  {% right-column class="sticky" %}
  **Example**

  **FunctionCallStep**

  ```json
  {
    "name": "get_weather",
    "type": "function_call",
    "arguments": {
      "location": "Boston, MA"
    },
    "id": "call_98231"
  }
  ```

  {% /right-column %}

  {% /two-column-layout %}

{% /details %}

{% details %}
  {% summary %}
  **FunctionResultStep**

  {% /summary %}

  Result of a function tool call.

  {% two-column-layout %}
  {% left-column %}
  {% section class="api-ref-property-list" %}
  {% details %}
  {% summary %}
  **result**: {% mark %}required{% /mark %} `(`[`ImageContent`](/api-reference/interactions-api#Resource:ImageContent) or [`TextContent`](/api-reference/interactions-api#Resource:TextContent)`) array` or `object` or `string`

  The result of the tool call.

  {% /summary %}

  **Possible Types:** {% class="api-ref-label" %}

  {% details %}
  {% summary %}
  **([ImageContent](/api-reference/interactions-api#Resource:ImageContent) or [TextContent](/api-reference/interactions-api#Resource:TextContent)) array**

  {% /summary %}

  A list where each item is one of: [`ImageContent`](/api-reference/interactions-api#Resource:ImageContent), [`TextContent`](/api-reference/interactions-api#Resource:TextContent).

  {% /details %}

  {% details %}
  {% summary %}
  **string**

  {% /summary %}

  A direct string value.

  {% /details %}

  {% /details %}

  {% hr /%}

  **call_id**: {% mark %}required{% /mark %} `string`

  ID to match the ID from the function call block.

  {% hr /%}

  **type**: {% mark %}required{% /mark %} `object`

  Value: `function_result`

  {% hr /%}

  **name**: `string`

  The name of the tool that was called.

  {% hr /%}

  **is_error**: `boolean`

  Whether the tool call resulted in an error.

  {% /section %}

  {% /left-column %}

  {% right-column class="sticky" %}
  **Example**

  **FunctionResultStep**

  ```json
  {
    "name": "get_weather",
    "type": "function_result",
    "call_id": "call_98231",
    "result": [
      {
        "type": "text",
        "text": "{\"weather\":\"sunny\"}"
      }
    ]
  }
  ```

  {% /right-column %}

  {% /two-column-layout %}

{% /details %}

{% details %}
  {% summary %}
  **GoogleMapsCallStep**

  {% /summary %}

  Google Maps call step.

  {% two-column-layout %}
  {% left-column %}
  {% section class="api-ref-property-list" %}
  **id**: {% mark %}required{% /mark %} `string`

  A unique ID for this specific tool call.

  {% hr /%}

  **type**: {% mark %}required{% /mark %} `object`

  Value: `google_maps_call`

  {% hr /%}

  {% details %}
  {% summary %}
  **arguments**: `GoogleMapsCallStepArguments`

  The arguments to pass to the Google Maps tool.

  {% /summary %}

  **queries**: `string array`

  The queries to be executed.

  {% /details %}

  {% hr /%}

  **signature**: `string`

  A signature hash for backend validation.

  {% /section %}

  {% /left-column %}

  {% right-column class="sticky" %}
  **Example**

  **GoogleMapsCallStep**

  ```json
  {
    "type": "google_maps_call",
    "arguments": {
      "latitude": 37.7749,
      "longitude": -122.4194
    },
    "id": "maps_call_39201"
  }
  ```

  {% /right-column %}

  {% /two-column-layout %}

{% /details %}

{% details %}
  {% summary %}
  **GoogleMapsResultStep**

  {% /summary %}

  Google Maps result step.

  {% two-column-layout %}
  {% left-column %}
  {% section class="api-ref-property-list" %}
  {% details %}
  {% summary %}
  **result**: {% mark %}required{% /mark %} `GoogleMapsResultItem array`

  {% /summary %}

  {% details %}
  {% summary %}
  **places**: `GoogleMapsResultPlaces array`

  {% /summary %}

  **place_id**: `string`

  **name**: `string`

  **url**: `string`

  {% details %}
  {% summary %}
  **review_snippets**: `ReviewSnippet array`

  {% /summary %}

  **title**: `string`

  Title of the review.

  **url**: `string`

  A link that corresponds to the user review on Google Maps.

  **review_id**: `string`

  The ID of the review snippet.

  {% /details %}

  {% /details %}

  **widget_context_token**: `string`

  {% /details %}

  {% hr /%}

  **call_id**: {% mark %}required{% /mark %} `string`

  ID to match the ID from the function call block.

  {% hr /%}

  **type**: {% mark %}required{% /mark %} `object`

  Value: `google_maps_result`

  {% hr /%}

  **signature**: `string`

  A signature hash for backend validation.

  {% /section %}

  {% /left-column %}

  {% right-column class="sticky" %}
  **Example**

  **GoogleMapsResultStep**

  ```json
  {
    "type": "google_maps_result",
    "call_id": "maps_call_39201",
    "result": [
      {
        "name": "Golden Gate Park",
        "place_id": "ChIJIQBpAG2ahYAR9R7bNdTLg8M",
        "rating": 4.8
      }
    ]
  }
  ```

  {% /right-column %}

  {% /two-column-layout %}

{% /details %}

{% details %}
  {% summary %}
  **GoogleSearchCallStep**

  {% /summary %}

  Google Search call step.

  {% two-column-layout %}
  {% left-column %}
  {% section class="api-ref-property-list" %}
  {% details %}
  {% summary %}
  **arguments**: {% mark %}required{% /mark %} `GoogleSearchCallStepArguments`

  The arguments to pass to Google Search.

  {% /summary %}

  **queries**: `string array`

  Web search queries for the following-up web search.

  {% /details %}

  {% hr /%}

  **id**: {% mark %}required{% /mark %} `string`

  A unique ID for this specific tool call.

  {% hr /%}

  **type**: {% mark %}required{% /mark %} `object`

  Value: `google_search_call`

  {% hr /%}

  {% details %}
  {% summary %}
  **search_type**: `string enum`

  The type of search grounding enabled.

  {% /summary %}

  Possible values:

  - `web_search`: Setting this field enables web search. Only text results are returned.
  - `image_search`: Setting this field enables image search. Image bytes are returned.

  {% /details %}

  {% hr /%}

  **signature**: `string`

  A signature hash for backend validation.

  {% /section %}

  {% /left-column %}

  {% right-column class="sticky" %}
  **Example**

  **GoogleSearchCallStep**

  ```json
  {
    "type": "google_search_call",
    "arguments": {
      "query": "Who won the men's 100m in Paris 2024?"
    },
    "id": "search_call_19201"
  }
  ```

  {% /right-column %}

  {% /two-column-layout %}

{% /details %}

{% details %}
  {% summary %}
  **GoogleSearchResultStep**

  {% /summary %}

  Google Search result step.

  {% two-column-layout %}
  {% left-column %}
  {% section class="api-ref-property-list" %}
  {% details %}
  {% summary %}
  **result**: {% mark %}required{% /mark %} `GoogleSearchResultItem array`

  The results of the Google Search.

  {% /summary %}

  **search_suggestions**: `string`

  Web content snippet that can be embedded in a web page or an app webview.

  {% /details %}

  {% hr /%}

  **call_id**: {% mark %}required{% /mark %} `string`

  ID to match the ID from the function call block.

  {% hr /%}

  **type**: {% mark %}required{% /mark %} `object`

  Value: `google_search_result`

  {% hr /%}

  **is_error**: `boolean`

  Whether the Google Search resulted in an error.

  {% hr /%}

  **signature**: `string`

  A signature hash for backend validation.

  {% /section %}

  {% /left-column %}

  {% right-column class="sticky" %}
  **Example**

  **GoogleSearchResultStep**

  ```json
  {
    "type": "google_search_result",
    "call_id": "search_call_19201",
    "result": [
      {
        "title": "Paris 2024 Olympics: Noah Lyles wins men's 100m gold",
        "url": "https://olympics.com/en/news/paris-2024-noah-lyles-wins-mens-100m-gold",
        "snippet": "American Noah Lyles won the Olympic men's 100m gold medal in a photo finish."
      }
    ]
  }
  ```

  {% /right-column %}

  {% /two-column-layout %}

{% /details %}

{% details %}
  {% summary %}
  **McpServerToolCallStep**

  {% /summary %}

  MCPServer tool call step.

  {% two-column-layout %}
  {% left-column %}
  {% section class="api-ref-property-list" %}
  **name**: {% mark %}required{% /mark %} `string`

  The name of the tool which was called.

  {% hr /%}

  **server_name**: {% mark %}required{% /mark %} `string`

  The name of the used MCP server.

  {% hr /%}

  **arguments**: {% mark %}required{% /mark %} `object`

  The JSON object of arguments for the function.

  {% hr /%}

  **id**: {% mark %}required{% /mark %} `string`

  A unique ID for this specific tool call.

  {% hr /%}

  **type**: {% mark %}required{% /mark %} `object`

  Value: `mcp_server_tool_call`

  {% /section %}

  {% /left-column %}

  {% right-column class="sticky" %}
  **Example**

  **McpServerToolCallStep**

  ```json
  {
    "name": "calculate_tax",
    "type": "mcp_server_tool_call",
    "arguments": {
      "income": 120000,
      "state": "CA"
    },
    "id": "mcp_call_29012",
    "server_name": "financial_mcp_server"
  }
  ```

  {% /right-column %}

  {% /two-column-layout %}

{% /details %}

{% details %}
  {% summary %}
  **McpServerToolResultStep**

  {% /summary %}

  MCPServer tool result step.

  {% two-column-layout %}
  {% left-column %}
  {% section class="api-ref-property-list" %}
  {% details %}
  {% summary %}
  **result**: {% mark %}required{% /mark %} `(`[`ImageContent`](/api-reference/interactions-api#Resource:ImageContent) or [`TextContent`](/api-reference/interactions-api#Resource:TextContent)`) array` or `object` or `string`

  The output from the MCP server call. Can be simple text or rich content.

  {% /summary %}

  **Possible Types:** {% class="api-ref-label" %}

  {% details %}
  {% summary %}
  **([ImageContent](/api-reference/interactions-api#Resource:ImageContent) or [TextContent](/api-reference/interactions-api#Resource:TextContent)) array**

  {% /summary %}

  A list where each item is one of: [`ImageContent`](/api-reference/interactions-api#Resource:ImageContent), [`TextContent`](/api-reference/interactions-api#Resource:TextContent).

  {% /details %}

  {% details %}
  {% summary %}
  **string**

  {% /summary %}

  A direct string value.

  {% /details %}

  {% /details %}

  {% hr /%}

  **call_id**: {% mark %}required{% /mark %} `string`

  ID to match the ID from the function call block.

  {% hr /%}

  **type**: {% mark %}required{% /mark %} `object`

  Value: `mcp_server_tool_result`

  {% hr /%}

  **name**: `string`

  Name of the tool which is called for this specific tool call.

  {% hr /%}

  **server_name**: `string`

  The name of the used MCP server.

  {% /section %}

  {% /left-column %}

  {% right-column class="sticky" %}
  **Example**

  **McpServerToolResultStep**

  ```json
  {
    "name": "calculate_tax",
    "type": "mcp_server_tool_result",
    "call_id": "mcp_call_29012",
    "result": {
      "tax_due": 32400
    },
    "server_name": "financial_mcp_server"
  }
  ```

  {% /right-column %}

  {% /two-column-layout %}

{% /details %}

{% details %}
  {% summary %}
  **ModelOutputStep**

  {% /summary %}

  Output generated by the model.

  {% two-column-layout %}
  {% left-column %}
  {% section class="api-ref-property-list" %}
  **type**: {% mark %}required{% /mark %} `object`

  Value: `model_output`

  {% hr /%}

  **content**: [`Content`](/api-reference/interactions-api#Resource:Content) `array`

  {% /section %}

  {% /left-column %}

  {% right-column class="sticky" %}
  **Example**

  **ModelOutputStep**

  ```json
  {
    "type": "model_output",
    "content": [
      {
        "type": "text",
        "text": "The capital of France is Paris."
      }
    ]
  }
  ```

  {% /right-column %}

  {% /two-column-layout %}

{% /details %}

{% details %}
  {% summary %}
  **ProcessingCallStep**

  {% /summary %}

  A server-initiated processing step for media analysis (e.g. video
  understanding).

  {% section class="api-ref-property-list" %}
  **id**: {% mark %}required{% /mark %} `string`

  A unique ID for this specific tool call.

  {% hr /%}

  **type**: {% mark %}required{% /mark %} `object`

  Value: `processing_call`

  {% hr /%}

  **signature**: `string`

  A signature hash for backend validation.

  {% /section %}

{% /details %}

{% details %}
  {% summary %}
  **ProcessingResultStep**

  {% /summary %}

  The result of a server-initiated media processing step.

  {% section class="api-ref-property-list" %}
  **call_id**: {% mark %}required{% /mark %} `string`

  ID to match the ID from the function call block.

  {% hr /%}

  **type**: {% mark %}required{% /mark %} `object`

  Value: `processing_result`

  {% hr /%}

  **signature**: `string`

  A signature hash for backend validation.

  {% /section %}

{% /details %}

{% details %}
  {% summary %}
  **ThoughtStep**

  {% /summary %}

  A thought step.

  {% two-column-layout %}
  {% left-column %}
  {% section class="api-ref-property-list" %}
  **type**: {% mark %}required{% /mark %} `object`

  Value: `thought`

  {% hr /%}

  **signature**: `string`

  A signature hash for backend validation.

  {% hr /%}

  **summary**: [`Content`](/api-reference/interactions-api#Resource:Content) `array`

  A summary of the thought.

  {% /section %}

  {% /left-column %}

  {% right-column class="sticky" %}
  **Example**

  **ThoughtStep**

  ```json
  {
    "type": "thought",
    "signature": "thought_sig_abcd1234",
    "summary": [
      {
        "type": "text",
        "text": "The model is searching Google for the capital of France."
      }
    ]
  }
  ```

  {% /right-column %}

  {% /two-column-layout %}

{% /details %}

{% details %}
  {% summary %}
  **UrlContextCallStep**

  {% /summary %}

  URL context call step.

  {% two-column-layout %}
  {% left-column %}
  {% section class="api-ref-property-list" %}
  {% details %}
  {% summary %}
  **arguments**: {% mark %}required{% /mark %} `UrlContextCallArguments`

  The arguments to pass to the URL context.

  {% /summary %}

  **urls**: `string array`

  The URLs to fetch.

  {% /details %}

  {% hr /%}

  **id**: {% mark %}required{% /mark %} `string`

  A unique ID for this specific tool call.

  {% hr /%}

  **type**: {% mark %}required{% /mark %} `object`

  Value: `url_context_call`

  {% hr /%}

  **signature**: `string`

  A signature hash for backend validation.

  {% /section %}

  {% /left-column %}

  {% right-column class="sticky" %}
  **Example**

  **UrlContextCallStep**

  ```json
  {
    "type": "url_context_call",
    "arguments": {
      "urls": [
        "https://www.example.com"
      ]
    },
    "id": "url_call_10219"
  }
  ```

  {% /right-column %}

  {% /two-column-layout %}

{% /details %}

{% details %}
  {% summary %}
  **UrlContextResultStep**

  {% /summary %}

  URL context result step.

  {% two-column-layout %}
  {% left-column %}
  {% section class="api-ref-property-list" %}
  {% details %}
  {% summary %}
  **result**: {% mark %}required{% /mark %} `UrlContextResult array`

  The results of the URL context.

  {% /summary %}

  **url**: `string`

  The URL that was fetched.

  {% details %}
  {% summary %}
  **status**: `string enum`

  The status of the URL retrieval.

  {% /summary %}

  Possible values:

  - `success`: Url retrieval is successful.
  - `error`: Url retrieval is failed due to error.
  - `paywall`: Url retrieval is failed because the content is behind paywall.
  - `unsafe`: Url retrieval is failed because the content is unsafe.

  {% /details %}

  {% /details %}

  {% hr /%}

  **call_id**: {% mark %}required{% /mark %} `string`

  ID to match the ID from the function call block.

  {% hr /%}

  **type**: {% mark %}required{% /mark %} `object`

  Value: `url_context_result`

  {% hr /%}

  **is_error**: `boolean`

  Whether the URL context resulted in an error.

  {% hr /%}

  **signature**: `string`

  A signature hash for backend validation.

  {% /section %}

  {% /left-column %}

  {% right-column class="sticky" %}
  **Example**

  **UrlContextResultStep**

  ```json
  {
    "type": "url_context_result",
    "call_id": "url_call_10219",
    "result": [
      {
        "title": "Example Domain",
        "url": "https://www.example.com",
        "snippet": "This domain is for use in illustrative examples in documents."
      }
    ]
  }
  ```

  {% /right-column %}

  {% /two-column-layout %}

{% /details %}

{% details %}
  {% summary %}
  **UserInputStep**

  {% /summary %}

  Input provided by the user.

  {% two-column-layout %}
  {% left-column %}
  {% section class="api-ref-property-list" %}
  **type**: {% mark %}required{% /mark %} `object`

  Value: `user_input`

  {% hr /%}

  **content**: [`Content`](/api-reference/interactions-api#Resource:Content) `array`

  {% /section %}

  {% /left-column %}

  {% right-column class="sticky" %}
  **Example**

  **UserInputStep**

  ```json
  {
    "type": "user_input",
    "content": [
      {
        "type": "text",
        "text": "What is the capital of France?"
      }
    ]
  }
  ```

  {% /right-column %}

  {% /two-column-layout %}

{% /details %}

### EnvironmentConfig  {% id="Resource:EnvironmentConfig" %}

Configuration for a custom environment.

{% two-column-layout %}
  {% left-column %}
  **Properties:**

  {% section class="api-ref-property-list" %}
  **type**: {% mark %}required{% /mark %} `object`

  Value: `remote`

  {% hr /%}

  {% details %}
  {% summary %}
  **sources**: `Source array`

  {% /summary %}

  {% details %}
  {% summary %}
  **type**: `string enum`

  {% /summary %}

  Possible values:

  - `gcs`: A Cloud Storage bucket.
  - `inline`: Inline content.
  - `repository`: A generic repository. The protocol prefix in the source URL identifies the provider (e.g., github://, gcs://).

  {% /details %}

  **source**: `string`

  The source of the environment. For Cloud Storage, this is the Cloud Storage path. For GitHub, this is the GitHub path.

  **target**: `string`

  Where the source should appear in the environment.

  **content**: `string`

  The inline content if `type` is `INLINE`.

  **encoding**: `string`

  Optional encoding for inline content (e.g. `base64`).

  {% /details %}

  {% hr /%}

  {% details %}
  {% summary %}
  **network**: [`EnvironmentNetworkEgressAllowlist`](/api-reference/interactions-api#Resource:EnvironmentNetworkEgressAllowlist) or `string enum`

  Network configuration for the environment.

  {% /summary %}

  **Possible Types:** {% class="api-ref-label" %}

  {% details %}
  {% summary %}
  **[EnvironmentNetworkEgressAllowlist](/api-reference/interactions-api#Resource:EnvironmentNetworkEgressAllowlist)**

  {% /summary %}

  Network egress configuration for the environment.

  {% details %}
  {% summary %}
  **allowlist**: `EgressRule array` or `string enum`

  List of allowed domains and their configurations. Set to `"disabled"` to block all network egress.

  {% /summary %}

  **Possible Types:** {% class="api-ref-label" %}

  {% details %}
  {% summary %}
  **EgressRule array**

  {% /summary %}

  A single domain allowlist rule with optional header injection.

  **domain**: {% mark %}required{% /mark %} `string`

  Domain to allow outbound requests to. Supports wildcards (e.g. '*.googleapis.com'). Use '*' to allow all domains.

  **transform**: `object`

  Headers to inject into requests matching this rule. Key: header name (e.g., "Authorization"). Value: header value (e.g., "Bearer your-token").

  **credential**: `string`

  Optional. Reference to a server-managed Credential resource by ID.

  {% /details %}

  {% details %}
  {% summary %}
  **string enum**

  {% /summary %}

  Possible values:

  - `disabled`: All network egress is blocked.

  {% /details %}

  {% /details %}

  {% /details %}

  {% details %}
  {% summary %}
  **string enum**

  {% /summary %}

  Possible values:

  - `disabled`: All network egress is blocked.

  {% /details %}

  {% /details %}

  {% hr /%}

  **environment_id**: `string`

  Optional. The environment ID for the interaction. If specified, the request will update the existing environment instead of creating a new one.

  {% hr /%}

  {% details %}
  {% summary %}
  **env**: `object` or `string`

  Environment variables to set in the sandbox environment.

  {% /summary %}

  **Possible Types:** {% class="api-ref-label" %}

  {% details %}
  {% summary %}
  **string**

  {% /summary %}

  A direct string value.

  {% /details %}

  {% /details %}

  {% /section %}

  {% /left-column %}

  {% right-column class="sticky" %}
  **Example**

  {% tabs %}
  {% tab label="Inline Sources" %}
  ```json
  {
    "type": "remote",
    "sources": [
      {
        "type": "inline",
        "content": "You are a data analyst. Always include visualizations and export results as PDF.",
        "target": ".agents/AGENTS.md"
      },
      {
        "type": "inline",
        "content": "---\nname: slide-maker\ndescription: Create HTML slide decks\n---\n# Slide Maker\n\nWhen asked to create a presentation:\n1. Analyze the input data\n2. Create an HTML slide deck with reveal.js\n3. Save to /workspace/output/slides.html",
        "target": ".agents/skills/slide-maker/SKILL.md"
      }
    ]
  }
  ```

  {% /tab %}

  {% tab label="External Sources" %}
  ```json
  {
    "type": "remote",
    "sources": [
      {
        "type": "repository",
        "source": "https://github.com/my-org/my-skills.git",
        "target": ".agents/skills"
      },
      {
        "type": "gcs",
        "source": "gs://my-bucket/my-folder",
        "target": "/workspace/data"
      }
    ]
  }
  ```

  {% /tab %}

  {% tab label="Network Allowlist" %}
  ```json
  {
    "type": "remote",
    "network": {
      "allowlist": [
        {
          "domain": "pypi.org"
        },
        {
          "domain": "*.github.com"
        }
      ]
    }
  }
  ```

  {% /tab %}

  {% tab label="Proxy Credentials" %}
  ```json
  {
    "type": "remote",
    "network": {
      "allowlist": [
        {
          "domain": "api.github.com",
          "transform": {
            "Authorization": "Bearer YOUR_GITHUB_TOKEN"
          }
        }
      ]
    }
  }
  ```

  {% /tab %}

  {% /tabs %}

  {% /right-column %}

{% /two-column-layout %}

### EnvironmentNetworkEgressAllowlist  {% id="Resource:EnvironmentNetworkEgressAllowlist" %}

Network egress configuration for the environment.

{% two-column-layout %}
  {% left-column %}
  **Properties:**

  {% section class="api-ref-property-list" %}
  {% details %}
  {% summary %}
  **allowlist**: `EgressRule array` or `string enum`

  List of allowed domains and their configurations. Set to `"disabled"` to block all network egress.

  {% /summary %}

  **Possible Types:** {% class="api-ref-label" %}

  {% details %}
  {% summary %}
  **EgressRule array**

  {% /summary %}

  A single domain allowlist rule with optional header injection.

  **domain**: {% mark %}required{% /mark %} `string`

  Domain to allow outbound requests to. Supports wildcards (e.g. '*.googleapis.com'). Use '*' to allow all domains.

  **transform**: `object`

  Headers to inject into requests matching this rule. Key: header name (e.g., "Authorization"). Value: header value (e.g., "Bearer your-token").

  **credential**: `string`

  Optional. Reference to a server-managed Credential resource by ID.

  {% /details %}

  {% details %}
  {% summary %}
  **string enum**

  {% /summary %}

  Possible values:

  - `disabled`: All network egress is blocked.

  {% /details %}

  {% /details %}

  {% /section %}

  {% /left-column %}

  {% right-column class="sticky" %}
  **Example**

  **Network Allowlist**

  ```json
  {
    "allowlist": [
      {
        "domain": "github.com",
        "transform": [
          {
            "Authorization": "Bearer your-token"
          }
        ]
      },
      {
        "domain": "*.googleapis.com"
      }
    ]
  }
  ```

  {% /right-column %}

{% /two-column-layout %}

### ToolChoiceConfig  {% id="Resource:ToolChoiceConfig" %}

The tool choice configuration containing allowed tools.

{% two-column-layout %}
  {% left-column %}
  **Properties:**

  {% section class="api-ref-property-list" %}
  {% details %}
  {% summary %}
  **allowed_tools**: `AllowedTools`

  The allowed tools.

  {% /summary %}

  {% details %}
  {% summary %}
  **mode**: `string enum`

  The mode of the tool choice.

  {% /summary %}

  Possible values:

  - `auto`: Auto tool choice.
  - `any`: Any tool choice.
  - `none`: No tool choice.
  - `validated`: Validated tool choice.

  {% /details %}

  **tools**: `string array`

  The names of the allowed tools.

  {% /details %}

  {% /section %}

  {% /left-column %}

  {% right-column class="sticky" %}
  **Example**

  ```json
  {
    "allowed_tools": {
      "mode": "any",
      "tools": [
        "my_tool"
      ]
    }
  }
  ```

  {% /right-column %}

{% /two-column-layout %}

### ImageContent  {% id="Resource:ImageContent" %}

An image content block.

{% two-column-layout %}
  {% left-column %}
  **Properties:**

  {% section class="api-ref-property-list" %}
  **type**: {% mark %}required{% /mark %} `object`

  Value: `image`

  {% hr /%}

  **data**: `string`

  The image content.

  {% hr /%}

  **uri**: `string`

  The URI of the image.

  {% hr /%}

  {% details %}
  {% summary %}
  **resolution**: `MediaResolution`

  The resolution of the media.

  {% /summary %}

  Possible values:

  - `low`: Low resolution.
  - `medium`: Medium resolution.
  - `high`: High resolution.
  - `ultra_high`: Ultra high resolution.

  {% /details %}

  {% hr /%}

  {% details %}
  {% summary %}
  **mime_type**: `string enum`

  The mime type of the image.

  {% /summary %}

  Possible values:

  - `image/png`: PNG image format
  - `image/jpeg`: JPEG image format
  - `image/webp`: WebP image format
  - `image/heic`: HEIC image format
  - `image/heif`: HEIF image format
  - `image/gif`: GIF image format
  - `image/bmp`: BMP image format
  - `image/tiff`: TIFF image format

  {% /details %}

  {% /section %}

  {% /left-column %}

  {% right-column class="sticky" %}
  **Example**

  **Image**

  ```json
  {
    "type": "image",
    "data": "BASE64_ENCODED_IMAGE",
    "mime_type": "image/png"
  }
  ```

  {% /right-column %}

{% /two-column-layout %}

### TextContent  {% id="Resource:TextContent" %}

A text content block.

{% two-column-layout %}
  {% left-column %}
  **Properties:**

  {% section class="api-ref-property-list" %}
  **text**: {% mark %}required{% /mark %} `string`

  The text content.

  {% hr /%}

  **type**: {% mark %}required{% /mark %} `object`

  Value: `text`

  {% hr /%}

  {% details %}
  {% summary %}
  **annotations**: `Annotation array`

  Citation information for model-generated content.

  {% /summary %}

  **Possible Types:** {% class="api-ref-label" %}

  {% details %}
  {% summary %}
  **FileCitation**

  {% /summary %}

  A file citation annotation.

  **type**: {% mark %}required{% /mark %} `object`

  Value: `file_citation`

  **document_uri**: `string`

  The URI of the file.

  **file_name**: `string`

  The name of the file.

  **source**: `string`

  Source attributed for a portion of the text.

  **custom_metadata**: `object`

  User provided metadata about the retrieved context.

  **page_number**: `integer`

  Page number of the cited document, if applicable.

  **media_id**: `string`

  Media ID in-case of image citations, if applicable.

  **start_index**: `integer`

  Start of segment of the response that is attributed to this source. Index indicates the start of the segment, measured in bytes.

  **end_index**: `integer`

  End of the attributed segment, exclusive.

  {% /details %}

  {% details %}
  {% summary %}
  **PlaceCitation**

  {% /summary %}

  A place citation annotation.

  **type**: {% mark %}required{% /mark %} `object`

  Value: `place_citation`

  **place_id**: `string`

  The ID of the place, in `places/{place_id}` format.

  **name**: `string`

  Title of the place.

  **url**: `string`

  URI reference of the place.

  {% details %}
  {% summary %}
  **review_snippets**: `ReviewSnippet array`

  Snippets of reviews that are used to generate answers about the features of a given place in Google Maps.

  {% /summary %}

  **title**: `string`

  Title of the review.

  **url**: `string`

  A link that corresponds to the user review on Google Maps.

  **review_id**: `string`

  The ID of the review snippet.

  {% /details %}

  **start_index**: `integer`

  Start of segment of the response that is attributed to this source. Index indicates the start of the segment, measured in bytes.

  **end_index**: `integer`

  End of the attributed segment, exclusive.

  {% /details %}

  {% details %}
  {% summary %}
  **SpeechAnnotation**

  {% /summary %}

  Speech annotation for text content.

  **type**: {% mark %}required{% /mark %} `object`

  Value: `speech_metadata`

  **speaker**: `string`

  The speaker to associate with this turn.

  **style**: `string`

  Style instruction for the speech synthesis.

  **start_index**: `integer`

  Start of segment of the response that is attributed to this source. Index indicates the start of the segment, measured in bytes.

  **end_index**: `integer`

  End of the attributed segment, exclusive.

  {% /details %}

  {% details %}
  {% summary %}
  **UrlCitation**

  {% /summary %}

  A URL citation annotation.

  **type**: {% mark %}required{% /mark %} `object`

  Value: `url_citation`

  **url**: `string`

  The URL.

  **title**: `string`

  The title of the URL.

  **start_index**: `integer`

  Start of segment of the response that is attributed to this source. Index indicates the start of the segment, measured in bytes.

  **end_index**: `integer`

  End of the attributed segment, exclusive.

  {% /details %}

  {% details %}
  {% summary %}
  **WordInfo**

  {% /summary %}

  Word-level ASR annotation for transcription output. Carries the word text, optional timing, and optional speaker attribution.

  **type**: {% mark %}required{% /mark %} `object`

  Value: `word_info`

  **text**: `string`

  The transcribed word.

  **start_offset**: `string`

  Start offset in time of the word relative to the start of the audio. Present when timestamp_granularities contains "word".

  **end_offset**: `string`

  End offset in time of the word relative to the start of the audio. Present when timestamp_granularities contains "word".

  **speaker**: `string`

  Optional. Speaker label for this word (e.g. "spk_1", "spk_2"). Present when diarization_mode is set in TranscriptionConfig.

  **start_index**: `integer`

  Start of segment of the response that is attributed to this source. Index indicates the start of the segment, measured in bytes.

  **end_index**: `integer`

  End of the attributed segment, exclusive.

  {% /details %}

  {% /details %}

  {% /section %}

  {% /left-column %}

  {% right-column class="sticky" %}
  **Example**

  **Text**

  ```json
  {
    "type": "text",
    "text": "Hello, how are you?"
  }
  ```

  {% /right-column %}

{% /two-column-layout %}
