<!--
  Upstream snapshot - DO NOT EDIT - run _upstream/sync.sh to refresh
  Source: https://ai.google.dev/gemini-api/docs/interactions-breaking-changes-may-2026.md.txt
  Synced: 2026-06-02
  Consumed by: gemini.interactions.wiretypes.ts, gemini.interactions.parser.ts, gemini.interactionsCreate.ts
  Companion: ./gemini.interactions.spec.md, ./gemini.interactions.guide.md, ./gemini.deep-research.guide.md
-->

> [!CAUTION]
> **Breaking changes** : The changes described in this guide are
> breaking changes to the Interactions API. The legacy schema will be
> removed on **June 8, 2026** . Use the
> `Api-Revision` request header to
> [manage your migration](https://ai.google.dev/gemini-api/docs/interactions-breaking-changes-may-2026#how-to-migrate).

The `v1beta` Interactions API is introducing breaking changes that restructure the
API shape to support future capabilities like mid-flight steering and
asynchronous tool calls. This page explains what's changing and provides
before-and-after code examples to help you migrate. There are two categories
of changes:

1. [**Steps schema**](https://ai.google.dev/gemini-api/docs/interactions-breaking-changes-may-2026#steps-schema): A new `steps` array replaces the `outputs` array, providing a structured timeline of each interaction turn.
2. [**Output format configuration**](https://ai.google.dev/gemini-api/docs/interactions-breaking-changes-may-2026#output-format-config): A new polymorphic `response_format` consolidates all output format controls and removes `response_mime_type`.

Follow the steps in [How to migrate to the new schema](https://ai.google.dev/gemini-api/docs/interactions-breaking-changes-may-2026#how-to-migrate) to
update your integration.

> [!NOTE]
> **Automate this migration with a coding agent.** If you use
> a coding agent that supports skills (like Gemini CLI or Jules), install the
> [Gemini
> Interactions API skill](https://ai.google.dev/gemini-api/docs/coding-agents#gemini-interactions-api) and run:
>
> ```
> /gemini-interactions-api migrate my app to the new steps schema
> ```
>
> The skill applies the breaking changes described in this
> guide.

## Core change: `outputs` to `steps`

The new schema replaces the `outputs` array with a `steps` array.

- **Legacy** : Responses returned a flat `outputs` array containing only the model's generated content.
- **New schema** : Responses return a `steps` array containing structured steps with type discriminators.

`POST /interactions` returns only output steps. `GET /interactions/{id}`
returns the full step timeline, including the initial `user_input` step.

### Basic input/output (unary)

#### Before (legacy)

### Python

    # Request
    interaction = client.interactions.create(
        model="gemini-3.5-flash", input="Tell me a joke."
    )

    # Response access
    print(interaction.outputs[-1].text)

### JavaScript

    // Request
    const interaction = await client.interactions.create({
        model: 'gemini-3.5-flash',
        input: 'Tell me a joke.'
    });

    // Response access
    console.log(interaction.outputs[-1].text);

### REST

    curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions?key=$GEMINI_API_KEY" \
      -H "Content-Type: application/json" \
      -d '{
        "model": "gemini-3.5-flash",
        "input": "Tell me a joke."
      }'

    // Response
    {
      "id": "int_123",
      "role": "model",
      "outputs": \[
    {
    "type": "text",
    "text": "Why did the chicken cross the road?"
    }
    \]
    }

#### After (new schema)

### Python

    # Request
    interaction = client.interactions.create(
        model="gemini-3.5-flash", input="Tell me a joke."
    )

    # Response access (Recommended sugar)
    print(interaction.output_text)

### JavaScript

    // Request
    const interaction = await client.interactions.create({
        model: 'gemini-3.5-flash',
        input: 'Tell me a joke.'
    });

    // Response access (Recommended sugar)
    console.log(interaction.output_text);

> [!NOTE]
> **Note:** For details on SDK convenience properties (including `.output_text`, `.output_image`, and `.output_audio`), see \[Access outputs with SDK convenience properties\]\[sdk-convenience\] in the overview.

\[sdk-convenience\]: /gemini-api/docs/interactions#convenience-properties

### REST

    # Opt-in needed before May 26th
    curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions?key=$GEMINI_API_KEY" \
      -H "Content-Type: application/json" \
      -H "Api-Revision: 2026-05-20" \\
      -d '{
        "model": "gemini-3.5-flash",
        "input": "Tell me a joke."
      }'

    // POST Response
    {
      "id": "int_123",
      "steps": \[
    {
    "type": "model_output",
    "content": \[
    {
    "type": "text",
    "text": "Why did the chicken cross the road?"
    }
    \]
    }
    \]
    }

    // GET /v1beta/interactions/int_123 (returns full timeline including input)
    {
      "id": "int_123",
      "steps": [
        {
          "type": "user_input",
          "content": [
            { "type": "text", "text": "Tell me a joke." }
          ]
        },
        {
          "type": "model_output",
          "content": [
            {
              "type": "text",
              "text": "Why did the chicken cross the road?"
            }
          ]
        }
      ]
    }

### Function calling

The request structure remains unchanged, but the response replaces the flat
`outputs` content with structured steps.

#### Before (legacy)

### Python

    # Accessing function call in legacy schema
    for output in interaction.outputs:
        if output.type == "function_call":
            print(f"Calling {output.name} with {output.arguments}")

### JavaScript

    // Accessing function call in legacy schema
    for (const output of interaction.outputs) {
        if (output.type === 'function_call') {
            console.log(`Calling {output.name} with {JSON.stringify(output.arguments)}`);
        }
    }

### REST

    // Response
    {
      "id": "int_001",
      "role": "model",
      "status": "requires_action",
      "outputs": \[
    {
    "type": "thought",
    "signature": "abc123..."
    },
    {
    "type": "function_call",
    "id": "fc_1",
    "name": "get_weather",
    "arguments": { "location": "Boston, MA" }
    }
    \]
    }

#### After (new schema)

### Python

    # Accessing function call in new steps schema
    for step in interaction.steps:
        if step.type == "function_call":
            print(f"Calling {step.name} with {step.arguments}")

### JavaScript

    // Accessing function call in new steps schema
    for (const step of interaction.steps) {
        if (step.type === 'function_call') {
            console.log(`Calling {step.name} with {JSON.stringify(step.arguments)}`);
        }
    }

### REST

    // POST Response
    {
      "id": "int_001",
      "status": "requires_action",
      "steps": \[
    {
    "type": "thought",
    "summary": \[{
    "type": "text",
    "text": "I need to check the weather in Boston..."
    }\],
    "signature": "abc123..."
    },
    {
    "type": "function_call",
    "id": "fc_1",
    "name": "get_weather",
    "arguments": { "location": "Boston, MA" }
    }
    \]
    }

### Server-side tools

Server-side tools (like Google Search or Code Execution) now yield specific
step types in the `steps` array. While the legacy schema returned these
operations as specific content types within the `outputs` array, the new schema
moves them into the `steps` array. The following examples use Google Search.

#### Before (legacy)

### Python

    # Accessing search results in legacy schema
    for output in interaction.outputs:
        if output.type == "google_search_call":
            print(f"Searched for: {output.arguments.queries}")
        elif output.type == "google_search_result":
            print(f"Found results: {output.result.rendered_content}")

### JavaScript

    // Accessing search results in legacy schema
    for (const output of interaction.outputs) {
        if (output.type === 'google_search_call') {
            console.log(`Searched for: {output.arguments.queries}`);
        } else if (output.type === 'google_search_result') {
            console.log(`Found results: {output.result.renderedContent}`);
        }
    }

### REST

    curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions?key=$GEMINI_API_KEY" \
      -H "Content-Type: application/json" \
      -d '{
        "model": "gemini-3.5-flash",
        "input": "Who won the last Super Bowl?",
        "tools": [
          { "type": "google_search" }
        ]
      }'

    // Response
    {
      "id": "int_456",
      "outputs": \[
    {
    "type": "google_search_call",
    "id": "gs_1",
    "arguments": { "queries": \["last Super Bowl winner"\] }
    },
    {
    "type": "google_search_result",
    "call_id": "gs_1",
    "result": {
    "rendered_content": "\<div\>...\</div\>",
    "url": "https://www.nfl.com/super-bowl"
    }
    },
    {
    "type": "text",
    "text": "The Kansas City Chiefs won the last Super Bowl.",
    "annotations": \[
    {
    "start_index": 4,
    "end_index": 22,
    "source": "https://www.nfl.com/super-bowl"
    }
    \]
    }
    \],
      "status": "completed"
    }

#### After (new schema)

### Python

    # Accessing search results in new steps schema
    for step in interaction.steps:
        if step.type == "google_search_call":
            print(f"Searched for: {step.arguments.queries}")
        elif step.type == "google_search_result":
            print(f"Found results: {step.result.search_suggestions}")

### JavaScript

    // Accessing search results in new steps schema
    for (const step of interaction.steps) {
        if (step.type === 'google_search_call') {
            console.log(`Searched for: {step.arguments.queries}`);
        } else if (step.type === 'google_search_result') {
            console.log(`Found results: {step.result.searchSuggestions}`);
        }
    }

### REST

    # Opt-in needed before May 26th
    curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions?key=$GEMINI_API_KEY" \
      -H "Content-Type: application/json" \
      -H "Api-Revision: 2026-05-20" \\
      -d '{
        "model": "gemini-3.5-flash",
        "input": "Who won the last Super Bowl?",
        "tools": [
          { "type": "google_search" }
        ]
      }'

    // POST Response
    {
      "id": "int_456",
      "steps": \[
    {
    "type": "google_search_call",
    "id": "gs_1",
    "arguments": { "queries": \["last Super Bowl winner"\] },
    "signature": "abc123..."
    },
    {
    "type": "google_search_result",
    "call_id": "gs_1",
    "result": {
    "search_suggestions": "\<div\>...\</div\>"
    },
    "signature": "abc123..."
    },
    {
    "type": "model_output",
    "content": \[
    {
    "type": "text",
    "text": "The Kansas City Chiefs won the last Super Bowl.",
    "annotations": \[
    {
    "type": "url_citation",
    "url": "https://www.nfl.com/super-bowl",
    "title": "NFL.com",
    "start_index": 4,
    "end_index": 22
    }
    \]
    }
    \]
    }
    \],
      "status": "completed"
    }

### Streaming

Streaming exposes new event types:

#### New event types

- `interaction.created`
- `interaction.completed`
- `interaction.in_progress`
- `interaction.requires_action`
- `step.start`
- `step.delta`
- `step.stop`

#### Deprecated event types

The following legacy event types are replaced by the new events listed above:

- `interaction.start` → `interaction.created`
- `content.start` → `step.start`
- `content.delta` → `step.delta`
- `content.stop` → `step.stop`
- `interaction.complete` → `interaction.completed`
- `interaction.status_update` → replaced by `interaction.in_progress`, `interaction.requires_action`, etc.

**Streaming function calls** : When you use streaming with function calling,
the `step.start` event delivers the function name, and `step.delta` events
stream the arguments as partial JSON strings (using `arguments_delta`). You
must accumulate these deltas to get the full arguments. This differs from
unary calls where you receive the complete function call object at once.

#### Examples

##### Before (Legacy)

### Python

    # Legacy streaming used content.delta
    stream = client.interactions.create(
        model="gemini-3.5-flash",
        input="Explain quantum entanglement in simple terms.",
        stream=True,
    )

    for chunk in stream:
        if chunk.event_type == "content.delta":
            if chunk.delta.type == "text":
                print(chunk.delta.text, end="", flush=True)

### JavaScript

    // Legacy streaming used content.delta
    const stream = await client.interactions.create({
        model: 'gemini-3.5-flash',
        input: 'Explain quantum entanglement in simple terms.',
        stream: true,
    });

    for await (const chunk of stream) {
        if (chunk.event_type === 'content.delta') {
            if (chunk.delta.type === 'text') {
                process.stdout.write(chunk.delta.text);
            }
        }
    }

### REST

    curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions?key=$GEMINI_API_KEY" \
      -H "Content-Type: application/json" \
      -d '{
        "model": "gemini-3.5-flash",
        "input": "Explain quantum entanglement in simple terms.",
        "stream": true
      }'

    // Response (SSE Lines)
    // event: interaction.start
    // data: {"id": "int_123", "status": "in_progress"}
    //
    // event: content.start
    // data: {"index": 0, "type": "text"}
    //
    // event: content.delta
    // data: {"delta": {"type": "text", "text": "Quantum entanglement is..."}}
    //
    // event: content.stop
    // data: {"index": 0}
    //
    // event: interaction.complete
    // data: {"id": "int_123", "status": "done", "usage": {"total_tokens": 42}}

##### After (New Schema)

### Python

    # Consuming stream and handling new event types
    for event in client.interactions.create(
        model="gemini-3.5-flash",
        input="Tell me a story.",
        stream=True,
    ):
        if event.type == "step.delta":  # CHANGED: step.delta instead of content.delta
            if event.delta.type == "text":
                print(event.delta.text, end="")

### JavaScript

    // Consuming stream and handling new event types
    const stream = await client.interactions.create({
        model: 'gemini-3.5-flash',
        input: 'Tell me a story.',
        stream: true,
    });

    for await (const event of stream) {
        if (event.type === 'step.delta') {  // CHANGED: step.delta instead of content.delta
            if (event.delta.type === 'text') {
                process.stdout.write(event.delta.text);
            }
        }
    }

### REST

     # Opt-in needed before May 26th
     curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions?key=$GEMINI_API_KEY" \
       -H "Content-Type: application/json" \
       -H "Accept: text/event-stream" \
       -H "Api-Revision: 2026-05-20" \\
       -d '{
         "model": "gemini-3.5-flash",
         "input": "Tell me a story.",
         "stream": true
       }'

     // Response (SSE Lines)
     // event: interaction.created
     // data: {"interaction": {"id": "int_xyz", "status": "in_progress", "object": "interaction", "model": "gemini-3.5-flash"}, "event_type": "interaction.created"}
     //
     // event: interaction.in_progress
     // data: {"interaction_id": "int_xyz", "event_type": "interaction.in_progress"}
     //
     // event: step.start
     // data: {"index": 0, "step": {"type": "thought", "signature": "abc123..."}, "event_type": "step.start"}
     //
     // event: step.stop
     // data: {"index": 0, "event_type": "step.stop"}
     //
     // event: step.start
     // data: {"index": 1, "step": {"content": [{"text": "Once upon", "type": "text"}], "type": "model_output"}, "event_type": "step.start"}
     //
     // event: step.delta
     // data: {"index": 1, "delta": {"text": " a time...", "type": "text"}, "event_type": "step.delta"}
     //
     // event: step.stop
     // data: {"type": "step.stop", "index": 1, "status": "done"}
     //
     // event: interaction.completed
     // data: {"type": "interaction.completed", "interaction": {"id": "int_xyz", "status": "completed", "usage": {"prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15}}} // NEW: Dedicated completion event

### Stateless Conversation History

If you manage conversation history manually on the client side (stateless use
case), you must update how you string along previous turns.

- **Legacy** : Developers often collected the `outputs` array from responses and sent them back in the `input` field on the next turn.
- **New schema** : You should now collect the `steps` array from the response and pass it in the `input` field of the next request, appending your new user turn as a `user_input` step.

## Output format configuration: `response_format` changes

The updated API consolidates all output format controls into a unified,
polymorphic `response_format` field. This centralizes output configuration at
the top level and keeps `generation_config` focused on model behavior (like
temperature, top_p, and thinking).

### Key changes

- **The API removes `response_mime_type`.** You now specify the MIME type per format entry inside `response_format`.
- **`response_format` is now a polymorphic object (or array).** Each entry has a `type` discriminator (`text`, `audio`, `image`) and type-specific fields. To request multiple output modalities, pass an array of format entries.
- **`image_config` moves from `generation_config` to `response_format`.** You now specify image output settings like `aspect_ratio` and `image_size` in a `response_format` entry with `"type": "image"`.

### Structured output (JSON)

The new schema removes the `response_mime_type` field. Instead, specify the
MIME type and JSON schema inside a `response_format` object with
`"type": "text"`.

#### Before (legacy)

### Python

    interaction = client.interactions.create(
        model="gemini-3.5-flash",
        input="Summarize this article.",
        response_mime_type="application/json",
        response_format={
            "type": "object",
            "properties": {
                "summary": {"type": "string"}
            }
        },
    )

    print(interaction.outputs[-1].text)

### JavaScript

    const interaction = await client.interactions.create({
        model: 'gemini-3.5-flash',
        input: 'Summarize this article.',
        response_mime_type: 'application/json',
        response_format: {
            type: 'object',
            properties: {
                summary: { type: 'string' }
            }
        },
    });

    console.log(interaction.outputs[-1].text);

### REST

    curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions?key=$GEMINI_API_KEY" \
      -H "Content-Type: application/json" \
      -d '{
        "model": "gemini-3.5-flash",
        "input": "Summarize this article.",
        "response_mime_type": "application/json",
        "response_format": {
          "type": "object",
          "properties": {
            "summary": { "type": "string" }
          }
        }
      }'

#### After (new schema)

### Python

    interaction = client.interactions.create(
        model="gemini-3.5-flash",
        input="Summarize this article.",
        # response_mime_type is removed --- specify mime_type inside response_format
        response_format={
            "type": "text",
            "mime_type": "application/json",
            "schema": {
                "type": "object",
                "properties": {
                    "summary": {"type": "string"}
                }
            }
        },
    )

    # Print response
    print(interaction.output_text)

### JavaScript

    const interaction = await client.interactions.create({
        model: 'gemini-3.5-flash',
        input: 'Summarize this article.',
        // response_mime_type is removed --- specify mime_type inside response_format
        response_format: {
            type: 'text',
            mime_type: 'application/json',
            schema: {
                type: 'object',
                properties: {
                    summary: { type: 'string' }
                }
            }
        },
    });

    // Print response
    console.log(interaction.output_text);

### REST

    # Opt-in needed before May 26th
    curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions?key=$GEMINI_API_KEY" \
      -H "Content-Type: application/json" \
      -H "Api-Revision: 2026-05-20" \\
      -d '{
        "model": "gemini-3.5-flash",
        "input": "Summarize this article.",
        "response_format": {
          "type": "text",
          "mime_type": "application/json",
          "schema": {
            "type": "object",
            "properties": {
              "summary": { "type": "string" }
            }
          }
        }
      }'

### Image configuration

The new schema removes `image_config` from `generation_config`. You now specify
image output settings in a `response_format` entry with `"type": "image"`.

#### Before (legacy)

### Python

    interaction = client.interactions.create(
        model="gemini-3.5-flash",
        input="Generate an image of a sunset over the ocean.",
        generation_config={
            "image_config": {
                "aspect_ratio": "1:1",
                "image_size": "1K"
            }
        },
    )

### JavaScript

    const interaction = await client.interactions.create({
        model: 'gemini-3.5-flash',
        input: 'Generate an image of a sunset over the ocean.',
        generation_config: {
            image_config: {
                aspect_ratio: '1:1',
                image_size: '1K'
            }
        },
    });

### REST

    curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions?key=$GEMINI_API_KEY" \
      -H "Content-Type: application/json" \
      -d '{
        "model": "gemini-3.5-flash",
        "input": "Generate an image of a sunset over the ocean.",
        "generation_config": {
          "image_config": {
            "aspect_ratio": "1:1",
            "image_size": "1K"
          }
        }
      }'

#### After (new schema)

### Python

    interaction = client.interactions.create(
        model="gemini-3.5-flash",
        input="Generate an image of a sunset over the ocean.",
        # image_config is removed from generation_config --- use response_format
        response_format={
            "type": "image",
            "mime_type": "image/jpeg",
            "aspect_ratio": "1:1",
            "image_size": "1K"
        },
    )

### JavaScript

    const interaction = await client.interactions.create({
        model: 'gemini-3.5-flash',
        input: 'Generate an image of a sunset over the ocean.',
        // image_config is removed from generation_config --- use response_format
        response_format: {
            type: 'image',
            mime_type: 'image/jpeg',
            aspect_ratio: '1:1',
            image_size: '1K'
        },
    });

### REST

    # Opt-in needed before May 26th
    curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions?key=$GEMINI_API_KEY" \
      -H "Content-Type: application/json" \
      -H "Api-Revision: 2026-05-20" \\
      -d '{
        "model": "gemini-3.5-flash",
        "input": "Generate an image of a sunset over the ocean.",
        "response_format": {
          "type": "image",
          "mime_type": "image/jpeg",
          "aspect_ratio": "1:1",
          "image_size": "1K"
        }
      }'

To request multiple output modalities (for example, text and audio together),
pass an array of format entries to `response_format` instead of a single
object.

## How to migrate to the new schema

### SDK users

Upgrade to the latest SDK version (Python ≥2.0.0, JavaScript ≥2.0.0). The
SDK automatically opts you into the new schema --- no code changes needed beyond
updating how you read responses (see examples above). Note that only the new
schema is supported in these SDK versions. Older SDK versions
(Python 1.x.x, JavaScript 1.x.x) will continue to work until the legacy
schema is removed on **June 8, 2026**.

### REST API users

Add the `Api-Revision: 2026-05-20` header to your requests to opt in to
the new schema now. After **May 26** , the new schema becomes the default for all
requests. You can temporarily opt out with `Api-Revision: 2026-05-07`
until **June 8**, when the API permanently removes the legacy schema.

### Timeline

| Date | Phase | SDK users | REST API users |
|---|---|---|---|
| **May 7** | Opt-in | New SDK version available (Python ≥2.0.0, JS ≥2.0.0). Upgrade to get the new schema automatically. | Add `Api-Revision: 2026-05-20` header to opt in. Default remains legacy. |
| **May 26** | Default flip | No action needed if already upgraded. Older SDKs (Python 1.x.x, JS 1.x.x) still work but return legacy responses. | New schema is now the default. Send `Api-Revision: 2026-05-07` header to opt out. |
| **June 8** | Sunset | Python 1.x.x and JS 1.x.x SDK versions will break for Interactions API calls. | Legacy schema removed for Interactions API. `Api-Revision` header ignored. |

> [!NOTE]
> **Note** : New features shipped after May 7 will only
> appear in `steps` responses. Users on the legacy `outputs`
> schema will not receive new capabilities until they migrate.

## Migration Checklist

### Steps schema (`steps`)

- Update code to read response content from the `steps` array instead of `outputs`. [See examples](https://ai.google.dev/gemini-api/docs/interactions-breaking-changes-may-2026#basic-unary).
- Verify that your code handles both `user_input` and `model_output` step types. [See examples](https://ai.google.dev/gemini-api/docs/interactions-breaking-changes-may-2026#basic-unary).
- (Function Calling) Update code to find `function_call` steps in the `steps` array. [See examples](https://ai.google.dev/gemini-api/docs/interactions-breaking-changes-may-2026#function-calling).
- (Server-Side Tools) Update code to handle tool-specific steps (e.g., `google_search_call`, `google_search_result`). [See examples](https://ai.google.dev/gemini-api/docs/interactions-breaking-changes-may-2026#server-side-tools).
- (Stateless History) Update history management to pass the `steps` array in the `input` field of the next request. [See details](https://ai.google.dev/gemini-api/docs/interactions-breaking-changes-may-2026#stateless-history).
- (Streaming only) Update client to listen for new SSE event types (`interaction.created`, `step.delta`, etc.). [See examples](https://ai.google.dev/gemini-api/docs/interactions-breaking-changes-may-2026#streaming).

### Output format configuration (`response_format`)

- Replace `response_mime_type` with a `mime_type` field inside `response_format`. [See examples](https://ai.google.dev/gemini-api/docs/interactions-breaking-changes-may-2026#structured-output).
- Wrap your existing `response_format` JSON schema inside a `{"type": "text", "schema": ...}` object. [See examples](https://ai.google.dev/gemini-api/docs/interactions-breaking-changes-may-2026#structured-output).
- (Image Generation) Move `image_config` from `generation_config` to a `{"type": "image", ...}` entry in `response_format`. [See examples](https://ai.google.dev/gemini-api/docs/interactions-breaking-changes-may-2026#image-config).
- (Multimodal) Convert `response_format` from a single object to an array when requesting multiple output modalities.