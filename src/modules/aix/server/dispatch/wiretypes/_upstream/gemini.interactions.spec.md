<!--
  Upstream snapshot - DO NOT EDIT - run _upstream/sync.sh to refresh
  Source: https://ai.google.dev/api/interactions-api.md.txt
  Synced: 2026-04-24
  Consumed by: gemini.interactions.wiretypes.ts, gemini.interactions.parser.ts, gemini.interactionsCreate.ts, gemini.interactionsPoller.ts
  Companion: ./gemini.interactions.guide.md (the Interactions API guide)
-->

The Gemini Interactions API is an experimental API that allows developers to build generative AI applications using Gemini models. Gemini is our most capable model, built from the ground up to be multimodal. It can generalize and seamlessly understand, operate across, and combine different types of information including language, images, audio, video, and code. You can use the Gemini API for use cases like reasoning across text and images, content generation, dialogue agents, summarization and classification systems, and more.
[View as markdown](https://ai.google.dev/static/api/interactions.md.txt) [View the OpenAPI Spec](https://ai.google.dev/static/api/interactions.openapi.json)

## Creating an interaction

post https://generativelanguage.googleapis.com/v1beta/interactions Creates a new interaction.
- [Request body](https://ai.google.dev/api/interactions-api#CreateInteraction.request_body)
- [Response](https://ai.google.dev/api/interactions-api#CreateInteraction.response)

### Request body

The request body contains data with the following structure:
model ModelOption (optional) The name of the \`Model\` used for generating the interaction.   
**Required if \`agent\` is not provided.**

Possible
values:

- `gemini-2.5-computer-use-preview-10-2025`

  An agentic capability model designed for direct interface interaction, allowing Gemini to perceive and navigate digital environments.
- `gemini-2.5-flash`

  Our first hybrid reasoning model which supports a 1M token context window and has thinking budgets.
- `gemini-2.5-flash-image`

  Our native image generation model, optimized for speed, flexibility, and contextual understanding. Text input and output is priced the same as 2.5 Flash.
- `gemini-2.5-flash-lite`

  Our smallest and most cost effective model, built for at scale usage.
- `gemini-2.5-flash-lite-preview-09-2025`

  The latest model based on Gemini 2.5 Flash lite optimized for cost-efficiency, high throughput and high quality.
- `gemini-2.5-flash-native-audio-preview-12-2025`

  Our native audio models optimized for higher quality audio outputs with better pacing, voice naturalness, verbosity, and mood.
- `gemini-2.5-flash-preview-09-2025`

  The latest model based on the 2.5 Flash model. 2.5 Flash Preview is best for large scale processing, low-latency, high volume tasks that require thinking, and agentic use cases.
- `gemini-2.5-flash-preview-tts`

  Our 2.5 Flash text-to-speech model optimized for powerful, low-latency controllable speech generation.
- `gemini-2.5-pro`

  Our state-of-the-art multipurpose model, which excels at coding and complex reasoning tasks.
- `gemini-2.5-pro-preview-tts`

  Our 2.5 Pro text-to-speech audio model optimized for powerful, low-latency speech generation for more natural outputs and easier to steer prompts.
- `gemini-3-flash-preview`

  Our most intelligent model built for speed, combining frontier intelligence with superior search and grounding.
- `gemini-3-pro-image-preview`

  State-of-the-art image generation and editing model.
- `gemini-3-pro-preview`

  Our most intelligent model with SOTA reasoning and multimodal understanding, and powerful agentic and vibe coding capabilities.
- `gemini-3.1-pro-preview`

  Our latest SOTA reasoning model with unprecedented depth and nuance, and powerful multimodal understanding and coding capabilities.
- `gemini-3.1-flash-image-preview`

  Pro-level visual intelligence with Flash-speed efficiency and reality-grounded generation capabilities.
- `gemini-3.1-flash-lite-preview`

  Our most cost-efficient model, optimized for high-volume agentic tasks, translation, and simple data processing.
- `gemini-3.1-flash-tts-preview`

  Gemini 3.1 Flash TTS: Powerful, low-latency speech generation. Enjoy natural outputs, steerable prompts, and new expressive audio tags for precise narration control.
- `lyria-3-clip-preview`

  Our low-latency, music generation model optimized for high-fidelity audio clips and precise rhythmic control.
- `lyria-3-pro-preview`

  Our advanced, full-song generative model with deep compositional understanding, optimized for precise structural control and complex transitions across diverse musical styles.

The model that will complete your prompt.\\n\\nSee \[models\](https://ai.google.dev/gemini-api/docs/models) for additional details.
agent AgentOption (optional) The name of the \`Agent\` used for generating the interaction.   
**Required if \`model\` is not provided.**

Possible
values:

- `deep-research-pro-preview-12-2025`

  Gemini Deep Research Agent
- `deep-research-preview-04-2026`

  Gemini Deep Research Agent
- `deep-research-max-preview-04-2026`

  Gemini Deep Research Max Agent

The agent to interact with.
input [Content](https://ai.google.dev/api/interactions-api#Resource:Content) or array ([Content](https://ai.google.dev/api/interactions-api#Resource:Content)) or array ([Turn](https://ai.google.dev/api/interactions-api#Resource:Turn)) or string (required) The inputs for the interaction (common to both Model and Agent).
system_instruction string (optional) System instruction for the interaction.
tools array ([Tool](https://ai.google.dev/api/interactions-api#Resource:Tool)) (optional) A list of tool declarations the model may call during interaction.
response_format object (optional) Enforces that the generated response is a JSON object that complies with
the JSON schema specified in this field.
response_mime_type string (optional) The mime type of the response. This is required if response_format is set.
stream boolean (optional) Input only. Whether the interaction will be streamed.
store boolean (optional) Input only. Whether to store the response and request for later retrieval.
background boolean (optional) Input only. Whether to run the model interaction in the background.
generation_config GenerationConfig (optional) **Model Configuration**   
Configuration parameters for the model interaction.   
*Alternative to \`agent_config\`. Only applicable when \`model\` is set.*
Configuration parameters for model interactions.

#### Fields

temperature number (optional) Controls the randomness of the output.
top_p number (optional) The maximum cumulative probability of tokens to consider when sampling.
seed integer (optional) Seed used in decoding for reproducibility.
stop_sequences array (string) (optional) A list of character sequences that will stop output interaction.
thinking_level ThinkingLevel (optional) The level of thought tokens that the model should generate.

Possible
values:

- `minimal`
- `low`
- `medium`
- `high`

<br />

thinking_summaries ThinkingSummaries (optional) Whether to include thought summaries in the response.

Possible
values:

- `auto`
- `none`

<br />

max_output_tokens integer (optional) The maximum number of tokens to include in the response.
speech_config SpeechConfig (optional) Configuration for speech interaction.
The configuration for speech interaction.

#### Fields

voice string (optional) The voice of the speaker.
language string (optional) The language of the speech.
speaker string (optional) The speaker's name, it should match the speaker name given in the prompt.
image_config ImageConfig (optional) Configuration for image interaction.
The configuration for image interaction.

#### Fields

aspect_ratio enum (string) (optional) No description provided.

Possible
values:

- `1:1`
- `2:3`
- `3:2`
- `3:4`
- `4:3`
- `4:5`
- `5:4`
- `9:16`
- `16:9`
- `21:9`
- `1:8`
- `8:1`
- `1:4`
- `4:1`
image_size enum (string) (optional) No description provided.

Possible
values:

- `1K`
- `2K`
- `4K`
- `512`
tool_choice [ToolChoiceConfig](https://ai.google.dev/api/interactions-api#Resource:ToolChoiceConfig) or [ToolChoiceType](https://ai.google.dev/api/interactions-api#Resource:ToolChoiceType) (optional) The tool choice configuration.
agent_config object (optional) **Agent Configuration**   
Configuration for the agent.   
*Alternative to \`generation_config\`. Only applicable when \`agent\` is set.*

#### Possible Types

Polymorphic discriminator: `type`
DynamicAgentConfig Configuration for dynamic agents.
type object (required) No description provided.

Always set to `"dynamic"`.
DeepResearchAgentConfig Configuration for the Deep Research agent.
type object (required) No description provided.

Always set to `"deep-research"`.
thinking_summaries ThinkingSummaries (optional) Whether to include thought summaries in the response.

Possible
values:

- `auto`
- `none`

<br />

visualization enum (string) (optional) Whether to include visualizations in the response.

Possible
values:

- `off`
- `auto`
collaborative_planning boolean (optional) Enables human-in-the-loop planning for the Deep Research agent. If set to
true, the Deep Research agent will provide a research plan in its response.
The agent will then proceed only if the user confirms the plan in the next
turn.
previous_interaction_id string (optional) The ID of the previous interaction, if any.
response_modalities ResponseModality (optional) The requested modalities of the response (TEXT, IMAGE, AUDIO).

Possible
values:

- `text`
- `image`
- `audio`
- `video`
- `document`

<br />

service_tier enum (string) (optional) The service tier for the interaction.

Possible
values:

- `flex`
- `standard`
- `priority`

### Response

Returns an [Interaction](https://ai.google.dev/api/interactions-api#Resource:Interaction) resource.

### Simple Request

<iframe src="https:///frame/api/interactions-api_a78c3656a191fc61337f0eb9564b677efd89f781a218f2885093fb97e9bac186.frame" class="framebox inherit-locale " allow="clipboard-write https://" allowfullscreen is-upgraded></iframe>

#### Example Response

```json
{
  "created": "2025-11-26T12:25:15Z",
  "id": "v1_ChdPU0F4YWFtNkFwS2kxZThQZ05lbXdROBIXT1NBeGFhbTZBcEtpMWU4UGdOZW13UTg",
  "model": "gemini-3-flash-preview",
  "object": "interaction",
  "outputs": [
    {
      "text": "Hello! I'm functioning perfectly and ready to assist you.\n\nHow are you doing today?",
      "type": "text"
    }
  ],
  "role": "model",
  "status": "completed",
  "updated": "2025-11-26T12:25:15Z",
  "usage": {
    "input_tokens_by_modality": [
      {
        "modality": "text",
        "tokens": 7
      }
    ],
    "total_cached_tokens": 0,
    "total_input_tokens": 7,
    "total_output_tokens": 20,
    "total_thought_tokens": 22,
    "total_tokens": 49,
    "total_tool_use_tokens": 0
  }
}
```

### Multi-turn

<iframe src="https:///frame/api/interactions-api_80220461097181601c66abcc498cc87a3a1c90056c2cf4a2fdaa89810d40aec3.frame" class="framebox inherit-locale " allow="clipboard-write https://" allowfullscreen is-upgraded></iframe>

#### Example Response

```json
{
  "id": "v1_ChdPU0F4YWFtNkFwS2kxZThQZ05lbXdROBIXT1NBeGFhbTZBcEtpMWU4UGdOZW13UTg",
  "model": "gemini-3-flash-preview",
  "status": "completed",
  "object": "interaction",
  "created": "2025-11-26T12:22:47Z",
  "updated": "2025-11-26T12:22:47Z",
  "role": "model",
  "outputs": [
    {
      "type": "text",
      "text": "The capital of France is Paris."
    }
  ],
  "usage": {
    "input_tokens_by_modality": [
      {
        "modality": "text",
        "tokens": 50
      }
    ],
    "total_cached_tokens": 0,
    "total_input_tokens": 50,
    "total_output_tokens": 10,
    "total_thought_tokens": 0,
    "total_tokens": 60,
    "total_tool_use_tokens": 0
  }
}
```

### Image Input

<iframe src="https:///frame/api/interactions-api_fe8a7d1313ac94f59379dba314adda00769c806d60c35f6449cfac89fc5627bb.frame" class="framebox inherit-locale " allow="clipboard-write https://" allowfullscreen is-upgraded></iframe>

#### Example Response

```json
{
  "id": "v1_ChdPU0F4YWFtNkFwS2kxZThQZ05lbXdROBIXT1NBeGFhbTZBcEtpMWU4UGdOZW13UTg",
  "model": "gemini-3-flash-preview",
  "status": "completed",
  "object": "interaction",
  "created": "2025-11-26T12:22:47Z",
  "updated": "2025-11-26T12:22:47Z",
  "role": "model",
  "outputs": [
    {
      "type": "text",
      "text": "A white humanoid robot with glowing blue eyes stands holding a red skateboard."
    }
  ],
  "usage": {
    "input_tokens_by_modality": [
      {
        "modality": "text",
        "tokens": 10
      },
      {
        "modality": "image",
        "tokens": 258
      }
    ],
    "total_cached_tokens": 0,
    "total_input_tokens": 268,
    "total_output_tokens": 20,
    "total_thought_tokens": 0,
    "total_tokens": 288,
    "total_tool_use_tokens": 0
  }
}
```

### Function Calling

<iframe src="https:///frame/api/interactions-api_7c5b66c09677dc6c9bc1bb1c4a5cb295f6ff522f576aded8d79169a66c61260e.frame" class="framebox inherit-locale " allow="clipboard-write https://" allowfullscreen is-upgraded></iframe>

#### Example Response

```json
{
  "id": "v1_ChdPU0F4YWFtNkFwS2kxZThQZ05lbXdROBIXT1NBeGFhbTZBcEtpMWU4UGdOZW13UTg",
  "model": "gemini-3-flash-preview",
  "status": "requires_action",
  "object": "interaction",
  "created": "2025-11-26T12:22:47Z",
  "updated": "2025-11-26T12:22:47Z",
  "role": "model",
  "outputs": [
    {
      "type": "function_call",
      "id": "gth23981",
      "name": "get_weather",
      "arguments": {
        "location": "Boston, MA"
      }
    }
  ],
  "usage": {
    "input_tokens_by_modality": [
      {
        "modality": "text",
        "tokens": 100
      }
    ],
    "total_cached_tokens": 0,
    "total_input_tokens": 100,
    "total_output_tokens": 25,
    "total_thought_tokens": 0,
    "total_tokens": 125,
    "total_tool_use_tokens": 50
  }
}
```

### Deep Research

<iframe src="https:///frame/api/interactions-api_6b3d214c3111e035124abcd42839fd24cdbef9769a1e89da930817d5101c6e78.frame" class="framebox inherit-locale " allow="clipboard-write https://" allowfullscreen is-upgraded></iframe>

#### Example Response

```json
{
  "id": "v1_ChdPU0F4YWFtNkFwS2kxZThQZ05lbXdROBIXT1NBeGFhbTZBcEtpMWU4UGdOZW13UTg",
  "agent": "deep-research-pro-preview-12-2025",
  "status": "completed",
  "object": "interaction",
  "created": "2025-11-26T12:22:47Z",
  "updated": "2025-11-26T12:22:47Z",
  "role": "agent",
  "outputs": [
    {
      "type": "text",
      "text": "Here is a comprehensive research report on the current state of cancer research..."
    }
  ],
  "usage": {
    "input_tokens_by_modality": [
      {
        "modality": "text",
        "tokens": 20
      }
    ],
    "total_cached_tokens": 0,
    "total_input_tokens": 20,
    "total_output_tokens": 1000,
    "total_thought_tokens": 500,
    "total_tokens": 1520,
    "total_tool_use_tokens": 0
  }
}
```

## Retrieving an interaction

get https://generativelanguage.googleapis.com/v1beta/interactions/{id} Retrieves the full details of a single interaction based on its \`Interaction.id\`.
- [Path / Query parameters](https://ai.google.dev/api/interactions-api#getInteractionById.PATH_PARAMETERS)
- [Response](https://ai.google.dev/api/interactions-api#getInteractionById.response)

### Path / Query Parameters

id string (required) The unique identifier of the interaction to retrieve.
stream boolean (optional) If set to true, the generated content will be streamed incrementally.

*Defaults to: `False`*
last_event_id string (optional) Optional. If set, resumes the interaction stream from the next chunk after the event marked by the event id. Can only be used if \`stream\` is true.
include_input boolean (optional) If set to true, includes the input in the response.

*Defaults to: `False`*
api_version string (optional) Which version of the API to use.

### Response

Returns an [Interaction](https://ai.google.dev/api/interactions-api#Resource:Interaction) resource.

### Get Interaction

<iframe src="https:///frame/api/interactions-api_045bea5bcc7023a054bdc4f512005145a41a695219354b1d037457e436ecd2af.frame" class="framebox inherit-locale " allow="clipboard-write https://" allowfullscreen is-upgraded></iframe>

#### Example Response

```json
{
  "id": "v1_ChdPU0F4YWFtNkFwS2kxZThQZ05lbXdROBIXT1NBeGFhbTZBcEtpMWU4UGdOZW13UTg",
  "model": "gemini-3-flash-preview",
  "status": "completed",
  "object": "interaction",
  "created": "2025-11-26T12:25:15Z",
  "updated": "2025-11-26T12:25:15Z",
  "role": "model",
  "outputs": [
    {
      "type": "text",
      "text": "I'm doing great, thank you for asking! How can I help you today?"
    }
  ]
}
```

## Deleting an interaction

delete https://generativelanguage.googleapis.com/v1beta/interactions/{id} Deletes the interaction by id.
- [Path / Query parameters](https://ai.google.dev/api/interactions-api#deleteInteraction.PATH_PARAMETERS)
- [Response](https://ai.google.dev/api/interactions-api#deleteInteraction.response)

### Path / Query Parameters

id string (required) The unique identifier of the interaction to delete.
api_version string (optional) Which version of the API to use.

### Response

If successful, the response is empty.

### Delete Interaction

<iframe src="https:///frame/api/interactions-api_74de8596698afe6a391224244bd26262f9c84aebed9f14c7d8039b8e539de205.frame" class="framebox inherit-locale " allow="clipboard-write https://" allowfullscreen is-upgraded></iframe>

## Canceling an interaction

post https://generativelanguage.googleapis.com/v1beta/interactions/{id}/cancel Cancels an interaction by id. This only applies to background interactions that are still running.
- [Path / Query parameters](https://ai.google.dev/api/interactions-api#cancelInteractionById.PATH_PARAMETERS)
- [Response](https://ai.google.dev/api/interactions-api#cancelInteractionById.response)

### Path / Query Parameters

id string (required) The unique identifier of the interaction to cancel.
api_version string (optional) Which version of the API to use.

### Response

Returns an [Interaction](https://ai.google.dev/api/interactions-api#Resource:Interaction) resource.

### Cancel Interaction

<iframe src="https:///frame/api/interactions-api_4c59af510bd084c8112b8430b6ae52e2c72a607f500a2122a28d6af02d60caec.frame" class="framebox inherit-locale " allow="clipboard-write https://" allowfullscreen is-upgraded></iframe>

#### Example Response

```json
{
  "id": "v1_ChdPU0F4YWFtNkFwS2kxZThQZ05lbXdROBIXT1NBeGFhbTZBcEtpMWU4UGdOZW13UTg",
  "agent": "deep-research-pro-preview-12-2025",
  "status": "cancelled",
  "object": "interaction",
  "created": "2025-11-26T12:25:15Z",
  "updated": "2025-11-26T12:25:15Z",
  "role": "agent"
}
```

## Resources

### Interaction

The Interaction resource.

#### Fields

model ModelOption (optional) The name of the \`Model\` used for generating the interaction.

Possible
values:

- `gemini-2.5-computer-use-preview-10-2025`

  An agentic capability model designed for direct interface interaction, allowing Gemini to perceive and navigate digital environments.
- `gemini-2.5-flash`

  Our first hybrid reasoning model which supports a 1M token context window and has thinking budgets.
- `gemini-2.5-flash-image`

  Our native image generation model, optimized for speed, flexibility, and contextual understanding. Text input and output is priced the same as 2.5 Flash.
- `gemini-2.5-flash-lite`

  Our smallest and most cost effective model, built for at scale usage.
- `gemini-2.5-flash-lite-preview-09-2025`

  The latest model based on Gemini 2.5 Flash lite optimized for cost-efficiency, high throughput and high quality.
- `gemini-2.5-flash-native-audio-preview-12-2025`

  Our native audio models optimized for higher quality audio outputs with better pacing, voice naturalness, verbosity, and mood.
- `gemini-2.5-flash-preview-09-2025`

  The latest model based on the 2.5 Flash model. 2.5 Flash Preview is best for large scale processing, low-latency, high volume tasks that require thinking, and agentic use cases.
- `gemini-2.5-flash-preview-tts`

  Our 2.5 Flash text-to-speech model optimized for powerful, low-latency controllable speech generation.
- `gemini-2.5-pro`

  Our state-of-the-art multipurpose model, which excels at coding and complex reasoning tasks.
- `gemini-2.5-pro-preview-tts`

  Our 2.5 Pro text-to-speech audio model optimized for powerful, low-latency speech generation for more natural outputs and easier to steer prompts.
- `gemini-3-flash-preview`

  Our most intelligent model built for speed, combining frontier intelligence with superior search and grounding.
- `gemini-3-pro-image-preview`

  State-of-the-art image generation and editing model.
- `gemini-3-pro-preview`

  Our most intelligent model with SOTA reasoning and multimodal understanding, and powerful agentic and vibe coding capabilities.
- `gemini-3.1-pro-preview`

  Our latest SOTA reasoning model with unprecedented depth and nuance, and powerful multimodal understanding and coding capabilities.
- `gemini-3.1-flash-image-preview`

  Pro-level visual intelligence with Flash-speed efficiency and reality-grounded generation capabilities.
- `gemini-3.1-flash-lite-preview`

  Our most cost-efficient model, optimized for high-volume agentic tasks, translation, and simple data processing.
- `gemini-3.1-flash-tts-preview`

  Gemini 3.1 Flash TTS: Powerful, low-latency speech generation. Enjoy natural outputs, steerable prompts, and new expressive audio tags for precise narration control.
- `lyria-3-clip-preview`

  Our low-latency, music generation model optimized for high-fidelity audio clips and precise rhythmic control.
- `lyria-3-pro-preview`

  Our advanced, full-song generative model with deep compositional understanding, optimized for precise structural control and complex transitions across diverse musical styles.

The model that will complete your prompt.\\n\\nSee \[models\](https://ai.google.dev/gemini-api/docs/models) for additional details.
agent AgentOption (optional) The name of the \`Agent\` used for generating the interaction.

Possible
values:

- `deep-research-pro-preview-12-2025`

  Gemini Deep Research Agent
- `deep-research-preview-04-2026`

  Gemini Deep Research Agent
- `deep-research-max-preview-04-2026`

  Gemini Deep Research Max Agent

The agent to interact with.
id string (optional) Required. Output only. A unique identifier for the interaction completion.
status enum (string) (optional) Required. Output only. The status of the interaction.

Possible
values:

- `in_progress`
- `requires_action`
- `completed`
- `failed`
- `cancelled`
- `incomplete`
created string (optional) Required. Output only. The time at which the response was created in ISO 8601 format
(YYYY-MM-DDThh:mm:ssZ).
updated string (optional) Required. Output only. The time at which the response was last updated in ISO 8601 format
(YYYY-MM-DDThh:mm:ssZ).
role string (optional) Output only. The role of the interaction.
outputs array ([Content](https://ai.google.dev/api/interactions-api#Resource:Content)) (optional) Output only. Responses from the model.
system_instruction string (optional) System instruction for the interaction.
tools array ([Tool](https://ai.google.dev/api/interactions-api#Resource:Tool)) (optional) A list of tool declarations the model may call during interaction.
usage Usage (optional) Output only. Statistics on the interaction request's token usage.
Statistics on the interaction request's token usage.

#### Fields

total_input_tokens integer (optional) Number of tokens in the prompt (context).
input_tokens_by_modality ModalityTokens (optional) A breakdown of input token usage by modality.
The token count for a single response modality.

#### Fields

modality ResponseModality (optional) The modality associated with the token count.

Possible
values:

- `text`
- `image`
- `audio`
- `video`
- `document`

<br />

tokens integer (optional) Number of tokens for the modality.
total_cached_tokens integer (optional) Number of tokens in the cached part of the prompt (the cached content).
cached_tokens_by_modality ModalityTokens (optional) A breakdown of cached token usage by modality.
The token count for a single response modality.

#### Fields

modality ResponseModality (optional) The modality associated with the token count.

Possible
values:

- `text`
- `image`
- `audio`
- `video`
- `document`

<br />

tokens integer (optional) Number of tokens for the modality.
total_output_tokens integer (optional) Total number of tokens across all the generated responses.
output_tokens_by_modality ModalityTokens (optional) A breakdown of output token usage by modality.
The token count for a single response modality.

#### Fields

modality ResponseModality (optional) The modality associated with the token count.

Possible
values:

- `text`
- `image`
- `audio`
- `video`
- `document`

<br />

tokens integer (optional) Number of tokens for the modality.
total_tool_use_tokens integer (optional) Number of tokens present in tool-use prompt(s).
tool_use_tokens_by_modality ModalityTokens (optional) A breakdown of tool-use token usage by modality.
The token count for a single response modality.

#### Fields

modality ResponseModality (optional) The modality associated with the token count.

Possible
values:

- `text`
- `image`
- `audio`
- `video`
- `document`

<br />

tokens integer (optional) Number of tokens for the modality.
total_thought_tokens integer (optional) Number of tokens of thoughts for thinking models.
total_tokens integer (optional) Total token count for the interaction request (prompt + responses + other
internal tokens).
response_modalities ResponseModality (optional) The requested modalities of the response (TEXT, IMAGE, AUDIO).

Possible
values:

- `text`
- `image`
- `audio`
- `video`
- `document`

<br />

response_format object (optional) Enforces that the generated response is a JSON object that complies with
the JSON schema specified in this field.
response_mime_type string (optional) The mime type of the response. This is required if response_format is set.
previous_interaction_id string (optional) The ID of the previous interaction, if any.
service_tier enum (string) (optional) The service tier for the interaction.

Possible
values:

- `flex`
- `standard`
- `priority`
input [Content](https://ai.google.dev/api/interactions-api#Resource:Content) or array ([Content](https://ai.google.dev/api/interactions-api#Resource:Content)) or array ([Turn](https://ai.google.dev/api/interactions-api#Resource:Turn)) or string (optional) The input for the interaction.
agent_config object (optional) Configuration parameters for the agent interaction.

#### Possible Types

Polymorphic discriminator: `type`
DynamicAgentConfig Configuration for dynamic agents.
type object (required) No description provided.

Always set to `"dynamic"`.
DeepResearchAgentConfig Configuration for the Deep Research agent.
type object (required) No description provided.

Always set to `"deep-research"`.
thinking_summaries ThinkingSummaries (optional) Whether to include thought summaries in the response.

Possible
values:

- `auto`
- `none`

<br />

visualization enum (string) (optional) Whether to include visualizations in the response.

Possible
values:

- `off`
- `auto`
collaborative_planning boolean (optional) Enables human-in-the-loop planning for the Deep Research agent. If set to
true, the Deep Research agent will provide a research plan in its response.
The agent will then proceed only if the user confirms the plan in the next
turn.

### Examples

### Example

```bash
{
  "created": "2025-12-04T15:01:45Z",
  "id": "v1_ChdXS0l4YWZXTk9xbk0xZThQczhEcmlROBIXV0tJeGFmV05PcW5NMWU4UHM4RHJpUTg",
  "model": "gemini-3-flash-preview",
  "object": "interaction",
  "outputs": [
    {
      "text": "Hello! I'm doing well, functioning as expected. Thank you for asking! How are you doing today?",
      "type": "text"
    }
  ],
  "role": "model",
  "status": "completed",
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

## Data Models

### Content

The content of the response.

### Possible Types

Polymorphic discriminator: `type`
TextContent A text content block.
type object (required) No description provided.

Always set to `"text"`.
text string (required) Required. The text content.
annotations Annotation (optional) Citation information for model-generated content.
Citation information for model-generated content.

#### Possible Types

Polymorphic discriminator: `type`
UrlCitation A URL citation annotation.
type object (required) No description provided.

Always set to `"url_citation"`.
url string (optional) The URL.
title string (optional) The title of the URL.
start_index integer (optional) Start of segment of the response that is attributed to this source.

Index indicates the start of the segment, measured in bytes.
end_index integer (optional) End of the attributed segment, exclusive.
FileCitation A file citation annotation.
type object (required) No description provided.

Always set to `"file_citation"`.
document_uri string (optional) The URI of the file.
file_name string (optional) The name of the file.
source string (optional) Source attributed for a portion of the text.
start_index integer (optional) Start of segment of the response that is attributed to this source.

Index indicates the start of the segment, measured in bytes.
end_index integer (optional) End of the attributed segment, exclusive.
PlaceCitation A place citation annotation.
type object (required) No description provided.

Always set to `"place_citation"`.
place_id string (optional) The ID of the place, in \`places/{place_id}\` format.
name string (optional) Title of the place.
url string (optional) URI reference of the place.
review_snippets ReviewSnippet (optional) Snippets of reviews that are used to generate answers about the
features of a given place in Google Maps.
Encapsulates a snippet of a user review that answers a question about
the features of a specific place in Google Maps.

#### Fields

title string (optional) Title of the review.
url string (optional) A link that corresponds to the user review on Google Maps.
review_id string (optional) The ID of the review snippet.
start_index integer (optional) Start of segment of the response that is attributed to this source.

Index indicates the start of the segment, measured in bytes.
end_index integer (optional) End of the attributed segment, exclusive.
ImageContent An image content block.
type object (required) No description provided.

Always set to `"image"`.
data string (optional) The image content.
uri string (optional) The URI of the image.
mime_type enum (string) (optional) The mime type of the image.

Possible
values:

- `image/png`
- `image/jpeg`
- `image/webp`
- `image/heic`
- `image/heif`
- `image/gif`
- `image/bmp`
- `image/tiff`
resolution MediaResolution (optional) The resolution of the media.

Possible
values:

- `low`
- `medium`
- `high`
- `ultra_high`

<br />

AudioContent An audio content block.
type object (required) No description provided.

Always set to `"audio"`.
data string (optional) The audio content.
uri string (optional) The URI of the audio.
mime_type enum (string) (optional) The mime type of the audio.

Possible
values:

- `audio/wav`
- `audio/mp3`
- `audio/aiff`
- `audio/aac`
- `audio/ogg`
- `audio/flac`
- `audio/mpeg`
- `audio/m4a`
- `audio/l16`
- `audio/opus`
- `audio/alaw`
- `audio/mulaw`
rate integer (optional) The sample rate of the audio.
channels integer (optional) The number of audio channels.
DocumentContent A document content block.
type object (required) No description provided.

Always set to `"document"`.
data string (optional) The document content.
uri string (optional) The URI of the document.
mime_type enum (string) (optional) The mime type of the document.

Possible
values:

- `application/pdf`
VideoContent A video content block.
type object (required) No description provided.

Always set to `"video"`.
data string (optional) The video content.
uri string (optional) The URI of the video.
mime_type enum (string) (optional) The mime type of the video.

Possible
values:

- `video/mp4`
- `video/mpeg`
- `video/mpg`
- `video/mov`
- `video/avi`
- `video/x-flv`
- `video/webm`
- `video/wmv`
- `video/3gpp`
resolution MediaResolution (optional) The resolution of the media.

Possible
values:

- `low`
- `medium`
- `high`
- `ultra_high`

<br />

ThoughtContent A thought content block.
type object (required) No description provided.

Always set to `"thought"`.
signature string (optional) Signature to match the backend source to be part of the generation.
summary ThoughtSummaryContent (optional) A summary of the thought.
<br />

#### Possible Types

Polymorphic discriminator: `type`
TextContent A text content block.
type object (required) No description provided.

Always set to `"text"`.
text string (required) Required. The text content.
annotations Annotation (optional) Citation information for model-generated content.
Citation information for model-generated content.

#### Possible Types

Polymorphic discriminator: `type`
UrlCitation A URL citation annotation.
type object (required) No description provided.

Always set to `"url_citation"`.
url string (optional) The URL.
title string (optional) The title of the URL.
start_index integer (optional) Start of segment of the response that is attributed to this source.

Index indicates the start of the segment, measured in bytes.
end_index integer (optional) End of the attributed segment, exclusive.
FileCitation A file citation annotation.
type object (required) No description provided.

Always set to `"file_citation"`.
document_uri string (optional) The URI of the file.
file_name string (optional) The name of the file.
source string (optional) Source attributed for a portion of the text.
start_index integer (optional) Start of segment of the response that is attributed to this source.

Index indicates the start of the segment, measured in bytes.
end_index integer (optional) End of the attributed segment, exclusive.
PlaceCitation A place citation annotation.
type object (required) No description provided.

Always set to `"place_citation"`.
place_id string (optional) The ID of the place, in \`places/{place_id}\` format.
name string (optional) Title of the place.
url string (optional) URI reference of the place.
review_snippets ReviewSnippet (optional) Snippets of reviews that are used to generate answers about the
features of a given place in Google Maps.
Encapsulates a snippet of a user review that answers a question about
the features of a specific place in Google Maps.

#### Fields

title string (optional) Title of the review.
url string (optional) A link that corresponds to the user review on Google Maps.
review_id string (optional) The ID of the review snippet.
start_index integer (optional) Start of segment of the response that is attributed to this source.

Index indicates the start of the segment, measured in bytes.
end_index integer (optional) End of the attributed segment, exclusive.
ImageContent An image content block.
type object (required) No description provided.

Always set to `"image"`.
data string (optional) The image content.
uri string (optional) The URI of the image.
mime_type enum (string) (optional) The mime type of the image.

Possible
values:

- `image/png`
- `image/jpeg`
- `image/webp`
- `image/heic`
- `image/heif`
- `image/gif`
- `image/bmp`
- `image/tiff`
resolution MediaResolution (optional) The resolution of the media.

Possible
values:

- `low`
- `medium`
- `high`
- `ultra_high`

<br />

FunctionCallContent A function tool call content block.
type object (required) No description provided.

Always set to `"function_call"`.
name string (required) Required. The name of the tool to call.
arguments object (required) Required. The arguments to pass to the function.
id string (required) Required. A unique ID for this specific tool call.
signature string (optional) A signature hash for backend validation.
CodeExecutionCallContent Code execution content.
type object (required) No description provided.

Always set to `"code_execution_call"`.
arguments CodeExecutionCallArguments (required) Required. The arguments to pass to the code execution.
The arguments to pass to the code execution.

#### Fields

language enum (string) (optional) Programming language of the \`code\`.

Possible
values:

- `python`
code string (optional) The code to be executed.
id string (required) Required. A unique ID for this specific tool call.
signature string (optional) A signature hash for backend validation.
UrlContextCallContent URL context content.
type object (required) No description provided.

Always set to `"url_context_call"`.
arguments UrlContextCallArguments (required) Required. The arguments to pass to the URL context.
The arguments to pass to the URL context.

#### Fields

urls array (string) (optional) The URLs to fetch.
id string (required) Required. A unique ID for this specific tool call.
signature string (optional) A signature hash for backend validation.
McpServerToolCallContent MCPServer tool call content.
type object (required) No description provided.

Always set to `"mcp_server_tool_call"`.
name string (required) Required. The name of the tool which was called.
server_name string (required) Required. The name of the used MCP server.
arguments object (required) Required. The JSON object of arguments for the function.
id string (required) Required. A unique ID for this specific tool call.
signature string (optional) A signature hash for backend validation.
GoogleSearchCallContent Google Search content.
type object (required) No description provided.

Always set to `"google_search_call"`.
arguments GoogleSearchCallArguments (required) Required. The arguments to pass to Google Search.
The arguments to pass to Google Search.

#### Fields

queries array (string) (optional) Web search queries for the following-up web search.
search_type enum (string) (optional) The type of search grounding enabled.

Possible
values:

- `web_search`
- `image_search`
- `enterprise_web_search`
id string (required) Required. A unique ID for this specific tool call.
signature string (optional) A signature hash for backend validation.
FileSearchCallContent File Search content.
type object (required) No description provided.

Always set to `"file_search_call"`.
id string (required) Required. A unique ID for this specific tool call.
signature string (optional) A signature hash for backend validation.
GoogleMapsCallContent Google Maps content.
type object (required) No description provided.

Always set to `"google_maps_call"`.
arguments GoogleMapsCallArguments (optional) The arguments to pass to the Google Maps tool.
The arguments to pass to the Google Maps tool.

#### Fields

queries array (string) (optional) The queries to be executed.
id string (required) Required. A unique ID for this specific tool call.
signature string (optional) A signature hash for backend validation.
FunctionResultContent A function tool result content block.
type object (required) No description provided.

Always set to `"function_result"`.
name string (optional) The name of the tool that was called.
is_error boolean (optional) Whether the tool call resulted in an error.
call_id string (required) Required. ID to match the ID from the function call block.
signature string (optional) A signature hash for backend validation.
result array ([FunctionResultSubcontent](https://ai.google.dev/api/interactions-api#Resource:FunctionResultSubcontent)) or string (required) The result of the tool call.
CodeExecutionResultContent Code execution result content.
type object (required) No description provided.

Always set to `"code_execution_result"`.
result string (required) Required. The output of the code execution.
is_error boolean (optional) Whether the code execution resulted in an error.
call_id string (required) Required. ID to match the ID from the function call block.
signature string (optional) A signature hash for backend validation.
UrlContextResultContent URL context result content.
type object (required) No description provided.

Always set to `"url_context_result"`.
result UrlContextResult (required) Required. The results of the URL context.
The result of the URL context.

#### Fields

url string (optional) The URL that was fetched.
status enum (string) (optional) The status of the URL retrieval.

Possible
values:

- `success`
- `error`
- `paywall`
- `unsafe`
is_error boolean (optional) Whether the URL context resulted in an error.
call_id string (required) Required. ID to match the ID from the function call block.
signature string (optional) A signature hash for backend validation.
GoogleSearchResultContent Google Search result content.
type object (required) No description provided.

Always set to `"google_search_result"`.
result GoogleSearchResult (required) Required. The results of the Google Search.
The result of the Google Search.

#### Fields

search_suggestions string (optional) Web content snippet that can be embedded in a web page or an app webview.
is_error boolean (optional) Whether the Google Search resulted in an error.
call_id string (required) Required. ID to match the ID from the function call block.
signature string (optional) A signature hash for backend validation.
McpServerToolResultContent MCPServer tool result content.
type object (required) No description provided.

Always set to `"mcp_server_tool_result"`.
name string (optional) Name of the tool which is called for this specific tool call.
server_name string (optional) The name of the used MCP server.
call_id string (required) Required. ID to match the ID from the function call block.
signature string (optional) A signature hash for backend validation.
result array ([FunctionResultSubcontent](https://ai.google.dev/api/interactions-api#Resource:FunctionResultSubcontent)) or string (required) The output from the MCP server call. Can be simple text or rich content.
FileSearchResultContent File Search result content.
type object (required) No description provided.

Always set to `"file_search_result"`.
result FileSearchResult (required) Required. The results of the File Search.
The result of the File Search.

#### Fields

custom_metadata array (object) (optional) User provided metadata about the FileSearchResult.
call_id string (required) Required. ID to match the ID from the function call block.
signature string (optional) A signature hash for backend validation.
GoogleMapsResultContent Google Maps result content.
type object (required) No description provided.

Always set to `"google_maps_result"`.
result GoogleMapsResult (required) Required. The results of the Google Maps.
The result of the Google Maps.

#### Fields

places Places (optional) The places that were found.
<br />

#### Fields

place_id string (optional) The ID of the place, in \`places/{place_id}\` format.
name string (optional) Title of the place.
url string (optional) URI reference of the place.
review_snippets ReviewSnippet (optional) Snippets of reviews that are used to generate answers about the
features of a given place in Google Maps.
Encapsulates a snippet of a user review that answers a question about
the features of a specific place in Google Maps.

#### Fields

title string (optional) Title of the review.
url string (optional) A link that corresponds to the user review on Google Maps.
review_id string (optional) The ID of the review snippet.
widget_context_token string (optional) Resource name of the Google Maps widget context token.
call_id string (required) Required. ID to match the ID from the function call block.
signature string (optional) A signature hash for backend validation.

### Examples

### Text

```json
{
  "type": "text",
  "text": "Hello, how are you?"
}
```

### Image

```json
{
  "type": "image",
  "data": "BASE64_ENCODED_IMAGE",
  "mime_type": "image/png"
}
```

### Audio

```json
{
  "type": "audio",
  "data": "BASE64_ENCODED_AUDIO",
  "mime_type": "audio/wav"
}
```

### Document

```json
{
  "type": "document",
  "data": "BASE64_ENCODED_DOCUMENT",
  "mime_type": "application/pdf"
}
```

### Video

```json
{
  "type": "video",
  "uri": "https://www.youtube.com/watch?v=9hE5-98ZeCg"
}
```

### Thought

```json
{
  "type": "thought",
  "summary": [
    {
      "type": "text",
      "text": "The user is asking about the weather. I should use the get_weather tool."
    }
  ],
  "signature": "CoMDAXLI2nynRYojJIy6B1Jh9os2crpWLfB0+19xcLsGG46bd8wjkF/6RNlRUdvHrXyjsHkG0BZFcuO/bPOyA6Xh5jANNgx82wPHjGExN8A4ZQn56FlMwyZoqFVQz0QyY1lfibFJ2zU3J87uw26OewzcuVX0KEcs+GIsZa3EA6WwqhbsOd3wtZB3Ua2Qf98VAWZTS5y/tWpql7jnU3/CU7pouxQr/Bwft3hwnJNesQ9/dDJTuaQ8Zprh9VRWf1aFFjpIueOjBRrlT3oW6/y/eRl/Gt9BQXCYTqg/38vHFUU4Wo/d9dUpvfCe/a3o97t2Jgxp34oFKcsVb4S5WJrykIkw+14DzVnTpCpbQNFckqvFLuqnJCkL0EQFtunBXI03FJpPu3T1XU6id8S7ojoJQZSauGUCgmaLqUGdMrd08oo81ecoJSLs51Re9N/lISGmjWFPGpqJLoGq6uo4FHz58hmeyXCgHG742BHz2P3MiH1CXHUT2J8mF6zLhf3SR9Qb3lkrobAh"
}
```

### Function Call

```json
{
  "type": "function_call",
  "name": "get_weather",
  "id": "gth23981",
  "arguments": {
    "location": "Boston, MA"
  }
}
```

### Code Execution Call

```json
{
  "type": "code_execution_call",
  "id": "call_123456",
  "arguments": {
    "language": "python",
    "code": "print('hello world')"
  }
}
```

### Url Context Call

```json
{
  "type": "url_context_call",
  "id": "call_123456",
  "arguments": {
    "urls": [
      "https://www.example.com"
    ]
  }
}
```

### Mcp Server Tool Call

```json
{
  "type": "mcp_server_tool_call",
  "id": "call_123456",
  "name": "get_forecast",
  "server_name": "weather_server",
  "arguments": {
    "city": "London"
  }
}
```

### Google Search Call

```json
{
  "type": "google_search_call",
  "id": "call_123456",
  "arguments": {
    "queries": [
      "weather in Boston"
    ]
  }
}
```

### File Search Call

```json
{
  "type": "file_search_call",
  "id": "call_123456"
}
```

### Google Maps Call

```json
{
  "type": "google_maps_call",
  "id": "call_123456",
  "arguments": {
    "query": "best food near me"
  }
}
```

### Function Result

```json
{
  "type": "function_result",
  "name": "get_weather",
  "call_id": "gth23981",
  "result": [
    {
      "type": "text",
      "text": "{\"weather\":\"sunny\"}"
    }
  ]
}
```

### Code Execution Result

```json
{
  "type": "code_execution_result",
  "call_id": "call_123456",
  "result": "hello world"
}
```

### Url Context Result

```json
{
  "type": "url_context_result",
  "call_id": "call_123456",
  "result": [
    {
      "url": "https://www.example.com",
      "status": "SUCCESS"
    }
  ]
}
```

### Google Search Result

```json
{
  "type": "google_search_result",
  "call_id": "call_123456",
  "result": [
    {
      "url": "https://www.google.com/search?q=weather+in+Boston",
      "title": "Weather in Boston"
    }
  ]
}
```

### Mcp Server Tool Result

```json
{
  "type": "mcp_server_tool_result",
  "name": "get_forecast",
  "server_name": "weather_server",
  "call_id": "call_123456",
  "result": "sunny"
}
```

### File Search Result

```json
{
  "type": "file_search_result",
  "call_id": "call_123456",
  "result": [
    {
      "text": "search result chunk",
      "file_search_store": "file_search_store"
    }
  ]
}
```

### Google Maps Result

```json
{
  "type": "google_maps_result",
  "call_id": "call_123456",
  "result": [
    {
      "places": [
        {
          "url": "https://www.google.com/maps/search/best+food+near+me",
          "name": "Tasty Restaurant"
        }
      ]
    }
  ]
}
```

### Tool

A tool that can be used by the model.

### Possible Types

Polymorphic discriminator: `type`
Function A tool that can be used by the model.
type object (required) No description provided.

Always set to `"function"`.
name string (optional) The name of the function.
description string (optional) A description of the function.
parameters object (optional) The JSON Schema for the function's parameters.
CodeExecution A tool that can be used by the model to execute code.
type object (required) No description provided.

Always set to `"code_execution"`.
UrlContext A tool that can be used by the model to fetch URL context.
type object (required) No description provided.

Always set to `"url_context"`.
ComputerUse A tool that can be used by the model to interact with the computer.
type object (required) No description provided.

Always set to `"computer_use"`.
environment enum (string) (optional) The environment being operated.

Possible
values:

- `browser`
excludedPredefinedFunctions array (string) (optional) The list of predefined functions that are excluded from the model call.
McpServer A MCPServer is a server that can be called by the model to perform actions.
type object (required) No description provided.

Always set to `"mcp_server"`.
name string (optional) The name of the MCPServer.
url string (optional) The full URL for the MCPServer endpoint.
Example: "https://api.example.com/mcp"
headers object (optional) Optional: Fields for authentication headers, timeouts, etc., if needed.
allowed_tools AllowedTools (optional) The allowed tools.
The configuration for allowed tools.

#### Fields

mode ToolChoiceType (optional) The mode of the tool choice.

Possible
values:

- `auto`
- `any`
- `none`
- `validated`

<br />

tools array (string) (optional) The names of the allowed tools.
GoogleSearch A tool that can be used by the model to search Google.
type object (required) No description provided.

Always set to `"google_search"`.
search_types array (enum (string)) (optional) The types of search grounding to enable.

Possible
values:

- `web_search`
- `image_search`
- `enterprise_web_search`
FileSearch A tool that can be used by the model to search files.
type object (required) No description provided.

Always set to `"file_search"`.
file_search_store_names array (string) (optional) The file search store names to search.
top_k integer (optional) The number of semantic retrieval chunks to retrieve.
metadata_filter string (optional) Metadata filter to apply to the semantic retrieval documents and chunks.
GoogleMaps A tool that can be used by the model to call Google Maps.
type object (required) No description provided.

Always set to `"google_maps"`.
enable_widget boolean (optional) Whether to return a widget context token in the tool call result of the
response.
latitude number (optional) The latitude of the user's location.
longitude number (optional) The longitude of the user's location.
Retrieval A tool that can be used by the model to retrieve files.
type object (required) No description provided.

Always set to `"retrieval"`.
retrieval_types array (enum (string)) (optional) The types of file retrieval to enable.

Possible
values:

- `vertex_ai_search`
vertex_ai_search_config VertexAISearchConfig (optional) Used to specify configuration for VertexAISearch.
Used to specify configuration for VertexAISearch.

#### Fields

engine string (optional) Optional. Used to specify Vertex AI Search engine.
datastores array (string) (optional) Optional. Used to specify Vertex AI Search datastores.

### Examples

### Function

<iframe src="https:///frame/api/interactions-api_4a5dbf9d620c02ac91fab9a81c18bbf757b789ac1aacdbdd1344543526285116.frame" class="framebox inherit-locale " allow="clipboard-write https://" allowfullscreen is-upgraded></iframe>

### CodeExecution

<iframe src="https:///frame/api/interactions-api_158cbd536bcb164757d0d89985a1c5e88412987a9c90e39ccbb2d56bef005f02.frame" class="framebox inherit-locale " allow="clipboard-write https://" allowfullscreen is-upgraded></iframe>

### UrlContext

<iframe src="https:///frame/api/interactions-api_c0dfd9bd68ce4844e89374cfb79942ea89e41b3ff4ef23313559319d0ad25db1.frame" class="framebox inherit-locale " allow="clipboard-write https://" allowfullscreen is-upgraded></iframe>

### ComputerUse

<iframe src="https:///frame/api/interactions-api_b44384e3558525bfc57333193c99e2d38675e9a63c4a68f6dae6b8f3fd0bafde.frame" class="framebox inherit-locale " allow="clipboard-write https://" allowfullscreen is-upgraded></iframe>

### McpServer

<iframe src="https:///frame/api/interactions-api_458a224ebb45f79cb7c7419d5075f46e288873a007f8e82b3227e8d4d0271f7d.frame" class="framebox inherit-locale " allow="clipboard-write https://" allowfullscreen is-upgraded></iframe>

### GoogleSearch

<iframe src="https:///frame/api/interactions-api_f8479aebdefc679bc0aa879da69b36359eeeecc8fa0aa2ade58c197fff9b0c4f.frame" class="framebox inherit-locale " allow="clipboard-write https://" allowfullscreen is-upgraded></iframe>

### FileSearch

<iframe src="https:///frame/api/interactions-api_bd9a26cfd12cf81a76c60572e19b2f395c33d0d45d640ee92106e6f73a63f36a.frame" class="framebox inherit-locale " allow="clipboard-write https://" allowfullscreen is-upgraded></iframe>

### GoogleMaps

<iframe src="https:///frame/api/interactions-api_1db4307e58ef6c070f4b46cda12ebc7fa3486db85c2351e7a60f5d5c7a841c46.frame" class="framebox inherit-locale " allow="clipboard-write https://" allowfullscreen is-upgraded></iframe>

### Retrieval

No examples available for this type.

### Turn

<br />

#### Fields

role string (optional) The originator of this turn. Must be user for input or model for
model output.
content array ([Content](https://ai.google.dev/api/interactions-api#Resource:Content)) or string (optional) No description provided.

### Examples

### User Turn

```bash
{
  "role": "user",
  "content": [
    {
      "type": "text",
      "text": "user turn"
    }
  ]
}
```

### Model Turn

```bash
{
  "role": "model",
  "content": [
    {
      "type": "text",
      "text": "model turn"
    }
  ]
}
```

### InteractionSseEvent

<br />

### Possible Types

Polymorphic discriminator: `event_type`
InteractionStartEvent <br />

event_type object (required) No description provided.

Always set to `"interaction.start"`.
interaction [Interaction](https://ai.google.dev/api/interactions-api#Resource:Interaction) (required) No description provided.
event_id string (optional) The event_id token to be used to resume the interaction stream, from
this event.
InteractionCompleteEvent <br />

event_type object (required) No description provided.

Always set to `"interaction.complete"`.
interaction [Interaction](https://ai.google.dev/api/interactions-api#Resource:Interaction) (required) Required. The completed interaction with empty outputs to reduce the payload size.
Use the preceding ContentDelta events for the actual output.
event_id string (optional) The event_id token to be used to resume the interaction stream, from
this event.
InteractionStatusUpdate <br />

event_type object (required) No description provided.

Always set to `"interaction.status_update"`.
interaction_id string (required) No description provided.
status enum (string) (required) No description provided.

Possible
values:

- `in_progress`
- `requires_action`
- `completed`
- `failed`
- `cancelled`
- `incomplete`
event_id string (optional) The event_id token to be used to resume the interaction stream, from
this event.
ContentStart <br />

event_type object (required) No description provided.

Always set to `"content.start"`.
index integer (required) No description provided.
content [Content](https://ai.google.dev/api/interactions-api#Resource:Content) (required) No description provided.
event_id string (optional) The event_id token to be used to resume the interaction stream, from
this event.
ContentDelta <br />

event_type object (required) No description provided.

Always set to `"content.delta"`.
index integer (required) No description provided.
delta ContentDeltaData (required) No description provided.
The delta content data for a content block.

#### Possible Types

Polymorphic discriminator: `type`
TextDelta <br />

type object (required) No description provided.

Always set to `"text"`.
text string (required) No description provided.
ImageDelta <br />

type object (required) No description provided.

Always set to `"image"`.
data string (optional) No description provided.
uri string (optional) No description provided.
mime_type enum (string) (optional) No description provided.

Possible
values:

- `image/png`
- `image/jpeg`
- `image/webp`
- `image/heic`
- `image/heif`
- `image/gif`
- `image/bmp`
- `image/tiff`
resolution MediaResolution (optional) The resolution of the media.

Possible
values:

- `low`
- `medium`
- `high`
- `ultra_high`

<br />

AudioDelta <br />

type object (required) No description provided.

Always set to `"audio"`.
data string (optional) No description provided.
uri string (optional) No description provided.
mime_type enum (string) (optional) No description provided.

Possible
values:

- `audio/wav`
- `audio/mp3`
- `audio/aiff`
- `audio/aac`
- `audio/ogg`
- `audio/flac`
- `audio/mpeg`
- `audio/m4a`
- `audio/l16`
- `audio/opus`
- `audio/alaw`
- `audio/mulaw`
rate integer (optional) The sample rate of the audio.
channels integer (optional) The number of audio channels.
DocumentDelta <br />

type object (required) No description provided.

Always set to `"document"`.
data string (optional) No description provided.
uri string (optional) No description provided.
mime_type enum (string) (optional) No description provided.

Possible
values:

- `application/pdf`
VideoDelta <br />

type object (required) No description provided.

Always set to `"video"`.
data string (optional) No description provided.
uri string (optional) No description provided.
mime_type enum (string) (optional) No description provided.

Possible
values:

- `video/mp4`
- `video/mpeg`
- `video/mpg`
- `video/mov`
- `video/avi`
- `video/x-flv`
- `video/webm`
- `video/wmv`
- `video/3gpp`
resolution MediaResolution (optional) The resolution of the media.

Possible
values:

- `low`
- `medium`
- `high`
- `ultra_high`

<br />

ThoughtSummaryDelta <br />

type object (required) No description provided.

Always set to `"thought_summary"`.
content ThoughtSummaryContent (optional) A new summary item to be added to the thought.
<br />

#### Possible Types

Polymorphic discriminator: `type`
TextContent A text content block.
type object (required) No description provided.

Always set to `"text"`.
text string (required) Required. The text content.
annotations Annotation (optional) Citation information for model-generated content.
Citation information for model-generated content.

#### Possible Types

Polymorphic discriminator: `type`
UrlCitation A URL citation annotation.
type object (required) No description provided.

Always set to `"url_citation"`.
url string (optional) The URL.
title string (optional) The title of the URL.
start_index integer (optional) Start of segment of the response that is attributed to this source.

Index indicates the start of the segment, measured in bytes.
end_index integer (optional) End of the attributed segment, exclusive.
FileCitation A file citation annotation.
type object (required) No description provided.

Always set to `"file_citation"`.
document_uri string (optional) The URI of the file.
file_name string (optional) The name of the file.
source string (optional) Source attributed for a portion of the text.
start_index integer (optional) Start of segment of the response that is attributed to this source.

Index indicates the start of the segment, measured in bytes.
end_index integer (optional) End of the attributed segment, exclusive.
PlaceCitation A place citation annotation.
type object (required) No description provided.

Always set to `"place_citation"`.
place_id string (optional) The ID of the place, in \`places/{place_id}\` format.
name string (optional) Title of the place.
url string (optional) URI reference of the place.
review_snippets ReviewSnippet (optional) Snippets of reviews that are used to generate answers about the
features of a given place in Google Maps.
Encapsulates a snippet of a user review that answers a question about
the features of a specific place in Google Maps.

#### Fields

title string (optional) Title of the review.
url string (optional) A link that corresponds to the user review on Google Maps.
review_id string (optional) The ID of the review snippet.
start_index integer (optional) Start of segment of the response that is attributed to this source.

Index indicates the start of the segment, measured in bytes.
end_index integer (optional) End of the attributed segment, exclusive.
ImageContent An image content block.
type object (required) No description provided.

Always set to `"image"`.
data string (optional) The image content.
uri string (optional) The URI of the image.
mime_type enum (string) (optional) The mime type of the image.

Possible
values:

- `image/png`
- `image/jpeg`
- `image/webp`
- `image/heic`
- `image/heif`
- `image/gif`
- `image/bmp`
- `image/tiff`
resolution MediaResolution (optional) The resolution of the media.

Possible
values:

- `low`
- `medium`
- `high`
- `ultra_high`

<br />

ThoughtSignatureDelta <br />

type object (required) No description provided.

Always set to `"thought_signature"`.
signature string (optional) Signature to match the backend source to be part of the generation.
FunctionCallDelta <br />

type object (required) No description provided.

Always set to `"function_call"`.
name string (required) No description provided.
arguments object (required) No description provided.
id string (required) Required. A unique ID for this specific tool call.
signature string (optional) A signature hash for backend validation.
CodeExecutionCallDelta <br />

type object (required) No description provided.

Always set to `"code_execution_call"`.
arguments CodeExecutionCallArguments (required) No description provided.
The arguments to pass to the code execution.

#### Fields

language enum (string) (optional) Programming language of the \`code\`.

Possible
values:

- `python`
code string (optional) The code to be executed.
id string (required) Required. A unique ID for this specific tool call.
signature string (optional) A signature hash for backend validation.
UrlContextCallDelta <br />

type object (required) No description provided.

Always set to `"url_context_call"`.
arguments UrlContextCallArguments (required) No description provided.
The arguments to pass to the URL context.

#### Fields

urls array (string) (optional) The URLs to fetch.
id string (required) Required. A unique ID for this specific tool call.
signature string (optional) A signature hash for backend validation.
GoogleSearchCallDelta <br />

type object (required) No description provided.

Always set to `"google_search_call"`.
arguments GoogleSearchCallArguments (required) No description provided.
The arguments to pass to Google Search.

#### Fields

queries array (string) (optional) Web search queries for the following-up web search.
id string (required) Required. A unique ID for this specific tool call.
signature string (optional) A signature hash for backend validation.
McpServerToolCallDelta <br />

type object (required) No description provided.

Always set to `"mcp_server_tool_call"`.
name string (required) No description provided.
server_name string (required) No description provided.
arguments object (required) No description provided.
id string (required) Required. A unique ID for this specific tool call.
signature string (optional) A signature hash for backend validation.
FileSearchCallDelta <br />

type object (required) No description provided.

Always set to `"file_search_call"`.
id string (required) Required. A unique ID for this specific tool call.
signature string (optional) A signature hash for backend validation.
GoogleMapsCallDelta <br />

type object (required) No description provided.

Always set to `"google_maps_call"`.
arguments GoogleMapsCallArguments (optional) The arguments to pass to the Google Maps tool.
The arguments to pass to the Google Maps tool.

#### Fields

queries array (string) (optional) The queries to be executed.
id string (required) Required. A unique ID for this specific tool call.
signature string (optional) A signature hash for backend validation.
FunctionResultDelta <br />

type object (required) No description provided.

Always set to `"function_result"`.
name string (optional) No description provided.
is_error boolean (optional) No description provided.
call_id string (required) Required. ID to match the ID from the function call block.
signature string (optional) A signature hash for backend validation.
result array ([FunctionResultSubcontent](https://ai.google.dev/api/interactions-api#Resource:FunctionResultSubcontent)) or string (required) No description provided.
CodeExecutionResultDelta <br />

type object (required) No description provided.

Always set to `"code_execution_result"`.
result string (required) No description provided.
is_error boolean (optional) No description provided.
call_id string (required) Required. ID to match the ID from the function call block.
signature string (optional) A signature hash for backend validation.
UrlContextResultDelta <br />

type object (required) No description provided.

Always set to `"url_context_result"`.
result UrlContextResult (required) No description provided.
The result of the URL context.

#### Fields

url string (optional) The URL that was fetched.
status enum (string) (optional) The status of the URL retrieval.

Possible
values:

- `success`
- `error`
- `paywall`
- `unsafe`
is_error boolean (optional) No description provided.
call_id string (required) Required. ID to match the ID from the function call block.
signature string (optional) A signature hash for backend validation.
GoogleSearchResultDelta <br />

type object (required) No description provided.

Always set to `"google_search_result"`.
result GoogleSearchResult (required) No description provided.
The result of the Google Search.

#### Fields

search_suggestions string (optional) Web content snippet that can be embedded in a web page or an app webview.
is_error boolean (optional) No description provided.
call_id string (required) Required. ID to match the ID from the function call block.
signature string (optional) A signature hash for backend validation.
McpServerToolResultDelta <br />

type object (required) No description provided.

Always set to `"mcp_server_tool_result"`.
name string (optional) No description provided.
server_name string (optional) No description provided.
call_id string (required) Required. ID to match the ID from the function call block.
signature string (optional) A signature hash for backend validation.
result array ([FunctionResultSubcontent](https://ai.google.dev/api/interactions-api#Resource:FunctionResultSubcontent)) or string (required) No description provided.
FileSearchResultDelta <br />

type object (required) No description provided.

Always set to `"file_search_result"`.
result FileSearchResult (required) No description provided.
The result of the File Search.

#### Fields

custom_metadata array (object) (optional) User provided metadata about the FileSearchResult.
call_id string (required) Required. ID to match the ID from the function call block.
signature string (optional) A signature hash for backend validation.
GoogleMapsResultDelta <br />

type object (required) No description provided.

Always set to `"google_maps_result"`.
result GoogleMapsResult (optional) The results of the Google Maps.
The result of the Google Maps.

#### Fields

places Places (optional) The places that were found.
<br />

#### Fields

place_id string (optional) The ID of the place, in \`places/{place_id}\` format.
name string (optional) Title of the place.
url string (optional) URI reference of the place.
review_snippets ReviewSnippet (optional) Snippets of reviews that are used to generate answers about the
features of a given place in Google Maps.
Encapsulates a snippet of a user review that answers a question about
the features of a specific place in Google Maps.

#### Fields

title string (optional) Title of the review.
url string (optional) A link that corresponds to the user review on Google Maps.
review_id string (optional) The ID of the review snippet.
widget_context_token string (optional) Resource name of the Google Maps widget context token.
call_id string (required) Required. ID to match the ID from the function call block.
signature string (optional) A signature hash for backend validation.
TextAnnotationDelta <br />

type object (required) No description provided.

Always set to `"text_annotation"`.
annotations Annotation (optional) Citation information for model-generated content.
Citation information for model-generated content.

#### Possible Types

Polymorphic discriminator: `type`
UrlCitation A URL citation annotation.
type object (required) No description provided.

Always set to `"url_citation"`.
url string (optional) The URL.
title string (optional) The title of the URL.
start_index integer (optional) Start of segment of the response that is attributed to this source.

Index indicates the start of the segment, measured in bytes.
end_index integer (optional) End of the attributed segment, exclusive.
FileCitation A file citation annotation.
type object (required) No description provided.

Always set to `"file_citation"`.
document_uri string (optional) The URI of the file.
file_name string (optional) The name of the file.
source string (optional) Source attributed for a portion of the text.
start_index integer (optional) Start of segment of the response that is attributed to this source.

Index indicates the start of the segment, measured in bytes.
end_index integer (optional) End of the attributed segment, exclusive.
PlaceCitation A place citation annotation.
type object (required) No description provided.

Always set to `"place_citation"`.
place_id string (optional) The ID of the place, in \`places/{place_id}\` format.
name string (optional) Title of the place.
url string (optional) URI reference of the place.
review_snippets ReviewSnippet (optional) Snippets of reviews that are used to generate answers about the
features of a given place in Google Maps.
Encapsulates a snippet of a user review that answers a question about
the features of a specific place in Google Maps.

#### Fields

title string (optional) Title of the review.
url string (optional) A link that corresponds to the user review on Google Maps.
review_id string (optional) The ID of the review snippet.
start_index integer (optional) Start of segment of the response that is attributed to this source.

Index indicates the start of the segment, measured in bytes.
end_index integer (optional) End of the attributed segment, exclusive.
event_id string (optional) The event_id token to be used to resume the interaction stream, from
this event.
ContentStop <br />

event_type object (required) No description provided.

Always set to `"content.stop"`.
index integer (required) No description provided.
event_id string (optional) The event_id token to be used to resume the interaction stream, from
this event.
ErrorEvent <br />

event_type object (required) No description provided.

Always set to `"error"`.
error Error (optional) No description provided.
Error message from an interaction.

#### Fields

code string (optional) A URI that identifies the error type.
message string (optional) A human-readable error message.
event_id string (optional) The event_id token to be used to resume the interaction stream, from
this event.

### Examples

### Interaction Start

```json
{
  "event_type": "interaction.start",
  "interaction": {
    "id": "v1_ChdTMjQ0YWJ5TUF1TzcxZThQdjRpcnFRcxIXUzI0NGFieU1BdU83MWU4UHY0aXJxUXM",
    "model": "gemini-3-flash-preview",
    "object": "interaction",
    "status": "in_progress"
  }
}
```

### Interaction Complete

```json
{
  "event_type": "interaction.complete",
  "interaction": {
    "created": "2025-12-09T18:45:40Z",
    "id": "v1_ChdTMjQ0YWJ5TUF1TzcxZThQdjRpcnFRcxIXUzI0NGFieU1BdU83MWU4UHY0aXJxUXM",
    "model": "gemini-3-flash-preview",
    "object": "interaction",
    "role": "model",
    "status": "completed",
    "updated": "2025-12-09T18:45:40Z",
    "usage": {
      "input_tokens_by_modality": [
        {
          "modality": "text",
          "tokens": 11
        }
      ],
      "total_cached_tokens": 0,
      "total_input_tokens": 11,
      "total_output_tokens": 364,
      "total_thought_tokens": 1120,
      "total_tokens": 1495,
      "total_tool_use_tokens": 0
    }
  }
}
```

### Interaction Status Update

```json
{
  "event_type": "interaction.status_update",
  "interaction_id": "v1_ChdTMjQ0YWJ5TUF1TzcxZThQdjRpcnFRcxIXUzI0NGFieU1BdU83MWU4UHY0aXJxUXM",
  "status": "in_progress"
}
```

### Content Start

```json
{
  "event_type": "content.start",
  "content": {
    "type": "text"
  },
  "index": 1
}
```

### Content Delta

```json
{
  "event_type": "content.delta",
  "delta": {
    "type": "text",
    "text": "Elara\u2019s life was a symphony of quiet moments. A librarian, she found solace in the hushed aisles, the scent of aged paper, and the predictable rhythm of her days. Her small apartment, meticulously ordered, reflected this internal calm, save"
  },
  "index": 1
}
```

### Content Stop

```json
{
  "event_type": "content.stop",
  "index": 1
}
```

### Error Event

```json
{
  "event_type": "error",
  "error": {
    "message": "Failed to get completed interaction: Result not found.",
    "code": "not_found"
  }
}
```
