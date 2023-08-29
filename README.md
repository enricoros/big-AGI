# `BIG-AGI` 🤖💬

Welcome to `big-AGI` 👋 your personal AGI application
powered by OpenAI GPT-4 and beyond. Designed for smart humans and super-heroes,
this responsive web app comes with Personas, Drawing, Code Execution, PDF imports, Voice support,
data Rendering, AGI functions, chats and much more. Comes with plenty of `#big-AGI-energy` 🚀

[![Official Website](https://img.shields.io/badge/BIG--AGI.com-%23096bde?style=for-the-badge&logo=vercel&label=demo)](https://big-agi.com)

Or fork & run on Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fenricoros%2Fbig-agi&env=OPENAI_API_KEY,OPENAI_API_HOST&envDescription=OpenAI%20KEY%20for%20your%20deployment.%20Set%20HOST%20only%20if%20non-default.)

## Useful 👊

![Ask away, paste a ton, copy the gems](docs/pixels/big-AGI-compo1.png)

- Engaging AI Personas
- Clean UX, w/ tokens counters
- Private: user-owned API keys and localStorage, self-hostable if you like
- Human I/O: Advanced voice support (TTS, STT)
- Machine I/O: PDF import & Summarization, code execution
- Many more updates & integrations: ElevenLabs, Helicone, Paste.gg, Prodia
- Coming up: automatic-AGI reasoning (Reason+Act) and more

## Support 🙌

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

## Latest Drops 💧🎁

#### 🚨 July/Aug: Back with the Cool features 🧠

- 🎉 **Camera OCR** - real-world AI - take a picture of a text, and chat with it
- 🎉 **Backup/Restore** - save chats, and restore them later
- 🎉 **[Local model support with Oobabooga server](docs/local-llm-text-web-ui.md)** - run your own LLMs!
- 🎉 **Flatten conversations** - conversations summarizer with 4 modes
- 🎉 **Fork conversations** - create a new chat, to expriment with different endings
- 🎉 New commands: /s to add a System message, and /a for an Assistant message
- 🎉 New Chat modes: Write-only - just appends the message, without assistant response
- 🎉 Fix STOP generation - in sync with the Vercel team to fix a long-standing NextJS issue
- 🎉 Fixes on the HTML block - particularly useful to see error pages

#### June: scale UP 🚀

- 🎉 **[New OpenAI Models](https://openai.com/blog/function-calling-and-other-api-updates) support** - 0613 models, including 16k and 32k 
- 🎉 **Cleaner UI** - with rationalized Settings, Modals, and Configurators
- 🎉 **Dynamic Models Configurator** - easy connection with different model vendors
- 🎉 **Multiple Model Vendors Support** framework to support many LLM vendors
- 🎉 **Per-model Options** (temperature, tokens, etc.) for fine-tuning AI behavior to your needs
- 🎉 Support for GPT-4-32k
- 🎉 Improved Dialogs and Messages
- 🎉 Much Enhanced DX: TRPC integration, modularization, pluggable UI, etc

#### April / May: more #big-agi-energy

- 🎉 **[Google Search](docs/pixels/feature_react_google.png)** active in ReAct - add your keys to Settings > Google
  Search
- 🎉 **[Reason+Act](docs/pixels/feature_react_turn_on.png)** preview feature - activate with 2-taps on the 'Chat' button
- 🎉 **[Image Generation](docs/pixels/feature_imagine_command.png)** using Prodia (BYO Keys) - /imagine - or menu option
- 🎉 **[Voice Synthesis](docs/pixels/feature_voice_1.png)** 📣 with ElevenLabs, including selection of custom voices
- 🎉 **[Precise Token Counter](docs/pixels/feature_token_counter.png)** 📈 extra-useful to pack the context window
- 🎉 **[Install Mobile APP](docs/pixels/feature_pwa.png)** 📲 looks like native (@harlanlewis)
- 🎉 **[UI language](docs/pixels/feature_language.png)** with auto-detect, and future app language! (@tbodyston)
- 🎉 **PDF Summarization** 🧩🤯 - ask questions to a PDF! (@fredliubojin)
- 🎉 **Code Execution: [Codepen](https://codepen.io/)/[Replit](https://replit.com/)** 💻 (@harlanlewis)
- 🎉 **[SVG Drawing](docs/pixels/feature_svg_drawing.png)** - draw with AI 🎨
- 🎉 Chats: multiple chats, AI titles, Import/Export, Selection mode
- 🎉 Rendering: Markdown, SVG, improved Code blocks
- 🎉 Integrations: OpenAI organization ID
- 🎉 [Cloudflare deployment instructions](docs/deploy-cloudflare.md),
  [awesome-agi](https://github.com/enricoros/awesome-agi)
- 🎉 [Typing Avatars](docs/pixels/gif_typing_040123.gif) ⌨️
  <!-- p><a href="docs/pixels/gif_typing_040123.gif"><img src="docs/pixels/gif_typing_040123.gif" width='700' alt="New Typing Avatars"/></a></p -->

#### March: first release

- 🎉 **[AI Personas](docs/pixels/feature_purpose_two.png)** - including Code, Science, Corporate, and Chat 🎭
- 🎉 **Privacy**: user-owned API keys 🔑 and localStorage 🛡️
- 🎉 **Context** - Attach or [Drag & Drop files](docs/pixels/feature_drop_target.png) to add them to the prompt 📁
- 🎉 **Syntax highlighting** - for multiple languages 🌈
- 🎉 **Code Execution: Sandpack** -
   [now on branch]((https://github.com/enricoros/big-agi/commit/f678a0d463d5e9cf0733f577e11bd612b7902d89)) `variant-code-execution`
- 🎉 Chat with GPT-4 and 3.5 Turbo 🧠💨
- 🎉 Real-time streaming of AI responses ⚡
- 🎉 **Voice Input** 🎙️ - works great on Chrome / Windows
- 🎉 Integration: **[Paste.gg](docs/pixels/feature_paste_gg.png)** integration for chat sharing 📥
- 🎉 Integration: **[Helicone](https://www.helicone.ai/)** integration for API observability 📊
- 🌙 Dark model - Wide mode ⛶

<br/>

## Why this? 💡

Because the official Chat ___lacks important features___, is ___more limited than the api___, at times
___slow or unavailable___, and you cannot deploy it yourself, remix it, add features, or share it with
your friends.
Our users report that ___big-AGI is faster___, ___more reliable___, and ___features rich___
with features that matter to them.

![Much features, so fun](docs/pixels/big-AGI-compo2b.png)

## Develop 🧩

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?style=&logo=react&logoColor=black)
![Next.js](https://img.shields.io/badge/Next.js-000000?style=&logo=vercel&logoColor=white)

Clone this repo, install the dependencies, and run the development server:

```bash
git clone https://github.com/enricoros/big-agi.git
cd big-agi
npm install
npm run dev
```

Now the app should be running on `http://localhost:3000`

### Integrations:

* [ElevenLabs](https://elevenlabs.io/) Voice Synthesis (bring your own voice too) - Settings > Text To Speech
* [Helicone](https://www.helicone.ai/) LLM Observability Platform - Settings > Advanced > API Host: 'oai.hconeai.com'
* [Paste.gg](https://paste.gg/) Paste Sharing - Chat Menu > Share via paste.gg
* [Prodia](https://prodia.com/) Image Generation - Settings > Image Generation > Api Key & Model

## Deploy with Docker 🐳

Specific docker information on [docs/deploy-docker.md](docs/deploy-docker.md). In short:

#### Pre-built image

Add your OpenAI API key to the `.env` file, then in a terminal run:

```bash
docker-compose up
```

#### Locally built image

If you wish to build the image yourself, run

```bash
docker build -t big-agi .
docker run --detach 'big-agi'
``` 

<br/>

This project is licensed under the MIT License.

[![GitHub stars](https://img.shields.io/github/stars/enricoros/big-agi)](https://github.com/enricoros/big-agi/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/enricoros/big-agi)](https://github.com/enricoros/big-agi/network)
[![GitHub pull requests](https://img.shields.io/github/issues-pr/enricoros/big-agi)](https://github.com/enricoros/big-agi/pulls)
[![License](https://img.shields.io/github/license/enricoros/big-agi)](https://github.com/enricoros/big-agi/LICENSE)

[//]: # ([![GitHub issues]&#40;https://img.shields.io/github/issues/enricoros/big-agi&#41;]&#40;https://github.com/enricoros/big-agi/issues&#41;)

Made with 💙
