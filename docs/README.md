# big-AGI Documentation

Welcome to the [official documentation for big-AGI](https://github.com/enricoros/big-AGI/blob/main/docs/README.md).
Find all the information you need to get started, configure, and effectively use big-AGI.

[//]: # (## Quick Start)

[//]: # (- **[Introduction]&#40;big-agi.md&#41;**: Overview of big-AGI's features.)

## Configuration Guides

Detailed guides to configure your big-AGI interface and models.

👉 The following apply to users of [big-AGI.com](https://big-agi.com), as the public instance is empty and to be configured by the user.

- **Cloud Model Services**:
  - straightforward: **Anthropic**, **Google AI**, **Groq**, **Mistral**, **OpenAI**, **Perplexity**, **TogetherAI**
  - **[Azure OpenAI](config-azure-openai.md)**
  - **[OpenRouter](config-openrouter.md)**


- **Local Model Servers**:
  - **[LocalAI](config-local-localai.md)**
  - **[LM Studio](config-local-lmstudio.md)**
  - **[Ollama](config-local-ollama.md)**
  - **[Oobabooga](config-local-oobabooga.md)**


- **Advanced Feature Configuration**:
  - **[Browse](config-feature-browse.md)**: Enable web page download through third-party services or your own cloud (advanced)
  - **ElevenLabs API**: Voice and cutom voice generation, only requires their API key
  - **Google Search API**: guide not yet available, see the Google options in [environment-variables.md](environment-variables.md) in the meantime
  - **Prodia API**: Stable Diffusion XL image generation, only requires their API key, alternative to DALL·E

## Deployment

System integrators, administrators, whitelabelers: instead of using the public big-AGI instance on [get.big-agi.com](https://big-agi.com), you can deploy your own instance.

Step-by-step deployment and system configuration instructions.

- **Deploy Your Own**
  - straightforward: **Local development**, **Vercel 1-Click**
  - **[Cloudflare Deployment](deploy-cloudflare.md)**
  - **[Docker Deployment](deploy-docker.md)**: Containers for Local or Cloud deployments


- **Deployment Server Features**
  - **[Database Setup](deploy-database.md)**: Optional, only required to enable "Chat Link Sharing"
  - **[Environment Variables](environment-variables.md)**: 📌 Set server-side API keys and special features in your deployments
  - **[HTTP Basic Authentication](deploy-authentication.md)**: Optional, Secure your big-AGI instance with a username and password

## Customization & Derivative UIs

👏 Customize big-AGI to fit your needs.

- **[Customizing big-AGI](customizations.md)**: how to alter source code and server-side configuration

<br/>

## Support and Community

Join our community or get support:

- Visit our [GitHub repository](https://github.com/enricoros/big-AGI) for source code and issue tracking
- Check the latest updates and features on [Changelog](changelog.md) or the in-app [News](https://get.big-agi.com/news)
- Connect with us and other users on [Discord](https://discord.gg/your-invite-link) for discussions, help, and sharing your experiences with big-AGI

Thank you for choosing big-AGI. We're excited to see what you'll build.