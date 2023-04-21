# BIG-AGI 🤖💬

Welcome to `big-agi`! 🎉
Personal AGI App, powered by `OpenAI GPT-4`. Designed for smart humans and super-heroes,
this responsive web app comes with Streaming, Code Execution, PDF imports, Voice support,
data Rendering, AGI functions and chats. Show your friends some `#big-agi-energy` 🚀

[![Official Website](https://img.shields.io/badge/BIG--AGI.com-%23096bde?style=for-the-badge&logo=vercel&label=demo)](https://big-agi.com)

Or click fork & run on Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fenricoros%2Fbig-agi&env=OPENAI_API_KEY,OPENAI_API_HOST&envDescription=OpenAI%20KEY%20for%20your%20deployment.%20Set%20HOST%20only%20if%20non-default.)

## Useful 👊

- Engaging AI Personas
- Clean UX, w/ tokens counters
- Privacy: user-owned API keys and localStorage
- Human I/O: Advanced voice support (TTS, STT)
- Machine I/O: PDF import & Summarization, code execution
- Many more updates & integrations: ElevenLabs, Helicone, Paste.gg
- Coming up: automatic-AGI reasoning

### Features

#### 🚨 April: moar #big-agi-energy

- 🎉 **[Voice Synthesis](docs/feature_voice_1.png)** 📣 with ElevenLabs, including selection of custom voices
- 🎉 **[Precise Token Counter](docs/feature_token_counter.png)** 📈 extra-useful to pack the context window
- 🎉 **[Install Mobile APP](docs/pwa_installed_icon.png)** 📲 looks like native (@harlanlewis)
- 🎉 **[UI language](docs/feature_language.png)** with auto-detect, and future app language! (@tbodyston)
- 🎉 **PDF Summarization** 🧩🤯 - ask questions to a PDF! (@fredliubojin)
- 🎉 **Code Execution: [Codepen](https://codepen.io/)/[Replit](https://replit.com/)** 💻 (@harlanlewis)
- 🎉 **[SVG Drawing](docs/feature_svg_drawing.png)** - draw with AI 🎨
- 🎉 Chats: multiple chats, AI titles, download as JSON
- 🎉 Rendering: Markdown, SVG, improved Code blocks
- 🎉 Integrations: OpenAI organization ID
- 🎉 [Cloudflare deployment instructions](docs/deploy-cloudflare.md),
  [awesome-agi](https://github.com/enricoros/awesome-agi)
- 🎉 [Typing Avatars](docs/recording_0401.gif) ⌨️
  <!-- p><a href="docs/recording_0401.gif"><img src="docs/recording_0401.gif" width='700' alt="New Typing Avatars"/></a></p -->

#### March: first release

- 🎉 **[AI Personas](docs/screenshot_purpose_two.png)** - including Code, Science, Corporate, and Chat 🎭
- 🎉 **Privacy**: user-owned API keys 🔑 and localStorage 🛡️
- 🎉 **Context** - Attach or [Drag & Drop files](docs/screenshot_drop_target.png) to add them to the prompt 📁
- 🎉 **Syntax highlighting** - for multiple languages 🌈
- 🎉 **Code Execution: Sandpack
  ** - [now on branch]((https://github.com/enricoros/big-agi/commit/f678a0d463d5e9cf0733f577e11bd612b7902d89)) `variant-code-execution`
- 🎉 Chat with GPT-4 and 3.5 Turbo 🧠💨
- 🎉 Real-time streaming of AI responses ⚡
- 🎉 **Voice Input** 🎙️ - works great on Chrome / Windows
- 🎉 Integration: **[Paste.gg](docs/screenshot_export_example1.png)** integration for chat sharing 📥
- 🎉 Integration: **[Helicone](https://www.helicone.ai/)** integration for API inspectability 📊
- 🌙 Dark model - Wide mode ⛶

## thank YOU 🙌

[![Official Discord](https://img.shields.io/discord/1098796266906980422?label=discord&logo=discord&logoColor=%23fff&style=for-the-badge)](https://discord.gg/v4Sayj4q)

* Enjoy the vanilla app on [big-AGI.com](https://main.big-agi.com)
* [Chat with us](https://discord.gg/v4Sayj4q). We just started!
* Deploy your [fork](https://github.com/enricoros/big-agi/fork) and surprise your friends with big-GPT
  energy!
* Send a PRs! 🎉 would love help with:
    * 🎭[Editing Personas](https://github.com/enricoros/big-agi/issues/35),
      🧩[Reasoning Systems](https://github.com/enricoros/big-agi/issues/36),
      🌐[Community Templates](https://github.com/enricoros/big-agi/issues/35),
      and
    * [Your BIG-idea](https://github.com/enricoros/big-agi/issues/new?labels=RFC&body=Describe+the+idea)❗

## Why this? 💡

Because the official Chat is ___slower than the API___, and the Playground UI ___doesn't even highlight code___.

![Ask away, paste a ton, copy the gems](docs/screenshot_web_highlighting.png)

## Code 🧩

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

* [Helicone](https://www.helicone.ai/) LLM Observability Platform - Settings > Advanced > API Host: 'oai.hconeai.com'
* [Paste.gg](https://paste.gg/) Paste Sharing - Chat Menu > Share via paste.gg

---

This project is licensed under the MIT License.

[![GitHub stars](https://img.shields.io/github/stars/enricoros/big-agi)](https://github.com/enricoros/big-agi/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/enricoros/big-agi)](https://github.com/enricoros/big-agi/network)
[![GitHub pull requests](https://img.shields.io/github/issues-pr/enricoros/big-agi)](https://github.com/enricoros/big-agi/pulls)
[![License](https://img.shields.io/github/license/enricoros/big-agi)](https://github.com/enricoros/big-agi/LICENSE)

[//]: # ([![GitHub issues]&#40;https://img.shields.io/github/issues/enricoros/big-agi&#41;]&#40;https://github.com/enricoros/big-agi/issues&#41;)

Made with 💙