# big-AGI Documentation

Find all the information you need to get started, configure, and effectively use big-AGI.

[//]: # (## Quick Start)

[//]: # (- **[Introduction]&#40;big-agi.md&#41;**: Overview of big-AGI's features.)

## Configuration Guides

Detailed guides to configure your big-AGI interface and models.

👉 The following applies to the users of big-AGI.com, as the public instance is empty and to be configured by the user.

- **Cloud Model Services**:
  - **[Azure OpenAI](config-azure-openai.md)**
  - **[OpenRouter](config-openrouter.md)**
  - easy API key: **Anthropic**, **Google AI**, **Groq**, **Mistral**, **OpenAI**, **Perplexity**, **TogetherAI**


- **Local Model Servers**:
  - **[LocalAI](config-local-localai.md)**
  - **[LM Studio](config-local-lmstudio.md)**
  - **[Ollama](config-local-ollama.md)**
  - **[Oobabooga](config-local-oobabooga.md)**


- **Advanced Feature Configuration**:
  - **[Browse](config-feature-browse.md)**: Enable web page download through third-party services or your own cloud (advanced)
  - **ElevenLabs API**: Voice and cutom voice generation, only requires their API key
  - **Google Search API**: guide not yet available, see the Google options in '[Environment Variables](environment-variables.md)'
  - **Prodia API**: Stable Diffusion XL image generation, only requires their API key, alternative to DALL·E

## Deployment

System integrators, administrators, whitelabelers: instead of using the public big-AGI instance on get.big-agi.com, you can deploy your own instance.

Step-by-step deployment and system configuration instructions.

- **[Installation](installation.md)**: Set up your own instance of big-AGI and related products
  - build from source or use pre-built
  - locally, in the public cloud, or on your own servers


- **Advanced Customizations**:
  - **[Source code alterations guide](customizations.md)**: source code primer and alterations guidelines
  - **[Basic Authentication](deploy-authentication.md)**: Optional, adds a username and password wall
  - **[Database Setup](deploy-database.md)**: Optional, enables "Chat Link Sharing"
  - **[Reverse Proxy](deploy-reverse-proxy.md)**: Optional, enables custom domain and SSL
  - **[Environment Variables](environment-variables.md)**: 📌 Pre-configures models and services

## Support and Community

Join our community or get support:

- Visit our [GitHub repository](https://github.com/enricoros/big-AGI) for source code and issue tracking
- Check the latest updates and features on [Changelog](changelog.md) or the in-app [News](https://get.big-agi.com/news)
- Connect with us and other users on [Discord](https://discord.gg/MkH4qj2Jp9) for discussions, help, and sharing your experiences with big-AGI

Thank you for choosing big-AGI. We're excited to see what you'll build.
