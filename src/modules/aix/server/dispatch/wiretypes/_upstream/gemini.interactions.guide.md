<!--
  Upstream snapshot - DO NOT EDIT - run _upstream/sync.sh to refresh
  Source: https://ai.google.dev/gemini-api/docs/interactions.md.txt
  Synced: 2026-06-03
  Consumed by: gemini.interactions.wiretypes.ts, gemini.interactions.parser.ts, gemini.interactionsCreate.ts, gemini.interactionsPoller.ts
  Companion: ./gemini.interactions.spec.md (the Interactions API reference spec), ./gemini.deep-research.guide.md (the Deep Research agent guide)
-->

# Interactions API

> [!IMPORTANT]
> The Interactions API is currently in Beta. Features and schemas are subject to [breaking changes](https://ai.google.dev/gemini-api/docs/interactions-breaking-changes-may-2026).
>
> If you are migrating from the `generateContent` API, see the [Migration Guide](https://ai.google.dev/gemini-api/docs/migrate-to-interactions).

The Interactions API is the new standard for building with Gemini, recommended for all new projects. It is optimized for agentic workflows, server-side state management, and complex multi-modal, multi-turn conversations. The original [`generateContent`](https://ai.google.dev/gemini-api/docs/interactions/text-generation) API remains fully supported.

## Why use the Interactions API?

- **Server-side history management** : Simplified multi-turn flows via `previous_interaction_id`. The server enables state by default (`store=true`), but you can opt into stateless behavior by setting `store=false`.
- **Observable execution steps**: Typed steps make it easy to debug complex flows and render UI for intermediate events (like thoughts or search widgets).
- **Built for agentic workflows**: Native support for multi-step tool use, orchestration, and complex reasoning flows through typed execution steps.
- **Long-running and background tasks** : Supports offloading time-intensive operations like [Deep Think](https://ai.google.dev/gemini-api/docs/interactions/thinking) and [Deep Research](https://ai.google.dev/gemini-api/docs/interactions/deep-research) to background processes using `background=true`.
- **Access to new models and capabilities**: Going forward, new models beyond the core mainline family, along with new agentic capabilities and tools, will launch exclusively on the Interactions API.

**Use the Interactions API** if you're starting a new project, building agentic applications, or need server-side conversation management. **Use [`generateContent`](https://ai.google.dev/gemini-api/docs/interactions/text-generation)** if you have an existing integration that works for your needs, or if you require a feature that is [not yet available](https://ai.google.dev/gemini-api/docs/interactions#limitations) in the Interactions API, such as the Batch API or explicit caching.

## Get started

- **Set up your coding agent** : Connect to the **Gemini Docs MCP** and install the `gemini-interactions-api` skill to give your assistant direct access to the latest developer docs and best practices. [Set up your coding agent →](https://ai.google.dev/gemini-api/docs/coding-agents)
- **Migrate from `generateContent`** : If you have an existing integration, follow the [Migration Guide](https://ai.google.dev/gemini-api/docs/migrate-to-interactions) to transition to the Interactions API.
- **Try the quickstart** : Get started with a minimal working example in the [Interactions API quickstart](https://ai.google.dev/gemini-api/docs/interactions/quickstart).

### Feature Guides

Explore the specific capabilities of the Interactions API through these guides. You can use the toggle on these pages to switch between generateContent and Interactions API:

- [Text generation](https://ai.google.dev/gemini-api/docs/interactions/text-generation)
- [Image generation](https://ai.google.dev/gemini-api/docs/interactions/image-generation)
- [Image understanding](https://ai.google.dev/gemini-api/docs/interactions/image-understanding)
- [Audio understanding](https://ai.google.dev/gemini-api/docs/interactions/audio)
- [Video understanding](https://ai.google.dev/gemini-api/docs/interactions/video-understanding)
- [Document processing](https://ai.google.dev/gemini-api/docs/interactions/document-processing)
- [Function calling](https://ai.google.dev/gemini-api/docs/interactions/function-calling)
- [Structured output](https://ai.google.dev/gemini-api/docs/interactions/structured-output)
- [Deep Research Agent](https://ai.google.dev/gemini-api/docs/interactions/deep-research)
- [Flex inference](https://ai.google.dev/gemini-api/docs/interactions/flex-inference)
- [Priority inference](https://ai.google.dev/gemini-api/docs/interactions/priority-inference)
- [Streaming](https://ai.google.dev/gemini-api/docs/interactions/streaming)

## How the Interactions API works

The Interactions API centers around a core resource: the [**`Interaction`**](https://ai.google.dev/api/interactions-api#Resource:Interaction). An `Interaction` represents a complete turn in a conversation or task. It acts as a session record, containing the entire history of an interaction as a chronological sequence of **execution steps** . These steps include model thoughts, server-side or client-side tool calls and results (like `function_call` and `function_result`), and the final `model_output`. The stored resource (retrieved via `interactions.get`) also includes `user_input` steps for full context, though the `interactions.create` response only returns model-generated steps.

When you make a call to
[`interactions.create`](https://ai.google.dev/api/interactions-api#CreateInteraction), you are
creating a new `Interaction` resource.

### Access outputs with SDK convenience properties

While the Interactions API returns a structured timeline of execution steps
(such as thoughts, search queries, and function calls), you don't need to
manually traverse the steps to get the final model response.

The Google GenAI SDKs provide convenience properties directly
on the returned `Interaction` object to access the outputs for different
modalities:

| SDK convenience property | Return Type | Description |
|---|---|---|
| **`interaction.output_text`** | String | Returns the last text blocks in the model's response. If the response is split across multiple consecutive `TextContent` blocks, it automatically joins them. It does not include earlier text blocks separated by non-text content (such as thoughts, images, audio, or tool calls). For complex or interleaved multimodal responses, you must manually iterate over `steps` instead. |
| **`interaction.output_image`** | ImageContent or `None` | Returns the last image block generated by the model in the current request. |
| **`interaction.output_audio`** | AudioContent or `None` | Returns the last audio block generated by the model in the current request. |

For advanced use cases---such as rendering intermediate thinking processes,
inspecting step-by-step tool calls, or debugging---you can still inspect and
traverse the raw `interaction.steps` timeline manually.

### Server-side state management

You can use the `id` of a completed interaction in a subsequent call using the
`previous_interaction_id` parameter to continue the conversation. The server
uses this ID to retrieve the conversation history, saving you from having to
resend the entire chat history.

The `previous_interaction_id` parameter preserves only the conversation history (inputs and outputs)
using `previous_interaction_id`. The other parameters are **interaction-scoped**
and apply only to the specific interaction you are currently generating:

- `tools`
- `system_instruction`
- `generation_config` (including `thinking_level`, `temperature`, etc.)

This means you must re-specify these parameters in each new interaction if you
want them to apply. This server-side state management is optional; you can also
operate in stateless mode by sending the full conversation history in each
request.

### Data storage and retention

By default, the API stores all Interaction objects (`store=true`) in order to
simplify use of server-side state management features (with
`previous_interaction_id`), background execution (using `background=true`) and
observability purposes.

- **Paid Tier** : The system retains interactions for **55 days**.
- **Free Tier** : The system retains interactions for **1 day**.

If you don't want this, you can
set `store=false` in your request. This control is separate from state
management; you can opt out of storage for any interaction. However, note that
`store=false` is incompatible with `background=true` and prevents using
`previous_interaction_id` for subsequent turns.

You can delete stored interactions at any time using the delete method found in
the [API Reference](https://ai.google.dev/api/interactions-api). You can only delete interactions if
you know the interaction ID.

After the retention period expires, your data will be
deleted automatically.

The system processes Interaction objects according to the [terms](https://ai.google.dev/gemini-api/terms).

## Best practices

- **Cache hit rate** : Using `previous_interaction_id` to continue conversations allows the system to more easily utilize implicit caching for the conversation history, which improves performance and reduces costs.
- **Mixing interactions** : You have the flexibility to mix and match Agent and Model interactions within a conversation. For example, you can use a specialized agent, like the Deep Research agent, for initial data collection, and then use a standard Gemini model for follow-up tasks such as summarizing or reformatting, linking these steps with the `previous_interaction_id`.

## Supported models \& agents

| Model Name | Type | Model ID |
|---|---|---|
| Gemini 3.5 Flash | Model | `gemini-3.5-flash` |
| Gemini 3.1 Flash-Lite | Model | `gemini-3.1-flash-lite` |
| Gemini 3.1 Flash-Lite Preview | Model | `gemini-3.1-flash-lite-preview` |
| Gemini 3.1 Pro Preview | Model | `gemini-3.1-pro-preview` |
| Gemini 3 Flash Preview | Model | `gemini-3-flash-preview` |
| Gemini 2.5 Pro | Model | `gemini-2.5-pro` |
| Gemini 2.5 Flash | Model | `gemini-2.5-flash` |
| Gemini 2.5 Flash-lite | Model | `gemini-2.5-flash-lite` |
| Lyria 3 Clip Preview | Model | `lyria-3-clip-preview` |
| Lyria 3 Pro Preview | Model | `lyria-3-pro-preview` |
| Deep Research Preview | Agent | `deep-research-pro-preview-12-2025` |
| Deep Research Preview | Agent | `deep-research-preview-04-2026` |
| Deep Research Preview | Agent | `deep-research-max-preview-04-2026` |

## SDKs

You can use latest version of the Google GenAI SDKs in order to access
Interactions API.

- On Python, this is `google-genai` package from `1.55.0` version onwards.
- On JavaScript, this is `@google/genai` package from `1.33.0` version onwards.

You can learn more about how to install the SDKs on
[Libraries](https://ai.google.dev/gemini-api/docs/libraries) page.

## Limitations

- **Beta status**: The Interactions API is in beta/preview. Features and schemas may change.
- **Remote MCP**: Gemini 3 does not support remote MCP, this is coming soon.

The following features are supported by the
[`generateContent`](https://ai.google.dev/gemini-api/docs/interactions/text-generation) API but are **not yet
available** in the Interactions API:

- **[Video metadata](https://ai.google.dev/gemini-api/docs/interactions/video-understanding)** : The `video_metadata` field, used to set clipping intervals and custom frame rates for video understanding.
- **[Batch API](https://ai.google.dev/gemini-api/docs/batch-api)**
- **[Automatic function calling (Python)](https://ai.google.dev/gemini-api/docs/function-calling?example=meeting#automatic_function_calling_python_only)**
- **[Explicit caching](https://ai.google.dev/gemini-api/docs/interactions/caching)** : Note that server-side implicit caching is available in the Interactions API via `previous_interaction_id`.

## Breaking changes

The Interactions API is currently in an early beta stage. We are actively
developing and refining the API capabilities, resource schemas, and SDK
interfaces based on real-world usage and developer feedback. As a result, **breaking changes may occur**.

Existing breaking changes:

- **Steps schema**: A new steps array replaces the outputs array, providing a structured timeline of each interaction turn.

To learn about the most recent breaking change and understand how to migrate, see [Breaking changes migration guide (May 2026)](https://ai.google.dev/gemini-api/docs/interactions-breaking-changes-may-2026).

Other potential updates may include changes to schemas for input and output, SDK method signatures and object structures, specific feature behaviors.

For production workloads, you should continue to use the standard
[`generateContent`](https://ai.google.dev/gemini-api/docs/interactions/text-generation) API. It remains the
recommended path for stable deployments, and we will continue to actively develop and maintain it.

## Feedback

Your feedback is critical to the development of the Interactions API.
Share your thoughts, report bugs, or request features on our
[Google AI Developer Community Forum](https://discuss.ai.google.dev/c/gemini-api/4).

## What's next

- Try the [Interactions API quickstart notebook](https://colab.sandbox.google.com/github/google-gemini/cookbook/blob/main/quickstarts/Get_started_interactions_api.ipynb).
- Learn about [Streaming interactions](https://ai.google.dev/gemini-api/docs/interactions/streaming) for real-time response handling.
- Learn more about the [Gemini Deep Research Agent](https://ai.google.dev/gemini-api/docs/interactions/deep-research).
