<!--
  Upstream snapshot - DO NOT EDIT - run _upstream/sync.sh to refresh
  Source: https://ai.google.dev/gemini-api/docs/interactions-breaking-changes-may-2026.md.txt
  Synced: 2026-11-06
  Consumed by: gemini.interactions.wiretypes.ts, gemini.interactions.parser.ts, gemini.interactionsCreate.ts
  Companion: ./gemini.interactions.spec.md, ./gemini.interactions.guide.md, ./gemini.deep-research.guide.md
-->

> ## AI Agent Context
> Get the complete documentation index at: https://aistudio.google.com/llms.txt
> Use this file to discover all available pages.
> For the full documentation in a single file, fetch: https://aistudio.google.com/llms-full.txt

# Interactions API: Breaking changes migration guide (May 2026)

{% callout type="warning" %}
  **Breaking changes**: The changes described in this guide are
  breaking changes to the Interactions API. The legacy schema will be
  removed on **June 8, 2026**. Use the
  `Api-Revision` request header to
  [manage your migration](/docs/interactions-breaking-changes-may-2026#how-to-migrate).

{% /callout %}

The `v1beta` Interactions API is introducing breaking changes that restructure the
API shape to support future capabilities like mid-flight steering and
asynchronous tool calls. This page explains what's changing and provides
before-and-after code examples to help you migrate. There are two categories
of changes:

1. [**Steps schema**](/docs/interactions-breaking-changes-may-2026#steps-schema): A new `steps` array replaces the
  `outputs` array, providing a structured timeline of each interaction turn.
2. [**Output format configuration**](/docs/interactions-breaking-changes-may-2026#output-format-config): A new polymorphic
  `response_format` consolidates all output format controls and removes
  `response_mime_type`.

Follow the steps in [How to migrate to the new schema](/docs/interactions-breaking-changes-may-2026#how-to-migrate) to
update your integration.

## Core change: `outputs` to `steps` {% id="steps-schema" %}

The new schema replaces the `outputs` array with a `steps` array.

- **Legacy**: Responses returned a flat `outputs` array containing only the model's generated content.
- **New schema**: Responses return a `steps` array containing structured steps with type discriminators.

`POST /interactions` returns only output steps. `GET /interactions/{id}`
returns the full step timeline, including the initial `user_input` step.

### Basic input/output (unary)  {% id="basic-unary" %}

#### Before (legacy)

{% tabs %}
  {% tab filename="sample.py" label="Python" %}
  ```python
  # Request
  interaction = client.interactions.create(
      model="gemini-3.8-flash", input="Tell me a joke."
  )
  
  # Response access
  print(interaction.outputs[-1].text)
  ```

  {% /tab %}

  {% tab filename="sample.js" label="JavaScript" %}
  ```javascript
  // Request
  const interaction = await client.interactions.create({
      model: 'gemini-3.8-flash',
      input: 'Tell me a joke.'
  });
  
  // Response access
  console.log(interaction.outputs[-1].text);
  ```

  {% /tab %}

  {% tab filename="sample.sh" label="REST" %}
  ```bash
  curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions?key=$GEMINI_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{
      "model": "gemini-3.8-flash",
      "input": "Tell me a joke."
    }'
  ```

  ```none
  // Response
  {
    "id": "int_123",
    "role": "model",
    {{ '<strong>' }}"outputs": [
      {
        "type": "text",
        "text": "Why did the chicken cross the road?"
      }
    ]{{ '</strong>' }}
  }
  ```

  {% /tab %}

{% /tabs %}

#### After (new schema)

{% tabs %}
  {% tab filename="sample.py" label="Python" %}
  ```python
  # Request
  interaction = client.interactions.create(
      model="gemini-3.8-flash", input="Tell me a joke."
  )
  
  # Response access (Recommended sugar)
  print(interaction.output_text)
  ```

  {% /tab %}

  {% tab filename="sample.js" label="JavaScript" %}
  ```javascript
  // Request
  const interaction = await client.interactions.create({
      model: 'gemini-3.8-flash',
      input: 'Tell me a joke.'
  });
  
  // Response access (Recommended sugar)
  console.log(interaction.output_text);
  ```

  Note: For details on SDK convenience properties (including `.output_text`,
    `.output_image`, and `.output_audio`), see
    [Access outputs with SDK convenience properties](/docs/interactions-overview#sdk-sugar)
    in the overview.

  {% /tab %}

  {% tab filename="sample.sh" label="REST" %}
  ```bash
  # Opt-in needed before May 26th
  curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions?key=$GEMINI_API_KEY" \
    -H "Content-Type: application/json" \
    {{ '**' }}-H "Api-Revision: 2026-05-20" \{{ '**' }}
    -d '{
      "model": "gemini-3.8-flash",
      "input": "Tell me a joke."
    }'
  ```

  ```html
  // POST Response
  {
    "id": "int_123",
    {{ '<strong>' }}"steps": [
      {
        "type": "model_output",
        "content": [
          {
            "type": "text",
            "text": "Why did the chicken cross the road?"
          }
        ]
      }
    ]{{ '</strong>' }}
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
  ```

  {% /tab %}

{% /tabs %}

### Function calling  {% id="function-calling" %}

The request structure remains unchanged, but the response replaces the flat
`outputs` content with structured steps.

#### Before (legacy)

{% tabs %}
  {% tab filename="sample.py" label="Python" %}
  ```python
  # Accessing function call in legacy schema
  for output in interaction.outputs:
      if output.type == "function_call":
          print(f"Calling {output.name} with {output.arguments}")
  ```

  {% /tab %}

  {% tab filename="sample.js" label="JavaScript" %}
  ```javascript
  // Accessing function call in legacy schema
  for (const output of interaction.outputs) {
      if (output.type === 'function_call') {
          console.log(`Calling ${output.name} with ${JSON.stringify(output.arguments)}`);
      }
  }
  ```

  {% /tab %}

  {% tab filename="sample.sh" label="REST" %}
  ```json
  // Response
  {
    "id": "int_001",
    "role": "model",
    "status": "requires_action",
    {{ '<strong>' }}"outputs": [
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
    ]{{ '</strong>' }}
  }
  ```

  {% /tab %}

{% /tabs %}

#### After (new schema)

{% tabs %}
  {% tab filename="sample.py" label="Python" %}
  ```python
  # Accessing function call in new steps schema
  for step in interaction.steps:
      if step.type == "function_call":
          print(f"Calling {step.name} with {step.arguments}")
  ```

  {% /tab %}

  {% tab filename="sample.js" label="JavaScript" %}
  ```javascript
  // Accessing function call in new steps schema
  for (const step of interaction.steps) {
      if (step.type === 'function_call') {
          console.log(`Calling ${step.name} with ${JSON.stringify(step.arguments)}`);
      }
  }
  ```

  {% /tab %}

  {% tab filename="sample.sh" label="REST" %}
  ```json
  // POST Response
  {
    "id": "int_001",
    "status": "requires_action",
    {{ '<strong>' }}"steps": [
      {
        "type": "thought",
        "summary": [{
          "type": "text",
          "text": "I need to check the weather in Boston..."
        }],
        "signature": "abc123..."
      },
      {
        "type": "function_call",
        "id": "fc_1",
        "name": "get_weather",
        "arguments": { "location": "Boston, MA" }
      }
    ]{{ '</strong>' }}
  }
  ```

  {% /tab %}

{% /tabs %}

### Server-side tools  {% id="server-side-tools" %}

Server-side tools (like Google Search or Code Execution) now yield specific
step types in the `steps` array. While the legacy schema returned these
operations as specific content types within the `outputs` array, the new schema
moves them into the `steps` array. The following examples use Google Search.

#### Before (legacy)

{% tabs %}
  {% tab filename="sample.py" label="Python" %}
  ```python
  # Accessing search results in legacy schema
  for output in interaction.outputs:
      if output.type == "google_search_call":
          print(f"Searched for: {output.arguments.queries}")
      elif output.type == "google_search_result":
          print(f"Found results: {output.result.rendered_content}")
  ```

  {% /tab %}

  {% tab filename="sample.js" label="JavaScript" %}
  ```javascript
  // Accessing search results in legacy schema
  for (const output of interaction.outputs) {
      if (output.type === 'google_search_call') {
          console.log(`Searched for: ${output.arguments.queries}`);
      } else if (output.type === 'google_search_result') {
          console.log(`Found results: ${output.result.renderedContent}`);
      }
  }
  ```

  {% /tab %}

  {% tab filename="sample.sh" label="REST" %}
  ```bash
  curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions?key=$GEMINI_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{
      "model": "gemini-3.8-flash",
      "input": "Who won the last Super Bowl?",
      "tools": [
        { "type": "google_search" }
      ]
    }'
  ```

  ```html
  // Response
  {
    "id": "int_456",
    {{ '<strong>' }}"outputs": [
      {
        "type": "google_search_call",
        "id": "gs_1",
        "arguments": { "queries": ["last Super Bowl winner"] }
      },
      {
        "type": "google_search_result",
        "call_id": "gs_1",
        "result": {
          "rendered_content": "...",
          "url": "https://www.nfl.com/super-bowl"
        }
      },
      {
        "type": "text",
        "text": "The Kansas City Chiefs won the last Super Bowl.",
        "annotations": [
          {
            "start_index": 4,
            "end_index": 22,
            "source": "https://www.nfl.com/super-bowl"
          }
        ]
      }
    ]{{ '</strong>' }},
    "status": "completed"
  }
  ```

  {% /tab %}

{% /tabs %}

#### After (new schema)

{% tabs %}
  {% tab filename="sample.py" label="Python" %}
  ```python
  # Accessing search results in new steps schema
  for step in interaction.steps:
      if step.type == "google_search_call":
          print(f"Searched for: {step.arguments.queries}")
      elif step.type == "google_search_result":
          print(f"Found results: {step.result[0].search_suggestions}")
  ```

  {% /tab %}

  {% tab filename="sample.js" label="JavaScript" %}
  ```javascript
  // Accessing search results in new steps schema
  for (const step of interaction.steps) {
      if (step.type === 'google_search_call') {
          console.log(`Searched for: ${step.arguments.queries}`);
      } else if (step.type === 'google_search_result') {
          console.log(`Found results: ${step.result[0].search_suggestions}`);
      }
  }
  ```

  {% /tab %}

  {% tab filename="sample.sh" label="REST" %}
  ```bash
  # Opt-in needed before May 26th
  curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions?key=$GEMINI_API_KEY" \
    -H "Content-Type: application/json" \
    {{ '**' }}-H "Api-Revision: 2026-05-20" \{{ '**' }}
    -d '{
      "model": "gemini-3.8-flash",
      "input": "Who won the last Super Bowl?",
      "tools": [
        { "type": "google_search" }
      ]
    }'
  ```

  ```html
  // POST Response
  {
    "id": "int_456",
    {{ '<strong>' }}"steps": [
      {
        "type": "google_search_call",
        "id": "gs_1",
        "arguments": { "queries": ["last Super Bowl winner"] },
        "signature": "abc123..."
      },
      {
        "type": "google_search_result",
        "call_id": "gs_1",
        "result": {
          "search_suggestions": "..."
        },
        "signature": "abc123..."
      },
      {
        "type": "model_output",
        "content": [
          {
            "type": "text",
            "text": "The Kansas City Chiefs won the last Super Bowl.",
            "annotations": [
              {
                "type": "url_citation",
                "url": "https://www.nfl.com/super-bowl",
                "title": "NFL.com",
                "start_index": 4,
                "end_index": 22
              }
            ]
          }
        ]
      }
    ]{{ '</strong>' }},
    "status": "completed"
  }
  ```

  {% /tab %}

{% /tabs %}

### Streaming  {% id="streaming" %}

Streaming exposes new event types:

#### New event types  {% id="event-types" %}

-  `interaction.created`
-  `interaction.completed`
-  `step.start`
-  `step.delta`
-  `step.stop`

`interaction.status_update` is unchanged. It carries the new `status` (for
example `in_progress` or `requires_action`). Every event names its type in
the `event_type` field of the JSON payload, matching the SSE `event:` line.

#### Deprecated event types  {% id="deprecated-event-types" %}

The following legacy event types are replaced by the new events listed above:

-  `interaction.start` → `interaction.created`
-  `content.start` → `step.start`
-  `content.delta` → `step.delta`
-  `content.stop` → `step.stop`
-  `interaction.complete` → `interaction.completed`

**Streaming function calls**: When you use streaming with function calling,
the `step.start` event delivers the function name, and `step.delta` events
stream the arguments as partial JSON strings (using `arguments_delta`). You
must accumulate these deltas to get the full arguments. This differs from
unary calls where you receive the complete function call object at once.

#### Examples  {% id="streaming-examples" %}

##### Before (Legacy)

{% tabs %}
  {% tab filename="sample.py" label="Python" %}
  ```python
  # Legacy streaming used content.delta
  stream = client.interactions.create(
      model="gemini-3.8-flash",
      input="Explain quantum entanglement in simple terms.",
      stream=True,
  )
  
  for chunk in stream:
      if chunk.event_type == "content.delta":
          if chunk.delta.type == "text":
              print(chunk.delta.text, end="", flush=True)
  ```

  {% /tab %}

  {% tab filename="sample.js" label="JavaScript" %}
  ```javascript
  // Legacy streaming used content.delta
  const stream = await client.interactions.create({
      model: 'gemini-3.8-flash',
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
  ```

  {% /tab %}

  {% tab filename="sample.sh" label="REST" %}
  ```bash
  curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions?key=$GEMINI_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{
      "model": "gemini-3.8-flash",
      "input": "Explain quantum entanglement in simple terms.",
      "stream": true
    }'
  ```

  ```none
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
  ```

  {% /tab %}

{% /tabs %}

##### After (New Schema)

{% tabs %}
  {% tab filename="sample.py" label="Python" %}
  ```python
  # Consuming stream and handling new event types
  for event in client.interactions.create(
      model="gemini-3.8-flash",
      input="Tell me a story.",
      stream=True,
  ):
      if event.event_type == "step.delta":  # CHANGED: step.delta instead of content.delta
          if event.delta.type == "text":
              print(event.delta.text, end="")
  ```

  {% /tab %}

  {% tab filename="sample.js" label="JavaScript" %}
  ```javascript
  // Consuming stream and handling new event types
  const stream = await client.interactions.create({
      model: 'gemini-3.8-flash',
      input: 'Tell me a story.',
      stream: true,
  });
  
  for await (const event of stream) {
      if (event.event_type === 'step.delta') {  // CHANGED: step.delta instead of content.delta
          if (event.delta.type === 'text') {
              process.stdout.write(event.delta.text);
          }
      }
  }
  ```

  {% /tab %}

  {% tab filename="sample.sh" label="REST" %}
  ```bash
  {{ '**' }}# Opt-in needed before May 26th{{ '**' }}
  curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions?key=$GEMINI_API_KEY" \
    -H "Content-Type: application/json" \
    -H "Accept: text/event-stream" \
    {{ '**' }}-H "Api-Revision: 2026-05-20" \{{ '**' }}
    -d '{
      "model": "gemini-3.8-flash",
      "input": "Tell me a story.",
      "stream": true
    }'
  ```

  ```none
  // Response (SSE Lines)
  // event: interaction.created
  // data: {"interaction": {"id": "int_xyz", "status": "in_progress", "object": "interaction", "model": "gemini-3.8-flash"}, "event_type": "interaction.created"}
  //
  // event: interaction.status_update
  // data: {"interaction_id": "int_xyz", "status": "in_progress", "event_type": "interaction.status_update"}
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
  // data: {"index": 1, "event_type": "step.stop"}
  //
  // event: interaction.completed
  // data: {"interaction": {"id": "int_xyz", "status": "completed", "usage": {"total_input_tokens": 10, "total_output_tokens": 5, "total_tokens": 15}}, "event_type": "interaction.completed"} // NEW: Dedicated completion event
  ```

  {% /tab %}

{% /tabs %}

### Stateless Conversation History  {% id="stateless-history" %}

If you manage conversation history manually on the client side (stateless use
case), you must update how you string along previous turns.

- **Legacy**: Developers often collected the `outputs` array from responses and sent them back in the `input` field on the next turn.
- **New schema**: You should now collect the `steps` array from the response and pass it in the `input` field of the next request, appending your new user turn as a `user_input` step.

## Output format configuration: `response_format` changes  {% id="output-format-config" %}

The updated API consolidates all output format controls into a unified,
polymorphic `response_format` field. This centralizes output configuration at
the top level and keeps `generation_config` focused on model behavior (like
temperature, top_p, and thinking).

### Key changes  {% id="response-format-changes" %}

- **The API removes `response_mime_type`.** You now specify the MIME type
  per format entry inside `response_format`.
- **`response_format` is now a polymorphic object (or array).** Each
  entry has a `type` discriminator (`text`, `audio`, `image`) and
  type-specific fields. To request multiple output modalities, pass an
  array of format entries.
- **`image_config` moves from `generation_config` to `response_format`.**
  You now specify image output settings like `aspect_ratio` and `image_size`
  in a `response_format` entry with `"type": "image"`.

### Structured output (JSON)  {% id="structured-output" %}

The new schema removes the `response_mime_type` field. Instead, specify the
MIME type and JSON schema inside a `response_format` object with
`"type": "text"`.

#### Before (legacy)

{% tabs %}
  {% tab filename="sample.py" label="Python" %}
  ```python
  interaction = client.interactions.create(
      model="gemini-3.8-flash",
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
  ```

  {% /tab %}

  {% tab filename="sample.js" label="JavaScript" %}
  ```javascript
  const interaction = await client.interactions.create({
      model: 'gemini-3.8-flash',
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
  ```

  {% /tab %}

  {% tab filename="sample.sh" label="REST" %}
  ```bash
  curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions?key=$GEMINI_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{
      "model": "gemini-3.8-flash",
      "input": "Summarize this article.",
      "response_mime_type": "application/json",
      "response_format": {
        "type": "object",
        "properties": {
          "summary": { "type": "string" }
        }
      }
    }'
  ```

  {% /tab %}

{% /tabs %}

#### After (new schema)

{% tabs %}
  {% tab filename="sample.py" label="Python" %}
  ```python
  interaction = client.interactions.create(
      model="gemini-3.8-flash",
      input="Summarize this article.",
      # response_mime_type is removed -- specify mime_type inside response_format
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
  ```

  {% /tab %}

  {% tab filename="sample.js" label="JavaScript" %}
  ```javascript
  const interaction = await client.interactions.create({
      model: 'gemini-3.8-flash',
      input: 'Summarize this article.',
      // response_mime_type is removed -- specify mime_type inside response_format
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
  ```

  {% /tab %}

  {% tab filename="sample.sh" label="REST" %}
  ```bash
  # Opt-in needed before May 26th
  curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions?key=$GEMINI_API_KEY" \
    -H "Content-Type: application/json" \
    {{ '**' }}-H "Api-Revision: 2026-05-20" \{{ '**' }}
    -d '{
      "model": "gemini-3.8-flash",
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
  ```

  {% /tab %}

{% /tabs %}

### Image configuration  {% id="image-config" %}

The new schema removes `image_config` from `generation_config`. You now specify
image output settings in a `response_format` entry with `"type": "image"`.

#### Before (legacy)

{% tabs %}
  {% tab filename="sample.py" label="Python" %}
  ```python
  interaction = client.interactions.create(
      model="gemini-3.8-flash",
      input="Generate an image of a sunset over the ocean.",
      generation_config={
          "image_config": {
              "aspect_ratio": "1:1",
              "image_size": "1K"
          }
      },
  )
  ```

  {% /tab %}

  {% tab filename="sample.js" label="JavaScript" %}
  ```javascript
  const interaction = await client.interactions.create({
      model: 'gemini-3.8-flash',
      input: 'Generate an image of a sunset over the ocean.',
      generation_config: {
          image_config: {
              aspect_ratio: '1:1',
              image_size: '1K'
          }
      },
  });
  ```

  {% /tab %}

  {% tab filename="sample.sh" label="REST" %}
  ```bash
  curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions?key=$GEMINI_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{
      "model": "gemini-3.8-flash",
      "input": "Generate an image of a sunset over the ocean.",
      "generation_config": {
        "image_config": {
          "aspect_ratio": "1:1",
          "image_size": "1K"
        }
      }
    }'
  ```

  {% /tab %}

{% /tabs %}

#### After (new schema)

{% tabs %}
  {% tab filename="sample.py" label="Python" %}
  ```python
  interaction = client.interactions.create(
      model="gemini-3.8-flash",
      input="Generate an image of a sunset over the ocean.",
      # image_config is removed from generation_config -- use response_format
      response_format={
          "type": "image",
          "mime_type": "image/jpeg",
          "aspect_ratio": "1:1",
          "image_size": "1K"
      },
  )
  ```

  {% /tab %}

  {% tab filename="sample.js" label="JavaScript" %}
  ```javascript
  const interaction = await client.interactions.create({
      model: 'gemini-3.8-flash',
      input: 'Generate an image of a sunset over the ocean.',
      // image_config is removed from generation_config -- use response_format
      response_format: {
          type: 'image',
          mime_type: 'image/jpeg',
          aspect_ratio: '1:1',
          image_size: '1K'
      },
  });
  ```

  {% /tab %}

  {% tab filename="sample.sh" label="REST" %}
  ```bash
  # Opt-in needed before May 26th
  curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions?key=$GEMINI_API_KEY" \
    -H "Content-Type: application/json" \
    {{ '**' }}-H "Api-Revision: 2026-05-20" \{{ '**' }}
    -d '{
      "model": "gemini-3.8-flash",
      "input": "Generate an image of a sunset over the ocean.",
      "response_format": {
        "type": "image",
        "mime_type": "image/jpeg",
        "aspect_ratio": "1:1",
        "image_size": "1K"
      }
    }'
  ```

  {% /tab %}

{% /tabs %}

### Audio configuration  {% id="audio-config" %}

The new schema replaces `response_modalities: ["audio"]` with a `response_format` entry of `"type": "audio"`.

#### Before (legacy)

{% tabs %}
  {% tab filename="sample.py" label="Python" %}
  ```python
  interaction = client.interactions.create(
      model="gemini-3.1-flash-tts-preview",
      input="Say cheerfully: Have a wonderful day!",
      response_modalities=["audio"],
      generation_config={
          "speech_config": [
              {"voice": "Kore"}
          ]
      }
  )
  ```

  {% /tab %}

  {% tab filename="sample.js" label="JavaScript" %}
  ```javascript
  const interaction = await client.interactions.create({
      model: 'gemini-3.1-flash-tts-preview',
      input: 'Say cheerfully: Have a wonderful day!',
      response_modalities: ['audio'],
      generation_config: {
          speech_config: [
              { voice: 'Kore' }
          ]
      },
  });
  ```

  {% /tab %}

  {% tab filename="sample.sh" label="REST" %}
  ```bash
  curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions?key=$GEMINI_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{
      "model": "gemini-3.1-flash-tts-preview",
      "input": "Say cheerfully: Have a wonderful day!",
      "response_modalities": ["audio"],
      "generation_config": {
        "speech_config": [
          { "voice": "Kore" }
        ]
      }
    }'
  ```

  {% /tab %}

{% /tabs %}

#### After (new schema)

{% tabs %}
  {% tab filename="sample.py" label="Python" %}
  ```python
  interaction = client.interactions.create(
      model="gemini-3.1-flash-tts-preview",
      input="Say cheerfully: Have a wonderful day!",
      # response_modalities is removed -- use response_format
      response_format={
          "type": "audio"
      },
      generation_config={
          "speech_config": [
              {"voice": "Kore"}
          ]
      }
  )
  ```

  {% /tab %}

  {% tab filename="sample.js" label="JavaScript" %}
  ```javascript
  const interaction = await client.interactions.create({
      model: 'gemini-3.1-flash-tts-preview',
      input: 'Say cheerfully: Have a wonderful day!',
      // response_modalities is removed -- use response_format
      response_format: {
          type: 'audio'
      },
      generation_config: {
          speech_config: [
              { voice: 'Kore' }
          ]
      },
  });
  ```

  {% /tab %}

  {% tab filename="sample.sh" label="REST" %}
  ```bash
  # Opt-in needed before May 26th
  curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions?key=$GEMINI_API_KEY" \
    -H "Content-Type: application/json" \
    -H "Api-Revision: 2026-05-20" \
    -d '{
      "model": "gemini-3.1-flash-tts-preview",
      "input": "Say cheerfully: Have a wonderful day!",
      "response_format": {
        "type": "audio"
      },
      "generation_config": {
        "speech_config": [
          { "voice": "Kore" }
        ]
      }
    }'
  ```

  To request multiple output modalities (for example, text and audio together),
    pass an array of format entries to `response_format` instead of a single
    object.

  {% /tab %}

{% /tabs %}

## How to migrate to the new schema  {% id="how-to-migrate" %}

### SDK users  {% id="sdk-users" %}

Upgrade to the latest SDK version (Python ≥2.0.0, JavaScript ≥2.0.0). The
SDK automatically opts you into the new schema — no code changes needed beyond
updating how you read responses (see examples above). Note that only the new
schema is supported in these SDK versions. Older SDK versions
(Python 1.x.x, JavaScript 1.x.x) will continue to work until the legacy
schema is removed on **June 8, 2026**.

### REST API users  {% id="raw-api-users" %}

Add the `Api-Revision: 2026-05-20` header to your requests to opt in to
the new schema now. After **May 26**, the new schema becomes the default for all
requests. You can temporarily opt out with `Api-Revision: 2026-05-07`
until **June 8**, when the API permanently removes the legacy schema.

### Timeline  {% id="timeline" %}

| Date | Phase | SDK users | REST API users |
| --- | --- | --- | --- |
| **May 7** | Opt-in | New SDK version available (Python ≥2.0.0, JS ≥2.0.0). Upgrade to get the new schema automatically. | Add `Api-Revision: 2026-05-20` header to opt in. Default remains legacy. |
| **May 26** | Default flip | No action needed if already upgraded. Older SDKs (Python 1.x.x, JS 1.x.x) still work but return legacy responses. | New schema is now the default. Send `Api-Revision: 2026-05-07` header to opt out. |
| **June 8** | Sunset | Python 1.x.x and JS 1.x.x SDK versions will break for Interactions API calls. | Legacy schema removed for Interactions API. `Api-Revision` header ignored. |

{% callout type="note" %}
  **Note**: New features shipped after May 7 will only
  appear in `steps` responses. Users on the legacy `outputs`
  schema will not receive new capabilities until they migrate.

{% /callout %}

## Migration Checklist  {% id="migration-checklist" %}

### Steps schema (`steps`)

- Update code to read response content from the `steps` array instead of `outputs`. [See examples](/docs/interactions-breaking-changes-may-2026#basic-unary).
- Verify that your code handles both `user_input` and `model_output` step types. [See examples](/docs/interactions-breaking-changes-may-2026#basic-unary).
- (Function Calling) Update code to find `function_call` steps in the `steps` array. [See examples](/docs/interactions-breaking-changes-may-2026#function-calling).
- (Server-Side Tools) Update code to handle tool-specific steps (e.g., `google_search_call`, `google_search_result`). [See examples](/docs/interactions-breaking-changes-may-2026#server-side-tools).
- (Stateless History) Update history management to pass the `steps` array in the `input` field of the next request. [See details](/docs/interactions-breaking-changes-may-2026#stateless-history).
- (Streaming only) Update client to listen for new SSE event types (`interaction.created`, `step.delta`, etc.). [See examples](/docs/interactions-breaking-changes-may-2026#streaming).

### Output format configuration (`response_format`)

- Replace `response_mime_type` with a `mime_type` field inside `response_format`. [See examples](/docs/interactions-breaking-changes-may-2026#structured-output).
- Wrap your existing `response_format` JSON schema inside a `{"type": "text", "schema": ...}` object. [See examples](/docs/interactions-breaking-changes-may-2026#structured-output).
- (Image Generation) Move `image_config` from `generation_config` to a `{"type": "image", ...}` entry in `response_format`. [See examples](/docs/interactions-breaking-changes-may-2026#image-config).
- (Speech Generation) Replace `response_modalities=["audio"]` with a `{"type": "audio"}` entry in `response_format`. [See examples](/docs/interactions-breaking-changes-may-2026#audio-config).
- (Multimodal) Convert `response_format` from a single object to an array when requesting multiple output modalities.
