# OrcaRouter Configuration

[OrcaRouter](https://www.orcarouter.ai) is an OpenAI-compatible API gateway
that routes requests across multiple LLM providers (OpenAI, Anthropic, DeepSeek, etc.)
with intelligent routing strategies.
This document details the process of integrating OrcaRouter with big-AGI.

### 1. OrcaRouter Account Setup and API Key Generation

1. Register for an OrcaRouter account at [orcarouter.ai](https://www.orcarouter.ai).
2. Generate an API key from the dashboard.
   - **Remember to copy and securely store your API key** - the key will be in the format `sk-orca-...`.
   - Keep the key confidential as it can be used to expend your credits.

### 2. Integrating OrcaRouter with big-AGI

1. Launch big-AGI, and navigate to the AI **Models** settings.
2. Add a Vendor, and select **OrcaRouter**.
3. Input the API key into the **API Key** field, and load the Models.
4. Models from all supported providers will now be accessible and selectable in the application.

In addition to using the UI, configuration can also be done using
[environment variables](environment-variables.md) by setting `ORCAROUTER_API_KEY`.

### 3. Model IDs

OrcaRouter uses provider-prefixed model IDs, for example:
- `openai/gpt-4o-mini`
- `anthropic/claude-sonnet-4.6`
- `deepseek/deepseek-chat`

### Pricing

OrcaRouter independently manages its service and pricing and is not affiliated with big-AGI.
For more detailed information, please visit the [OrcaRouter documentation](https://docs.orcarouter.ai).
