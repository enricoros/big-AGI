# BIG-AGI 🧠✨

Welcome to big-AGI 👋, the GPT application for professionals that need function, form,
simplicity, and speed. Powered by the latest models from 7 vendors and
open-source model servers, `big-AGI` offers best-in-class Voice and Chat with AI Personas,
visualizations, coding, drawing, calling, and quite more -- all in a polished UX.

Pros use big-AGI. 🚀 Developers love big-AGI. 🤖

[![Official Website](https://img.shields.io/badge/BIG--AGI.com-%23096bde?style=for-the-badge&logo=vercel&label=launch)](https://big-agi.com)

Or fork & run on Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fenricoros%2Fbig-agi&env=OPENAI_API_KEY,OPENAI_API_HOST&envDescription=OpenAI%20KEY%20for%20your%20deployment.%20Set%20HOST%20only%20if%20non-default.)

## 👉 [roadmap](https://github.com/users/enricoros/projects/4/views/2)

big-AGI is an open book; our **[public roadmap](https://github.com/users/enricoros/projects/4/views/2)**
shows the current developments and future ideas.

- Got a suggestion? [_Add your roadmap ideas_](https://github.com/enricoros/big-agi/issues/new?&template=roadmap-request.md)
- Want to contribute? [_Pick up a task!_](https://github.com/users/enricoros/projects/4/views/4) - _easy_ to _pro_

### What's New in 1.7.3 · Dec 13, 2023 · Attachment Theory 🌟

- **Attachments System Overhaul**: Drag, paste, link, snap, text, images, PDFs and more. [#251](https://github.com/enricoros/big-agi/issues/251)
- **Desktop Webcam Capture**: Image capture now available as Labs feature. [#253](https://github.com/enricoros/big-agi/issues/253)
- **Independent Browsing**: Full browsing support with Browserless. [Learn More](https://github.com/enricoros/big-agi/blob/main/docs/config-browse.md)
- **Overheat LLMs**: Push the creativity with higher LLM temperatures. [#256](https://github.com/enricoros/big-agi/issues/256)
- **Model Options Shortcut**: Quick adjust with `Ctrl+Shift+O`
- Optimized Voice Input and Performance
- Latest Ollama and Oobabooga models
- For developers: **Password Protection**: HTTP Basic Auth. [Learn How](https://github.com/enricoros/big-agi/blob/main/docs/deploy-authentication.md)
- [1.7.1]: Improved Ollama chats. [#270](https://github.com/enricoros/big-agi/issues/270)
- [1.7.2]: OpenRouter login & free models 🎁
- [1.7.3]: Mistral Platform support. [#273](https://github.com/enricoros/big-agi/issues/273)

### What's New in 1.6.0 - Nov 28, 2023

- **Web Browsing**: Download web pages within chats - [browsing guide](https://github.com/enricoros/big-agi/blob/main/docs/config-browse.md)
- **Branching Discussions**: Create new conversations from any message
- **Keyboard Navigation**: Swift chat navigation with new shortcuts (e.g. ctrl+alt+left/right)
- **Performance Boost**: Faster rendering for a smoother experience
- **UI Enhancements**: Refined interface based on user feedback
- **New Features**: Anthropic Claude 2.1, `/help` command, and Flattener tool
- **For Developers**: Code quality upgrades and snackbar notifications

### What's New in 1.5.0 - Nov 19, 2023

- **Continued Voice**: Engage with hands-free interaction for a seamless experience
- **Visualization Tool**: Create data representations with our new visualization capabilities
- **Ollama Local Models**: Leverage local models support with our comprehensive guide
- **Text Tools**: Enjoy tools including highlight differences to refine your content
- **Mermaid Diagramming**: Render complex diagrams with our Mermaid language support
- **OpenAI 1106 Chat Models**: Experience the cutting-edge capabilities of the latest OpenAI models
- **SDXL Support**: Enhance your image generation with SDXL support for Prodia
- **Cloudflare OpenAI API Gateway**: Integrate with Cloudflare for a robust API gateway
- **Helicone for Anthropic**: Utilize Helicone's tools for Anthropic models

Check out the [big-AGI open roadmap](https://github.com/users/enricoros/projects/4/views/2), or
the [past releases changelog](docs/changelog.md).

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

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fenricoros%2Fbig-agi&env=OPENAI_API_KEY,OPENAI_API_HOST&envDescription=OpenAI%20KEY%20for%20your%20deployment.%20Set%20HOST%20only%20if%20non-default.)

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
