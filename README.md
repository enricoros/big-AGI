# BIG-AGI 🧠✨

Welcome to big-AGI 👋, the GPT application for professionals that need function, form,
simplicity, and speed. Powered by the latest models from 11 vendors and
open-source model servers, `big-AGI` offers best-in-class Voice and Chat with AI Personas,
visualizations, coding, drawing, calling, and quite more -- all in a polished UX.

Pros use big-AGI. 🚀 Developers love big-AGI. 🤖

[![Official Website](https://img.shields.io/badge/BIG--AGI.com-%23096bde?style=for-the-badge&logo=vercel&label=launch)](https://big-agi.com)

Or fork & run on Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fenricoros%2Fbig-agi&env=OPENAI_API_KEY&envDescription=Backend%20API%20keys%2C%20optional%20and%20may%20be%20overridden%20by%20the%20UI.&envLink=https%3A%2F%2Fgithub.com%2Fenricoros%2Fbig-AGI%2Fblob%2Fmain%2Fdocs%2Fenvironment-variables.md&project-name=big-agi)

## 👉 [roadmap](https://github.com/users/enricoros/projects/4/views/2)

big-AGI is an open book; our **[public roadmap](https://github.com/users/enricoros/projects/4/views/2)**
shows the current developments and future ideas.

- Got a suggestion? [_Add your roadmap ideas_](https://github.com/enricoros/big-agi/issues/new?&template=roadmap-request.md)
- Want to contribute? [_Pick up a task!_](https://github.com/users/enricoros/projects/4/views/4) - _easy_ to _pro_

### What's New in 1.11.0 · Jan 16, 2024 · Singularity

https://github.com/enricoros/big-AGI/assets/1590910/a6b8e172-0726-4b03-a5e5-10cfcb110c68

- **Find chats**: search in titles and content, with frequency ranking. [#329](https://github.com/enricoros/big-AGI/issues/329)
- **Commands**: command auto-completion (type '/'). [#327](https://github.com/enricoros/big-AGI/issues/327)
- **[Together AI](https://www.together.ai/products#inference)** inference platform support (good speed and newer models). [#346](https://github.com/enricoros/big-AGI/issues/346)
- Persona Creator history, deletion, custom creation, fix llm API timeouts
- Enable adding up to five custom OpenAI-compatible endpoints
- Developer enhancements: new 'Actiles' framework

### What's New in 1.10.0 · Jan 6, 2024 · The Year of AGI

https://github.com/enricoros/big-AGI/assets/32999/fbb1be49-5c38-49c8-86fa-3705700f6c39

- **New UI**: for both desktop and mobile, sets the stage for future scale. [#201](https://github.com/enricoros/big-AGI/issues/201)
- **Conversation Folders**: enhanced conversation organization. [#321](https://github.com/enricoros/big-AGI/issues/321)
- **[LM Studio](https://lmstudio.ai/)** support and improved token management
- Resizable panes in split-screen conversations.
- Large performance optimizations
- Developer enhancements: new UI framework, updated documentation for proxy settings on browserless/docker

### What's New in 1.9.0 · Dec 28, 2023 · Creative Horizons

- **DALL·E 3 integration** for enhanced image generation. [#212](https://github.com/enricoros/big-AGI/issues/212)
- **Perfect scrolling mechanics** across devices. [#304](https://github.com/enricoros/big-AGI/issues/304)
- Persona creation now supports **text input**. [#287](https://github.com/enricoros/big-AGI/pull/287)
- Openrouter updates for better model management and rate limit handling
- Image drawing UX improvements
- Layout fix for Firefox users
- Developer enhancements: Text2Image subsystem, Optima layout, ScrollToBottom library, Panes library, and Llms subsystem updates.

For full details and former releases, check out the [changelog](docs/changelog.md).

## ✨ Key Features 👊

![Ask away, paste a ton, copy the gems](docs/pixels/big-AGI-compo1.png)
[More](docs/pixels/big-AGI-compo2b.png), [screenshots](docs/pixels).

- **AI Personas**: Tailor your AI interactions with customizable personas
- **Sleek UI/UX**: A smooth, intuitive, and mobile-responsive interface
- **Efficient Interaction**: Voice commands, OCR, and drag-and-drop file uploads
- **Multiple AI Models**: Choose from a variety of leading AI providers
- **Privacy First**: Self-host and use your own API keys for full control
- **Advanced Tools**: Execute code, import PDFs, and summarize documents
- **Seamless Integrations**: Enhance functionality with various third-party services
- **Open Roadmap**: Contribute to the progress of big-AGI

## 💖 Support

[//]: # ([![Official Discord]&#40;https://img.shields.io/discord/1098796266906980422?label=discord&logo=discord&logoColor=%23fff&style=for-the-badge&#41;]&#40;https://discord.gg/MkH4qj2Jp9&#41;)
[![Official Discord](https://discordapp.com/api/guilds/1098796266906980422/widget.png?style=banner2)](https://discord.gg/MkH4qj2Jp9)

* Enjoy the hosted open-source app on [big-AGI.com](https://big-agi.com)
* [Chat with us](https://discord.gg/MkH4qj2Jp9)
* Deploy your [fork](https://github.com/enricoros/big-agi/fork) for your friends and family
* send PRs! ...
  🎭[Editing Personas](https://github.com/enricoros/big-agi/issues/35),
  🧩[Reasoning Systems](https://github.com/enricoros/big-agi/issues/36),
  🌐[Community Templates](https://github.com/enricoros/big-agi/issues/35),
  and [your big-IDEAs](https://github.com/enricoros/big-agi/issues/new?labels=RFC&body=Describe+the+idea)

<br/>

## 🧩 Develop

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?style=&logo=react&logoColor=black)
![Next.js](https://img.shields.io/badge/Next.js-000000?style=&logo=vercel&logoColor=white)

Clone this repo, install the dependencies (all locally), and run the development server (which auto-watches the
files for changes):

```bash
git clone https://github.com/enricoros/big-agi.git
cd big-agi
npm install
npm run dev
```

The development app will be running on `http://localhost:3000`. Development builds have the advantage of not requiring
a build step, but can be slower than production builds. Also, development builds won't have timeout on edge functions.

## 🌐 Deploy manually

The _production_ build of the application is optimized for performance and is performed by the `npm run build` command,
after installing the required dependencies.

```bash
# .. repeat the steps above up to `npm install`, then:
npm run build
npm run start --port 3000
```

The app will be running on the specified port, e.g. `http://localhost:3000`.

Want to deploy with username/password? See the [Authentication](docs/deploy-authentication.md) guide.

## 🐳 Deploy with Docker

For more detailed information on deploying with Docker, please refer to the [docker deployment documentation](docs/deploy-docker.md).

Build and run:

```bash
docker build -t big-agi .
docker run -d -p 3000:3000 big-agi
``` 

Or run the official container:

- manually: `docker run -d -p 3000:3000 ghcr.io/enricoros/big-agi`
- or, with docker-compose: `docker-compose up` or see [the documentation](docs/deploy-docker.md) for a composer file with integrated browsing

## ☁️ Deploy on Cloudflare Pages

Please refer to the [Cloudflare deployment documentation](docs/deploy-cloudflare.md).

## 🚀 Deploy on Vercel

Create your GitHub fork, create a Vercel project over that fork, and deploy it. Or press the button below for convenience.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fenricoros%2Fbig-agi&env=OPENAI_API_KEY&envDescription=Backend%20API%20keys%2C%20optional%20and%20may%20be%20overridden%20by%20the%20UI.&envLink=https%3A%2F%2Fgithub.com%2Fenricoros%2Fbig-AGI%2Fblob%2Fmain%2Fdocs%2Fenvironment-variables.md&project-name=big-agi)

## Integrations:

* Local models: Ollama, Oobabooga, LocalAi, etc.
* [ElevenLabs](https://elevenlabs.io/) Voice Synthesis (bring your own voice too) - Settings > Text To Speech
* [Helicone](https://www.helicone.ai/) LLM Observability Platform - Models > OpenAI > Advanced > API Host: 'oai.hconeai.com'
* [Paste.gg](https://paste.gg/) Paste Sharing - Chat Menu > Share via paste.gg
* [Prodia](https://prodia.com/) Image Generation - Settings > Image Generation > Api Key & Model

<br/>

This project is licensed under the MIT License.

[![GitHub stars](https://img.shields.io/github/stars/enricoros/big-agi)](https://github.com/enricoros/big-agi/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/enricoros/big-agi)](https://github.com/enricoros/big-agi/network)
[![GitHub pull requests](https://img.shields.io/github/issues-pr/enricoros/big-agi)](https://github.com/enricoros/big-agi/pulls)
[![License](https://img.shields.io/github/license/enricoros/big-agi)](https://github.com/enricoros/big-agi/LICENSE)

[//]: # ([![GitHub issues]&#40;https://img.shields.io/github/issues/enricoros/big-agi&#41;]&#40;https://github.com/enricoros/big-agi/issues&#41;)

Made with 💙
