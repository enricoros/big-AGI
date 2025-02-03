# Big-AGI Documentation

Information you need to get started, configure, and use big-AGI productively.

## Getting Started

Essential guides:

- **[FAQ](help-faq.md)**: Common questions and answers
- **[Enabling Microphone](help-feature-microphone.md)**: Configure speech recognition in your browser

## AI Services

How to set up AI models and features in big-AGI.

> 👉 The following applies to users of big-AGI.com, as the public instance is empty and requires user configuration.

- **Cloud AI Services**:
  - Easy API key configuration:
    [Anthropic](https://console.anthropic.com/settings/keys),
    [Deepseek](https://platform.deepseek.com/api_keys),
    [Google Gemini](https://aistudio.google.com/app/apikey),
    [Groq](https://console.groq.com/keys),
    [Mistral](https://console.mistral.ai/api-keys/),
    [OpenAI](https://platform.openai.com/api-keys),
    [OpenPipe](https://app.openpipe.ai/settings),
    [Perplexity](https://www.perplexity.ai/settings/api),
    [TogetherAI](https://api.together.xyz/settings/api-keys),
    [xAI](http://x.ai/api)
  - **[Azure OpenAI](config-azure-openai.md)** guide
  - **[OpenRouter](config-openrouter.md)** guide


- **Local AI Integrations**:
  - [LocalAI](config-local-localai.md), [LM Studio](config-local-lmstudio.md), [Ollama](config-local-ollama.md)


- **Enhanced AI Features**:
  - **[Web Browsing](config-feature-browse.md)**: Enable web page download through third-party services or your own cloud
  - **Web Search**: Google Search API (see '[Environment Variables](environment-variables.md)')
  - **Image Generation**: DALL·E 3 and 2, or Prodia API for Stable Diffusion XL
  - **Voice Synthesis**: ElevenLabs API for voice generation

## Deployment & Customization

> 👉 The following applies to developers and experts who deploy their own big-AGI instance.

For deploying a custom big-AGI instance:

- **[Installation Guide](installation.md)**, including:
  - Set up your own big-AGI instance
  - Source build or pre-built options
  - Local, cloud, or on-premises deployment


- **Advanced Setup**:
  - **[Source Code Customization](customizations.md)**: Modify the source code
  - **[Access Control](deploy-authentication.md)**: Optional, add basic user authentication
  - **[Database Setup](deploy-database.md)**: Optional, enables "Chat Link Sharing"
  - **[Reverse Proxy](deploy-reverse-proxy.md)**: Optional, enables custom domains and SSL
  - **[Environment Variables](environment-variables.md)**: Pre-configures models and services

## Community & Support

- Visit our [GitHub repository](https://github.com/enricoros/big-AGI) for source code and issue tracking
- Check the latest updates in the [Changelog](changelog.md) or in-app [News](https://get.big-agi.com/news)
- Join our [Discord](https://discord.gg/MkH4qj2Jp9) for discussions and help

Let's build something great.
