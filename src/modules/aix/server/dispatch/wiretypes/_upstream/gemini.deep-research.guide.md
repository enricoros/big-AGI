<!--
  Upstream snapshot - DO NOT EDIT - run _upstream/sync.sh to refresh
  Source: https://ai.google.dev/gemini-api/docs/deep-research.md.txt
  Synced: 2026-04-24
  Consumed by: gemini.interactions.wiretypes.ts, gemini.interactions.parser.ts, gemini.interactionsCreate.ts, gemini.interactionsPoller.ts
  Companion: ./gemini.interactions.guide.md (the Interactions API guide)
-->

The Gemini Deep Research Agent autonomously plans, executes, and synthesizes
multi-step research tasks. Powered by Gemini, it navigates complex
information landscapes to produce detailed, cited reports. New
capabilities allow you to collaboratively plan with the agent, connect to
external tools using MCP servers, include
visualizations (like charts and graphs), and provide documents directly
as input.

Research tasks involve iterative searching and reading and can take several
minutes to complete. You must use background execution (set `background=true`)
to run the agent asynchronously and poll for results or stream updates. See
[Handling long running tasks](https://ai.google.dev/gemini-api/docs/deep-research#long-running-tasks) for more details.

> [!WARNING]
> **Preview:** The Gemini Deep Research Agent is currently in preview. The Deep Research agent is exclusively available using the [Interactions
> API](https://ai.google.dev/gemini-api/docs/interactions). You cannot access it through `generate_content`.

The following example shows how to start a research task in the background
and poll for results.

### Python

    import time
    from google import genai

    client = genai.Client()

    interaction = client.interactions.create(
        input="Research the history of Google TPUs.",
        agent="deep-research-preview-04-2026",
        background=True,
    )

    print(f"Research started: {interaction.id}")

    while True:
        interaction = client.interactions.get(interaction.id)
        if interaction.status == "completed":
            print(interaction.outputs[-1].text)
            break
        elif interaction.status == "failed":
            print(f"Research failed: {interaction.error}")
            break
        time.sleep(10)

### JavaScript

    import { GoogleGenAI } from '@google/genai';

    const client = new GoogleGenAI({});

    const interaction = await client.interactions.create({
        input: 'Research the history of Google TPUs.',
        agent: 'deep-research-preview-04-2026',
        background: true
    });

    console.log(`Research started: ${interaction.id}`);

    while (true) {
        const result = await client.interactions.get(interaction.id);
        if (result.status === 'completed') {
            console.log(result.outputs[result.outputs.length - 1].text);
            break;
        } else if (result.status === 'failed') {
            console.log(`Research failed: ${result.error}`);
            break;
        }
        await new Promise(resolve => setTimeout(resolve, 10000));
    }

### REST

    # 1. Start the research task
    curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions" \
    -H "Content-Type: application/json" \
    -H "x-goog-api-key: $GEMINI_API_KEY" \
    -d '{
        "input": "Research the history of Google TPUs.",
        "agent": "deep-research-preview-04-2026",
        "background": true
    }'

    # 2. Poll for results (Replace INTERACTION_ID)
    # curl -X GET "https://generativelanguage.googleapis.com/v1beta/interactions/INTERACTION_ID" \
    # -H "x-goog-api-key: $GEMINI_API_KEY"

## Supported Versions

The Deep Research agent comes in two versions:

- **Deep Research** (`deep-research-preview-04-2026`): Designed for speed and efficiency, ideal to be streamed back to a client UI.
- **Deep Research Max** (`deep-research-max-preview-04-2026`): Maximum comprehensiveness for automated context gathering and synthesis.

## Collaborative planning

> [!WARNING]
> **Preview:** Collaborative planning allows you to review and refine the research plan before execution.

Collaborative planning gives you control over the research direction
before the agent starts its work. When enabled, the agent returns a
proposed research plan instead of executing immediately. You can then
review, modify, or approve the plan through multi-turn interactions.

### Step 1: Request a plan

Set `collaborative_planning=True` in the first interaction. The agent
returns a research plan instead of a full report.

### Python

    from google import genai

    client = genai.Client()

    # First interaction: request a research plan
    plan_interaction = client.interactions.create(
        agent="deep-research-preview-04-2026",
        input="Do some research on Google TPUs.",
        agent_config={
            "type": "deep-research",
            "thinking_summaries": "auto",
            "collaborative_planning": True,
        },
        background=True,
    )

    # Wait for and retrieve the plan
    while (result := client.interactions.get(id=plan_interaction.id)).status != "completed":
        time.sleep(5)
    print(result.outputs[-1].text)

### JavaScript

    const planInteraction = await client.interactions.create({
        agent: 'deep-research-preview-04-2026',
        input: 'Do some research on Google TPUs.',
        agent_config: {
            type: 'deep-research',
            thinking_summaries: 'auto',
            collaborative_planning: true
        },
        background: true
    });

    let result;
    while ((result = await client.interactions.get(planInteraction.id)).status !== 'completed') {
        await new Promise(r => setTimeout(r, 5000));
    }
    console.log(result.outputs[result.outputs.length - 1].text);

### REST

    curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions" \
    -H "Content-Type: application/json" \
    -H "x-goog-api-key: $GEMINI_API_KEY" \
    -d '{
        "agent": "deep-research-preview-04-2026",
        "input": "Do some research on Google TPUs.",
        "agent_config": {
            "type": "deep-research",
            "thinking_summaries": "auto",
            "collaborative_planning": true
        },
        "background": true
    }'

### Step 2: Refine the plan (optional)

Use `previous_interaction_id` to continue the conversation and iterate
on the plan. Keep `collaborative_planning=True` to stay in planning
mode.

### Python

    # Second interaction: refine the plan
    refined_plan = client.interactions.create(
        agent="deep-research-preview-04-2026",
        input="Focus more on the differences between Google TPUs and competitor hardware, and less on the history.",
        agent_config={
            "type": "deep-research",
            "thinking_summaries": "auto",
            "collaborative_planning": True,
        },
        previous_interaction_id=plan_interaction.id,
        background=True,
    )

    while (result := client.interactions.get(id=refined_plan.id)).status != "completed":
        time.sleep(5)
    print(result.outputs[-1].text)

### JavaScript

    const refinedPlan = await client.interactions.create({
        agent: 'deep-research-preview-04-2026',
        input: 'Focus more on the differences between Google TPUs and competitor hardware, and less on the history.',
        agent_config: {
            type: 'deep-research',
            thinking_summaries: 'auto',
            collaborative_planning: true
        },
        previous_interaction_id: planInteraction.id,
        background: true
    });

    let result;
    while ((result = await client.interactions.get(refinedPlan.id)).status !== 'completed') {
        await new Promise(r => setTimeout(r, 5000));
    }
    console.log(result.outputs[result.outputs.length - 1].text);

### REST

    curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions" \
    -H "Content-Type: application/json" \
    -H "x-goog-api-key: $GEMINI_API_KEY" \
    -d '{
        "agent": "deep-research-preview-04-2026",
        "input": "Focus more on the differences between Google TPUs and competitor hardware, and less on the history.",
        "agent_config": {
            "type": "deep-research",
            "thinking_summaries": "auto",
            "collaborative_planning": true
        },
        "previous_interaction_id": "PREVIOUS_INTERACTION_ID",
        "background": true
    }'

### Step 3: Approve and execute

Set `collaborative_planning=False` (or omit it) to approve the plan and
start the research.

### Python

    # Third interaction: approve the plan and kick off research
    final_report = client.interactions.create(
        agent="deep-research-preview-04-2026",
        input="Plan looks good!",
        agent_config={
            "type": "deep-research",
            "thinking_summaries": "auto",
            "collaborative_planning": False,
        },
        previous_interaction_id=refined_plan.id,
        background=True,
    )

    while (result := client.interactions.get(id=final_report.id)).status != "completed":
        time.sleep(5)
    print(result.outputs[-1].text)

### JavaScript

    const finalReport = await client.interactions.create({
        agent: 'deep-research-preview-04-2026',
        input: 'Plan looks good!',
        agent_config: {
            type: 'deep-research',
            thinking_summaries: 'auto',
            collaborative_planning: false
        },
        previous_interaction_id: refinedPlan.id,
        background: true
    });

    let result;
    while ((result = await client.interactions.get(finalReport.id)).status !== 'completed') {
        await new Promise(r => setTimeout(r, 5000));
    }
    console.log(result.outputs[result.outputs.length - 1].text);

### REST

    curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions" \
    -H "Content-Type: application/json" \
    -H "x-goog-api-key: $GEMINI_API_KEY" \
    -d '{
        "agent": "deep-research-preview-04-2026",
        "input": "Plan looks good!",
        "agent_config": {
            "type": "deep-research",
            "thinking_summaries": "auto",
            "collaborative_planning": false
        },
        "previous_interaction_id": "PREVIOUS_INTERACTION_ID",
        "background": true
    }'

## Visualization

> [!WARNING]
> **Preview:** Visualization allows the agent to generate charts and graphs to support its findings.

When `visualization` is set to `"auto"`, the agent can generate charts,
graphs, and other visual elements to support its research findings.
Generated images are included in the response outputs and streamed as
`image` deltas. For best results, explicitly ask for visuals in your
query --- for example, "Include charts showing trends over time" or
"Generate graphics comparing market share." Setting `visualization` to
`"auto"` enables the capability, but the agent generates visuals only
when the prompt requests them.

### Python

    import base64
    from IPython.display import Image, display

    interaction = client.interactions.create(
        agent="deep-research-preview-04-2026",
        input="Analyze global semiconductor market trends. Include graphics showing market share changes.",
        agent_config={
            "type": "deep-research",
            "visualization": "auto",
        },
        background=True,
    )

    print(f"Research started: {interaction.id}")

    while (result := client.interactions.get(id=interaction.id)).status != "completed":
        time.sleep(5)

    for output in result.outputs:
        if output.type == "text":
            print(output.text)
        elif output.type == "image" and output.data:
            image_bytes = base64.b64decode(output.data)
            print(f"Received image: {len(image_bytes)} bytes")
            # To display in a Jupyter notebook:
            # from IPython.display import display, Image
            # display(Image(data=image_bytes))

### JavaScript

    import { GoogleGenAI } from '@google/genai';

    const client = new GoogleGenAI({});

    const interaction = await client.interactions.create({
        agent: 'deep-research-preview-04-2026',
        input: 'Analyze global semiconductor market trends. Include graphics showing market share changes.',
        agent_config: {
            type: 'deep-research',
            visualization: 'auto'
        },
        background: true
    });

    console.log(`Research started: ${interaction.id}`);

    let result;
    while ((result = await client.interactions.get(interaction.id)).status !== 'completed') {
        await new Promise(r => setTimeout(r, 5000));
    }

    for (const output of result.outputs) {
        if (output.type === 'text') {
            console.log(output.text);
        } else if (output.type === 'image' && output.data) {
            console.log(`[Image Output: ${output.data.substring(0, 20)}...]`);
        }
    }

### REST

    curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions" \
    -H "Content-Type: application/json" \
    -H "x-goog-api-key: $GEMINI_API_KEY" \
    -d '{
        "agent": "deep-research-preview-04-2026",
        "input": "Analyze global semiconductor market trends. Include graphics showing market share changes.",
        "agent_config": {
            "type": "deep-research",
            "visualization": "auto"
        },
        "background": true
    }'

## Supported tools

Deep Research supports multiple built-in and external tools. By default
(when no `tools` parameter is provided), the agent has access to Google
Search, URL Context, and Code Execution. You can explicitly
specify tools to restrict or extend the agent's capabilities.

| Tool | Type value | Description |
|---|---|---|
| Google Search | `google_search` | Search the public web. Enabled by default. |
| URL Context | `url_context` | Read and summarize web page content. Enabled by default. |
| Code Execution | `code_execution` | Execute code to perform calculations and data analysis. Enabled by default. |
| MCP Server | `mcp_server` | Connect to remote MCP servers for external tool access. |
| File Search | `file_search` | Search your uploaded document corpora. |

### Google Search

Explicitly enable Google Search as the only tool:

### Python

    interaction = client.interactions.create(
        agent="deep-research-preview-04-2026",
        input="What are the latest developments in quantum computing?",
        tools=[{"type": "google_search"}],
        background=True,
    )

### JavaScript

    const interaction = await client.interactions.create({
        agent: 'deep-research-preview-04-2026',
        input: 'What are the latest developments in quantum computing?',
        tools: [{ type: 'google_search' }],
        background: true
    });

### REST

    curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions" \
    -H "Content-Type: application/json" \
    -H "x-goog-api-key: $GEMINI_API_KEY" \
    -d '{
        "agent": "deep-research-preview-04-2026",
        "input": "What are the latest developments in quantum computing?",
        "tools": [{"type": "google_search"}],
        "background": true
    }'

### URL Context

Give the agent the ability to read and summarize specific web pages:

### Python

    interaction = client.interactions.create(
        agent="deep-research-preview-04-2026",
        input="Summarize the content of https://www.wikipedia.org/.",
        tools=[{"type": "url_context"}],
        background=True,
    )

### JavaScript

    const interaction = await client.interactions.create({
        agent: 'deep-research-preview-04-2026',
        input: 'Summarize the content of https://www.wikipedia.org/.',
        tools: [{ type: 'url_context' }],
        background: true
    });

### REST

    curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions" \
    -H "Content-Type: application/json" \
    -H "x-goog-api-key: $GEMINI_API_KEY" \
    -d '{
        "agent": "deep-research-preview-04-2026",
        "input": "Summarize the content of https://www.wikipedia.org/.",
        "tools": [{"type": "url_context"}],
        "background": true
    }'

### Code Execution

Allow the agent to execute code for calculations and data analysis:

### Python

    interaction = client.interactions.create(
        agent="deep-research-preview-04-2026",
        input="Calculate the 50th Fibonacci number.",
        tools=[{"type": "code_execution"}],
        background=True,
    )

### JavaScript

    const interaction = await client.interactions.create({
        agent: 'deep-research-preview-04-2026',
        input: 'Calculate the 50th Fibonacci number.',
        tools: [{ type: 'code_execution' }],
        background: true
    });

### REST

    curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions" \
    -H "Content-Type: application/json" \
    -H "x-goog-api-key: $GEMINI_API_KEY" \
    -d '{
        "agent": "deep-research-preview-04-2026",
        "input": "Calculate the 50th Fibonacci number.",
        "tools": [{"type": "code_execution"}],
        "background": true
    }'

### MCP servers

> [!WARNING]
> **Preview:** Connect to remote MCP servers to give the agent access to external tools and services.

Provide the server `name` and `url` in the tools configuration. You can also pass authentication credentials and restrict which tools the agent can call.

| Field | Type | Required | Description |
|---|---|---|---|
| `type` | `string` | Yes | Must be `"mcp_server"`. |
| `name` | `string` | No | A display name for the MCP server. |
| `url` | `string` | No | The full URL for the MCP server endpoint. |
| `headers` | `object` | No | Key-value pairs sent as HTTP headers with every request to the server (for example, authentication tokens). |
| `allowed_tools` | `array` | No | Restrict which tools from the server the agent may call. |

#### Basic usage

### Python

    interaction = client.interactions.create(
        agent="deep-research-preview-04-2026",
        input="Check the status of my last server deployment.",
        tools=[
            {
                "type": "mcp_server",
                "name": "Deployment Tracker",
                "url": "https://mcp.example.com/mcp",
                "headers": {"Authorization": "Bearer my-token"},
            }
        ],
        background=True,
    )

### JavaScript

    const interaction = await client.interactions.create({
        agent: 'deep-research-preview-04-2026',
        input: 'Check the status of my last server deployment.',
        tools: [
            {
                type: 'mcp_server',
                name: 'Deployment Tracker',
                url: 'https://mcp.example.com/mcp',
                headers: { Authorization: 'Bearer my-token' }
            }
        ],
        background: true
    });

### REST

    curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions" \
    -H "Content-Type: application/json" \
    -H "x-goog-api-key: $GEMINI_API_KEY" \
    -d '{
        "agent": "deep-research-preview-04-2026",
        "input": "Check the status of my last server deployment.",
        "tools": [
            {
                "type": "mcp_server",
                "name": "Deployment Tracker",
                "url": "https://mcp.example.com/mcp",
                "headers": {"Authorization": "Bearer my-token"}
            }
        ],
        "background": true
    }'

### File Search

Give the agent access to your own data by using the [File Search](https://ai.google.dev/gemini-api/docs/file-search) tool.

### Python

    import time
    from google import genai

    client = genai.Client()

    interaction = client.interactions.create(
        input="Compare our 2025 fiscal year report against current public web news.",
        agent="deep-research-preview-04-2026",
        background=True,
        tools=[
            {
                "type": "file_search",
                "file_search_store_names": ['fileSearchStores/my-store-name']
            }
        ]
    )

### JavaScript

    const interaction = await client.interactions.create({
        input: 'Compare our 2025 fiscal year report against current public web news.',
        agent: 'deep-research-preview-04-2026',
        background: true,
        tools: [
            { type: 'file_search', file_search_store_names: ['fileSearchStores/my-store-name'] },
        ]
    });

### REST

    curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions" \
    -H "Content-Type: application/json" \
    -H "x-goog-api-key: $GEMINI_API_KEY" \
    -d '{
        "input": "Compare our 2025 fiscal year report against current public web news.",
        "agent": "deep-research-preview-04-2026",
        "background": true,
        "tools": [
            {"type": "file_search", "file_search_store_names": ["fileSearchStores/my-store-name"]},
        ]
    }'

## Steerability and formatting

You can steer the agent's output by providing specific formatting instructions
in your prompt. This allows you to structure reports into specific sections and
subsections, include data tables, or adjust tone for different audiences (e.g.,
"technical," "executive," "casual").

Define the desired output format explicitly in your input text.

### Python

    prompt = """
    Research the competitive landscape of EV batteries.

    Format the output as a technical report with the following structure:
    1. Executive Summary
    2. Key Players (Must include a data table comparing capacity and chemistry)
    3. Supply Chain Risks
    """

    interaction = client.interactions.create(
        input=prompt,
        agent="deep-research-preview-04-2026",
        background=True
    )

### JavaScript

    const prompt = `
    Research the competitive landscape of EV batteries.

    Format the output as a technical report with the following structure:
    1. Executive Summary
    2. Key Players (Must include a data table comparing capacity and chemistry)
    3. Supply Chain Risks
    `;

    const interaction = await client.interactions.create({
        input: prompt,
        agent: 'deep-research-preview-04-2026',
        background: true,
    });

### REST

    curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions" \
    -H "Content-Type: application/json" \
    -H "x-goog-api-key: $GEMINI_API_KEY" \
    -d '{
        "input": "Research the competitive landscape of EV batteries.\n\nFormat the output as a technical report with the following structure: \n1. Executive Summary\n2. Key Players (Must include a data table comparing capacity and chemistry)\n3. Supply Chain Risks",
        "agent": "deep-research-preview-04-2026",
        "background": true
    }'

## Multimodal inputs

Deep Research supports multimodal inputs, including images and documents (PDFs), allowing
the agent to analyze visual content and conduct web-based research
contextualized by the provided inputs.

### Python

    import time
    from google import genai

    client = genai.Client()

    prompt = """Analyze the interspecies dynamics and behavioral risks present
    in the provided image of the African watering hole. Specifically, investigate
    the symbiotic relationship between the avian species and the pachyderms
    shown, and conduct a risk assessment for the reticulated giraffes based on
    their drinking posture relative to the specific predator visible in the
    foreground."""

    interaction = client.interactions.create(
        input=[
            {"type": "text", "text": prompt},
            {
                "type": "image",
                "uri": "https://storage.googleapis.com/generativeai-downloads/images/generated_elephants_giraffes_zebras_sunset.jpg"
            }
        ],
        agent="deep-research-preview-04-2026",
        background=True
    )

    print(f"Research started: {interaction.id}")

    while True:
        interaction = client.interactions.get(interaction.id)
        if interaction.status == "completed":
            print(interaction.outputs[-1].text)
            break
        elif interaction.status == "failed":
            print(f"Research failed: {interaction.error}")
            break
        time.sleep(10)

### JavaScript

    import { GoogleGenAI } from '@google/genai';

    const client = new GoogleGenAI({});

    const prompt = `Analyze the interspecies dynamics and behavioral risks present
    in the provided image of the African watering hole. Specifically, investigate
    the symbiotic relationship between the avian species and the pachyderms
    shown, and conduct a risk assessment for the reticulated giraffes based on
    their drinking posture relative to the specific predator visible in the
    foreground.`;

    const interaction = await client.interactions.create({
        input: [
            { type: 'text', text: prompt },
            {
                type: 'image',
                uri: 'https://storage.googleapis.com/generativeai-downloads/images/generated_elephants_giraffes_zebras_sunset.jpg'
            }
        ],
        agent: 'deep-research-preview-04-2026',
        background: true
    });

    console.log(`Research started: ${interaction.id}`);

    while (true) {
        const result = await client.interactions.get(interaction.id);
        if (result.status === 'completed') {
            console.log(result.outputs[result.outputs.length - 1].text);
            break;
        } else if (result.status === 'failed') {
            console.log(`Research failed: ${result.error}`);
            break;
        }
        await new Promise(resolve => setTimeout(resolve, 10000));
    }

### REST

    # 1. Start the research task with image input
    curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions" \
    -H "Content-Type: application/json" \
    -H "x-goog-api-key: $GEMINI_API_KEY" \
    -d '{
        "input": [
            {"type": "text", "text": "Analyze the interspecies dynamics and behavioral risks present in the provided image of the African watering hole. Specifically, investigate the symbiotic relationship between the avian species and the pachyderms shown, and conduct a risk assessment for the reticulated giraffes based on their drinking posture relative to the specific predator visible in the foreground."},
            {"type": "image", "uri": "https://storage.googleapis.com/generativeai-downloads/images/generated_elephants_giraffes_zebras_sunset.jpg"}
        ],
        "agent": "deep-research-preview-04-2026",
        "background": true
    }'

    # 2. Poll for results (Replace INTERACTION_ID)
    # curl -X GET "https://generativelanguage.googleapis.com/v1beta/interactions/INTERACTION_ID" \
    # -H "x-goog-api-key: $GEMINI_API_KEY"

### Document understanding

> [!WARNING]
> **Preview:** Document understanding allows passing documents directly as multimodal input.

Pass documents directly as multimodal input. The agent analyzes the
provided documents and conducts research grounded in their content.

### Python

    from google import genai

    client = genai.Client()

    interaction = client.interactions.create(
        agent="deep-research-preview-04-2026",
        input=[
            {"type": "text", "text": "What is this document about?"},
            {
                "type": "document",
                "uri": "https://arxiv.org/pdf/1706.03762",
                "mime_type": "application/pdf",
            },
        ],
        background=True,
    )

### JavaScript

    import { GoogleGenAI } from '@google/genai';

    const client = new GoogleGenAI({});

    const interaction = await client.interactions.create({
        agent: 'deep-research-preview-04-2026',
        input: [
            { type: 'text', text: 'What is this document about?' },
            {
                type: 'document',
                uri: 'https://arxiv.org/pdf/1706.03762',
                mime_type: 'application/pdf'
            }
        ],
        background: true
    });

### REST

    # 1. Start the research task with document input
    curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions" \
    -H "Content-Type: application/json" \
    -H "x-goog-api-key: $GEMINI_API_KEY" \
    -d '{
        "agent": "deep-research-preview-04-2026",
        "input": [
            {"type": "text", "text": "What is this document about?"},
            {"type": "document", "uri": "https://arxiv.org/pdf/1706.03762", "mime_type": "application/pdf"}
        ],
        "background": true
    }'

## Handling long-running tasks

Deep Research is a multi-step process involving planning, searching, reading,
and writing. This cycle typically exceeds the standard timeout limits of
synchronous API calls.

Agents are required to use `background=True`. The API returns a partial
`Interaction` object immediately. You can use the `id` property to retrieve an
interaction for polling. The interaction state will transition from
`in_progress` to `completed` or `failed`.

### Streaming

Deep Research supports streaming to receive real-time updates on the research
progress including thought summaries, text output, and generated images.
You must set `stream=True` and `background=True`.

To receive intermediate reasoning steps (thoughts) and progress updates,
you must enable **thinking summaries** by setting `thinking_summaries` to
`"auto"` in the `agent_config`. Without this, the stream may only provide the
final results.

> [!NOTE]
> **Note:** The streaming connection can drop or expire. Since Deep Research tasks can run longer, your application should check the interaction status and reconnect as shown in the examples below.

#### Stream event types

| Event type | Delta type | Description |
|---|---|---|
| `content.delta` | `thought_summary` | Intermediate reasoning step from the agent. |
| `content.delta` | `text` | Part of the final text output. |
| `content.delta` | `image` | A generated image (base64-encoded). |

The following example starts a research task and processes the stream with
automatic reconnection. It tracks the `interaction_id` and `last_event_id` so
that if the connection drops (for example, after the 600-second timeout), it can
resume from where it left off.

### Python

    from google import genai

    client = genai.Client()

    interaction_id = None
    last_event_id = None
    is_complete = False

    def process_stream(stream):
        global interaction_id, last_event_id, is_complete
        for chunk in stream:
            if chunk.event_type == "interaction.start":
                interaction_id = chunk.interaction.id
            if chunk.event_id:
                last_event_id = chunk.event_id
            if chunk.event_type == "content.delta":
                if chunk.delta.type == "text":
                    print(chunk.delta.text, end="", flush=True)
                elif chunk.delta.type == "thought_summary":
                    print(f"Thought: {chunk.delta.content.text}", flush=True)
            elif chunk.event_type in ("interaction.complete", "error"):
                is_complete = True

    stream = client.interactions.create(
        input="Research the history of Google TPUs.",
        agent="deep-research-preview-04-2026",
        background=True,
        stream=True,
        agent_config={"type": "deep-research", "thinking_summaries": "auto"},
    )
    process_stream(stream)

    # Reconnect if the connection drops
    while not is_complete and interaction_id:
        status = client.interactions.get(interaction_id)
        if status.status != "in_progress":
            break
        stream = client.interactions.get(
            id=interaction_id, stream=True, last_event_id=last_event_id,
        )
        process_stream(stream)

### JavaScript

    import { GoogleGenAI } from '@google/genai';

    const client = new GoogleGenAI({});

    let interactionId;
    let lastEventId;
    let isComplete = false;

    async function processStream(stream) {
        for await (const chunk of stream) {
            if (chunk.event_type === 'interaction.start') {
                interactionId = chunk.interaction.id;
            }
            if (chunk.event_id) lastEventId = chunk.event_id;
            if (chunk.event_type === 'content.delta') {
                if (chunk.delta.type === 'text') {
                    process.stdout.write(chunk.delta.text);
                } else if (chunk.delta.type === 'thought_summary') {
                    console.log(`Thought: ${chunk.delta.content.text}`);
                }
            } else if (['interaction.complete', 'error'].includes(chunk.event_type)) {
                isComplete = true;
            }
        }
    }

    const stream = await client.interactions.create({
        input: 'Research the history of Google TPUs.',
        agent: 'deep-research-preview-04-2026',
        background: true,
        stream: true,
        agent_config: { type: 'deep-research', thinking_summaries: 'auto' },
    });
    await processStream(stream);

    // Reconnect if the connection drops
    while (!isComplete && interactionId) {
        const status = await client.interactions.get(interactionId);
        if (status.status !== 'in_progress') break;
        const resumeStream = await client.interactions.get(interactionId, {
            stream: true, last_event_id: lastEventId,
        });
        await processStream(resumeStream);
    }

### REST

    # 1. Start the stream (save the INTERACTION_ID from the interaction.start event
    #    and the last "event_id" you receive)
    curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions" \
    -H "Content-Type: application/json" \
    -H "x-goog-api-key: $GEMINI_API_KEY" \
    -d '{
        "input": "Research the history of Google TPUs.",
        "agent": "deep-research-preview-04-2026",
        "background": true,
        "stream": true,
        "agent_config": {
            "type": "deep-research",
            "thinking_summaries": "auto"
        }
    }'

    # 2. If the connection drops, reconnect with your saved IDs
    curl -X GET "https://generativelanguage.googleapis.com/v1beta/interactions/INTERACTION_ID?stream=true&last_event_id=LAST_EVENT_ID" \
    -H "x-goog-api-key: $GEMINI_API_KEY"

## Follow-up questions and interactions

You can continue the conversation after the agent returns the final report by
using the `previous_interaction_id`. This lets you to ask for clarification,
summarization or elaboration on specific sections of the research without
restarting the entire task.

### Python

    import time
    from google import genai

    client = genai.Client()

    interaction = client.interactions.create(
        input="Can you elaborate on the second point in the report?",
        model="gemini-3.1-pro-preview",
        previous_interaction_id="COMPLETED_INTERACTION_ID"
    )

    print(interaction.outputs[-1].text)

### JavaScript

    const interaction = await client.interactions.create({
        input: 'Can you elaborate on the second point in the report?',
        model: 'gemini-3.1-pro-preview',
        previous_interaction_id: 'COMPLETED_INTERACTION_ID'
    });
    console.log(interaction.outputs[interaction.outputs.length - 1].text);

### REST

    curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions" \
    -H "Content-Type: application/json" \
    -H "x-goog-api-key: $GEMINI_API_KEY" \
    -d '{
        "input": "Can you elaborate on the second point in the report?",
        "model": "gemini-3.1-pro-preview",
        "previous_interaction_id": "COMPLETED_INTERACTION_ID"
    }'

## When to use Gemini Deep Research Agent

Deep Research is an **agent**, not just a model. It is best suited for workloads
that require an "analyst-in-a-box" approach rather than low-latency chat.

| Feature | Standard Gemini Models | Gemini Deep Research Agent |
|---|---|---|
| **Latency** | Seconds | Minutes (Async/Background) |
| **Process** | Generate -\> Output | Plan -\> Search -\> Read -\> Iterate -\> Output |
| **Output** | Conversational text, code, short summaries | Detailed reports, long-form analysis, comparative tables |
| **Best For** | Chatbots, extraction, creative writing | Market analysis, due diligence, literature reviews, competitive landscaping |

## Agent configuration

Deep Research uses the `agent_config` parameter to control behavior.
Pass it as a dictionary with the following fields:

| Field | Type | Default | Description |
|---|---|---|---|
| `type` | `string` | Required | Must be `"deep-research"`. |
| `thinking_summaries` | `string` | `"none"` | Set to `"auto"` to receive intermediate reasoning steps during streaming. Set to `"none"` to disable. |
| `visualization` | `string` | `"auto"` | Set to `"auto"` to enable agent-generated charts and images. Set to `"off"` to disable. |
| `collaborative_planning` | `boolean` | `false` | Set to `true` to enable multi-turn plan review before research begins. |

### Python

    agent_config = {
        "type": "deep-research",
        "thinking_summaries": "auto",
        "visualization": "auto",
        "collaborative_planning": False,
    }

    interaction = client.interactions.create(
        agent="deep-research-preview-04-2026",
        input="Research the competitive landscape of cloud GPUs.",
        agent_config=agent_config,
        background=True,
    )

### JavaScript

    const interaction = await client.interactions.create({
        agent: 'deep-research-preview-04-2026',
        input: 'Research the competitive landscape of cloud GPUs.',
        agent_config: {
            type: 'deep-research',
            thinking_summaries: 'auto',
            visualization: 'auto',
            collaborative_planning: false,
        },
        background: true,
    });

### REST

    curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions" \
    -H "Content-Type: application/json" \
    -H "x-goog-api-key: $GEMINI_API_KEY" \
    -d '{
        "input": "Research the competitive landscape of cloud GPUs.",
        "agent": "deep-research-preview-04-2026",
        "agent_config": {
            "type": "deep-research",
            "thinking_summaries": "auto",
            "visualization": "auto",
            "collaborative_planning": false
        },
        "background": true
    }'

## Availability and pricing

You can access the Gemini Deep Research Agent using the Interactions API in Google AI Studio and the Gemini API.

Pricing follows a [pay-as-you-go model](https://ai.google.dev/gemini-api/docs/pricing#pricing-for-agents) based on the underlying Gemini models and the specific tools the agent utilizes. Unlike standard chat requests, where a request leads to one output, a Deep Research task is an agentic workflow. A single request triggers an autonomous loop of planning, searching, reading, and reasoning.

### Estimated costs

Costs vary based on the depth of research required. The agent autonomously determines how much reading and searching is necessary to answer your prompt.

- **Deep Research** (`deep-research-preview-04-2026`): For a typical query requiring moderate analysis, the agent might use \~80 search queries, \~250k input tokens (\~50-70% cached), and \~60k output tokens.
  - **Estimated total:** \~$1.00 -- $3.00 per task
- **Deep Research Max** (`deep-research-max-preview-04-2026`): For deep competitive landscape analysis or extensive due diligence, the agent might use up to \~160 search queries, \~900k input tokens (\~50-70% cached), and \~80k output tokens.
  - **Estimated total:** \~$3.00 -- $7.00 per task

> [!NOTE]
> **Note:** These figures are estimates based on preview rates and are subject to change.

## Safety considerations

Giving an agent access to the web and your private files requires careful
consideration of safety risks.

- **Prompt injection using files:** The agent reads the contents of the files you provide. Ensure that uploaded documents (PDFs, text files) come from trusted sources. A malicious file could contain hidden text designed to manipulate the agent's output.
- **Web content risks:** The agent searches the public web. While we implement robust safety filters, there is a risk that the agent may encounter and process malicious web pages. We recommend reviewing the `citations` provided in the response to verify the sources.
- **Exfiltration:** Be cautious when asking the agent to summarize sensitive internal data if you are also allowing it to browse the web.

## Best practices

- **Prompt for unknowns:** Instruct the agent on how to handle missing data. For example, add *"If specific figures for 2025 are not available,
  explicitly state they are projections or unavailable rather than
  estimating"* to your prompt.
- **Provide context:** Ground the agent's research by providing background information or constraints directly in the input prompt.
- **Use collaborative planning:** For complex queries, enable collaborative planning to review and refine the research plan before execution.
- **Multimodal inputs:** Deep Research Agent supports multi-modal inputs. Use cautiously, as this increases costs and risks context window overflow.

## Limitations

- **Beta status**: The Interactions API is in public beta. Features and schemas may change.
- **Custom tools:** You cannot currently provide custom Function Calling tools but you can use remote MCP (Model Context Protocol) servers with the Deep Research agent.
- **Structured output:** The Deep Research Agent currently doesn't support structured outputs.
- **Max research time:** The Deep Research agent has a maximum research time of 60 minutes. Most tasks should complete within 20 minutes.
- **Store requirement:** Agent execution using `background=True` requires `store=True`.
- **Google search:** [Google
  Search](https://ai.google.dev/gemini-api/docs/google-search) is enabled by default and [specific
  restrictions](https://ai.google.dev/gemini-api/terms#use-restrictions2) apply to the grounded results.

## What's next

- Learn more about the [Interactions API](https://ai.google.dev/gemini-api/docs/interactions).
- Try the [Deep Research in the Gemini API Cookbook](https://colab.research.google.com/github/google-gemini/cookbook/blob/main/quickstarts/Get_started_Deep_Research.ipynb).
- Learn how to use your own data using the [File Search](https://ai.google.dev/gemini-api/docs/file-search) tool.
