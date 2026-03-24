# Big-AGI Documentation

Information you need to get started, configure, and use big-AGI productively.

👉 **[Changelog](https://big-agi.com/changes)** - See what's new

## Getting Started

Essential guides:

- **[FAQ](help-faq.md)**: Common questions and answers
- **[Enabling Microphone](help-feature-microphone.md)**: Configure speech recognition in your browser
- **[Data Ownership](help-data-ownership.md)**: How your data is stored and managed
- **[Live File](help-feature-livefile.md)**: Live file attachment feature

## AI Services

How to set up AI models and features in big-AGI.

> 👉 The following applies to users of big-AGI.com, as the public instance is empty and requires user configuration.

- **Cloud AI Services**:
  - Easy API key configuration:
    [Alibaba](https://bailian.console.alibabacloud.com/?apiKey=1#/api-key),
    [Anthropic](https://console.anthropic.com/settings/keys),
    [AWS Bedrock](https://console.aws.amazon.com/bedrock/),
    [Deepseek](https://platform.deepseek.com/api_keys),
    [Google Gemini](https://aistudio.google.com/app/apikey),
    [Groq](https://console.groq.com/keys),
    [Mistral](https://console.mistral.ai/api-keys/),
    [Moonshot](https://platform.moonshot.cn/console/api-keys),
    [OpenAI](https://platform.openai.com/api-keys),
    [OpenPipe](https://app.openpipe.ai/settings),
    [Perplexity](https://www.perplexity.ai/settings/api),
    [TogetherAI](https://api.together.xyz/settings/api-keys),
    [xAI](https://x.ai/api),
    [Z.ai](https://z.ai/)
  - **[Azure OpenAI](config-azure-openai.md)** guide
  - **[OpenRouter](config-openrouter.md)** guide
  - **OpenAI-compatible endpoints**: Any provider with an OpenAI-compatible API works out of the box - models, pricing, and capabilities are auto-detected


- **Local AI Integrations**:
  - [LocalAI](config-local-localai.md), [LM Studio](config-local-lmstudio.md), [Ollama](config-local-ollama.md)


- **Enhanced AI Features**:
  - **[Web Browsing](config-feature-browse.md)**: Enable web page download through third-party services or your own cloud
  - **Web Search**: Google Search API (see '[Environment Variables](environment-variables.md)')
  - **Image Generation**: GPT Image (gpt-image-1), Nano Banana, DALL·E 3 and 2
  - **Voice Synthesis**: ElevenLabs, Inworld, OpenAI TTS, LocalAI, or browser Web Speech API
  - **[Google Drive](config-feature-google-drive.md)**: Attach files from Google Drive

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
  - **[Reverse Proxy](deploy-reverse-proxy.md)**: Optional, enables custom domains and SSL
  - **[Docker Deployment](deploy-docker.md)**: Deploy with Docker containers
  - **[Kubernetes](deploy-k8s.md)**: Deploy on Kubernetes clusters
  - **[Analytics](deploy-analytics.md)**: Set up usage analytics
  - **[Environment Variables](environment-variables.md)**: Pre-configures models and services

## Community & Support

- Check the [changelog](https://big-agi.com/changes) for the latest updates
- Visit our [GitHub repository](https://github.com/enricoros/big-AGI) for source code and issue tracking
- Join our [Discord](https://discord.gg/MkH4qj2Jp9) for discussions and help

Let's build something great.
