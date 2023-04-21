# BIG-AGI 🤖💬

Welcome to `big-agi`! 🎉
Personal AGI App, powered by `OpenAI GPT-4`. Designed for smart humans and super-heroes,
this responsive web app comes with Streaming, Code Execution, PDF imports, Voice support,
data Rendering, AGI functions and chats. Show your friends some `#big-agi-energy` 🚀

[![Official Website](https://img.shields.io/badge/BIG--AGI.com-%23096bde?style=for-the-badge&logo=vercel&label=demo)](https://big-agi.com)
<br/>
[![Official Discord](https://img.shields.io/discord/1098796266906980422?label=discord&logo=discord&logoColor=%23fff&style=for-the-badge)](https://discord.gg/v4Sayj4q)

Or click fork & run on Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fenricoros%2Fnextjs-chatgpt-app&env=OPENAI_API_KEY,OPENAI_API_HOST&envDescription=OpenAI%20KEY%20for%20your%20deployment.%20Set%20HOST%20only%20if%20non-default.)

## Features 👊

- Engaging AI Personas
- Clean UX, w/ tokens counters
- Human I/O: Advanced voice support (TTS, STT)
- Machine I/O: PDF import & Summarization, code execution
- Many more updates & integrations: ElevenLabs, Helicone, Paste.gg
- Coming up: automatic-AGI reasoning

## # changelog

🚨 **April: more cool new features** to the app!

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
- 🎉 [Cloudflare deployment instructions](docs/deploy-cloudflare.md), [awesome-agi.md](https://github.com/enricoros/awesome-agi) 
- 🎉 [Typing Avatars](docs/recording_0401.gif) ⌨️
  <!-- p><a href="docs/recording_0401.gif"><img src="docs/recording_0401.gif" width='700' alt="New Typing Avatars"/></a></p -->

**March: first release**

- 🎉 **[AI Personas](docs/screenshot_purpose_two.png)** - including Code, Science, Corporate, and Chat 🎭
- 🎉 **Privacy**: user-owned API keys 🔑 and localStorage 🛡️
- 🎉 **Context** - Attach or [Drag & Drop files](docs/screenshot_drop_target.png) to add them to the prompt 📁
- 🎉 **Syntax highlighting** - for multiple languages 🌈
- 🎉 **Code Execution: Sandpack** - [now on branch]((https://github.com/enricoros/nextjs-chatgpt-app/commit/f678a0d463d5e9cf0733f577e11bd612b7902d89)) `variant-code-execution`
- 🎉 Chat with GPT-4 and 3.5 Turbo 🧠💨
- 🎉 Real-time streaming of AI responses ⚡
- 🎉 **Voice Input** 🎙️ - works great on Chrome / Windows
- 🎉 Integration: **[Paste.gg](docs/screenshot_export_example1.png)** integration for chat sharing 📥
- 🎉 Integration: **[Helicone](https://www.helicone.ai/)** integration for API inspectability 📊
- 🌙 Dark model - Wide mode ⛶

## Roadmap 🛣️

🚨 ** April 2023 - Attention! We look for your input!** 🚨

| Roadmap              | RFC 📝                                                    | Status | Description                                                                                                      |
|:---------------------|-----------------------------------------------------------|:------:|:-----------------------------------------------------------------------------------------------------------------|
| Editable Purposes 🎭 | https://github.com/enricoros/nextjs-chatgpt-app/issues/35 |   💬   | In-app customization of 'Purposes', as many forks are created for that reason.                                   |
| Templates sharing 🌐 | https://github.com/enricoros/nextjs-chatgpt-app/issues/35 |   💬   | Community repository of Purposes/Systems - Vote with 👍 and usage. Where to store? Bring your own key? Moderate? |
| Reasoning Systems 🧩 | https://github.com/enricoros/nextjs-chatgpt-app/issues/36 |   🤔   | ReAct, DEPS, Reflexion - shall we?                                                                               |
| Your epic idea       |                                                           |   💡   | [Create RFC](https://github.com/enricoros/nextjs-chatgpt-app/issues/new?labels=RFC&body=Describe+the+idea) ❗     |

## Why this? 💡

Because the official Chat is ___slower than the API___, and the Playground UI ___doesn't even highlight code___.

![Ask away, paste a ton, copy the gems](docs/screenshot_web_highlighting.png)

## Integrations 🤝

| Integration                          | Description                | Docs                                                   |
|:-------------------------------------|:---------------------------|:-------------------------------------------------------|
| [Helicone](https://www.helicone.ai/) | LLM Observability Platform | Settings Menu > Advanced > API Host: 'oai.hconeai.com' |
| [Paste.gg](https://paste.gg/)        | Paste Sharing              | Chat Menu > Share via paste.gg                         |

## Developing 🚀

Tech Stack 🛠️

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=vercel&logoColor=white)

Simply clone the repository, install the dependencies, and run the development server:

```bash
git clone https://github.com/enricoros/nextjs-chatgpt-app.git
cd nextjs-chatgpt-app
npm install
npm run dev
```

Now the app should be running on `http://localhost:3000`.

## Contributing 🙌

The source code is Very Simple™ 😀. We'd love to have you contribute to this project! Feel free to fork the repository,
make changes, and submit a pull request. If you have any questions or need help, feel free to reach out to us.

This project is licensed under the MIT License.


---

[![GitHub stars](https://img.shields.io/github/stars/enricoros/nextjs-chatgpt-app)](https://github.com/enricoros/nextjs-chatgpt-app/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/enricoros/nextjs-chatgpt-app)](https://github.com/enricoros/nextjs-chatgpt-app/network)
[![GitHub issues](https://img.shields.io/github/issues/enricoros/nextjs-chatgpt-app)](https://github.com/enricoros/nextjs-chatgpt-app/issues)
[![GitHub pull requests](https://img.shields.io/github/issues-pr/enricoros/nextjs-chatgpt-app)](https://github.com/enricoros/nextjs-chatgpt-app/pulls)
[![GitHub license](https://img.shields.io/github/license/enricoros/nextjs-chatgpt-app)](https://github.com/enricoros/nextjs-chatgpt-app/LICENSE)
[![Twitter Follow](https://img.shields.io/twitter/follow/enricoros?style=social)](https://twitter.com/enricoros)

Made with 💙
