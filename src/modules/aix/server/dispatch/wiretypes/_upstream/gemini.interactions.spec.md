<!--
  Upstream snapshot - DO NOT EDIT - run _upstream/sync.sh to refresh
  Source: https://ai.google.dev/api/interactions-api.md.txt
  Synced: 2026-06-03
  Consumed by: gemini.interactions.wiretypes.ts, gemini.interactions.parser.ts, gemini.interactionsCreate.ts, gemini.interactionsPoller.ts
  Companion: ./gemini.interactions.guide.md (the Interactions API guide)
-->

# Gemini Interactions API

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
- `gemini-3.1-flash-lite`

  Our most cost-efficient model, optimized for high-volume agentic tasks, translation, and simple data processing.
- `gemini-3.1-flash-lite-preview`

  Our most cost-efficient model, optimized for high-volume agentic tasks, translation, and simple data processing.
- `gemini-3.1-flash-tts-preview`

  Gemini 3.1 Flash TTS: Powerful, low-latency speech generation. Enjoy natural outputs, steerable prompts, and new expressive audio tags for precise narration control.
- `lyria-3-clip-preview`

  Our low-latency, music generation model optimized for high-fidelity audio clips and precise rhythmic control.
- `lyria-3-pro-preview`

  Our advanced, full-song generative model with deep compositional understanding, optimized for precise structural control and complex transitions across diverse musical styles.
- `gemini-3.5-flash`

  Our most intelligent model for sustained frontier performance in agentic and coding tasks.

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
- `antigravity-preview-05-2026`

  Use the Antigravity managed agent to perform multi-step tasks that require reasoning, file operations, and tool use.

The agent to interact with.
input [Content](https://ai.google.dev/api/interactions-api#Resource:Content) or array ([Content](https://ai.google.dev/api/interactions-api#Resource:Content)) or array ([Step](https://ai.google.dev/api/interactions-api#Resource:Step)) or string (required) The inputs for the interaction (common to both Model and Agent).
system_instruction string (optional) System instruction for the interaction.
tools array ([Tool](https://ai.google.dev/api/interactions-api#Resource:Tool)) (optional) A list of tool declarations the model may call during interaction.
response_format [ResponseFormat](https://ai.google.dev/api/interactions-api#Resource:ResponseFormat) or [ResponseFormatList](https://ai.google.dev/api/interactions-api#Resource:ResponseFormatList) (optional) Enforces that the generated response is a JSON object that complies with the JSON schema specified in this field.
response_mime_type string (optional) The mime type of the response. This is required if response_format is set.
stream boolean (optional) Input only. Whether the interaction will be streamed.
store boolean (optional) Input only. Whether to store the response and request for later retrieval.
background boolean (optional) Input only. Whether to run the model interaction in the background.
generation_config GenerationConfig (optional) **Model Configuration**   
Configuration parameters for the model interaction.   
*Alternative to \`agent_config\`. Only applicable when \`model\` is set.*
Configuration parameters for model interactions.

#### Fields

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
max_output_tokens integer (optional) The maximum number of tokens to include in the response.
seed integer (optional) Seed used in decoding for reproducibility.
speech_config SpeechConfig (optional) Configuration for speech interaction.
The configuration for speech interaction.

#### Fields

language string (optional) The language of the speech.
speaker string (optional) The speaker's name, it should match the speaker name given in the prompt.
voice string (optional) The voice of the speaker.
stop_sequences array (string) (optional) A list of character sequences that will stop output interaction.
temperature number (optional) Controls the randomness of the output.
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

tool_choice [ToolChoiceConfig](https://ai.google.dev/api/interactions-api#Resource:ToolChoiceConfig) or [ToolChoiceType](https://ai.google.dev/api/interactions-api#Resource:ToolChoiceType) (optional) The tool choice configuration.
top_p number (optional) The maximum cumulative probability of tokens to consider when sampling.
agent_config object (optional) **Agent Configuration**   
Configuration for the agent.   
*Alternative to \`generation_config\`. Only applicable when \`agent\` is set.*

#### Possible Types

Polymorphic discriminator: `type`
DynamicAgentConfig Configuration for dynamic agents.
type object (required) No description provided.

Always set to `"dynamic"`.
DeepResearchAgentConfig Configuration for the Deep Research agent.
collaborative_planning boolean (optional) Enables human-in-the-loop planning for the Deep Research agent. If set to
true, the Deep Research agent will provide a research plan in its response.
The agent will then proceed only if the user confirms the plan in the next
turn.
thinking_summaries ThinkingSummaries (optional) Whether to include thought summaries in the response.

Possible
values:

- `auto`
- `none`

<br />

type object (required) No description provided.

Always set to `"deep-research"`.
visualization enum (string) (optional) Whether to include visualizations in the response.

Possible
values:

- `off`
- `auto`
environment [EnvironmentConfig](https://ai.google.dev/api/interactions-api#Resource:EnvironmentConfig) or string (optional) The environment configuration for the interaction. Can be an object specifying remote environment sources or a string referencing an existing environment ID.
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

service_tier ServiceTier (optional) The service tier for the interaction.

Possible
values:

- `flex`
- `standard`
- `priority`

<br />

webhook_config WebhookConfig (optional) Optional. Webhook configuration for receiving notifications when the
interaction completes.
Message for configuring webhook events for a request.

#### Fields

uris array (string) (optional) Optional. If set, these webhook URIs will be used for webhook events instead of the
registered webhooks.
user_metadata object (optional) Optional. The user metadata that will be returned on each event emission to the
webhooks.

### Response

Returns an [Interaction](https://ai.google.dev/api/interactions-api#Resource:Interaction) resource.

### Simple Request

#### Example Request

REST Python JavaScript

```sh
curl -X POST https://generativelanguage.googleapis.com/v1beta/interactions 
  -H "x-goog-api-key: $GEMINI_API_KEY" 
  -H "Content-Type: application/json" 
  -H "Api-Revision: 2026-05-20" 
  -d '{
    "model": "gemini-3-flash-preview",
    "input": "Hello, how are you?"
  }'
```

```python
from google import genai

client = genai.Client()
interaction = client.interactions.create(
    model="gemini-3-flash-preview",
    input="Hello, how are you?",
)
print(interaction.output_text)
```

```javascript
import {GoogleGenAI} from '@google/genai';

const ai = new GoogleGenAI({});
const interaction = await ai.interactions.create({
    model: 'gemini-3-flash-preview',
    input: 'Hello, how are you?',
});
console.log(interaction.output_text);
```

#### Example Response

```json
{
  "created": "2025-11-26T12:25:15Z",
  "id": "v1_ChdPU0F4YWFtNkFwS2kxZThQZ05lbXdROBIXT1NBeGFhbTZBcEtpMWU4UGdOZW13UTg",
  "model": "gemini-3-flash-preview",
  "object": "interaction",
  "steps": [
    {
      "type": "model_output",
      "content": [
        {
          "type": "text",
          "text": "Hello! I'm functioning perfectly and ready to assist you.\n\nHow are you doing today?"
        }
      ]
    }
  ],
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

#### Example Request

REST Python JavaScript

```sh
curl -X POST https://generativelanguage.googleapis.com/v1beta/interactions 
  -H "x-goog-api-key: $GEMINI_API_KEY" 
  -H "Content-Type: application/json" 
  -H "Api-Revision: 2026-05-20" 
  -d '{
    "model": "gemini-3-flash-preview",
    "input": [
      { "type": "user_input", "content": [{ "type": "text", "text": "Hello!" }] },
      { "type": "model_output", "content": [{ "type": "text", "text": "Hi there! How can I help you today?" }] },
      { "type": "user_input", "content": [{ "type": "text", "text": "What is the capital of France?" }] }
    ]
  }'
```

```python
from google import genai

client = genai.Client()
response = client.interactions.create(
    model="gemini-3-flash-preview",
    input=[
        { "type": "user_input", "content": [{ "type": "text", "text": "Hello!" }] },
        { "type": "model_output", "content": [{ "type": "text", "text": "Hi there! How can I help you today?" }] },
        { "type": "user_input", "content": [{ "type": "text", "text": "What is the capital of France?" }] }
    ]
)
print(response.output_text)
```

```javascript
import {GoogleGenAI} from '@google/genai';

const ai = new GoogleGenAI({});
const interaction = await ai.interactions.create({
    model: 'gemini-3-flash-preview',
    input: [
        { type: 'user_input', content: [{ type: 'text', text: 'Hello' }] },
        { type: 'model_output', content: [{ type: 'text', text: 'Hi there! How can I help you today?' }] },
        { type: 'user_input', content: [{ type: 'text', text: 'What is the capital of France?' }] }
    ]
});
console.log(interaction.output_text);
```

#### Example Response

```json
{
  "id": "v1_ChdPU0F4YWFtNkFwS2kxZThQZ05lbXdROBIXT1NBeGFhbTZBcEtpMWU4UGdOZW13UTg",
  "model": "gemini-3-flash-preview",
  "status": "completed",
  "object": "interaction",
  "created": "2025-11-26T12:22:47Z",
  "updated": "2025-11-26T12:22:47Z",
  "steps": [
    {
      "type": "model_output",
      "content": [
        {
          "type": "text",
          "text": "The capital of France is Paris."
        }
      ]
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

#### Example Request

REST Python JavaScript

```sh
curl -X POST https://generativelanguage.googleapis.com/v1beta/interactions 
  -H "x-goog-api-key: $GEMINI_API_KEY" 
  -H "Content-Type: application/json" 
  -H "Api-Revision: 2026-05-20" 
  -d '{
    "model": "gemini-3-flash-preview",
    "input": [
      {
        "type": "text",
        "text": "What is in this picture?"
      },
      {
        "type": "image",
        "data": "BASE64_ENCODED_IMAGE",
        "mime_type": "image/png"
      }
    ]
  }'
```

```python
from google import genai

client = genai.Client()
response = client.interactions.create(
    model="gemini-3-flash-preview",
    input=[
      { "type": "text", "text": "What is in this picture?" },
      { "type": "image", "data": "BASE64_ENCODED_IMAGE", "mime_type": "image/png" }
    ]
)
print(response.output_text)
```

```javascript
import {GoogleGenAI} from '@google/genai';

const ai = new GoogleGenAI({});
const interaction = await ai.interactions.create({
    model: 'gemini-3-flash-preview',
    input: [
      { type: 'text', text: 'What is in this picture?' },
      { type: 'image', data: 'BASE64_ENCODED_IMAGE', mime_type: 'image/png' }
    ]
});
console.log(interaction.output_text);
```

#### Example Response

```json
{
  "id": "v1_ChdPU0F4YWFtNkFwS2kxZThQZ05lbXdROBIXT1NBeGFhbTZBcEtpMWU4UGdOZW13UTg",
  "model": "gemini-3-flash-preview",
  "status": "completed",
  "object": "interaction",
  "created": "2025-11-26T12:22:47Z",
  "updated": "2025-11-26T12:22:47Z",
  "steps": [
    {
      "type": "model_output",
      "content": [
        {
          "type": "text",
          "text": "A white humanoid robot with glowing blue eyes stands holding a red skateboard."
        }
      ]
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

#### Example Request

REST Python JavaScript

```sh
curl -X POST https://generativelanguage.googleapis.com/v1beta/interactions 
  -H "x-goog-api-key: $GEMINI_API_KEY" 
  -H "Content-Type: application/json" 
  -H "Api-Revision: 2026-05-20" 
  -d '{
    "model": "gemini-3-flash-preview",
    "tools": [
      {
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
          "required": [
            "location"
          ]
        }
      }
    ],
    "input": "What is the weather like in Boston, MA?"
  }'
```

```python
from google import genai

client = genai.Client()
response = client.interactions.create(
    model="gemini-3-flash-preview",
    tools=[{
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
    input="What is the weather like in Boston, MA?"
)
print(response.steps[-1])
```

```javascript
import {GoogleGenAI} from '@google/genai';

const ai = new GoogleGenAI({});
const interaction = await ai.interactions.create({
    model: 'gemini-3-flash-preview',
    tools: [{
        type: 'function',
        name: 'get_weather',
        description: 'Get the current weather in a given location',
        parameters: {
            type: 'object',
            properties: {
                location: {
                    type: 'string',
                    description: 'The city and state, e.g. San Francisco, CA'
                }
            },
            required: ['location']
        }
    }],
    input: 'What is the weather like in Boston, MA?'
});
console.log(interaction.steps.at(-1));
```

#### Example Response

```json
{
  "id": "v1_ChdPU0F4YWFtNkFwS2kxZThQZ05lbXdROBIXT1NBeGFhbTZBcEtpMWU4UGdOZW13UTg",
  "model": "gemini-3-flash-preview",
  "status": "requires_action",
  "object": "interaction",
  "created": "2025-11-26T12:22:47Z",
  "updated": "2025-11-26T12:22:47Z",
  "steps": [
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

#### Example Request

REST Python JavaScript

```sh
curl -X POST https://generativelanguage.googleapis.com/v1beta/interactions 
  -H "x-goog-api-key: $GEMINI_API_KEY" 
  -H "Content-Type: application/json" 
  -H "Api-Revision: 2026-05-20" 
  -d '{
    "agent": "deep-research-pro-preview-12-2025",
    "input": "Find a cure to cancer",
    "background": true
  }'
```

```python
from google import genai

client = genai.Client()
interaction = client.interactions.create(
    agent="deep-research-pro-preview-12-2025",
    input="find a cure to cancer",
    background=True,
)
print(interaction.status)
```

```javascript
import {GoogleGenAI} from '@google/genai';

const ai = new GoogleGenAI({});
const interaction = await ai.interactions.create({
    agent: 'deep-research-pro-preview-12-2025',
    input: 'find a cure to cancer',
    background: true,
});
console.log(interaction.status);
```

#### Example Response

```json
{
  "id": "v1_ChdPU0F4YWFtNkFwS2kxZThQZ05lbXdROBIXT1NBeGFhbTZBcEtpMWU4UGdOZW13UTg",
  "agent": "deep-research-pro-preview-12-2025",
  "status": "completed",
  "object": "interaction",
  "created": "2025-11-26T12:22:47Z",
  "updated": "2025-11-26T12:22:47Z",
  "steps": [
    {
      "type": "model_output",
      "content": [
        {
          "type": "text",
          "text": "Here is a comprehensive research report on the current state of cancer research..."
        }
      ]
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

#### Example Request

REST Python JavaScript

```sh
curl -X GET "https://generativelanguage.googleapis.com/v1beta/interactions/$INTERACTION_ID" 
  -H "x-goog-api-key: $GEMINI_API_KEY" 
  -H "Api-Revision: 2026-05-20"
```

```python
from google import genai

client = genai.Client()


interaction = client.interactions.get(id=created.id)
print(interaction.status)
```

```javascript
import {GoogleGenAI} from '@google/genai';

const ai = new GoogleGenAI({});


const interaction = await ai.interactions.get(created.id);
console.log(interaction.status);
```

#### Example Response

```json
{
  "id": "v1_ChdPU0F4YWFtNkFwS2kxZThQZ05lbXdROBIXT1NBeGFhbTZBcEtpMWU4UGdOZW13UTg",
  "model": "gemini-3-flash-preview",
  "status": "completed",
  "object": "interaction",
  "created": "2025-11-26T12:25:15Z",
  "updated": "2025-11-26T12:25:15Z",
  "steps": [
    {
      "type": "model_output",
      "content": [
        {
          "type": "text",
          "text": "I'm doing great, thank you for asking! How can I help you today?"
        }
      ]
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

#### Example Request

REST Python JavaScript

```sh
curl -X DELETE "https://generativelanguage.googleapis.com/v1beta/interactions/$INTERACTION_ID" 
  -H "x-goog-api-key: $GEMINI_API_KEY" 
  -H "Api-Revision: 2026-05-20"
```

```python
from google import genai

client = genai.Client()


client.interactions.delete(id=created.id)
print("Interaction deleted successfully.")
```

```javascript
import {GoogleGenAI} from '@google/genai';

const ai = new GoogleGenAI({});


await ai.interactions.delete(created.id);
console.log('Interaction deleted successfully.');
```

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

#### Example Request

REST Python JavaScript

```sh
curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions/$INTERACTION_ID/cancel" 
  -H "x-goog-api-key: $GEMINI_API_KEY" 
  -H "Api-Revision: 2026-05-20"
```

```python
from google import genai

client = genai.Client()

# Start a background interaction so it stays in-progress.
created = client.interactions.create(
    model="gemini-3-flash-preview",
    input="Write a long essay about the history of computing.",
    tools=[{"type": "computer_use"}],
    background=True,
)

# Cancel the in-progress interaction.
interaction = client.interactions.cancel(id=created.id)
print(interaction.status)
```

```javascript
import {GoogleGenAI} from '@google/genai';

const ai = new GoogleGenAI({});

// Start a background interaction so it stays in-progress.
const created = await ai.interactions.create({
    model: 'gemini-3-flash-preview',
    input: 'Write a long essay about the history of computing.',
    tools: [{ type: 'computer_use' }],
    background: true,
});

// Cancel the in-progress interaction.
const interaction = await ai.interactions.cancel(created.id);
console.log(interaction.status);
```

#### Example Response

```json
{
  "id": "v1_ChdPU0F4YWFtNkFwS2kxZThQZ05lbXdROBIXT1NBeGFhbTZBcEtpMWU4UGdOZW13UTg",
  "agent": "deep-research-pro-preview-12-2025",
  "status": "cancelled",
  "object": "interaction",
  "created": "2025-11-26T12:25:15Z",
  "updated": "2025-11-26T12:25:15Z"
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
- `gemini-3.1-flash-lite`

  Our most cost-efficient model, optimized for high-volume agentic tasks, translation, and simple data processing.
- `gemini-3.1-flash-lite-preview`

  Our most cost-efficient model, optimized for high-volume agentic tasks, translation, and simple data processing.
- `gemini-3.1-flash-tts-preview`

  Gemini 3.1 Flash TTS: Powerful, low-latency speech generation. Enjoy natural outputs, steerable prompts, and new expressive audio tags for precise narration control.
- `lyria-3-clip-preview`

  Our low-latency, music generation model optimized for high-fidelity audio clips and precise rhythmic control.
- `lyria-3-pro-preview`

  Our advanced, full-song generative model with deep compositional understanding, optimized for precise structural control and complex transitions across diverse musical styles.
- `gemini-3.5-flash`

  Our most intelligent model for sustained frontier performance in agentic and coding tasks.

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
- `antigravity-preview-05-2026`

  Use the Antigravity managed agent to perform multi-step tasks that require reasoning, file operations, and tool use.

The agent to interact with.
created string (optional) Required. Output only. The time at which the response was created in ISO 8601 format
(YYYY-MM-DDThh:mm:ssZ).
environment [EnvironmentConfig](https://ai.google.dev/api/interactions-api#Resource:EnvironmentConfig) or string (optional) The environment configuration for the interaction. Can be an object specifying remote environment sources or a string referencing an existing environment ID.
environment_id string (optional) Output only. The environment ID for the interaction. Only populated if environment
config is set in the request.
id string (optional) Required. Output only. A unique identifier for the interaction completion.
input [Content](https://ai.google.dev/api/interactions-api#Resource:Content) or array ([Content](https://ai.google.dev/api/interactions-api#Resource:Content)) or array ([Step](https://ai.google.dev/api/interactions-api#Resource:Step)) or string (optional) The input for the interaction.
previous_interaction_id string (optional) The ID of the previous interaction, if any.
response_format [ResponseFormat](https://ai.google.dev/api/interactions-api#Resource:ResponseFormat) or [ResponseFormatList](https://ai.google.dev/api/interactions-api#Resource:ResponseFormatList) (optional) Enforces that the generated response is a JSON object that complies with the JSON schema specified in this field.
response_mime_type string (optional) The mime type of the response. This is required if response_format is set.
response_modalities ResponseModality (optional) The requested modalities of the response (TEXT, IMAGE, AUDIO).

Possible
values:

- `text`
- `image`
- `audio`
- `video`
- `document`

<br />

role string (optional) Output only. The role of the interaction.
service_tier ServiceTier (optional) The service tier for the interaction.

Possible
values:

- `flex`
- `standard`
- `priority`

<br />

status enum (string) (optional) Required. Output only. The status of the interaction.

Possible
values:

- `in_progress`
- `requires_action`
- `completed`
- `failed`
- `cancelled`
- `incomplete`
- `budget_exceeded`
steps array ([Step](https://ai.google.dev/api/interactions-api#Resource:Step)) (optional) Required. Output only. The steps that make up the interaction.
system_instruction string (optional) System instruction for the interaction.
tools array ([Tool](https://ai.google.dev/api/interactions-api#Resource:Tool)) (optional) A list of tool declarations the model may call during interaction.
updated string (optional) Required. Output only. The time at which the response was last updated in ISO 8601 format
(YYYY-MM-DDThh:mm:ssZ).
usage Usage (optional) Output only. Statistics on the interaction request's token usage.
Statistics on the interaction request's token usage.

#### Fields

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
grounding_tool_count GroundingToolCount (optional) Grounding tool count.
The number of grounding tool counts.

#### Fields

count integer (optional) The number of grounding tool counts.
type enum (string) (optional) The grounding tool type associated with the count.

Possible
values:

- `google_search`
- `google_maps`
- `retrieval`
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
total_cached_tokens integer (optional) Number of tokens in the cached part of the prompt (the cached content).
total_input_tokens integer (optional) Number of tokens in the prompt (context).
total_output_tokens integer (optional) Total number of tokens across all the generated responses.
total_thought_tokens integer (optional) Number of tokens of thoughts for thinking models.
total_tokens integer (optional) Total token count for the interaction request (prompt + responses + other
internal tokens).
total_tool_use_tokens integer (optional) Number of tokens present in tool-use prompt(s).
webhook_config WebhookConfig (optional) Optional. Webhook configuration for receiving notifications when the
interaction completes.
Message for configuring webhook events for a request.

#### Fields

uris array (string) (optional) Optional. If set, these webhook URIs will be used for webhook events instead of the
registered webhooks.
user_metadata object (optional) Optional. The user metadata that will be returned on each event emission to the
webhooks.
agent_config object (optional) Configuration parameters for the agent interaction.

#### Possible Types

Polymorphic discriminator: `type`
DynamicAgentConfig Configuration for dynamic agents.
type object (required) No description provided.

Always set to `"dynamic"`.
DeepResearchAgentConfig Configuration for the Deep Research agent.
collaborative_planning boolean (optional) Enables human-in-the-loop planning for the Deep Research agent. If set to
true, the Deep Research agent will provide a research plan in its response.
The agent will then proceed only if the user confirms the plan in the next
turn.
thinking_summaries ThinkingSummaries (optional) Whether to include thought summaries in the response.

Possible
values:

- `auto`
- `none`

<br />

type object (required) No description provided.

Always set to `"deep-research"`.
visualization enum (string) (optional) Whether to include visualizations in the response.

Possible
values:

- `off`
- `auto`

### Examples

### Example

```bash
{
  "created": "2025-12-04T15:01:45Z",
  "id": "v1_ChdXS0l4YWZXTk9xbk0xZThQczhEcmlROBIXV0tJeGFmV05PcW5NMWU4UHM4RHJpUTg",
  "model": "gemini-3-flash-preview",
  "object": "interaction",
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
annotations Annotation (optional) Citation information for model-generated content.
Citation information for model-generated content.

#### Possible Types

Polymorphic discriminator: `type`
UrlCitation A URL citation annotation.
end_index integer (optional) End of the attributed segment, exclusive.
start_index integer (optional) Start of segment of the response that is attributed to this source.

Index indicates the start of the segment, measured in bytes.
title string (optional) The title of the URL.
type object (required) No description provided.

Always set to `"url_citation"`.
url string (optional) The URL.
FileCitation A file citation annotation.
custom_metadata object (optional) User provided metadata about the retrieved context.
document_uri string (optional) The URI of the file.
end_index integer (optional) End of the attributed segment, exclusive.
file_name string (optional) The name of the file.
media_id string (optional) Media ID in-case of image citations, if applicable.
page_number integer (optional) Page number of the cited document, if applicable.
source string (optional) Source attributed for a portion of the text.
start_index integer (optional) Start of segment of the response that is attributed to this source.

Index indicates the start of the segment, measured in bytes.
type object (required) No description provided.

Always set to `"file_citation"`.
PlaceCitation A place citation annotation.
end_index integer (optional) End of the attributed segment, exclusive.
name string (optional) Title of the place.
place_id string (optional) The ID of the place, in \`places/{place_id}\` format.
review_snippets ReviewSnippet (optional) Snippets of reviews that are used to generate answers about the
features of a given place in Google Maps.
Encapsulates a snippet of a user review that answers a question about
the features of a specific place in Google Maps.

#### Fields

review_id string (optional) The ID of the review snippet.
title string (optional) Title of the review.
url string (optional) A link that corresponds to the user review on Google Maps.
start_index integer (optional) Start of segment of the response that is attributed to this source.

Index indicates the start of the segment, measured in bytes.
type object (required) No description provided.

Always set to `"place_citation"`.
url string (optional) URI reference of the place.
text string (required) Required. The text content.
type object (required) No description provided.

Always set to `"text"`.
ImageContent An image content block.
data string (optional) The image content.
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

type object (required) No description provided.

Always set to `"image"`.
uri string (optional) The URI of the image.
AudioContent An audio content block.
channels integer (optional) The number of audio channels.
data string (optional) The audio content.
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
sample_rate integer (optional) The sample rate of the audio.
type object (required) No description provided.

Always set to `"audio"`.
uri string (optional) The URI of the audio.
DocumentContent A document content block.
data string (optional) The document content.
mime_type enum (string) (optional) The mime type of the document.

Possible
values:

- `application/pdf`
type object (required) No description provided.

Always set to `"document"`.
uri string (optional) The URI of the document.
VideoContent A video content block.
data string (optional) The video content.
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

type object (required) No description provided.

Always set to `"video"`.
uri string (optional) The URI of the video.

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

### Tool

A tool that can be used by the model.

### Possible Types

Polymorphic discriminator: `type`
Function A tool that can be used by the model.
description string (optional) A description of the function.
name string (optional) The name of the function.
parameters object (optional) The JSON Schema for the function's parameters.
type object (required) No description provided.

Always set to `"function"`.
CodeExecution A tool that can be used by the model to execute code.
type object (required) No description provided.

Always set to `"code_execution"`.
UrlContext A tool that can be used by the model to fetch URL context.
type object (required) No description provided.

Always set to `"url_context"`.
ComputerUse A tool that can be used by the model to interact with the computer.
environment enum (string) (optional) The environment being operated.

Possible
values:

- `browser`
excluded_predefined_functions array (string) (optional) The list of predefined functions that are excluded from the model call.
type object (required) No description provided.

Always set to `"computer_use"`.
McpServer A MCPServer is a server that can be called by the model to perform actions.
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
headers object (optional) Optional: Fields for authentication headers, timeouts, etc., if needed.
name string (optional) The name of the MCPServer.
type object (required) No description provided.

Always set to `"mcp_server"`.
url string (optional) The full URL for the MCPServer endpoint.
Example: "https://api.example.com/mcp"
GoogleSearch A tool that can be used by the model to search Google.
search_types array (enum (string)) (optional) The types of search grounding to enable.

Possible
values:

- `web_search`
- `image_search`
- `enterprise_web_search`
type object (required) No description provided.

Always set to `"google_search"`.
FileSearch A tool that can be used by the model to search files.
file_search_store_names array (string) (optional) The file search store names to search.
metadata_filter string (optional) Metadata filter to apply to the semantic retrieval documents and chunks.
top_k integer (optional) The number of semantic retrieval chunks to retrieve.
type object (required) No description provided.

Always set to `"file_search"`.
GoogleMaps A tool that can be used by the model to call Google Maps.
enable_widget boolean (optional) Whether to return a widget context token in the tool call result of the
response.
latitude number (optional) The latitude of the user's location.
longitude number (optional) The longitude of the user's location.
type object (required) No description provided.

Always set to `"google_maps"`.
Retrieval A tool that can be used by the model to retrieve files.
retrieval_types array (enum (string)) (optional) The types of file retrieval to enable.

Possible
values:

- `vertex_ai_search`
type object (required) No description provided.

Always set to `"retrieval"`.
vertex_ai_search_config VertexAISearchConfig (optional) Used to specify configuration for VertexAISearch.
Used to specify configuration for VertexAISearch.

#### Fields

datastores array (string) (optional) Optional. Used to specify Vertex AI Search datastores.
engine string (optional) Optional. Used to specify Vertex AI Search engine.

### Examples

### Function

#### Example

REST Python JavaScript

```sh
curl -X POST https://generativelanguage.googleapis.com/v1beta/interactions 
  -H "x-goog-api-key: $GEMINI_API_KEY" 
  -H "Content-Type: application/json" 
  -H "Api-Revision: 2026-05-20" 
  -d '{
    "model": "gemini-3-flash-preview",
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

```python
from google import genai

client = genai.Client()
response = client.interactions.create(
    model="gemini-3-flash-preview",
    tools=[{
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
    input="What is the weather like in Boston?"
)
print(response.steps[-1])
```

```javascript
import {GoogleGenAI} from '@google/genai';

const ai = new GoogleGenAI({});
const interaction = await ai.interactions.create({
    model: 'gemini-3-flash-preview',
    tools: [{
        type: 'function',
        name: 'get_weather',
        description: 'Get the current weather in a given location',
        parameters: {
            type: 'object',
            properties: {
                location: {
                    type: 'string',
                    description: 'The city and state, e.g. San Francisco, CA'
                }
            },
            required: ['location']
        }
    }],
    input: 'What is the weather like in Boston?'
});
console.log(interaction.steps.at(-1));
```

### CodeExecution

#### Example

REST Python JavaScript

```sh
curl -X POST https://generativelanguage.googleapis.com/v1beta/interactions 
  -H "x-goog-api-key: $GEMINI_API_KEY" 
  -H "Content-Type: application/json" 
  -H "Api-Revision: 2026-05-20" 
  -d '{
    "model": "gemini-3-flash-preview",
    "tools": [{
      "type": "code_execution"
    }],
    "input": "Calculate the first 10 Fibonacci numbers"
  }'
```

```python
from google import genai

client = genai.Client()
response = client.interactions.create(
    model="gemini-3-flash-preview",
    tools=[{"type": "code_execution"}],
    input="Calculate the first 10 Fibonacci numbers"
)
print(response.output_text)
```

```javascript
import {GoogleGenAI} from '@google/genai';

const ai = new GoogleGenAI({});
const interaction = await ai.interactions.create({
    model: 'gemini-3-flash-preview',
    tools: [{ type: 'code_execution' }],
    input: 'Calculate the first 10 Fibonacci numbers'
});
console.log(interaction.output_text);
```

### UrlContext

#### Example

REST Python JavaScript

```sh
curl -X POST https://generativelanguage.googleapis.com/v1beta/interactions 
  -H "x-goog-api-key: $GEMINI_API_KEY" 
  -H "Content-Type: application/json" 
  -H "Api-Revision: 2026-05-20" 
  -d '{
    "model": "gemini-3-flash-preview",
    "tools": [{
      "type": "url_context"
    }],
    "input": "Summarize https://www.example.com"
  }'
```

```python
from google import genai

client = genai.Client()
response = client.interactions.create(
    model="gemini-3-flash-preview",
    tools=[{"type": "url_context"}],
    input="Summarize https://www.example.com"
)
print(response.output_text)
```

```javascript
import {GoogleGenAI} from '@google/genai';

const ai = new GoogleGenAI({});
const interaction = await ai.interactions.create({
    model: 'gemini-3-flash-preview',
    tools: [{ type: 'url_context' }],
    input: 'Summarize https://www.example.com'
});
console.log(interaction.output_text);
```

### ComputerUse

#### Example

REST Python JavaScript

```sh
curl -X POST https://generativelanguage.googleapis.com/v1beta/interactions 
  -H "x-goog-api-key: $GEMINI_API_KEY" 
  -H "Content-Type: application/json" 
  -H "Api-Revision: 2026-05-20" 
  -d '{
    "model": "gemini-2.5-computer-use-preview-10-2025",
    "tools": [{
      "type": "computer_use"
    }],
    "input": "Find a flight to Tokyo"
  }'
```

```python
from google import genai

client = genai.Client()
response = client.interactions.create(
    model="gemini-2.5-computer-use-preview-10-2025",
    tools=[{"type": "computer_use"}],
    input="Find a flight to Tokyo"
)
print(response.output_text)
```

```javascript
import {GoogleGenAI} from '@google/genai';

const ai = new GoogleGenAI({});
const interaction = await ai.interactions.create({
    model: 'gemini-2.5-computer-use-preview-10-2025',
    tools: [{ type: 'computer_use'}],
    input: 'Find a flight to Tokyo'
});
console.log(interaction.output_text);
```

### McpServer

#### Example

REST Python JavaScript

```sh
curl -X POST https://generativelanguage.googleapis.com/v1beta/interactions 
  -H "x-goog-api-key: $GEMINI_API_KEY" 
  -H "Content-Type: application/json" 
  -H "Api-Revision: 2026-05-20" 
  -d '{
    "model": "gemini-3-flash-preview",
    "tools": [{
      "type": "mcp_server",
      "name": "weather_service",
      "url": "https://gemini-api-demos.uc.r.appspot.com/mcp"
    }],
    "input": "Today is 12-05-2025, what is the temperature today in London?"
  }'
```

```python
from google import genai

client = genai.Client()
response = client.interactions.create(
    model="gemini-3-flash-preview",
    tools=[{
        "type": "mcp_server",
        "name": "weather_service",
        "url": "https://gemini-api-demos.uc.r.appspot.com/mcp"
    }],
    input="Today is 12-05-2025, what is the temperature today in London?"
)
print(response.output_text)
```

```javascript
import {GoogleGenAI} from '@google/genai';

const ai = new GoogleGenAI({});
const interaction = await ai.interactions.create({
    model: 'gemini-3-flash-preview',
    tools: [{
        type: 'mcp_server',
        name: 'weather_service',
        url: 'https://gemini-api-demos.uc.r.appspot.com/mcp'
    }],
    input: 'Today is 12-05-2025, what is the temperature today in London?'
});
console.log(interaction.output_text);
```

### GoogleSearch

#### Example

REST Python JavaScript

```sh
curl -X POST https://generativelanguage.googleapis.com/v1beta/interactions 
  -H "x-goog-api-key: $GEMINI_API_KEY" 
  -H "Content-Type: application/json" 
  -H "Api-Revision: 2026-05-20" 
  -d '{
    "model": "gemini-3-flash-preview",
    "tools": [{
      "type": "google_search"
    }],
    "input": "Who is the current president of France?"
  }'
```

```python
from google import genai

client = genai.Client()
response = client.interactions.create(
    model="gemini-3-flash-preview",
    tools=[{"type": "google_search"}],
    input="Who is the current president of France?"
)
print(response.output_text)
```

```javascript
import {GoogleGenAI} from '@google/genai';

const ai = new GoogleGenAI({});
const interaction = await ai.interactions.create({
    model: 'gemini-3-flash-preview',
    tools: [{ type: 'google_search' }],
    input: 'Who is the current president of France?'
});
console.log(interaction.output_text);
```

### FileSearch

#### Example

REST Python JavaScript

```sh
curl -X POST https://generativelanguage.googleapis.com/v1beta/interactions 
  -H "x-goog-api-key: $GEMINI_API_KEY" 
  -H "Content-Type: application/json" 
  -H "Api-Revision: 2026-05-20" 
  -d '{
    "model": "gemini-3-flash-preview",
    "tools": [{
      "type": "file_search",
      "file_search_store_names": ["fileSearchStores/m64d1sevsr4y-xfyawui3fxqg"]
    }],
    "input": "Who is the author of the book?"
  }'
```

```python
from google import genai

client = genai.Client()

# Create a file search store so we have a valid one to use.
store = client.file_search_stores.create()

response = client.interactions.create(
    model="gemini-3-flash-preview",
    tools=[{
        "type": "file_search",
        "file_search_store_names": [store.name]
    }],
    input="What documents are available?"
)
print(response.output_text)

# [cleanup]
client.file_search_stores.delete(name=store.name)
# [/cleanup]
```

```javascript
import {GoogleGenAI} from '@google/genai';

const ai = new GoogleGenAI({});

// Create a file search store so we have a valid one to use.
const store = await ai.fileSearchStores.create({});
if (!store.name) {
    throw new Error('Store creation failed: Name is undefined');
}

const interaction = await ai.interactions.create({
    model: 'gemini-3-flash-preview',
    tools: [{
        type: 'file_search',
        file_search_store_names: [store.name]
    }],
    input: 'What documents are available?'
});
console.log(interaction.output_text);

// [cleanup]
await ai.fileSearchStores.delete({name: store.name});
// [/cleanup]
```

### GoogleMaps

#### Example

REST Python JavaScript

```sh
curl -X POST https://generativelanguage.googleapis.com/v1beta/interactions 
  -H "x-goog-api-key: $GEMINI_API_KEY" 
  -H "Content-Type: application/json" 
  -H "Api-Revision: 2026-05-20" 
  -d '{
    "model": "gemini-3-flash-preview",
    "tools": [{
      "type": "google_maps",
      "latitude": 37.7749,
      "longitude": -122.4194
    }],
    "input": "What is the best food near me?"
  }'
```

```python
from google import genai

client = genai.Client()
response = client.interactions.create(
    model="gemini-3-flash-preview",
    tools=[{
        "type": "google_maps",
        "latitude": 37.7749,
        "longitude": -122.4194
    }],
    input="What is the best food near me?"
)
print(response.output_text)
```

```javascript
import {GoogleGenAI} from '@google/genai';

const ai = new GoogleGenAI({});
const interaction = await ai.interactions.create({
    model: 'gemini-3-flash-preview',
    tools: [{
        type: 'google_maps',
        latitude: 37.7749,
        longitude: -122.4194
    }],
    input: 'What is the best food near me?'
});
console.log(interaction.output_text);
```

### Retrieval

No examples available for this type.

### InteractionSseEvent

<br />

### Possible Types

Polymorphic discriminator: `event_type`
InteractionCreatedEvent <br />

event_id string (optional) The event_id token to be used to resume the interaction stream, from
this event.
event_type object (required) No description provided.

Always set to `"interaction.created"`.
interaction [Interaction](https://ai.google.dev/api/interactions-api#Resource:Interaction) (required) No description provided.
InteractionCompletedEvent <br />

event_id string (optional) The event_id token to be used to resume the interaction stream, from
this event.
event_type object (required) No description provided.

Always set to `"interaction.completed"`.
interaction [Interaction](https://ai.google.dev/api/interactions-api#Resource:Interaction) (required) Required. The completed interaction with empty outputs to reduce the payload size.
Use the preceding ContentDelta events for the actual output.
InteractionStatusUpdate <br />

event_id string (optional) The event_id token to be used to resume the interaction stream, from
this event.
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
- `budget_exceeded`
ErrorEvent <br />

error Error (optional) No description provided.
Error message from an interaction.

#### Fields

code string (optional) A URI that identifies the error type.
message string (optional) A human-readable error message.
event_id string (optional) The event_id token to be used to resume the interaction stream, from
this event.
event_type object (required) No description provided.

Always set to `"error"`.
StepStart <br />

event_id string (optional) The event_id token to be used to resume the interaction stream, from
this event.
event_type object (required) No description provided.

Always set to `"step.start"`.
index integer (required) No description provided.
step [Step](https://ai.google.dev/api/interactions-api#Resource:Step) (required) No description provided.
StepDelta <br />

delta StepDeltaData (required) No description provided.
<br />

#### Possible Types

Polymorphic discriminator: `type`
TextDelta <br />

text string (required) No description provided.
type object (required) No description provided.

Always set to `"text"`.
ImageDelta <br />

data string (optional) No description provided.
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

type object (required) No description provided.

Always set to `"image"`.
uri string (optional) No description provided.
AudioDelta <br />

channels integer (optional) The number of audio channels.
data string (optional) No description provided.
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
rate integer (optional) Deprecated. Use sample_rate instead. The value is ignored.
sample_rate integer (optional) The sample rate of the audio.
type object (required) No description provided.

Always set to `"audio"`.
uri string (optional) No description provided.
DocumentDelta <br />

data string (optional) No description provided.
mime_type enum (string) (optional) No description provided.

Possible
values:

- `application/pdf`
type object (required) No description provided.

Always set to `"document"`.
uri string (optional) No description provided.
VideoDelta <br />

data string (optional) No description provided.
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

type object (required) No description provided.

Always set to `"video"`.
uri string (optional) No description provided.
ThoughtSummaryDelta <br />

content ThoughtSummaryContent (optional) A new summary item to be added to the thought.
<br />

#### Possible Types

Polymorphic discriminator: `type`
TextContent A text content block.
annotations Annotation (optional) Citation information for model-generated content.
Citation information for model-generated content.

#### Possible Types

Polymorphic discriminator: `type`
UrlCitation A URL citation annotation.
end_index integer (optional) End of the attributed segment, exclusive.
start_index integer (optional) Start of segment of the response that is attributed to this source.

Index indicates the start of the segment, measured in bytes.
title string (optional) The title of the URL.
type object (required) No description provided.

Always set to `"url_citation"`.
url string (optional) The URL.
FileCitation A file citation annotation.
custom_metadata object (optional) User provided metadata about the retrieved context.
document_uri string (optional) The URI of the file.
end_index integer (optional) End of the attributed segment, exclusive.
file_name string (optional) The name of the file.
media_id string (optional) Media ID in-case of image citations, if applicable.
page_number integer (optional) Page number of the cited document, if applicable.
source string (optional) Source attributed for a portion of the text.
start_index integer (optional) Start of segment of the response that is attributed to this source.

Index indicates the start of the segment, measured in bytes.
type object (required) No description provided.

Always set to `"file_citation"`.
PlaceCitation A place citation annotation.
end_index integer (optional) End of the attributed segment, exclusive.
name string (optional) Title of the place.
place_id string (optional) The ID of the place, in \`places/{place_id}\` format.
review_snippets ReviewSnippet (optional) Snippets of reviews that are used to generate answers about the
features of a given place in Google Maps.
Encapsulates a snippet of a user review that answers a question about
the features of a specific place in Google Maps.

#### Fields

review_id string (optional) The ID of the review snippet.
title string (optional) Title of the review.
url string (optional) A link that corresponds to the user review on Google Maps.
start_index integer (optional) Start of segment of the response that is attributed to this source.

Index indicates the start of the segment, measured in bytes.
type object (required) No description provided.

Always set to `"place_citation"`.
url string (optional) URI reference of the place.
text string (required) Required. The text content.
type object (required) No description provided.

Always set to `"text"`.
ImageContent An image content block.
data string (optional) The image content.
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

type object (required) No description provided.

Always set to `"image"`.
uri string (optional) The URI of the image.
type object (required) No description provided.

Always set to `"thought_summary"`.
ThoughtSignatureDelta <br />

signature string (optional) Signature to match the backend source to be part of the generation.
type object (required) No description provided.

Always set to `"thought_signature"`.
TextAnnotationDelta <br />

annotations Annotation (optional) Citation information for model-generated content.
Citation information for model-generated content.

#### Possible Types

Polymorphic discriminator: `type`
UrlCitation A URL citation annotation.
end_index integer (optional) End of the attributed segment, exclusive.
start_index integer (optional) Start of segment of the response that is attributed to this source.

Index indicates the start of the segment, measured in bytes.
title string (optional) The title of the URL.
type object (required) No description provided.

Always set to `"url_citation"`.
url string (optional) The URL.
FileCitation A file citation annotation.
custom_metadata object (optional) User provided metadata about the retrieved context.
document_uri string (optional) The URI of the file.
end_index integer (optional) End of the attributed segment, exclusive.
file_name string (optional) The name of the file.
media_id string (optional) Media ID in-case of image citations, if applicable.
page_number integer (optional) Page number of the cited document, if applicable.
source string (optional) Source attributed for a portion of the text.
start_index integer (optional) Start of segment of the response that is attributed to this source.

Index indicates the start of the segment, measured in bytes.
type object (required) No description provided.

Always set to `"file_citation"`.
PlaceCitation A place citation annotation.
end_index integer (optional) End of the attributed segment, exclusive.
name string (optional) Title of the place.
place_id string (optional) The ID of the place, in \`places/{place_id}\` format.
review_snippets ReviewSnippet (optional) Snippets of reviews that are used to generate answers about the
features of a given place in Google Maps.
Encapsulates a snippet of a user review that answers a question about
the features of a specific place in Google Maps.

#### Fields

review_id string (optional) The ID of the review snippet.
title string (optional) Title of the review.
url string (optional) A link that corresponds to the user review on Google Maps.
start_index integer (optional) Start of segment of the response that is attributed to this source.

Index indicates the start of the segment, measured in bytes.
type object (required) No description provided.

Always set to `"place_citation"`.
url string (optional) URI reference of the place.
type object (required) No description provided.

Always set to `"text_annotation_delta"`.
ArgumentsDelta <br />

arguments string (optional) No description provided.
type object (required) No description provided.

Always set to `"arguments_delta"`.
CodeExecutionCallDelta <br />

arguments CodeExecutionCallArguments (required) No description provided.
The arguments to pass to the code execution.

#### Fields

code string (optional) The code to be executed.
language enum (string) (optional) Programming language of the \`code\`.

Possible
values:

- `python`
signature string (optional) A signature hash for backend validation.
type object (required) No description provided.

Always set to `"code_execution_call"`.
UrlContextCallDelta <br />

arguments UrlContextCallArguments (required) No description provided.
The arguments to pass to the URL context.

#### Fields

urls array (string) (optional) The URLs to fetch.
signature string (optional) A signature hash for backend validation.
type object (required) No description provided.

Always set to `"url_context_call"`.
GoogleSearchCallDelta <br />

arguments GoogleSearchCallArguments (required) No description provided.
The arguments to pass to Google Search.

#### Fields

queries array (string) (optional) Web search queries for the following-up web search.
signature string (optional) A signature hash for backend validation.
type object (required) No description provided.

Always set to `"google_search_call"`.
McpServerToolCallDelta <br />

arguments object (required) No description provided.
name string (required) No description provided.
server_name string (required) No description provided.
signature string (optional) A signature hash for backend validation.
type object (required) No description provided.

Always set to `"mcp_server_tool_call"`.
FileSearchCallDelta <br />

signature string (optional) A signature hash for backend validation.
type object (required) No description provided.

Always set to `"file_search_call"`.
GoogleMapsCallDelta <br />

arguments GoogleMapsCallArguments (optional) The arguments to pass to the Google Maps tool.
The arguments to pass to the Google Maps tool.

#### Fields

queries array (string) (optional) The queries to be executed.
signature string (optional) A signature hash for backend validation.
type object (required) No description provided.

Always set to `"google_maps_call"`.
CodeExecutionResultDelta <br />

is_error boolean (optional) No description provided.
result string (required) No description provided.
signature string (optional) A signature hash for backend validation.
type object (required) No description provided.

Always set to `"code_execution_result"`.
UrlContextResultDelta <br />

is_error boolean (optional) No description provided.
result UrlContextResult (required) No description provided.
The result of the URL context.

#### Fields

status enum (string) (optional) The status of the URL retrieval.

Possible
values:

- `success`
- `error`
- `paywall`
- `unsafe`
url string (optional) The URL that was fetched.
signature string (optional) A signature hash for backend validation.
type object (required) No description provided.

Always set to `"url_context_result"`.
GoogleSearchResultDelta <br />

is_error boolean (optional) No description provided.
result GoogleSearchResult (required) No description provided.
The result of the Google Search.

#### Fields

search_suggestions string (optional) Web content snippet that can be embedded in a web page or an app webview.
signature string (optional) A signature hash for backend validation.
type object (required) No description provided.

Always set to `"google_search_result"`.
McpServerToolResultDelta <br />

name string (optional) No description provided.
result array ([FunctionResultSubcontent](https://ai.google.dev/api/interactions-api#Resource:FunctionResultSubcontent)) or string (required) No description provided.
server_name string (optional) No description provided.
signature string (optional) A signature hash for backend validation.
type object (required) No description provided.

Always set to `"mcp_server_tool_result"`.
FileSearchResultDelta <br />

result FileSearchResult (required) No description provided.
The result of the File Search.
signature string (optional) A signature hash for backend validation.
type object (required) No description provided.

Always set to `"file_search_result"`.
GoogleMapsResultDelta <br />

result GoogleMapsResult (optional) The results of the Google Maps.
The result of the Google Maps.

#### Fields

places Places (optional) The places that were found.
<br />

#### Fields

name string (optional) Title of the place.
place_id string (optional) The ID of the place, in \`places/{place_id}\` format.
review_snippets ReviewSnippet (optional) Snippets of reviews that are used to generate answers about the
features of a given place in Google Maps.
Encapsulates a snippet of a user review that answers a question about
the features of a specific place in Google Maps.

#### Fields

review_id string (optional) The ID of the review snippet.
title string (optional) Title of the review.
url string (optional) A link that corresponds to the user review on Google Maps.
url string (optional) URI reference of the place.
widget_context_token string (optional) Resource name of the Google Maps widget context token.
signature string (optional) A signature hash for backend validation.
type object (required) No description provided.

Always set to `"google_maps_result"`.
FunctionResultDelta <br />

call_id string (required) Required. ID to match the ID from the function call block.
is_error boolean (optional) No description provided.
name string (optional) No description provided.
result array ([FunctionResultSubcontent](https://ai.google.dev/api/interactions-api#Resource:FunctionResultSubcontent)) or string (required) No description provided.
type object (required) No description provided.

Always set to `"function_result"`.
event_id string (optional) The event_id token to be used to resume the interaction stream, from
this event.
event_type object (required) No description provided.

Always set to `"step.delta"`.
index integer (required) No description provided.
StepStop <br />

event_id string (optional) The event_id token to be used to resume the interaction stream, from
this event.
event_type object (required) No description provided.

Always set to `"step.stop"`.
index integer (required) No description provided.

### Examples

### Interaction Created

```json
{
  "event_type": "interaction.created",
  "interaction": {
    "id": "v1_ChdXS0l4YWZXTk9xbk0xZThQczhEcmlROBIXV0tJeGFmV05PcW5NMWU4UHM4RHJpUTg",
    "model": "gemini-3-flash-preview",
    "status": "in_progress",
    "created": "2025-12-04T15:01:45Z",
    "updated": "2025-12-04T15:01:45Z"
  },
  "event_id": "evt_123"
}
```

### Interaction Completed

```json
{
  "event_type": "interaction.completed",
  "interaction": {
    "id": "v1_ChdXS0l4YWZXTk9xbk0xZThQczhEcmlROBIXV0tJeGFmV05PcW5NMWU4UHM4RHJpUTg",
    "model": "gemini-3-flash-preview",
    "status": "completed",
    "created": "2025-12-04T15:01:45Z",
    "updated": "2025-12-04T15:01:45Z"
  },
  "event_id": "evt_123"
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

### Step Start

```json
{
  "event_type": "step.start",
  "index": 0,
  "step": {
    "type": "model_output"
  }
}
```

### Step Delta

```json
{
  "event_type": "step.delta",
  "index": 0,
  "delta": {
    "type": "text",
    "text": "Hello"
  }
}
```

### Step Stop

```json
{
  "event_type": "step.stop",
  "index": 0
}
```

### ResponseFormat

<br />

### Possible Types

AudioResponseFormat Configuration for audio output format.
bit_rate integer (optional) Bit rate in bits per second (bps). Only applicable for compressed formats
(MP3, Opus).
delivery enum (string) (optional) The delivery mode for the audio output.

Possible
values:

- `inline`
- `uri`
mime_type enum (string) (optional) The MIME type of the audio output.

Possible
values:

- `audio/mp3`
- `audio/ogg_opus`
- `audio/l16`
- `audio/wav`
- `audio/alaw`
- `audio/mulaw`
sample_rate integer (optional) Sample rate in Hz.
type object (required) No description provided.

Always set to `"audio"`.
TextResponseFormat Configuration for text output format.
mime_type enum (string) (optional) The MIME type of the text output.

Possible
values:

- `application/json`
- `text/plain`
schema object (optional) The JSON schema that the output should conform to. Only applicable when
mime_type is application/json.
type object (required) No description provided.

Always set to `"text"`.
ImageResponseFormat Configuration for image output format.
aspect_ratio enum (string) (optional) The aspect ratio for the image output.

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
delivery enum (string) (optional) The delivery mode for the image output.

Possible
values:

- `inline`
- `uri`
image_size enum (string) (optional) The size of the image output.

Possible
values:

- `512`
- `1K`
- `2K`
- `4K`
mime_type enum (string) (optional) The MIME type of the image output.

Possible
values:

- `image/jpeg`
type object (required) No description provided.

Always set to `"image"`.
Option <br />

This type has no specific fields.

### Examples

### Audio Output

```json
{
  "type": "audio",
  "sample_rate": 24000
}
```

### Text Output (JSON Schema)

```json
{
  "type": "text",
  "mime_type": "application/json",
  "schema": {
    "type": "object",
    "properties": {
      "recipe_name": {
        "type": "string"
      },
      "ingredients": {
        "type": "array",
        "items": {
          "type": "string"
        }
      }
    },
    "required": [
      "recipe_name",
      "ingredients"
    ]
  }
}
```

### Image Output

```json
{
  "type": "image",
  "mime_type": "image/jpeg",
  "aspect_ratio": "16:9",
  "image_size": "1K"
}
```

### Option

No examples available for this type.

### ResponseFormatList

<br />

### Examples

### Example

```bash
[
  {
    "type": "text",
    "mime_type": "application/json"
  }
]
```

### Step

A step in the interaction.

### Possible Types

Polymorphic discriminator: `type`
UserInputStep Input provided by the user.
content array ([Content](https://ai.google.dev/api/interactions-api#Resource:Content)) (optional) No description provided.
type object (required) No description provided.

Always set to `"user_input"`.
ModelOutputStep Output generated by the model.
content array ([Content](https://ai.google.dev/api/interactions-api#Resource:Content)) (optional) No description provided.
type object (required) No description provided.

Always set to `"model_output"`.
ThoughtStep A thought step.
signature string (optional) A signature hash for backend validation.
summary ThoughtSummaryContent (optional) A summary of the thought.
<br />

#### Possible Types

Polymorphic discriminator: `type`
TextContent A text content block.
annotations Annotation (optional) Citation information for model-generated content.
Citation information for model-generated content.

#### Possible Types

Polymorphic discriminator: `type`
UrlCitation A URL citation annotation.
end_index integer (optional) End of the attributed segment, exclusive.
start_index integer (optional) Start of segment of the response that is attributed to this source.

Index indicates the start of the segment, measured in bytes.
title string (optional) The title of the URL.
type object (required) No description provided.

Always set to `"url_citation"`.
url string (optional) The URL.
FileCitation A file citation annotation.
custom_metadata object (optional) User provided metadata about the retrieved context.
document_uri string (optional) The URI of the file.
end_index integer (optional) End of the attributed segment, exclusive.
file_name string (optional) The name of the file.
media_id string (optional) Media ID in-case of image citations, if applicable.
page_number integer (optional) Page number of the cited document, if applicable.
source string (optional) Source attributed for a portion of the text.
start_index integer (optional) Start of segment of the response that is attributed to this source.

Index indicates the start of the segment, measured in bytes.
type object (required) No description provided.

Always set to `"file_citation"`.
PlaceCitation A place citation annotation.
end_index integer (optional) End of the attributed segment, exclusive.
name string (optional) Title of the place.
place_id string (optional) The ID of the place, in \`places/{place_id}\` format.
review_snippets ReviewSnippet (optional) Snippets of reviews that are used to generate answers about the
features of a given place in Google Maps.
Encapsulates a snippet of a user review that answers a question about
the features of a specific place in Google Maps.

#### Fields

review_id string (optional) The ID of the review snippet.
title string (optional) Title of the review.
url string (optional) A link that corresponds to the user review on Google Maps.
start_index integer (optional) Start of segment of the response that is attributed to this source.

Index indicates the start of the segment, measured in bytes.
type object (required) No description provided.

Always set to `"place_citation"`.
url string (optional) URI reference of the place.
text string (required) Required. The text content.
type object (required) No description provided.

Always set to `"text"`.
ImageContent An image content block.
data string (optional) The image content.
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

type object (required) No description provided.

Always set to `"image"`.
uri string (optional) The URI of the image.
type object (required) No description provided.

Always set to `"thought"`.
FunctionCallStep A function tool call step.
arguments object (required) Required. The arguments to pass to the function.
id string (required) Required. A unique ID for this specific tool call.
name string (required) Required. The name of the tool to call.
signature string (optional) A signature hash for backend validation.
type object (required) No description provided.

Always set to `"function_call"`.
CodeExecutionCallStep Code execution call step.
arguments CodeExecutionCallStepArguments (required) Required. The arguments to pass to the code execution.
The arguments to pass to the code execution.

#### Fields

code string (optional) The code to be executed.
language enum (string) (optional) Programming language of the \`code\`.

Possible
values:

- `python`
id string (required) Required. A unique ID for this specific tool call.
signature string (optional) A signature hash for backend validation.
type object (required) No description provided.

Always set to `"code_execution_call"`.
UrlContextCallStep URL context call step.
arguments UrlContextCallStepArguments (required) Required. The arguments to pass to the URL context.
The arguments to pass to the URL context.

#### Fields

urls array (string) (optional) The URLs to fetch.
id string (required) Required. A unique ID for this specific tool call.
signature string (optional) A signature hash for backend validation.
type object (required) No description provided.

Always set to `"url_context_call"`.
McpServerToolCallStep MCPServer tool call step.
arguments object (required) Required. The JSON object of arguments for the function.
id string (required) Required. A unique ID for this specific tool call.
name string (required) Required. The name of the tool which was called.
server_name string (required) Required. The name of the used MCP server.
signature string (optional) A signature hash for backend validation.
type object (required) No description provided.

Always set to `"mcp_server_tool_call"`.
GoogleSearchCallStep Google Search call step.
arguments GoogleSearchCallStepArguments (required) Required. The arguments to pass to Google Search.
The arguments to pass to Google Search.

#### Fields

queries array (string) (optional) Web search queries for the following-up web search.
id string (required) Required. A unique ID for this specific tool call.
search_type enum (string) (optional) The type of search grounding enabled.

Possible
values:

- `web_search`
- `image_search`
- `enterprise_web_search`
signature string (optional) A signature hash for backend validation.
type object (required) No description provided.

Always set to `"google_search_call"`.
FileSearchCallStep File Search call step.
id string (required) Required. A unique ID for this specific tool call.
signature string (optional) A signature hash for backend validation.
type object (required) No description provided.

Always set to `"file_search_call"`.
GoogleMapsCallStep Google Maps call step.
arguments GoogleMapsCallStepArguments (optional) The arguments to pass to the Google Maps tool.
The arguments to pass to the Google Maps tool.

#### Fields

queries array (string) (optional) The queries to be executed.
id string (required) Required. A unique ID for this specific tool call.
signature string (optional) A signature hash for backend validation.
type object (required) No description provided.

Always set to `"google_maps_call"`.
FunctionResultStep Result of a function tool call.
call_id string (required) Required. ID to match the ID from the function call block.
is_error boolean (optional) Whether the tool call resulted in an error.
name string (optional) The name of the tool that was called.
result array ([FunctionResultSubcontent](https://ai.google.dev/api/interactions-api#Resource:FunctionResultSubcontent)) or string (required) The result of the tool call.
signature string (optional) A signature hash for backend validation.
type object (required) No description provided.

Always set to `"function_result"`.
CodeExecutionResultStep Code execution result step.
call_id string (required) Required. ID to match the ID from the function call block.
is_error boolean (optional) Whether the code execution resulted in an error.
result string (required) Required. The output of the code execution.
signature string (optional) A signature hash for backend validation.
type object (required) No description provided.

Always set to `"code_execution_result"`.
UrlContextResultStep URL context result step.
call_id string (required) Required. ID to match the ID from the function call block.
is_error boolean (optional) Whether the URL context resulted in an error.
result UrlContextResultItem (required) Required. The results of the URL context.
The result of the URL context.

#### Fields

status enum (string) (optional) The status of the URL retrieval.

Possible
values:

- `success`
- `error`
- `paywall`
- `unsafe`
url string (optional) The URL that was fetched.
signature string (optional) A signature hash for backend validation.
type object (required) No description provided.

Always set to `"url_context_result"`.
GoogleSearchResultStep Google Search result step.
call_id string (required) Required. ID to match the ID from the function call block.
is_error boolean (optional) Whether the Google Search resulted in an error.
result GoogleSearchResultItem (required) Required. The results of the Google Search.
The result of the Google Search.

#### Fields

search_suggestions string (optional) Web content snippet that can be embedded in a web page or an app webview.
signature string (optional) A signature hash for backend validation.
type object (required) No description provided.

Always set to `"google_search_result"`.
McpServerToolResultStep MCPServer tool result step.
call_id string (required) Required. ID to match the ID from the function call block.
name string (optional) Name of the tool which is called for this specific tool call.
result array ([FunctionResultSubcontent](https://ai.google.dev/api/interactions-api#Resource:FunctionResultSubcontent)) or string (required) The output from the MCP server call. Can be simple text or rich content.
server_name string (optional) The name of the used MCP server.
signature string (optional) A signature hash for backend validation.
type object (required) No description provided.

Always set to `"mcp_server_tool_result"`.
FileSearchResultStep File Search result step.
call_id string (required) Required. ID to match the ID from the function call block.
signature string (optional) A signature hash for backend validation.
type object (required) No description provided.

Always set to `"file_search_result"`.
GoogleMapsResultStep Google Maps result step.
call_id string (required) Required. ID to match the ID from the function call block.
result GoogleMapsResultItem (required) No description provided.
The result of the Google Maps.

#### Fields

places GoogleMapsResultPlaces (optional) No description provided.
<br />

#### Fields

name string (optional) No description provided.
place_id string (optional) No description provided.
review_snippets ReviewSnippet (optional) No description provided.
Encapsulates a snippet of a user review that answers a question about
the features of a specific place in Google Maps.

#### Fields

review_id string (optional) The ID of the review snippet.
title string (optional) Title of the review.
url string (optional) A link that corresponds to the user review on Google Maps.
url string (optional) No description provided.
widget_context_token string (optional) No description provided.
signature string (optional) A signature hash for backend validation.
type object (required) No description provided.

Always set to `"google_maps_result"`.

### Examples

### UserInputStep

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

### ModelOutputStep

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

### ThoughtStep

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

### FunctionCallStep

```json
{
  "type": "function_call",
  "id": "call_98231",
  "name": "get_weather",
  "arguments": {
    "location": "Boston, MA"
  }
}
```

### CodeExecutionCallStep

```json
{
  "type": "code_execution_call",
  "id": "code_call_71021",
  "arguments": {
    "code": "print(sum(range(1, 11)))"
  }
}
```

### UrlContextCallStep

```json
{
  "type": "url_context_call",
  "id": "url_call_10219",
  "arguments": {
    "urls": [
      "https://www.example.com"
    ]
  }
}
```

### McpServerToolCallStep

```json
{
  "type": "mcp_server_tool_call",
  "id": "mcp_call_29012",
  "name": "calculate_tax",
  "server_name": "financial_mcp_server",
  "arguments": {
    "income": 120000,
    "state": "CA"
  }
}
```

### GoogleSearchCallStep

```json
{
  "type": "google_search_call",
  "id": "search_call_19201",
  "arguments": {
    "query": "Who won the men's 100m in Paris 2024?"
  }
}
```

### FileSearchCallStep

```json
{
  "type": "file_search_call",
  "id": "file_call_88192"
}
```

### GoogleMapsCallStep

```json
{
  "type": "google_maps_call",
  "id": "maps_call_39201",
  "arguments": {
    "latitude": 37.7749,
    "longitude": -122.4194
  }
}
```

### FunctionResultStep

```json
{
  "type": "function_result",
  "call_id": "call_98231",
  "name": "get_weather",
  "result": {
    "temperature": "72F",
    "conditions": "Partly Cloudy"
  }
}
```

### CodeExecutionResultStep

```json
{
  "type": "code_execution_result",
  "call_id": "code_call_71021",
  "result": "55\n"
}
```

### UrlContextResultStep

```json
{
  "type": "url_context_result",
  "call_id": "url_call_10219",
  "result": [
    {
      "url": "https://www.example.com",
      "title": "Example Domain",
      "snippet": "This domain is for use in illustrative examples in documents."
    }
  ]
}
```

### GoogleSearchResultStep

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

### McpServerToolResultStep

```json
{
  "type": "mcp_server_tool_result",
  "call_id": "mcp_call_29012",
  "result": {
    "tax_due": 32400
  }
}
```

### FileSearchResultStep

```json
{
  "type": "file_search_result",
  "call_id": "file_call_88192"
}
```

### GoogleMapsResultStep

```json
{
  "type": "google_maps_result",
  "call_id": "maps_call_39201",
  "result": [
    {
      "place_id": "ChIJIQBpAG2ahYAR9R7bNdTLg8M",
      "name": "Golden Gate Park",
      "rating": 4.8
    }
  ]
}
```

### EnvironmentConfig

Configuration for a custom environment.

#### Fields

network [EnvironmentNetworkEgressAllowlist](https://ai.google.dev/api/interactions-api#Resource:EnvironmentNetworkEgressAllowlist) or enum (string) (optional) Network configuration for the environment.
sources Source (optional) No description provided.
A source to be mounted into the environment.

#### Fields

content string (optional) The inline content if \`type\` is \`INLINE\`.
encoding string (optional) Optional encoding for inline content (e.g. \`base64\`).
source string (optional) The source of the environment.
For GCS, this is the GCS path.
For GitHub, this is the GitHub path.
target string (optional) Where the source should appear in the environment.
type enum (string) (optional) No description provided.

Possible
values:

- `gcs`
- `inline`
- `repository`
- `skill_registry`
type object (optional) No description provided.

Always set to `"remote"`.

### Examples

### Inline Sources

```bash
{
  "type": "remote",
  "sources": [
    {
      "type": "inline",
      "target": ".agents/AGENTS.md",
      "content": "You are a data analyst. Always include visualizations and export results as PDF."
    },
    {
      "type": "inline",
      "target": ".agents/skills/slide-maker/SKILL.md",
      "content": "---\nname: slide-maker\ndescription: Create HTML slide decks\n---\n# Slide Maker\n\nWhen asked to create a presentation:\n1. Analyze the input data\n2. Create an HTML slide deck with reveal.js\n3. Save to /workspace/output/slides.html"
    }
  ]
}
```

### External Sources

```bash
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

### Network Allowlist

```bash
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

### Proxy Credentials

```bash
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
