<!--
  Upstream snapshot - DO NOT EDIT - run _upstream/sync.sh to refresh
  Source: https://ai.google.dev/gemini-api/docs/deep-research.md.txt
  Synced: 2026-11-06
  Consumed by: gemini.interactions.wiretypes.ts, gemini.interactions.parser.ts, gemini.interactionsCreate.ts, gemini.interactionsPoller.ts
  Companion: ./gemini.interactions.guide.md (the Interactions API guide)
-->

> ## AI Agent Context
> Get the complete documentation index at: https://aistudio.google.com/llms.txt
> Use this file to discover all available pages.
> For the full documentation in a single file, fetch: https://aistudio.google.com/llms-full.txt

# Gemini Deep Research agent

{% callout type="note" %}
  This feature is in [preview](/docs/models#preview). The Deep Research agent is exclusively available using the [Interactions API](/docs/interactions-overview). You cannot access it through `generate_content`.

{% /callout %}

The Gemini Deep Research agent autonomously plans, executes, and synthesizes
multi-step research tasks. Powered by Gemini, it navigates complex
information landscapes to produce detailed, cited reports. New
capabilities allow you to collaboratively plan with the agent, connect to
external tools using MCP servers, include
visualizations (like charts and graphs), and provide documents directly
as input.

Research tasks involve iterative searching and reading and can take several
minutes to complete. You must use background execution (set `background=true`)
to run the agent asynchronously and poll for results or stream updates. See
[Handling long running tasks](/docs/deep-research#long-running-tasks) for more details.

The following example shows how to start a research task in the background
and poll for results.

{% tabs %}
  {% tab label="Python" %}
  ```python
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
          print(interaction.steps[-1].content[0].text)
          break
      elif interaction.status == "failed":
          print(f"Research failed: {interaction.error}")
          break
      time.sleep(10)
  ```

  {% /tab %}

  {% tab label="JavaScript" %}
  ```javascript
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
          console.log(result.output_text);
          break;
      } else if (result.status === 'failed') {
          console.log(`Research failed: ${JSON.stringify(result.errors)}`);
          break;
      }
      await new Promise(resolve => setTimeout(resolve, 10000));
  }
  ```

  {% /tab %}

  {% tab label="Java" %}
  ```java
  import com.google.genai.Client;
  import com.google.genai.gaos.models.interactions.CreateAgentInteraction;
  import com.google.genai.gaos.models.interactions.Interaction;
  import com.google.genai.gaos.models.interactions.InteractionStatus;
  import com.google.genai.gaos.models.interactions.InteractionsInput;
  import com.google.genai.gaos.models.operations.CreateInteractionRequestBody;
  import com.google.genai.gaos.models.operations.GetInteractionByIdRequest;
  import java.util.Collections;
  
  Client client = new Client();
  
  CreateAgentInteraction params =
      CreateAgentInteraction.builder()
          .agent("deep-research-preview-04-2026")
          .input(InteractionsInput.of("Research the history of Google TPUs."))
          .background(true)
          .build();
  
  Interaction interaction =
      client.interactions.create(CreateInteractionRequestBody.of(params)).interaction().get();
  
  System.out.println("Research started: " + interaction.id().orElse(""));
  
  while (true) {
    interaction =
        client.interactions
            .get(GetInteractionByIdRequest.builder().id(interaction.id().get()).build())
            .interaction()
            .get();
    if (InteractionStatus.COMPLETED.equals(interaction.status().orElse(null))) {
      System.out.println(interaction.outputText().orElse(""));
      break;
    } else if (InteractionStatus.FAILED.equals(interaction.status().orElse(null))) {
      System.out.println("Research failed: " + interaction.errors().orElse(Collections.emptyList()));
      break;
    }
    Thread.sleep(10000);
  }
  ```

  {% /tab %}

  {% tab label="Go" %}
  ```go
  package main
  
  import (
      "context"
      "fmt"
      "log"
      "time"
  
      "google.golang.org/genai"
      "google.golang.org/genai/interactions/models/interactions"
      "google.golang.org/genai/interactions/models/operations"
  )
  
  func main() {
      ctx := context.Background()
      client, err := genai.NewClient(ctx, nil)
      if err != nil {
          log.Fatal(err)
      }
  
      res, err := client.Interactions.Create(ctx, operations.CreateInteractionRequest{
          Body: operations.NewCreateInteractionRequestBody(interactions.CreateAgentInteraction{
              Agent:      interactions.AgentOption("deep-research-preview-04-2026"),
              Input:      interactions.NewInteractionsInput("Research the history of Google TPUs."),
              Background: genai.Ptr(true),
          }),
      })
      if err != nil {
          log.Fatal(err)
      }
      interaction := res.Interaction
      if interaction.ID != nil {
          fmt.Printf("Research started: %s\n", *interaction.ID)
      }
  
      for {
          getRes, err := client.Interactions.Get(ctx, operations.GetInteractionByIDRequest{
              ID: *interaction.ID,
          })
          if err != nil {
              log.Fatal(err)
          }
          interaction = getRes.Interaction
          if interaction.Status == interactions.InteractionStatusCompleted {
              if interaction.OutputText != nil {
                  fmt.Println(*interaction.OutputText)
              }
              break
          } else if interaction.Status == interactions.InteractionStatusFailed {
              fmt.Printf("Research failed: %v\n", interaction.Errors)
              break
          }
          time.Sleep(10 * time.Second)
      }
  }
  ```

  {% /tab %}

  {% tab label="REST" %}
  ```bash
  # 1. Start the research task
  curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions" \
  -H "Api-Revision: 2026-05-20" \
  -H "Content-Type: application/json" \
  -H "x-goog-api-key: $GEMINI_API_KEY" \
  -d '{
      "input": "Research the history of Google TPUs.",
      "agent": "deep-research-preview-04-2026",
      "background": true
  }'
  
  # 2. Poll for results (Replace INTERACTION_ID)
  # curl -X GET "https://generativelanguage.googleapis.com/v1beta/interactions/INTERACTION_ID" \
  # -H "Api-Revision: 2026-05-20" \
  # -H "x-goog-api-key: $GEMINI_API_KEY"
  ```

  {% /tab %}

{% /tabs %}

## Supported Versions  {% id="supported-models" %}

The Deep Research agent comes in two versions:

* **Deep Research** (`deep-research-preview-04-2026`): Designed for speed and efficiency, ideal to be streamed back to a client UI.
* **Deep Research Max** (`deep-research-max-preview-04-2026`): Maximum comprehensiveness for automated context gathering and synthesis.

## Collaborative planning  {% id="collaborative-planning" %}

{% callout type="note" %}
  Preview: Collaborative planning allows you to review and refine the research
  plan before execution.

{% /callout %}

Collaborative planning gives you control over the research direction
before the agent starts its work. When enabled, the agent returns a
proposed research plan instead of executing immediately. You can then
review, modify, or approve the plan through multi-turn interactions.

### Step 1: Request a plan  {% id="step-1-request-a-plan" %}

Set `collaborative_planning=True` in the first interaction. The agent
returns a research plan instead of a full report.

{% tabs %}
  {% tab label="Python" %}
  ```python
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
  print(result.steps[-1].content[0].text)
  ```

  {% /tab %}

  {% tab label="JavaScript" %}
  ```javascript
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
  console.log(result.steps.at(-1).content[0].text);
  ```

  {% /tab %}

  {% tab label="Java" %}
  ```java
  import com.google.genai.Client;
  import com.google.genai.gaos.models.interactions.CreateAgentInteraction;
  import com.google.genai.gaos.models.interactions.DeepResearchAgentConfig;
  import com.google.genai.gaos.models.interactions.Interaction;
  import com.google.genai.gaos.models.interactions.InteractionStatus;
  import com.google.genai.gaos.models.interactions.InteractionsInput;
  import com.google.genai.gaos.models.interactions.ThinkingSummaries;
  import com.google.genai.gaos.models.operations.CreateInteractionRequestBody;
  import com.google.genai.gaos.models.operations.GetInteractionByIdRequest;
  
  Client client = new Client();
  
  // First interaction: request a research plan
  CreateAgentInteraction params =
      CreateAgentInteraction.builder()
          .agent("deep-research-preview-04-2026")
          .input(InteractionsInput.of("Do some research on Google TPUs."))
          .agentConfig(
              DeepResearchAgentConfig.builder()
                  .thinkingSummaries(ThinkingSummaries.AUTO)
                  .collaborativePlanning(true)
                  .build())
          .background(true)
          .build();
  
  Interaction planInteraction =
      client.interactions.create(CreateInteractionRequestBody.of(params)).interaction().get();
  
  // Wait for and retrieve the plan
  Interaction result;
  while (true) {
    result =
        client.interactions
            .get(GetInteractionByIdRequest.builder().id(planInteraction.id().get()).build())
            .interaction()
            .get();
    if (InteractionStatus.COMPLETED.equals(result.status().orElse(null))) {
      break;
    }
    Thread.sleep(5000);
  }
  System.out.println(result.outputText().orElse(""));
  ```

  {% /tab %}

  {% tab label="Go" %}
  ```go
  package main
  
  import (
      "context"
      "fmt"
      "log"
      "time"
  
      "google.golang.org/genai"
      "google.golang.org/genai/interactions/models/interactions"
      "google.golang.org/genai/interactions/models/operations"
  )
  
  func main() {
      ctx := context.Background()
      client, err := genai.NewClient(ctx, nil)
      if err != nil {
          log.Fatal(err)
      }
  
      agentCfg := interactions.NewCreateAgentInteractionAgentConfig(interactions.DeepResearchAgentConfig{
          ThinkingSummaries:     interactions.ThinkingSummariesAuto.ToPointer(),
          CollaborativePlanning: genai.Ptr(true),
      })
  
      // First interaction: request a research plan
      planRes, err := client.Interactions.Create(ctx, operations.CreateInteractionRequest{
          Body: operations.NewCreateInteractionRequestBody(interactions.CreateAgentInteraction{
              Agent:       interactions.AgentOption("deep-research-preview-04-2026"),
              Input:       interactions.NewInteractionsInput("Do some research on Google TPUs."),
              AgentConfig: &agentCfg,
              Background:  genai.Ptr(true),
          }),
      })
      if err != nil {
          log.Fatal(err)
      }
  
      // Wait for and retrieve the plan
      var result *interactions.Interaction
      for {
          getRes, err := client.Interactions.Get(ctx, operations.GetInteractionByIDRequest{
              ID: *planRes.Interaction.ID,
          })
          if err != nil {
              log.Fatal(err)
          }
          result = getRes.Interaction
          if result.Status == interactions.InteractionStatusCompleted {
              break
          }
          time.Sleep(5 * time.Second)
      }
      if result.OutputText != nil {
          fmt.Println(*result.OutputText)
      }
  }
  ```

  {% /tab %}

  {% tab label="REST" %}
  ```bash
  curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions" \
  -H "Api-Revision: 2026-05-20" \
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
  ```

  {% /tab %}

{% /tabs %}

### Step 2: Refine the plan (optional)  {% id="step-2-refine-the-plan-optional" %}

Use `previous_interaction_id` to continue the conversation and iterate
on the plan. Keep `collaborative_planning=True` to stay in planning
mode.

{% tabs %}
  {% tab label="Python" %}
  ```python
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
  print(result.steps[-1].content[0].text)
  ```

  {% /tab %}

  {% tab label="JavaScript" %}
  ```javascript
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
  console.log(result.steps.at(-1).content[0].text);
  ```

  {% /tab %}

  {% tab label="Java" %}
  ```java
  import com.google.genai.Client;
  import com.google.genai.gaos.models.interactions.CreateAgentInteraction;
  import com.google.genai.gaos.models.interactions.DeepResearchAgentConfig;
  import com.google.genai.gaos.models.interactions.Interaction;
  import com.google.genai.gaos.models.interactions.InteractionStatus;
  import com.google.genai.gaos.models.interactions.InteractionsInput;
  import com.google.genai.gaos.models.interactions.ThinkingSummaries;
  import com.google.genai.gaos.models.operations.CreateInteractionRequestBody;
  import com.google.genai.gaos.models.operations.GetInteractionByIdRequest;
  
  Client client = new Client();
  String planInteractionId = "PLAN_INTERACTION_ID";
  
  // Second interaction: refine the plan
  CreateAgentInteraction params =
      CreateAgentInteraction.builder()
          .agent("deep-research-preview-04-2026")
          .input(
              InteractionsInput.of(
                  "Focus more on the differences between Google TPUs and competitor hardware, and less on the history."))
          .agentConfig(
              DeepResearchAgentConfig.builder()
                  .thinkingSummaries(ThinkingSummaries.AUTO)
                  .collaborativePlanning(true)
                  .build())
          .previousInteractionId(planInteractionId)
          .background(true)
          .build();
  
  Interaction refinedPlan =
      client.interactions.create(CreateInteractionRequestBody.of(params)).interaction().get();
  
  Interaction result;
  while (true) {
    result =
        client.interactions
            .get(GetInteractionByIdRequest.builder().id(refinedPlan.id().get()).build())
            .interaction()
            .get();
    if (InteractionStatus.COMPLETED.equals(result.status().orElse(null))) {
      break;
    }
    Thread.sleep(5000);
  }
  System.out.println(result.outputText().orElse(""));
  ```

  {% /tab %}

  {% tab label="Go" %}
  ```go
  package main
  
  import (
      "context"
      "fmt"
      "log"
      "time"
  
      "google.golang.org/genai"
      "google.golang.org/genai/interactions/models/interactions"
      "google.golang.org/genai/interactions/models/operations"
  )
  
  func main() {
      ctx := context.Background()
      client, err := genai.NewClient(ctx, nil)
      if err != nil {
          log.Fatal(err)
      }
  
      planInteractionID := "PLAN_INTERACTION_ID"
      agentCfg := interactions.NewCreateAgentInteractionAgentConfig(interactions.DeepResearchAgentConfig{
          ThinkingSummaries:     interactions.ThinkingSummariesAuto.ToPointer(),
          CollaborativePlanning: genai.Ptr(true),
      })
  
      // Second interaction: refine the plan
      refinedRes, err := client.Interactions.Create(ctx, operations.CreateInteractionRequest{
          Body: operations.NewCreateInteractionRequestBody(interactions.CreateAgentInteraction{
              Agent:                 interactions.AgentOption("deep-research-preview-04-2026"),
              Input:                 interactions.NewInteractionsInput("Focus more on the differences between Google TPUs and competitor hardware, and less on the history."),
              AgentConfig:           &agentCfg,
              PreviousInteractionID: genai.Ptr(planInteractionID),
              Background:            genai.Ptr(true),
          }),
      })
      if err != nil {
          log.Fatal(err)
      }
  
      var result *interactions.Interaction
      for {
          getRes, err := client.Interactions.Get(ctx, operations.GetInteractionByIDRequest{
              ID: *refinedRes.Interaction.ID,
          })
          if err != nil {
              log.Fatal(err)
          }
          result = getRes.Interaction
          if result.Status == interactions.InteractionStatusCompleted {
              break
          }
          time.Sleep(5 * time.Second)
      }
      if result.OutputText != nil {
          fmt.Println(*result.OutputText)
      }
  }
  ```

  {% /tab %}

  {% tab label="REST" %}
  ```bash
  curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions" \
  -H "Api-Revision: 2026-05-20" \
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
  ```

  {% /tab %}

{% /tabs %}

### Step 3: Approve and execute  {% id="step-3-approve-and-execute" %}

Set `collaborative_planning=False` (or omit it) to approve the plan and
start the research.

{% tabs %}
  {% tab label="Python" %}
  ```python
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
  print(result.steps[-1].content[0].text)
  ```

  {% /tab %}

  {% tab label="JavaScript" %}
  ```javascript
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
  console.log(result.steps.at(-1).content[0].text);
  ```

  {% /tab %}

  {% tab label="Java" %}
  ```java
  import com.google.genai.Client;
  import com.google.genai.gaos.models.interactions.CreateAgentInteraction;
  import com.google.genai.gaos.models.interactions.DeepResearchAgentConfig;
  import com.google.genai.gaos.models.interactions.Interaction;
  import com.google.genai.gaos.models.interactions.InteractionStatus;
  import com.google.genai.gaos.models.interactions.InteractionsInput;
  import com.google.genai.gaos.models.interactions.ThinkingSummaries;
  import com.google.genai.gaos.models.operations.CreateInteractionRequestBody;
  import com.google.genai.gaos.models.operations.GetInteractionByIdRequest;
  
  Client client = new Client();
  String refinedPlanId = "REFINED_PLAN_ID";
  
  // Third interaction: approve the plan and kick off research
  CreateAgentInteraction params =
      CreateAgentInteraction.builder()
          .agent("deep-research-preview-04-2026")
          .input(InteractionsInput.of("Plan looks good!"))
          .agentConfig(
              DeepResearchAgentConfig.builder()
                  .thinkingSummaries(ThinkingSummaries.AUTO)
                  .collaborativePlanning(false)
                  .build())
          .previousInteractionId(refinedPlanId)
          .background(true)
          .build();
  
  Interaction finalReport =
      client.interactions.create(CreateInteractionRequestBody.of(params)).interaction().get();
  
  Interaction result;
  while (true) {
    result =
        client.interactions
            .get(GetInteractionByIdRequest.builder().id(finalReport.id().get()).build())
            .interaction()
            .get();
    if (InteractionStatus.COMPLETED.equals(result.status().orElse(null))) {
      break;
    }
    Thread.sleep(5000);
  }
  System.out.println(result.outputText().orElse(""));
  ```

  {% /tab %}

  {% tab label="Go" %}
  ```go
  package main
  
  import (
      "context"
      "fmt"
      "log"
      "time"
  
      "google.golang.org/genai"
      "google.golang.org/genai/interactions/models/interactions"
      "google.golang.org/genai/interactions/models/operations"
  )
  
  func main() {
      ctx := context.Background()
      client, err := genai.NewClient(ctx, nil)
      if err != nil {
          log.Fatal(err)
      }
  
      refinedPlanID := "REFINED_PLAN_ID"
      agentCfg := interactions.NewCreateAgentInteractionAgentConfig(interactions.DeepResearchAgentConfig{
          ThinkingSummaries:     interactions.ThinkingSummariesAuto.ToPointer(),
          CollaborativePlanning: genai.Ptr(false),
      })
  
      // Third interaction: approve the plan and kick off research
      finalRes, err := client.Interactions.Create(ctx, operations.CreateInteractionRequest{
          Body: operations.NewCreateInteractionRequestBody(interactions.CreateAgentInteraction{
              Agent:                 interactions.AgentOption("deep-research-preview-04-2026"),
              Input:                 interactions.NewInteractionsInput("Plan looks good!"),
              AgentConfig:           &agentCfg,
              PreviousInteractionID: genai.Ptr(refinedPlanID),
              Background:            genai.Ptr(true),
          }),
      })
      if err != nil {
          log.Fatal(err)
      }
  
      var result *interactions.Interaction
      for {
          getRes, err := client.Interactions.Get(ctx, operations.GetInteractionByIDRequest{
              ID: *finalRes.Interaction.ID,
          })
          if err != nil {
              log.Fatal(err)
          }
          result = getRes.Interaction
          if result.Status == interactions.InteractionStatusCompleted {
              break
          }
          time.Sleep(5 * time.Second)
      }
      if result.OutputText != nil {
          fmt.Println(*result.OutputText)
      }
  }
  ```

  {% /tab %}

  {% tab label="REST" %}
  ```bash
  curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions" \
  -H "Api-Revision: 2026-05-20" \
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
  ```

  {% /tab %}

{% /tabs %}

## Visualization  {% id="visualization" %}

{% callout type="note" %}
  Preview: Visualization allows the agent to generate charts and graphs to support
  its findings.

{% /callout %}

When `visualization` is set to `"auto"`, the agent can generate charts,
graphs, and other visual elements to support its research findings.
Generated images are included in the response steps and streamed as
`image` deltas. For best results, explicitly ask for visuals in your
query - for example, "Include charts showing trends over time" or
"Generate graphics comparing market share." Setting `visualization` to
`"auto"` enables the capability, but the agent generates visuals only
when the prompt requests them.

{% tabs %}
  {% tab label="Python" %}
  ```python
  import base64
  
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
  
  for step in result.steps:
      if step.type == "model_output":
          for content_item in step.content:
              if content_item.type == "text":
                  print(content_item.text)
              elif content_item.type == "image" and content_item.data:
                  image_bytes = base64.b64decode(content_item.data)
                  print(f"Received image: {len(image_bytes)} bytes")
  ```

  {% /tab %}

  {% tab label="JavaScript" %}
  ```javascript
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
  
  for (const step of result.steps) {
      if (step.type === 'model_output') {
          for (const contentItem of step.content || []) {
              if (contentItem.type === 'text') {
                  console.log(contentItem.text);
              } else if (contentItem.type === 'image' && contentItem.data) {
                  console.log(`[Image Output: ${contentItem.data.substring(0, 20)}...]`);
              }
          }
      }
  }
  ```

  {% /tab %}

  {% tab label="Java" %}
  ```java
  import com.google.genai.Client;
  import com.google.genai.gaos.models.interactions.Content;
  import com.google.genai.gaos.models.interactions.CreateAgentInteraction;
  import com.google.genai.gaos.models.interactions.DeepResearchAgentConfig;
  import com.google.genai.gaos.models.interactions.ImageContent;
  import com.google.genai.gaos.models.interactions.Interaction;
  import com.google.genai.gaos.models.interactions.InteractionStatus;
  import com.google.genai.gaos.models.interactions.InteractionsInput;
  import com.google.genai.gaos.models.interactions.ModelOutputStep;
  import com.google.genai.gaos.models.interactions.Step;
  import com.google.genai.gaos.models.interactions.TextContent;
  import com.google.genai.gaos.models.interactions.Visualization;
  import com.google.genai.gaos.models.operations.CreateInteractionRequestBody;
  import com.google.genai.gaos.models.operations.GetInteractionByIdRequest;
  import java.util.Base64;
  import java.util.Collections;
  
  Client client = new Client();
  
  CreateAgentInteraction params =
      CreateAgentInteraction.builder()
          .agent("deep-research-preview-04-2026")
          .input(
              InteractionsInput.of(
                  "Analyze global semiconductor market trends. Include graphics showing market share changes."))
          .agentConfig(DeepResearchAgentConfig.builder().visualization(Visualization.AUTO).build())
          .background(true)
          .build();
  
  Interaction interaction =
      client.interactions.create(CreateInteractionRequestBody.of(params)).interaction().get();
  
  System.out.println("Research started: " + interaction.id().orElse(""));
  
  Interaction result;
  while (true) {
    result =
        client.interactions
            .get(GetInteractionByIdRequest.builder().id(interaction.id().get()).build())
            .interaction()
            .get();
    if (InteractionStatus.COMPLETED.equals(result.status().orElse(null))) {
      break;
    }
    Thread.sleep(5000);
  }
  
  for (Step step : result.steps().orElse(Collections.emptyList())) {
    if (step instanceof ModelOutputStep) {
      for (Content contentItem : ((ModelOutputStep) step).content().orElse(Collections.emptyList())) {
        if (contentItem instanceof TextContent) {
          System.out.println(((TextContent) contentItem).text().orElse(""));
        } else if (contentItem instanceof ImageContent) {
          ImageContent img = (ImageContent) contentItem;
          if (img.data().isPresent()) {
            byte[] imageBytes = Base64.getDecoder().decode(img.data().get());
            System.out.println("Received image: " + imageBytes.length + " bytes");
          }
        }
      }
    }
  }
  ```

  {% /tab %}

  {% tab label="Go" %}
  ```go
  package main
  
  import (
      "context"
      "encoding/base64"
      "fmt"
      "log"
      "time"
  
      "google.golang.org/genai"
      "google.golang.org/genai/interactions/models/interactions"
      "google.golang.org/genai/interactions/models/operations"
  )
  
  func main() {
      ctx := context.Background()
      client, err := genai.NewClient(ctx, nil)
      if err != nil {
          log.Fatal(err)
      }
  
      agentCfg := interactions.NewCreateAgentInteractionAgentConfig(interactions.DeepResearchAgentConfig{
          Visualization: interactions.VisualizationAuto.ToPointer(),
      })
  
      res, err := client.Interactions.Create(ctx, operations.CreateInteractionRequest{
          Body: operations.NewCreateInteractionRequestBody(interactions.CreateAgentInteraction{
              Agent:       interactions.AgentOption("deep-research-preview-04-2026"),
              Input:       interactions.NewInteractionsInput("Analyze global semiconductor market trends. Include graphics showing market share changes."),
              AgentConfig: &agentCfg,
              Background:  genai.Ptr(true),
          }),
      })
      if err != nil {
          log.Fatal(err)
      }
      if res.Interaction.ID != nil {
          fmt.Printf("Research started: %s\n", *res.Interaction.ID)
      }
  
      var result *interactions.Interaction
      for {
          getRes, err := client.Interactions.Get(ctx, operations.GetInteractionByIDRequest{
              ID: *res.Interaction.ID,
          })
          if err != nil {
              log.Fatal(err)
          }
          result = getRes.Interaction
          if result.Status == interactions.InteractionStatusCompleted {
              break
          }
          time.Sleep(5 * time.Second)
      }
  
      for _, step := range result.Steps {
          if outStep := step.ModelOutputStep; outStep != nil {
              for _, contentItem := range outStep.Content {
                  if textContent := contentItem.TextContent; textContent != nil {
                      fmt.Println(textContent.GetText())
                  } else if imgContent := contentItem.ImageContent; imgContent != nil && imgContent.Data != nil {
                      imageBytes, err := base64.StdEncoding.DecodeString(*imgContent.Data)
                      if err == nil {
                          fmt.Printf("Received image: %d bytes\n", len(imageBytes))
                      }
                  }
              }
          }
      }
  }
  ```

  {% /tab %}

  {% tab label="REST" %}
  ```bash
  curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions" \
  -H "Api-Revision: 2026-05-20" \
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
  ```

  {% /tab %}

{% /tabs %}

## Supported tools  {% id="supported-tools" %}

Deep Research supports multiple built-in and external tools. By default
(when no `tools` parameter is provided), the agent has access to Google
Search, URL Context, and Code Execution. You can explicitly
specify tools to restrict or extend the agent's capabilities.

| Tool | Type value | Description |
| :--- | :--- | :--- |
| Google Search | `google_search` | Search the public web. Enabled by default. |
| URL Context | `url_context` | Read and summarize web page content. Enabled by default. |
| Code Execution | `code_execution` | Execute code to perform calculations and data analysis. Enabled by default. |
| MCP Server | `mcp_server` | Connect to remote MCP servers for external tool access. |
| File Search | `file_search` | Search your uploaded document corpora. |

### Google Search  {% id="google-search" %}

Explicitly enable Google Search as the only tool:

{% tabs %}
  {% tab label="Python" %}
  ```python
  interaction = client.interactions.create(
      agent="deep-research-preview-04-2026",
      input="What are the latest developments in quantum computing?",
      tools=[{"type": "google_search"}],
      background=True,
  )
  ```

  {% /tab %}

  {% tab label="JavaScript" %}
  ```javascript
  const interaction = await client.interactions.create({
      agent: 'deep-research-preview-04-2026',
      input: 'What are the latest developments in quantum computing?',
      tools: [{ type: 'google_search' }],
      background: true
  });
  ```

  {% /tab %}

  {% tab label="Java" %}
  ```java
  import com.google.genai.Client;
  import com.google.genai.gaos.models.interactions.CreateAgentInteraction;
  import com.google.genai.gaos.models.interactions.GoogleSearch;
  import com.google.genai.gaos.models.interactions.Interaction;
  import com.google.genai.gaos.models.interactions.InteractionsInput;
  import com.google.genai.gaos.models.operations.CreateInteractionRequestBody;
  import java.util.Arrays;
  
  Client client = new Client();
  
  CreateAgentInteraction params =
      CreateAgentInteraction.builder()
          .agent("deep-research-preview-04-2026")
          .input(InteractionsInput.of("What are the latest developments in quantum computing?"))
          .tools(Arrays.asList(GoogleSearch.builder().build()))
          .background(true)
          .build();
  
  Interaction interaction =
      client.interactions.create(CreateInteractionRequestBody.of(params)).interaction().get();
  ```

  {% /tab %}

  {% tab label="Go" %}
  ```go
  package main
  
  import (
      "context"
      "log"
  
      "google.golang.org/genai"
      "google.golang.org/genai/interactions/models/interactions"
      "google.golang.org/genai/interactions/models/operations"
  )
  
  func main() {
      ctx := context.Background()
      client, err := genai.NewClient(ctx, nil)
      if err != nil {
          log.Fatal(err)
      }
  
      _, err = client.Interactions.Create(ctx, operations.CreateInteractionRequest{
          Body: operations.NewCreateInteractionRequestBody(interactions.CreateAgentInteraction{
              Agent: interactions.AgentOption("deep-research-preview-04-2026"),
              Input: interactions.NewInteractionsInput("What are the latest developments in quantum computing?"),
              Tools: []interactions.Tool{
                  interactions.NewTool(interactions.GoogleSearch{}),
              },
              Background: genai.Ptr(true),
          }),
      })
      if err != nil {
          log.Fatal(err)
      }
  }
  ```

  {% /tab %}

  {% tab label="REST" %}
  ```bash
  curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions" \
  -H "Api-Revision: 2026-05-20" \
  -H "Content-Type: application/json" \
  -H "x-goog-api-key: $GEMINI_API_KEY" \
  -d '{
      "agent": "deep-research-preview-04-2026",
      "input": "What are the latest developments in quantum computing?",
      "tools": [{"type": "google_search"}],
      "background": true
  }'
  ```

  {% /tab %}

{% /tabs %}

### URL Context  {% id="url-context" %}

Give the agent the ability to read and summarize specific web pages:

{% tabs %}
  {% tab label="Python" %}
  ```python
  interaction = client.interactions.create(
      agent="deep-research-preview-04-2026",
      input="Summarize the content of https://www.wikipedia.org/.",
      tools=[{"type": "url_context"}],
      background=True,
  )
  ```

  {% /tab %}

  {% tab label="JavaScript" %}
  ```javascript
  const interaction = await client.interactions.create({
      agent: 'deep-research-preview-04-2026',
      input: 'Summarize the content of https://www.wikipedia.org/.',
      tools: [{ type: 'url_context' }],
      background: true
  });
  ```

  {% /tab %}

  {% tab label="Java" %}
  ```java
  import com.google.genai.Client;
  import com.google.genai.gaos.models.interactions.CreateAgentInteraction;
  import com.google.genai.gaos.models.interactions.Interaction;
  import com.google.genai.gaos.models.interactions.InteractionsInput;
  import com.google.genai.gaos.models.interactions.URLContext;
  import com.google.genai.gaos.models.operations.CreateInteractionRequestBody;
  import java.util.Arrays;
  
  Client client = new Client();
  
  CreateAgentInteraction params =
      CreateAgentInteraction.builder()
          .agent("deep-research-preview-04-2026")
          .input(InteractionsInput.of("Summarize the content of https://www.wikipedia.org/."))
          .tools(Arrays.asList(URLContext.builder().build()))
          .background(true)
          .build();
  
  Interaction interaction =
      client.interactions.create(CreateInteractionRequestBody.of(params)).interaction().get();
  ```

  {% /tab %}

  {% tab label="Go" %}
  ```go
  package main
  
  import (
      "context"
      "log"
  
      "google.golang.org/genai"
      "google.golang.org/genai/interactions/models/interactions"
      "google.golang.org/genai/interactions/models/operations"
  )
  
  func main() {
      ctx := context.Background()
      client, err := genai.NewClient(ctx, nil)
      if err != nil {
          log.Fatal(err)
      }
  
      _, err = client.Interactions.Create(ctx, operations.CreateInteractionRequest{
          Body: operations.NewCreateInteractionRequestBody(interactions.CreateAgentInteraction{
              Agent: interactions.AgentOption("deep-research-preview-04-2026"),
              Input: interactions.NewInteractionsInput("Summarize the content of https://www.wikipedia.org/."),
              Tools: []interactions.Tool{
                  interactions.NewTool(interactions.URLContext{}),
              },
              Background: genai.Ptr(true),
          }),
      })
      if err != nil {
          log.Fatal(err)
      }
  }
  ```

  {% /tab %}

  {% tab label="REST" %}
  ```bash
  curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions" \
  -H "Api-Revision: 2026-05-20" \
  -H "Content-Type: application/json" \
  -H "x-goog-api-key: $GEMINI_API_KEY" \
  -d '{
      "agent": "deep-research-preview-04-2026",
      "input": "Summarize the content of https://www.wikipedia.org/.",
      "tools": [{"type": "url_context"}],
      "background": true
  }'
  ```

  {% /tab %}

{% /tabs %}

### Code Execution  {% id="code-execution" %}

Allow the agent to execute code for calculations and data analysis:

{% tabs %}
  {% tab label="Python" %}
  ```python
  interaction = client.interactions.create(
      agent="deep-research-preview-04-2026",
      input="Calculate the 50th Fibonacci number.",
      tools=[{"type": "code_execution"}],
      background=True,
  )
  ```

  {% /tab %}

  {% tab label="JavaScript" %}
  ```javascript
  const interaction = await client.interactions.create({
      agent: 'deep-research-preview-04-2026',
      input: 'Calculate the 50th Fibonacci number.',
      tools: [{ type: 'code_execution' }],
      background: true
  });
  ```

  {% /tab %}

  {% tab label="Java" %}
  ```java
  import com.google.genai.Client;
  import com.google.genai.gaos.models.interactions.CodeExecution;
  import com.google.genai.gaos.models.interactions.CreateAgentInteraction;
  import com.google.genai.gaos.models.interactions.Interaction;
  import com.google.genai.gaos.models.interactions.InteractionsInput;
  import com.google.genai.gaos.models.operations.CreateInteractionRequestBody;
  import java.util.Arrays;
  
  Client client = new Client();
  
  CreateAgentInteraction params =
      CreateAgentInteraction.builder()
          .agent("deep-research-preview-04-2026")
          .input(InteractionsInput.of("Calculate the 50th Fibonacci number."))
          .tools(Arrays.asList(CodeExecution.builder().build()))
          .background(true)
          .build();
  
  Interaction interaction =
      client.interactions.create(CreateInteractionRequestBody.of(params)).interaction().get();
  ```

  {% /tab %}

  {% tab label="Go" %}
  ```go
  package main
  
  import (
      "context"
      "log"
  
      "google.golang.org/genai"
      "google.golang.org/genai/interactions/models/interactions"
      "google.golang.org/genai/interactions/models/operations"
  )
  
  func main() {
      ctx := context.Background()
      client, err := genai.NewClient(ctx, nil)
      if err != nil {
          log.Fatal(err)
      }
  
      _, err = client.Interactions.Create(ctx, operations.CreateInteractionRequest{
          Body: operations.NewCreateInteractionRequestBody(interactions.CreateAgentInteraction{
              Agent: interactions.AgentOption("deep-research-preview-04-2026"),
              Input: interactions.NewInteractionsInput("Calculate the 50th Fibonacci number."),
              Tools: []interactions.Tool{
                  interactions.NewTool(interactions.CodeExecution{}),
              },
              Background: genai.Ptr(true),
          }),
      })
      if err != nil {
          log.Fatal(err)
      }
  }
  ```

  {% /tab %}

  {% tab label="REST" %}
  ```bash
  curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions" \
  -H "Api-Revision: 2026-05-20" \
  -H "Content-Type: application/json" \
  -H "x-goog-api-key: $GEMINI_API_KEY" \
  -d '{
      "input": "Calculate the 50th Fibonacci number.",
      "agent": "deep-research-preview-04-2026",
      "tools": [{"type": "code_execution"}],
      "background": true
  }'
  ```

  {% /tab %}

{% /tabs %}

### MCP servers  {% id="mcp-servers" %}

{% callout type="note" %}
  Preview: Connect to remote MCP servers to give the agent access to external
  tools and services.

{% /callout %}

Provide the server `name` and `url` in the tools configuration. You can also
pass authentication credentials and restrict which tools the agent can call.

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `type` | `string` | Yes | Must be `"mcp_server"`. |
| `name` | `string` | No | A display name for the MCP server. |
| `url` | `string` | No | The full URL for the MCP server endpoint. |
| `headers` | `object` | No | Key-value pairs sent as HTTP headers with every request to the server (for example, authentication tokens). |
| `allowed_tools` | `array` | No | Restrict which tools from the server the agent may call. |

#### Basic usage  {% id="mcp-basic" %}

{% tabs %}
  {% tab label="Python" %}
  ```python
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
  ```

  {% /tab %}

  {% tab label="JavaScript" %}
  ```javascript
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
  ```

  {% /tab %}

  {% tab label="Java" %}
  ```java
  import com.google.genai.Client;
  import com.google.genai.gaos.models.interactions.CreateAgentInteraction;
  import com.google.genai.gaos.models.interactions.Interaction;
  import com.google.genai.gaos.models.interactions.InteractionsInput;
  import com.google.genai.gaos.models.interactions.MCPServer;
  import com.google.genai.gaos.models.operations.CreateInteractionRequestBody;
  import java.util.Arrays;
  import java.util.Collections;
  
  Client client = new Client();
  
  CreateAgentInteraction params =
      CreateAgentInteraction.builder()
          .agent("deep-research-preview-04-2026")
          .input(InteractionsInput.of("Check the status of my last server deployment."))
          .tools(
              Arrays.asList(
                  MCPServer.builder()
                      .name("Deployment Tracker")
                      .url("https://mcp.example.com/mcp")
                      .headers(Collections.singletonMap("Authorization", "Bearer my-token"))
                      .build()))
          .background(true)
          .build();
  
  Interaction interaction =
      client.interactions.create(CreateInteractionRequestBody.of(params)).interaction().get();
  ```

  {% /tab %}

  {% tab label="Go" %}
  ```go
  package main
  
  import (
      "context"
      "log"
  
      "google.golang.org/genai"
      "google.golang.org/genai/interactions/models/interactions"
      "google.golang.org/genai/interactions/models/operations"
  )
  
  func main() {
      ctx := context.Background()
      client, err := genai.NewClient(ctx, nil)
      if err != nil {
          log.Fatal(err)
      }
  
      _, err = client.Interactions.Create(ctx, operations.CreateInteractionRequest{
          Body: operations.NewCreateInteractionRequestBody(interactions.CreateAgentInteraction{
              Agent: interactions.AgentOption("deep-research-preview-04-2026"),
              Input: interactions.NewInteractionsInput("Check the status of my last server deployment."),
              Tools: []interactions.Tool{
                  interactions.NewTool(interactions.MCPServer{
                      Name: genai.Ptr("Deployment Tracker"),
                      URL:  genai.Ptr("https://mcp.example.com/mcp"),
                      Headers: map[string]string{
                          "Authorization": "Bearer my-token",
                      },
                  }),
              },
              Background: genai.Ptr(true),
          }),
      })
      if err != nil {
          log.Fatal(err)
      }
  }
  ```

  {% /tab %}

  {% tab label="REST" %}
  ```bash
  curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions" \
  -H "Api-Revision: 2026-05-20" \
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
  ```

  {% /tab %}

{% /tabs %}

### File Search  {% id="file-search" %}

Give the agent access to your own data by using the [File Search](/docs/file-search) tool.

{% tabs %}
  {% tab label="Python" %}
  ```python
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
  ```

  {% /tab %}

  {% tab label="JavaScript" %}
  ```javascript
  const interaction = await client.interactions.create({
      input: 'Compare our 2025 fiscal year report against current public web news.',
      agent: 'deep-research-preview-04-2026',
      background: true,
      tools: [
          { type: 'file_search', file_search_store_names: ['fileSearchStores/my-store-name'] },
      ]
  });
  ```

  {% /tab %}

  {% tab label="Java" %}
  ```java
  import com.google.genai.Client;
  import com.google.genai.gaos.models.interactions.CreateAgentInteraction;
  import com.google.genai.gaos.models.interactions.FileSearch;
  import com.google.genai.gaos.models.interactions.Interaction;
  import com.google.genai.gaos.models.interactions.InteractionsInput;
  import com.google.genai.gaos.models.operations.CreateInteractionRequestBody;
  import java.util.Arrays;
  
  Client client = new Client();
  
  CreateAgentInteraction params =
      CreateAgentInteraction.builder()
          .agent("deep-research-preview-04-2026")
          .input(
              InteractionsInput.of(
                  "Compare our 2025 fiscal year report against current public web news."))
          .tools(
              Arrays.asList(
                  FileSearch.builder()
                      .fileSearchStoreNames(Arrays.asList("fileSearchStores/my-store-name"))
                      .build()))
          .background(true)
          .build();
  
  Interaction interaction =
      client.interactions.create(CreateInteractionRequestBody.of(params)).interaction().get();
  ```

  {% /tab %}

  {% tab label="Go" %}
  ```go
  package main
  
  import (
      "context"
      "log"
  
      "google.golang.org/genai"
      "google.golang.org/genai/interactions/models/interactions"
      "google.golang.org/genai/interactions/models/operations"
  )
  
  func main() {
      ctx := context.Background()
      client, err := genai.NewClient(ctx, nil)
      if err != nil {
          log.Fatal(err)
      }
  
      _, err = client.Interactions.Create(ctx, operations.CreateInteractionRequest{
          Body: operations.NewCreateInteractionRequestBody(interactions.CreateAgentInteraction{
              Agent: interactions.AgentOption("deep-research-preview-04-2026"),
              Input: interactions.NewInteractionsInput("Compare our 2025 fiscal year report against current public web news."),
              Tools: []interactions.Tool{
                  interactions.NewTool(interactions.FileSearch{
                      FileSearchStoreNames: []string{"fileSearchStores/my-store-name"},
                  }),
              },
              Background: genai.Ptr(true),
          }),
      })
      if err != nil {
          log.Fatal(err)
      }
  }
  ```

  {% /tab %}

  {% tab label="REST" %}
  ```bash
  curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions" \
  -H "Api-Revision: 2026-05-20" \
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
  ```

  {% /tab %}

{% /tabs %}

## Steerability and formatting  {% id="steerability-and-formatting" %}

You can steer the agent's output by providing specific formatting instructions
in your prompt. This allows you to structure reports into specific sections and
subsections, include data tables, or adjust tone for different audiences (e.g.,
"technical," "executive," "casual").

Define the desired output format explicitly in your input text.

{% tabs %}
  {% tab label="Python" %}
  ```python
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
  ```

  {% /tab %}

  {% tab label="JavaScript" %}
  ```javascript
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
  ```

  {% /tab %}

  {% tab label="Java" %}
  ```java
  import com.google.genai.Client;
  import com.google.genai.gaos.models.interactions.CreateAgentInteraction;
  import com.google.genai.gaos.models.interactions.Interaction;
  import com.google.genai.gaos.models.interactions.InteractionsInput;
  import com.google.genai.gaos.models.operations.CreateInteractionRequestBody;
  
  Client client = new Client();
  
  String prompt =
      "Research the competitive landscape of EV batteries.\n\n"
          + "Format the output as a technical report with the following structure:\n"
          + "1. Executive Summary\n"
          + "2. Key Players (Must include a data table comparing capacity and chemistry)\n"
          + "3. Supply Chain Risks";
  
  CreateAgentInteraction params =
      CreateAgentInteraction.builder()
          .agent("deep-research-preview-04-2026")
          .input(InteractionsInput.of(prompt))
          .background(true)
          .build();
  
  Interaction interaction =
      client.interactions.create(CreateInteractionRequestBody.of(params)).interaction().get();
  ```

  {% /tab %}

  {% tab label="Go" %}
  ```go
  package main
  
  import (
      "context"
      "log"
  
      "google.golang.org/genai"
      "google.golang.org/genai/interactions/models/interactions"
      "google.golang.org/genai/interactions/models/operations"
  )
  
  func main() {
      ctx := context.Background()
      client, err := genai.NewClient(ctx, nil)
      if err != nil {
          log.Fatal(err)
      }
  
      prompt := "Research the competitive landscape of EV batteries.\n\n" +
          "Format the output as a technical report with the following structure:\n" +
          "1. Executive Summary\n" +
          "2. Key Players (Must include a data table comparing capacity and chemistry)\n" +
          "3. Supply Chain Risks"
  
      _, err = client.Interactions.Create(ctx, operations.CreateInteractionRequest{
          Body: operations.NewCreateInteractionRequestBody(interactions.CreateAgentInteraction{
              Agent:      interactions.AgentOption("deep-research-preview-04-2026"),
              Input:      interactions.NewInteractionsInput(prompt),
              Background: genai.Ptr(true),
          }),
      })
      if err != nil {
          log.Fatal(err)
      }
  }
  ```

  {% /tab %}

  {% tab label="REST" %}
  ```bash
  curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions" \
  -H "Api-Revision: 2026-05-20" \
  -H "Content-Type: application/json" \
  -H "x-goog-api-key: $GEMINI_API_KEY" \
  -d '{
      "input": "Research the competitive landscape of EV batteries.\n\nFormat the output as a technical report with the following structure: \n1. Executive Summary\n2. Key Players (Must include a data table comparing capacity and chemistry)\n3. Supply Chain Risks",
      "agent": "deep-research-preview-04-2026",
      "background": true
  }'
  ```

  {% /tab %}

{% /tabs %}

## Multimodal inputs  {% id="multimodal-inputs" %}

Deep Research supports multimodal inputs, including images and documents (PDFs),
allowing the agent to analyze visual content and conduct web-based research
contextualized by the provided inputs.

{% tabs %}
  {% tab label="Python" %}
  ```python
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
              "mime_type": "image/jpeg",
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
          print(interaction.steps[-1].content[0].text)
          break
      elif interaction.status == "failed":
          print(f"Research failed: {interaction.error}")
          break
      time.sleep(10)
  ```

  {% /tab %}

  {% tab label="JavaScript" %}
  ```javascript
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
              mime_type: "image/jpeg",
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
          console.log(result.output_text);
          break;
      } else if (result.status === 'failed') {
          console.log(`Research failed: ${JSON.stringify(result.errors)}`);
          break;
      }
      await new Promise(resolve => setTimeout(resolve, 10000));
  }
  ```

  {% /tab %}

  {% tab label="Java" %}
  ```java
  import com.google.genai.Client;
  import com.google.genai.gaos.models.interactions.CreateAgentInteraction;
  import com.google.genai.gaos.models.interactions.ImageContent;
  import com.google.genai.gaos.models.interactions.ImageContentMimeType;
  import com.google.genai.gaos.models.interactions.Interaction;
  import com.google.genai.gaos.models.interactions.InteractionStatus;
  import com.google.genai.gaos.models.interactions.InteractionsInput;
  import com.google.genai.gaos.models.interactions.TextContent;
  import com.google.genai.gaos.models.operations.CreateInteractionRequestBody;
  import com.google.genai.gaos.models.operations.GetInteractionByIdRequest;
  import java.util.Arrays;
  import java.util.Collections;
  
  Client client = new Client();
  
  String prompt =
      "Analyze the interspecies dynamics and behavioral risks present "
          + "in the provided image of the African watering hole. Specifically, investigate "
          + "the symbiotic relationship between the avian species and the pachyderms "
          + "shown, and conduct a risk assessment for the reticulated giraffes based on "
          + "their drinking posture relative to the specific predator visible in the "
          + "foreground.";
  
  CreateAgentInteraction params =
      CreateAgentInteraction.builder()
          .agent("deep-research-preview-04-2026")
          .input(
              InteractionsInput.ofContent(
                  Arrays.asList(
                      TextContent.builder().text(prompt).build(),
                      ImageContent.builder()
                          .mimeType(ImageContentMimeType.IMAGE_JPEG)
                          .uri(
                              "https://storage.googleapis.com/generativeai-downloads/images/generated_elephants_giraffes_zebras_sunset.jpg")
                          .build())))
          .background(true)
          .build();
  
  Interaction interaction =
      client.interactions.create(CreateInteractionRequestBody.of(params)).interaction().get();
  
  System.out.println("Research started: " + interaction.id().orElse(""));
  
  while (true) {
    interaction =
        client.interactions
            .get(GetInteractionByIdRequest.builder().id(interaction.id().get()).build())
            .interaction()
            .get();
    if (InteractionStatus.COMPLETED.equals(interaction.status().orElse(null))) {
      System.out.println(interaction.outputText().orElse(""));
      break;
    } else if (InteractionStatus.FAILED.equals(interaction.status().orElse(null))) {
      System.out.println("Research failed: " + interaction.errors().orElse(Collections.emptyList()));
      break;
    }
    Thread.sleep(10000);
  }
  ```

  {% /tab %}

  {% tab label="Go" %}
  ```go
  package main
  
  import (
      "context"
      "fmt"
      "log"
      "time"
  
      "google.golang.org/genai"
      "google.golang.org/genai/interactions/models/interactions"
      "google.golang.org/genai/interactions/models/operations"
  )
  
  func main() {
      ctx := context.Background()
      client, err := genai.NewClient(ctx, nil)
      if err != nil {
          log.Fatal(err)
      }
  
      prompt := "Analyze the interspecies dynamics and behavioral risks present " +
          "in the provided image of the African watering hole. Specifically, investigate " +
          "the symbiotic relationship between the avian species and the pachyderms " +
          "shown, and conduct a risk assessment for the reticulated giraffes based on " +
          "their drinking posture relative to the specific predator visible in the " +
          "foreground."
  
      res, err := client.Interactions.Create(ctx, operations.CreateInteractionRequest{
          Body: operations.NewCreateInteractionRequestBody(interactions.CreateAgentInteraction{
              Agent: interactions.AgentOption("deep-research-preview-04-2026"),
              Input: interactions.NewInteractionsInput([]interactions.Content{
                  interactions.NewContent(interactions.TextContent{Text: prompt}),
                  interactions.NewContent(interactions.ImageContent{
                      MimeType: interactions.ImageContentMimeType("image/jpeg").ToPointer(),
                      URI:      genai.Ptr("https://storage.googleapis.com/generativeai-downloads/images/generated_elephants_giraffes_zebras_sunset.jpg"),
                  }),
              }),
              Background: genai.Ptr(true),
          }),
      })
      if err != nil {
          log.Fatal(err)
      }
      interaction := res.Interaction
      if interaction.ID != nil {
          fmt.Printf("Research started: %s\n", *interaction.ID)
      }
  
      for {
          getRes, err := client.Interactions.Get(ctx, operations.GetInteractionByIDRequest{
              ID: *interaction.ID,
          })
          if err != nil {
              log.Fatal(err)
          }
          interaction = getRes.Interaction
          if interaction.Status == interactions.InteractionStatusCompleted {
              if interaction.OutputText != nil {
                  fmt.Println(*interaction.OutputText)
              }
              break
          } else if interaction.Status == interactions.InteractionStatusFailed {
              fmt.Printf("Research failed: %v\n", interaction.Errors)
              break
          }
          time.Sleep(10 * time.Second)
      }
  }
  ```

  {% /tab %}

  {% tab label="REST" %}
  ```bash
  # 1. Start the research task with image input
  curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions" \
  -H "Api-Revision: 2026-05-20" \
  -H "Content-Type: application/json" \
  -H "x-goog-api-key: $GEMINI_API_KEY" \
  -d '{
      "input": [
          {"type": "text", "text": "Analyze the interspecies dynamics and behavioral risks present in the provided image of the African watering hole. Specifically, investigate the symbiotic relationship between the avian species and the pachyderms shown, and conduct a risk assessment for the reticulated giraffes based on their drinking posture relative to the specific predator visible in the foreground."},
          {"type": "image", "mime_type": "image/jpeg", "uri": "https://storage.googleapis.com/generativeai-downloads/images/generated_elephants_giraffes_zebras_sunset.jpg"}
      ],
      "agent": "deep-research-preview-04-2026",
      "background": true
  }'
  
  # 2. Poll for results (Replace INTERACTION_ID)
  # curl -X GET "https://generativelanguage.googleapis.com/v1beta/interactions/INTERACTION_ID" \
  # -H "Api-Revision: 2026-05-20" \
  # -H "x-goog-api-key: $GEMINI_API_KEY"
  ```

  {% /tab %}

{% /tabs %}

### Document understanding  {% id="document-understanding" %}

{% callout type="note" %}
  Preview: Document understanding allows passing documents directly as multimodal
  input.

{% /callout %}

Pass documents directly as multimodal input. The agent analyzes the
provided documents and conducts research grounded in their content.

{% tabs %}
  {% tab label="Python" %}
  ```python
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
  ```

  {% /tab %}

  {% tab label="JavaScript" %}
  ```javascript
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
  ```

  {% /tab %}

  {% tab label="Java" %}
  ```java
  import com.google.genai.Client;
  import com.google.genai.gaos.models.interactions.CreateAgentInteraction;
  import com.google.genai.gaos.models.interactions.DocumentContent;
  import com.google.genai.gaos.models.interactions.DocumentContentMimeType;
  import com.google.genai.gaos.models.interactions.Interaction;
  import com.google.genai.gaos.models.interactions.InteractionsInput;
  import com.google.genai.gaos.models.interactions.TextContent;
  import com.google.genai.gaos.models.operations.CreateInteractionRequestBody;
  import java.util.Arrays;
  
  Client client = new Client();
  
  CreateAgentInteraction params =
      CreateAgentInteraction.builder()
          .agent("deep-research-preview-04-2026")
          .input(
              InteractionsInput.ofContent(
                  Arrays.asList(
                      TextContent.builder().text("What is this document about?").build(),
                      DocumentContent.builder()
                          .uri("https://arxiv.org/pdf/1706.03762")
                          .mimeType(DocumentContentMimeType.APPLICATION_PDF)
                          .build())))
          .background(true)
          .build();
  
  Interaction interaction =
      client.interactions.create(CreateInteractionRequestBody.of(params)).interaction().get();
  ```

  {% /tab %}

  {% tab label="Go" %}
  ```go
  package main
  
  import (
      "context"
      "log"
  
      "google.golang.org/genai"
      "google.golang.org/genai/interactions/models/interactions"
      "google.golang.org/genai/interactions/models/operations"
  )
  
  func main() {
      ctx := context.Background()
      client, err := genai.NewClient(ctx, nil)
      if err != nil {
          log.Fatal(err)
      }
  
      _, err = client.Interactions.Create(ctx, operations.CreateInteractionRequest{
          Body: operations.NewCreateInteractionRequestBody(interactions.CreateAgentInteraction{
              Agent: interactions.AgentOption("deep-research-preview-04-2026"),
              Input: interactions.NewInteractionsInput([]interactions.Content{
                  interactions.NewContent(interactions.TextContent{Text: "What is this document about?"}),
                  interactions.NewContent(interactions.DocumentContent{
                      URI:      genai.Ptr("https://arxiv.org/pdf/1706.03762"),
                      MimeType: interactions.DocumentContentMimeType("application/pdf").ToPointer(),
                  }),
              }),
              Background: genai.Ptr(true),
          }),
      })
      if err != nil {
          log.Fatal(err)
      }
  }
  ```

  {% /tab %}

  {% tab label="REST" %}
  ```bash
  # 1. Start the research task with document input
  curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions" \
  -H "Api-Revision: 2026-05-20" \
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
  ```

  {% /tab %}

{% /tabs %}

## Handling long-running tasks  {% id="long-running-tasks" %}

Deep Research is a multi-step process involving planning, searching, reading,
and writing. This cycle typically exceeds the standard timeout limits of
synchronous API calls.

Agents are required to use `background=True`. The API returns a partial
`Interaction` object immediately. You can use the `id` property to retrieve an
interaction for polling. The interaction state will transition from
`in_progress` to `completed` or `failed`.

### Streaming  {% id="streaming" %}

Deep Research supports streaming to receive real-time updates on the research
progress including thought summaries, text output, and generated images.
You must set `stream=True` and `background=True`.

To receive intermediate reasoning steps (thoughts) and progress updates,
you must enable **thinking summaries** by setting `thinking_summaries` to
`"auto"` in the `agent_config`. Without this, the stream may only provide the
final results.

{% callout type="note" %}
  Note: The streaming connection can drop or expire. Since Deep Research tasks can
  run longer, your application should check the interaction status and reconnect
  as shown in the examples below.

{% /callout %}

#### Stream event types  {% id="stream-event-types" %}

| Event type | Delta type | Description |
| :--- | :--- | :--- |
| `step.delta` | `thought` | Intermediate reasoning step from the agent. |
| `step.delta` | `text` | Part of the final text output. |
| `step.delta` | `image` | A generated image (base64-encoded). |

The following example starts a research task and processes the stream with
automatic reconnection. It tracks the `interaction_id` and `last_event_id` so
that if the connection drops (for example, after the 600-second timeout), it can
resume from where it left off.

{% tabs %}
  {% tab label="Python" %}
  ```python
  from google import genai
  
  client = genai.Client()
  
  interaction_id = None
  last_event_id = None
  is_complete = False
  
  def process_stream(stream):
      global interaction_id, last_event_id, is_complete
      for event in stream:
          if event.event_type == "interaction.created":
              interaction_id = event.interaction.id
          if event.event_id:
              last_event_id = event.event_id
          if event.event_type == "step.delta":
              if event.delta.type == "text":
                  print(event.delta.text, end="", flush=True)
              elif event.delta.type == "thought":
                  print(f"Thought: {event.delta.text}", flush=True)
          elif event.event_type in ("interaction.completed", "interaction.error"):
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
  ```

  {% /tab %}

  {% tab label="JavaScript" %}
  ```javascript
  import { GoogleGenAI } from '@google/genai';
  
  const client = new GoogleGenAI({});
  
  let interactionId;
  let lastEventId;
  let isComplete = false;
  
  const initialStream = await client.interactions.create({
      input: 'Research the history of Google TPUs.',
      agent: 'deep-research-preview-04-2026',
      background: true,
      stream: true,
      agent_config: { type: 'deep-research', thinking_summaries: 'auto' },
  });
  
  async function processStream(stream = initialStream) {
      for await (const event of stream) {
          if (event.event_type === 'interaction.created') {
              interactionId = event.interaction.id;
          }
          if (event.event_id) lastEventId = event.event_id;
          if (event.event_type === 'step.delta') {
              if (event.delta.type === 'text') {
                  process.stdout.write(event.delta.text || '');
              } else if (event.delta.type === 'thought_summary') {
                  if (event.delta.content?.type === 'text') {
                      console.log(`Thought: ${event.delta.content.text}`);
                  }
              }
          } else if (['interaction.completed', 'interaction.error'].includes(event.event_type)) {
              isComplete = true;
          }
      }
  }
  
  await processStream(initialStream);
  
  // Reconnect if the connection drops
  while (!isComplete && interactionId) {
      const status = await client.interactions.get(interactionId);
      if (status.status !== 'in_progress') break;
      const resumeStream = await client.interactions.get(interactionId, {
          stream: true, last_event_id: lastEventId,
      });
      await processStream(resumeStream);
  }
  ```

  {% /tab %}

  {% tab label="Java" %}
  ```java
  import com.google.genai.Client;
  import com.google.genai.gaos.models.interactions.Content;
  import com.google.genai.gaos.models.interactions.CreateAgentInteraction;
  import com.google.genai.gaos.models.interactions.DeepResearchAgentConfig;
  import com.google.genai.gaos.models.interactions.ErrorEvent;
  import com.google.genai.gaos.models.interactions.Interaction;
  import com.google.genai.gaos.models.interactions.InteractionCompletedEvent;
  import com.google.genai.gaos.models.interactions.InteractionCreatedEvent;
  import com.google.genai.gaos.models.interactions.InteractionSSEEvent;
  import com.google.genai.gaos.models.interactions.InteractionSSEStreamEvent;
  import com.google.genai.gaos.models.interactions.InteractionStatus;
  import com.google.genai.gaos.models.interactions.InteractionsInput;
  import com.google.genai.gaos.models.interactions.StepDelta;
  import com.google.genai.gaos.models.interactions.TextContent;
  import com.google.genai.gaos.models.interactions.TextDelta;
  import com.google.genai.gaos.models.interactions.ThinkingSummaries;
  import com.google.genai.gaos.models.interactions.ThoughtSummaryDelta;
  import com.google.genai.gaos.models.operations.CreateInteractionRequestBody;
  import com.google.genai.gaos.models.operations.GetInteractionByIdRequest;
  import com.google.genai.gaos.utils.EventStream;
  
  class StreamProcessor {
    String interactionId = null;
    String lastEventId = null;
    boolean isComplete = false;
  
    void processStream(EventStream<InteractionSSEStreamEvent> stream) {
      for (InteractionSSEStreamEvent streamEvent : stream) {
        InteractionSSEEvent event = streamEvent.data().orElse(null);
        if (event instanceof InteractionCreatedEvent) {
          InteractionCreatedEvent created = (InteractionCreatedEvent) event;
          interactionId = created.interaction().flatMap(i -> i.id()).orElse(null);
          if (created.eventId().isPresent()) {
            lastEventId = created.eventId().get();
          }
        } else if (event instanceof StepDelta) {
          StepDelta stepDelta = (StepDelta) event;
          if (stepDelta.eventId().isPresent()) {
            lastEventId = stepDelta.eventId().get();
          }
          if (stepDelta.delta().isPresent()) {
            if (stepDelta.delta().get() instanceof TextDelta) {
              System.out.print(((TextDelta) stepDelta.delta().get()).text().orElse(""));
              System.out.flush();
            } else if (stepDelta.delta().get() instanceof ThoughtSummaryDelta) {
              ThoughtSummaryDelta thought = (ThoughtSummaryDelta) stepDelta.delta().get();
              Content content = thought.content().orElse(null);
              if (content instanceof TextContent) {
                System.out.println("Thought: " + ((TextContent) content).text().orElse(""));
              }
            }
          }
        } else if (event instanceof InteractionCompletedEvent || event instanceof ErrorEvent) {
          isComplete = true;
        }
      }
    }
  }
  
  Client client = new Client();
  StreamProcessor processor = new StreamProcessor();
  
  CreateAgentInteraction params =
      CreateAgentInteraction.builder()
          .agent("deep-research-preview-04-2026")
          .input(InteractionsInput.of("Research the history of Google TPUs."))
          .background(true)
          .stream(true)
          .agentConfig(
              DeepResearchAgentConfig.builder().thinkingSummaries(ThinkingSummaries.AUTO).build())
          .build();
  
  try (EventStream<InteractionSSEStreamEvent> stream =
      client.interactions.create(CreateInteractionRequestBody.of(params)).events()) {
    processor.processStream(stream);
  }
  
  // Reconnect if the connection drops
  while (!processor.isComplete && processor.interactionId != null) {
    Interaction status =
        client.interactions
            .get(GetInteractionByIdRequest.builder().id(processor.interactionId).build())
            .interaction()
            .get();
    if (!InteractionStatus.IN_PROGRESS.equals(status.status().orElse(null))) {
      break;
    }
    try (EventStream<InteractionSSEStreamEvent> stream =
        client.interactions
            .get(
                GetInteractionByIdRequest.builder()
                    .id(processor.interactionId)
                    .stream(true)
                    .lastEventId(processor.lastEventId)
                    .build())
            .events()) {
      processor.processStream(stream);
    }
  }
  ```

  {% /tab %}

  {% tab label="Go" %}
  ```go
  package main
  
  import (
      "context"
      "fmt"
      "log"
  
      "google.golang.org/genai"
      "google.golang.org/genai/interactions/models/interactions"
      "google.golang.org/genai/interactions/models/operations"
      "google.golang.org/genai/interactions/types/stream"
  )
  
  type StreamProcessor struct {
      interactionID string
      lastEventID   *string
      isComplete    bool
  }
  
  func (p *StreamProcessor) processStream(s *stream.EventStream[interactions.InteractionSSEStreamEvent]) {
      defer s.Close()
      for s.Next() {
          event := s.Value()
          if created := event.GetDataInteractionCreated(); created != nil {
              p.interactionID = created.Interaction.ID
              if created.EventID != nil {
                  p.lastEventID = created.EventID
              }
          } else if stepDelta := event.GetDataStepDelta(); stepDelta != nil {
              if stepDelta.EventID != nil {
                  p.lastEventID = stepDelta.EventID
              }
              if textDelta := stepDelta.GetDeltaText(); textDelta != nil {
                  fmt.Print(textDelta.GetText())
              } else if thoughtDelta := stepDelta.GetDeltaThoughtSummary(); thoughtDelta != nil {
                  if textContent := thoughtDelta.GetContentText(); textContent != nil {
                      fmt.Printf("Thought: %s\n", textContent.GetText())
                  }
              }
          } else if event.GetDataInteractionCompleted() != nil || event.GetDataError() != nil {
              p.isComplete = true
          }
      }
  }
  
  func main() {
      ctx := context.Background()
      client, err := genai.NewClient(ctx, nil)
      if err != nil {
          log.Fatal(err)
      }
  
      processor := &StreamProcessor{}
      agentCfg := interactions.NewCreateAgentInteractionAgentConfig(interactions.DeepResearchAgentConfig{
          ThinkingSummaries: interactions.ThinkingSummariesAuto.ToPointer(),
      })
  
      res, err := client.Interactions.Create(ctx, operations.CreateInteractionRequest{
          Body: operations.NewCreateInteractionRequestBody(interactions.CreateAgentInteraction{
              Agent:       interactions.AgentOption("deep-research-preview-04-2026"),
              Input:       interactions.NewInteractionsInput("Research the history of Google TPUs."),
              Background:  genai.Ptr(true),
              Stream:      genai.Ptr(true),
              AgentConfig: &agentCfg,
          }),
      })
      if err != nil {
          log.Fatal(err)
      }
      processor.processStream(res.InteractionSSEStreamEvent)
  
      // Reconnect if the connection drops
      for !processor.isComplete && processor.interactionID != "" {
          statusRes, err := client.Interactions.Get(ctx, operations.GetInteractionByIDRequest{
              ID: processor.interactionID,
          })
          if err != nil || statusRes.Interaction.Status != interactions.InteractionStatusInProgress {
              break
          }
          streamRes, err := client.Interactions.Get(ctx, operations.GetInteractionByIDRequest{
              ID:          processor.interactionID,
              Stream:      genai.Ptr(true),
              LastEventID: processor.lastEventID,
          })
          if err != nil {
              break
          }
          processor.processStream(streamRes.InteractionSSEStreamEvent)
      }
  }
  ```

  {% /tab %}

  {% tab label="REST" %}
  ```bash
  # 1. Start the stream (save the INTERACTION_ID from the interaction.start event
  # and the last "event_id" you receive)
  curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions" \
  -H "Api-Revision: 2026-05-20" \
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
  -H "Api-Revision: 2026-05-20" \
  -H "x-goog-api-key: $GEMINI_API_KEY"
  ```

  {% /tab %}

{% /tabs %}

## Follow-up questions and interactions  {% id="follow-up-questions-and-interactions" %}

You can continue the conversation after the agent returns the final report by
using the `previous_interaction_id`. This lets you to ask for clarification,
summarization or elaboration on specific sections of the research without
restarting the entire task.

{% tabs %}
  {% tab label="Python" %}
  ```python
  import time
  from google import genai
  
  client = genai.Client()
  
  interaction = client.interactions.create(
      input="Can you elaborate on the second point in the report?",
      model="gemini-4-argon",
      previous_interaction_id="COMPLETED_INTERACTION_ID"
  )
  
  print(interaction.steps[-1].content[0].text)
  ```

  {% /tab %}

  {% tab label="JavaScript" %}
  ```javascript
  const interaction = await client.interactions.create({
      input: 'Can you elaborate on the second point in the report?',
      model: 'gemini-4-argon',
      previous_interaction_id: 'COMPLETED_INTERACTION_ID'
  });
  console.log(interaction.steps.at(-1).content[0].text);
  ```

  {% /tab %}

  {% tab label="Java" %}
  ```java
  import com.google.genai.Client;
  import com.google.genai.gaos.models.interactions.CreateModelInteraction;
  import com.google.genai.gaos.models.interactions.Interaction;
  import com.google.genai.gaos.models.interactions.InteractionsInput;
  import com.google.genai.gaos.models.operations.CreateInteractionRequestBody;
  
  Client client = new Client();
  
  CreateModelInteraction params =
      CreateModelInteraction.builder()
          .model("gemini-4-argon")
          .input(InteractionsInput.of("Can you elaborate on the second point in the report?"))
          .previousInteractionId("COMPLETED_INTERACTION_ID")
          .build();
  
  Interaction interaction =
      client.interactions.create(CreateInteractionRequestBody.of(params)).interaction().get();
  
  System.out.println(interaction.outputText().orElse(""));
  ```

  {% /tab %}

  {% tab label="Go" %}
  ```go
  package main
  
  import (
      "context"
      "fmt"
      "log"
  
      "google.golang.org/genai"
      "google.golang.org/genai/interactions/models/interactions"
      "google.golang.org/genai/interactions/models/operations"
  )
  
  func main() {
      ctx := context.Background()
      client, err := genai.NewClient(ctx, nil)
      if err != nil {
          log.Fatal(err)
      }
  
      res, err := client.Interactions.Create(ctx, operations.CreateInteractionRequest{
          Body: operations.NewCreateInteractionRequestBody(interactions.CreateModelInteraction{
              Model:                 interactions.Model("gemini-4-argon"),
              Input:                 interactions.NewInteractionsInput("Can you elaborate on the second point in the report?"),
              PreviousInteractionID: genai.Ptr("COMPLETED_INTERACTION_ID"),
          }),
      })
      if err != nil {
          log.Fatal(err)
      }
  
      if res.Interaction.OutputText != nil {
          fmt.Println(*res.Interaction.OutputText)
      }
  }
  ```

  {% /tab %}

  {% tab label="REST" %}
  ```bash
  curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions" \
  -H "Api-Revision: 2026-05-20" \
  -H "Content-Type: application/json" \
  -H "x-goog-api-key: $GEMINI_API_KEY" \
  -d '{
      "input": "Can you elaborate on the second point in the report?",
      "model": "gemini-4-argon",
      "previous_interaction_id": "COMPLETED_INTERACTION_ID"
  }'
  ```

  {% /tab %}

{% /tabs %}

## When to use Gemini Deep Research agent  {% id="when-to-use-deep-research" %}

Deep Research is an **agent**, not just a model. It is best suited for workloads
that require an "analyst-in-a-box" approach rather than low-latency chat.

| Feature | Standard Gemini Models | Gemini Deep Research agent |
| :--- | :--- | :--- |
| **Latency** | Seconds | Minutes (Async/Background) |
| **Process** | Generate \-\> Output | Plan \-\> Search \-\> Read \-\> Iterate \-\> Output |
| **Output** | Conversational text, code, short summaries | Detailed reports, long-form analysis, comparative tables |
| **Best For** | Chatbots, extraction, creative writing | Market analysis, due diligence, literature reviews, competitive landscaping |

## Agent configuration  {% id="agent-configuration" %}

Deep Research uses the `agent_config` parameter to control behavior.
Pass it as a dictionary with the following fields:

| Field | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `type` | `string` | Required | Must be `"deep-research"`. |
| `thinking_summaries` | `string` | `"none"` | Set to `"auto"` to receive intermediate reasoning steps during streaming. Set to `"none"` to disable. |
| `visualization` | `string` | `"auto"` | Set to `"auto"` to enable agent-generated charts and images. Set to `"off"` to disable. |
| `collaborative_planning` | `boolean` | `false` | Set to `true` to enable multi-turn plan review before research begins. |

{% tabs %}
  {% tab label="Python" %}
  ```python
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
  ```

  {% /tab %}

  {% tab label="JavaScript" %}
  ```javascript
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
  ```

  {% /tab %}

  {% tab label="Java" %}
  ```java
  import com.google.genai.Client;
  import com.google.genai.gaos.models.interactions.CreateAgentInteraction;
  import com.google.genai.gaos.models.interactions.DeepResearchAgentConfig;
  import com.google.genai.gaos.models.interactions.Interaction;
  import com.google.genai.gaos.models.interactions.InteractionsInput;
  import com.google.genai.gaos.models.interactions.ThinkingSummaries;
  import com.google.genai.gaos.models.interactions.Visualization;
  import com.google.genai.gaos.models.operations.CreateInteractionRequestBody;
  
  Client client = new Client();
  
  DeepResearchAgentConfig agentConfig =
      DeepResearchAgentConfig.builder()
          .thinkingSummaries(ThinkingSummaries.AUTO)
          .visualization(Visualization.AUTO)
          .collaborativePlanning(false)
          .build();
  
  CreateAgentInteraction params =
      CreateAgentInteraction.builder()
          .agent("deep-research-preview-04-2026")
          .input(InteractionsInput.of("Research the competitive landscape of cloud GPUs."))
          .agentConfig(agentConfig)
          .background(true)
          .build();
  
  Interaction interaction =
      client.interactions.create(CreateInteractionRequestBody.of(params)).interaction().get();
  ```

  {% /tab %}

  {% tab label="Go" %}
  ```go
  package main
  
  import (
      "context"
      "log"
  
      "google.golang.org/genai"
      "google.golang.org/genai/interactions/models/interactions"
      "google.golang.org/genai/interactions/models/operations"
  )
  
  func main() {
      ctx := context.Background()
      client, err := genai.NewClient(ctx, nil)
      if err != nil {
          log.Fatal(err)
      }
  
      agentCfg := interactions.NewCreateAgentInteractionAgentConfig(interactions.DeepResearchAgentConfig{
          ThinkingSummaries:     interactions.ThinkingSummariesAuto.ToPointer(),
          Visualization:         interactions.VisualizationAuto.ToPointer(),
          CollaborativePlanning: genai.Ptr(false),
      })
  
      _, err = client.Interactions.Create(ctx, operations.CreateInteractionRequest{
          Body: operations.NewCreateInteractionRequestBody(interactions.CreateAgentInteraction{
              Agent:       interactions.AgentOption("deep-research-preview-04-2026"),
              Input:       interactions.NewInteractionsInput("Research the competitive landscape of cloud GPUs."),
              AgentConfig: &agentCfg,
              Background:  genai.Ptr(true),
          }),
      })
      if err != nil {
          log.Fatal(err)
      }
  }
  ```

  {% /tab %}

  {% tab label="REST" %}
  ```bash
  curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions" \
  -H "Api-Revision: 2026-05-20" \
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
  ```

  {% /tab %}

{% /tabs %}

## Availability and pricing  {% id="availability-and-pricing" %}

You can access the Gemini Deep Research agent using the Interactions API in
Google AI Studio and the Gemini API.

Pricing follows a [pay-as-you-go model](/docs/pricing#pricing-for-agents) based
on the underlying Gemini models and the specific tools the agent utilizes.
Unlike standard chat requests, where a request leads to one output, a Deep
Research task is an agentic workflow. A single request triggers an autonomous
loop of planning, searching, reading, and reasoning.

### Estimated costs  {% id="estimated-costs" %}

Costs vary based on the depth of research required. The agent autonomously
determines how much reading and searching is necessary to answer your prompt.

* **Deep Research** (`deep-research-preview-04-2026`): For a typical query
  requiring moderate analysis, the agent might use ~80 search queries, ~250k
  input tokens (~50-70% cached), and ~60k output tokens.  *   **Estimated total:** ~$1.00 - $3.00 per task

* **Deep Research Max** (`deep-research-max-preview-04-2026`): For deep
  competitive landscape analysis or extensive due diligence, the agent might use
  up to ~160 search queries, ~900k input tokens (~50-70% cached), and ~80k
  output tokens.  *   **Estimated total:** ~$3.00 - $7.00 per task


{% callout type="note" %}
  Note: These figures are estimates based on preview rates and are subject to
  change.

{% /callout %}

## Safety considerations  {% id="safety-considerations" %}

Giving an agent access to the web and your private files requires careful
consideration of safety risks.

*   **Prompt injection using files:** The agent reads the contents of the files
  you provide. Ensure that uploaded documents (PDFs, text files) come from
  trusted sources. A malicious file could contain hidden text designed to
  manipulate the agent's output.

*   **Web content risks:** The agent searches the public web. While we implement
  robust safety filters, there is a risk that the agent may encounter and
  process malicious web pages. We recommend reviewing the `citations` provided
  in the response to verify the sources.

*   **Exfiltration:** Be cautious when asking the agent to summarize sensitive
  internal data if you are also allowing it to browse the web.


## Best practices  {% id="best-practices" %}

*   **Prompt for unknowns:** Instruct the agent on how to handle missing data.
  For example, add *"If specific figures for 2025 are not available,
  explicitly state they are projections or unavailable rather than
  estimating"* to your prompt.

*   **Provide context:** Ground the agent's research by providing background
  information or constraints directly in the input prompt.

*   **Use collaborative planning:** For complex queries, enable collaborative
  planning to review and refine the research plan before execution.

*   **Multimodal inputs:** Deep Research agent supports multi-modal inputs.
  Use cautiously, as this increases costs and risks context window overflow.


## Limitations  {% id="limitations" %}

*   **Custom tools:** You cannot currently provide custom Function Calling tools
  but you can use remote MCP (Model Context Protocol) servers with the Deep
  Research agent.

*   **Structured output:** The Deep Research agent currently
  doesn't support structured outputs.

*   **Max research time:** The Deep Research agent has a maximum research time
  of 60 minutes. Most tasks should complete within 20 minutes.

*   **Store requirement:** Agent execution using `background=True` requires
  `store=True`.

*   **Google search:** [Google
  Search](/docs/google-search) is enabled by
  default and [specific
  restrictions](/docs/terms#use-restrictions2)
  apply to the grounded results.


## What's next  {% id="whats-next" %}

* Learn more about the [Interactions API](/docs/interactions-overview).
* Learn how to use your own data using the [File Search](/docs/file-search)
  tool.
