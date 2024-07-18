# BIG-AGI 🧠✨

Welcome to big-AGI, the AI suite for professionals that need function, form,
simplicity, and speed. Powered by the latest models from 12 vendors and
open-source servers, `big-AGI` offers best-in-class Chats,
[Beams](https://github.com/enricoros/big-AGI/issues/470),
and [Calls](https://github.com/enricoros/big-AGI/issues/354) with AI personas,
visualizations, coding, drawing, side-by-side chatting, and more -- all wrapped in a polished UX.

Stay ahead of the curve with big-AGI. 🚀 Pros & Devs love big-AGI. 🤖

[![Official Website](https://img.shields.io/badge/BIG--AGI.com-%23096bde?style=for-the-badge&logo=vercel&label=launch)](https://big-agi.com)

Or fork & run on Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fenricoros%2Fbig-AGI&env=OPENAI_API_KEY&envDescription=Backend%20API%20keys%2C%20optional%20and%20may%20be%20overridden%20by%20the%20UI.&envLink=https%3A%2F%2Fgithub.com%2Fenricoros%2Fbig-AGI%2Fblob%2Fmain%2Fdocs%2Fenvironment-variables.md&project-name=big-AGI)

## 👉 [roadmap](https://github.com/users/enricoros/projects/4/views/2) 👉 [installation](docs/installation.md) 👉 [documentation](docs/README.md)

> Note: bigger better features (incl. Beam-2) are being cooked outside of `main`.

[//]: # (big-AGI is an open book; see the **[ready-to-ship and future ideas]&#40;https://github.com/users/enricoros/projects/4/views/2&#41;** in our open roadmap)

### What's New in 1.16.1...1.16.5 · Jul 18, 2024 (patch releases)

- 1.16.5: GPT-4o Mini support
- 1.16.4: 8192 tokens support for Claude 3.5 Sonnet
- 1.16.3: Anthropic Claude 3.5 Sonnet model support
- 1.16.2: Improve web downloads, as text, markdwon, or HTML
- 1.16.2: Proper support for Gemini models
- 1.16.2: Added the latest Mistral model
- 1.16.2: Tokenizer support for gpt-4o
- 1.16.2: Updates to Beam
- 1.16.1: Support for the new OpenAI GPT-4o 2024-05-13 model

### What's New in 1.16.0 · May 9, 2024 · Crystal Clear

- [Beam](https://big-agi.com/blog/beam-multi-model-ai-reasoning) core and UX improvements based on user feedback
- Chat cost estimation 💰 (enable it in Labs / hover the token counter)
- Save/load chat files with Ctrl+S / Ctrl+O on desktop
- Major enhancements to the Auto-Diagrams tool
- YouTube Transcriber Persona for chatting with video content, [#500](https://github.com/enricoros/big-AGI/pull/500)
- Improved formula rendering (LaTeX), and dark-mode diagrams, [#508](https://github.com/enricoros/big-AGI/issues/508), [#520](https://github.com/enricoros/big-AGI/issues/520)
- Models update: **Anthropic**, **Groq**, **Ollama**, **OpenAI**, **OpenRouter**, **Perplexity**
- Code soft-wrap, chat text selection toolbar, 3x faster on Apple silicon, and more [#517](https://github.com/enricoros/big-AGI/issues/517), [507](https://github.com/enricoros/big-AGI/pull/507)

#### 3,000 Commits Milestone · April 7, 2024

![big-AGI Milestone](https://github.com/enricoros/big-AGI/assets/32999/47fddbb1-9bd6-4b58-ace4-781dfcb80923)

- 🥇 Today we <b>celebrate commit 3000</b> in just over one year, and going stronger 🚀
- 📢️ Thanks everyone for your support and words of love for Big-AGI, we are committed to creating the best AI experiences for everyone.

### What's New in 1.15.0 · April 1, 2024 · Beam

- ⚠️ [**Beam**: the multi-model AI chat](https://big-agi.com/blog/beam-multi-model-ai-reasoning). find better answers, faster - a game-changer for brainstorming, decision-making, and creativity. [#443](https://github.com/enricoros/big-AGI/issues/443)
- Managed Deployments **Auto-Configuration**: simplify the UI models setup with backend-set models. [#436](https://github.com/enricoros/big-AGI/issues/436)
- Message **Starring ⭐**: star important messages within chats, to attach them later. [#476](https://github.com/enricoros/big-AGI/issues/476)
- Enhanced the default Persona
- Fixes to Gemini models and SVGs, improvements to UI and icons
- 1.15.1: Support for Gemini Pro 1.5 and OpenAI Turbo models
- Beast release, over 430 commits, 10,000+ lines changed: [release notes](https://github.com/enricoros/big-AGI/releases/tag/v1.15.0), and changes [v1.14.1...v1.15.0](https://github.com/enricoros/big-AGI/compare/v1.14.1...v1.15.0)

<details>
<summary>What's New in 1.14.1 · March 7, 2024 · Modelmorphic</summary>

- **Anthropic** [Claude-3](https://www.anthropic.com/news/claude-3-family) model family support. [#443](https://github.com/enricoros/big-AGI/issues/443)
- New **[Perplexity](https://www.perplexity.ai/)** and **[Groq](https://groq.com/)** integration (thanks @Penagwin). [#407](https://github.com/enricoros/big-AGI/issues/407), [#427](https://github.com/enricoros/big-AGI/issues/427)
- **[LocalAI](https://localai.io/models/)** deep integration, including support for [model galleries](https://github.com/enricoros/big-AGI/issues/411)
- **Mistral** Large and Google **Gemini 1.5** support
- Performance optimizations: runs [much faster](https://twitter.com/enricoros/status/1756553038293303434?utm_source=localhost:3000&utm_medium=big-agi), saves lots of power, reduces memory usage
- Enhanced UX with auto-sizing charts, refined search and folder functionalities, perfected scaling
- And with more UI improvements, documentation, bug fixes (20 tickets), and developer enhancements

</details>

<details>
<summary>What's New in 1.13.0 · Feb 8, 2024 · Multi + Mind</summary>

https://github.com/enricoros/big-AGI/assets/32999/01732528-730e-41dc-adc7-511385686b13

- **Side-by-Side Split Windows**: multitask with parallel conversations. [#208](https://github.com/enricoros/big-AGI/issues/208)
- **Multi-Chat Mode**: message everyone, all at once. [#388](https://github.com/enricoros/big-AGI/issues/388)
- **Export tables as CSV**: big thanks to @aj47. [#392](https://github.com/enricoros/big-AGI/pull/392)
- Adjustable text size: customize density. [#399](https://github.com/enricoros/big-AGI/issues/399)
- Dev2 Persona Technology Preview
- Better looking chats with improved spacing, fonts, and menus
- More: new video player, [LM Studio tutorial](https://github.com/enricoros/big-AGI/blob/main/docs/config-local-lmstudio.md) (thanks @aj47), [MongoDB support](https://github.com/enricoros/big-AGI/blob/main/docs/deploy-database.md) (thanks @ranfysvalle02), and speedups

</details>

<details>
<summary>What's New in 1.12.0 · Jan 26, 2024 · AGI Hotline</summary>

https://github.com/enricoros/big-AGI/assets/32999/95ceb03c-945d-4fdd-9a9f-3317beb54f3f

- **Voice Calls**: real-time voice call your personas out of the blue or in relation to a chat [#354](https://github.com/enricoros/big-AGI/issues/354)
- Support **OpenAI 0125** Models. [#364](https://github.com/enricoros/big-AGI/issues/364)
- Rename or Auto-Rename chats.  [#222](https://github.com/enricoros/big-AGI/issues/222), [#360](https://github.com/enricoros/big-AGI/issues/360)
- More control over **Link Sharing** [#356](https://github.com/enricoros/big-AGI/issues/356)
- **Accessibility** to screen readers [#358](https://github.com/enricoros/big-AGI/issues/358)
- Export chats to Markdown [#337](https://github.com/enricoros/big-AGI/issues/337)
- Paste tables from Excel [#286](https://github.com/enricoros/big-AGI/issues/286)
- Ollama model updates and context window detection fixes [#309](https://github.com/enricoros/big-AGI/issues/309)

</details>

<details>
<summary>What's New in 1.11.0 · Jan 16, 2024 · Singularity</summary>

https://github.com/enricoros/big-AGI/assets/1590910/a6b8e172-0726-4b03-a5e5-10cfcb110c68

- **Find chats**: search in titles and content, with frequency ranking. [#329](https://github.com/enricoros/big-AGI/issues/329)
- **Commands**: command auto-completion (type '/'). [#327](https://github.com/enricoros/big-AGI/issues/327)
- **[Together AI](https://www.together.ai/products#inference)** inference platform support (good speed and newer models). [#346](https://github.com/enricoros/big-AGI/issues/346)
- Persona Creator history, deletion, custom creation, fix llm API timeouts
- Enable adding up to five custom OpenAI-compatible endpoints
- Developer enhancements: new 'Actiles' framework

</details>

<details>
<summary>What's New in 1.10.0 · Jan 6, 2024 · The Year of AGI</summary>

- **New UI**: for both desktop and mobile, sets the stage for future scale. [#201](https://github.com/enricoros/big-AGI/issues/201)
- **Conversation Folders**: enhanced conversation organization. [#321](https://github.com/enricoros/big-AGI/issues/321)
- **[LM Studio](https://lmstudio.ai/)** support and improved token management
- Resizable panes in split-screen conversations.
- Large performance optimizations
- Developer enhancements: new UI framework, updated documentation for proxy settings on browserless/docker

</details>

For full details and former releases, check out the [changelog](docs/changelog.md).

## 👉 Key Features ✨

| ![Advanced AI](https://img.shields.io/badge/Advanced%20AI-32383e?style=for-the-badge&logo=ai&logoColor=white) | ![100+ AI Models](https://img.shields.io/badge/100%2B%20AI%20Models-32383e?style=for-the-badge&logo=ai&logoColor=white) | ![Flow-state UX](https://img.shields.io/badge/Flow--state%20UX-32383e?style=for-the-badge&logo=flow&logoColor=white) | ![Privacy First](https://img.shields.io/badge/Privacy%20First-32383e?style=for-the-badge&logo=privacy&logoColor=white) | ![Advanced Tools](https://img.shields.io/badge/Fun%20To%20Use-f22a85?style=for-the-badge&logo=tools&logoColor=white) |  
|---------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------| 
| **Chat**<br/>**Call**<br/>**Beam**<br/>**Draw**, ...                                                          | Local & Cloud<br/>Open & Closed<br/>Cheap & Heavy<br/>Google, Mistral, ...                                              | Attachments<br/>Diagrams<br/>Multi-Chat<br/>Mobile-first UI                                                          | Stored Locally<br/>Easy self-Host<br/>Local actions<br/>Data = Gold                                                    | AI Personas<br/>Voice Modes<br/>Screen Capture<br/>Camera + OCR                                                      |

![big-AGI screenshot](docs/pixels/big-AGI-compo-20240201_small.png)

You can easily configure 100s of AI models in big-AGI:

| **AI models**       | _supported vendors_                                                                                                                                                                                                             |
|:--------------------|:--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Opensource Servers  | [LocalAI](https://localai.io/) (multimodal) · [Ollama](https://ollama.com/) · [Oobabooga](https://github.com/oobabooga/text-generation-webui)                                                                                   |
| Local Servers       | [LM Studio](https://lmstudio.ai/)                                                                                                                                                                                               |
| Multimodal services | [Azure](https://azure.microsoft.com/en-us/products/ai-services/openai-service) · [Google Gemini](https://ai.google.dev/) · [OpenAI](https://platform.openai.com/docs/overview)                                                  |
| Language services   | [Anthropic](https://anthropic.com) · [Groq](https://wow.groq.com/) · [Mistral](https://mistral.ai/) · [OpenRouter](https://openrouter.ai/) · [Perplexity](https://www.perplexity.ai/) · [Together AI](https://www.together.ai/) | 
| Image services      | [Prodia](https://prodia.com/) (SDXL)                                                                                                                                                                                            | 
| Speech services     | [ElevenLabs](https://elevenlabs.io) (Voice synthesis / cloning)                                                                                                                                                                 | 

Add extra functionality with these integrations:

| **More**     | _integrations_                                                                                                 |
|:-------------|:---------------------------------------------------------------------------------------------------------------| 
| Web Browse   | [Browserless](https://www.browserless.io/) · [Puppeteer](https://pptr.dev/)-based                              |
| Web Search   | [Google CSE](https://programmablesearchengine.google.com/)                                                     |
| Code Editors | [CodePen](https://codepen.io/pen/) · [StackBlitz](https://stackblitz.com/) · [JSFiddle](https://jsfiddle.net/) |
| Sharing      | [Paste.gg](https://paste.gg/) (Paste chats)                                                                    | 
| Tracking     | [Helicone](https://www.helicone.ai) (LLM Observability)                                                        | 

[//]: # (- [x] **Flow-state UX** for uncompromised productivity)

[//]: # (- [x] **AI Personas**: Tailor your AI interactions with customizable personas)

[//]: # (- [x] **Sleek UI/UX**: A smooth, intuitive, and mobile-responsive interface)

[//]: # (- [x] **Efficient Interaction**: Voice commands, OCR, and drag-and-drop file uploads)

[//]: # (- [x] **Privacy First**: Self-host and use your own API keys for full control)

[//]: # (- [x] **Advanced Tools**: Execute code, import PDFs, and summarize documents)

[//]: # (- [x] **Seamless Integrations**: Enhance functionality with various third-party services)

[//]: # (- [x] **Open Roadmap**: Contribute to the progress of big-AGI)

<br/>

## 🚀 Installation

To get started with big-AGI, follow our comprehensive [Installation Guide](docs/installation.md).
The guide covers various installation options, whether you're spinning it up on
your local computer, deploying on Vercel, on Cloudflare, or rolling it out
through Docker.

Whether you're a developer, system integrator, or enterprise user, you'll find step-by-step instructions
to set up big-AGI quickly and easily.

[![Installation Guide](https://img.shields.io/badge/Installation%20Guide-blue?style=for-the-badge&logo=read-the-docs&logoColor=white)](docs/installation.md)

Or bring your API keys and jump straight into our free instance on [big-AGI.com](https://big-agi.com).

<br/>

# 🌟 Get Involved!

[//]: # ([![Official Discord]&#40;https://img.shields.io/discord/1098796266906980422?label=discord&logo=discord&logoColor=%23fff&style=for-the-badge&#41;]&#40;https://discord.gg/MkH4qj2Jp9&#41;)
[![Official Discord](https://discordapp.com/api/guilds/1098796266906980422/widget.png?style=banner2)](https://discord.gg/MkH4qj2Jp9)

- [ ] 📢️ [**Chat with us** on Discord](https://discord.gg/MkH4qj2Jp9)
- [ ] ⭐ **Give us a star** on GitHub 👆
- [ ] 🚀 **Do you like code**? You'll love this gem of a project! [_Pick up a task!_](https://github.com/users/enricoros/projects/4/views/4) - _easy_ to _pro_
- [ ] 💡 Got a feature suggestion? [_Add your roadmap ideas_](https://github.com/enricoros/big-agi/issues/new?&template=roadmap-request.md)
- [ ] ✨ [Deploy](docs/installation.md) your [fork](docs/customizations.md) for your friends and family, or [customize it for work](docs/customizations.md)

<br/>

[//]: # ([![GitHub stars]&#40;https://img.shields.io/github/stars/enricoros/big-agi&#41;]&#40;https://github.com/enricoros/big-agi/stargazers&#41;)

[//]: # ([![GitHub forks]&#40;https://img.shields.io/github/forks/enricoros/big-agi&#41;]&#40;https://github.com/enricoros/big-agi/network&#41;)

[//]: # ([![GitHub pull requests]&#40;https://img.shields.io/github/issues-pr/enricoros/big-agi&#41;]&#40;https://github.com/enricoros/big-agi/pulls&#41;)

[//]: # ([![License]&#40;https://img.shields.io/github/license/enricoros/big-agi&#41;]&#40;https://github.com/enricoros/big-agi/LICENSE&#41;)

---

2023-2024 · Enrico Ros x [big-AGI](https://big-agi.com) · License: [MIT](LICENSE) · Made with 💙
