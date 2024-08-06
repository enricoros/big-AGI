# ReAct: question answering with Reasoning and Actions

## What is ReAct?

[ReAct](https://arxiv.org/abs/2210.03629) (Reason+Act) is a classis AI question-answering feature,
that combines reasoning with actions to provide informed answers.

Within Big-AGI, users can invoke ReAct to ask complex questions that require multiple steps to answer.

| Mode  | Activation                        | Information Sources                                  | Reasoning Visibility               | When to Use                                      |
|-------|-----------------------------------|------------------------------------------------------|------------------------------------|--------------------------------------------------|
| Chat  | Just type and send                | **Pre-trained knowledge only**                       | Only shows final response          | Quick answers, general knowledge queries         |
| ReAct | Type "/react" before the question | **Web loads, Web searches, Wikipedia, calculations** | Shows step-by-step thought process | Complex, multi-step, or research-based questions |

Example of ReAct in action, taking a question about current events, googling results, opening a page, and summarizing the information:

https://github.com/user-attachments/assets/c3480428-9ab8-4257-a869-2541bf44a062

The following tools are implemented in Big-AGI:

- **browse**: loads web pages (URLs) and extracts information, using a correctly configured `Tools > Browsing` API
- **search**: searches the web to produce page URLs, using a correctly configured `Tools > Google Search` ([Google Programmable Search Engine](https://programmablesearchengine.google.com/about/)) API
- **wikipedia**: looks up information on Wikipedia pages
- **calculate**: performs mathematical calculations by executing typescript code
  - warning: (!) unsafe and dangerous, do not use for untrusted code/LLMs

## How to Use ReAct in Big-AGI

1. **Invoking ReAct**: Type "/react" followed by your question in the chat.
2. **What to Expect**:

- An ephemeral space will show the AI's thought process and actions, showing all the steps taken.
- The final answer will appear in the main chat.

3. **Available Actions**: Web searches, Wikipedia lookups, calculations, and optionally web browsing.

## Good to know:

- **ReAct operates in isolation** from the main chat history.
- It **will take longer than standard responses** due to multiple steps.
- Web searches and browsing may have privacy implications, and require **tool configuration** in the UI.
- Errors or limitations in accessing external resources may affect results.
- ReAct does not use the [Tool or Function Calling](https://platform.openai.com/docs/guides/function-calling) feature of AI models, rather uses the old school approach of parsing and executing actions.
