## Changelog

This is a high-level changelog. Calls out some of the high level features batched
by release.

- For the live roadmap, please see [the GitHub project](https://github.com/users/enricoros/projects/4/views/2)

### 1.8.0 - Dec 2023

- work in progress: [big-AGI open roadmap](https://github.com/users/enricoros/projects/4/views/2), [help here](https://github.com/users/enricoros/projects/4/views/4)
- milestone: [1.8.0](https://github.com/enricoros/big-agi/milestone/8)

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

### What's New in 1.6.0 - Nov 28, 2023 · Surf's Up

- **Web Browsing**: Download web pages within chats - [browsing guide](https://github.com/enricoros/big-agi/blob/main/docs/config-browse.md)
- **Branching Discussions**: Create new conversations from any message
- **Keyboard Navigation**: Swift chat navigation with new shortcuts (e.g. ctrl+alt+left/right)
- **Performance Boost**: Faster rendering for a smoother experience
- **UI Enhancements**: Refined interface based on user feedback
- **New Features**: Anthropic Claude 2.1, `/help` command, and Flattener tool
- **For Developers**: Code quality upgrades and snackbar notifications

### What's New in 1.5.0 - Nov 19, 2023 · Loaded

- **Continued Voice**: Engage with hands-free interaction for a seamless experience
- **Visualization Tool**: Create data representations with our new visualization capabilities
- **Ollama Local Models**: Leverage local models support with our comprehensive guide
- **Text Tools**: Enjoy tools including highlight differences to refine your content
- **Mermaid Diagramming**: Render complex diagrams with our Mermaid language support
- **OpenAI 1106 Chat Models**: Experience the cutting-edge capabilities of the latest OpenAI models
- **SDXL Support**: Enhance your image generation with SDXL support for Prodia
- **Cloudflare OpenAI API Gateway**: Integrate with Cloudflare for a robust API gateway
- **Helicone for Anthropic**: Utilize Helicone's tools for Anthropic models

For Developers:

- Runtime Server-Side configuration:  https://github.com/enricoros/big-agi/issues/189. Env vars are
  not required to be set at build time anymore. The frontend will roundtrip to the backend at the
  first request to get the configuration. See
  https://github.com/enricoros/big-agi/blob/main/src/modules/backend/backend.router.ts.
- CloudFlare developers: please change the deployment command to
  `rm app/api/trpc-node/[trpc]/route.ts && npx @cloudflare/next-on-pages@1`,
  as we transitioned to the App router in NextJS 14. The documentation in
  [docs/deploy-cloudflare.md](../docs/deploy-cloudflare.md) is updated

### 1.4.0: Sept/Oct: scale OUT

- **Expanded Model Support**: Azure and [OpenRouter](https://openrouter.ai/docs#models) models, including gpt-4-32k
- **Share and clone** conversations with public links
- Removed the 20 chats hard limit ([Ashesh3](https://github.com/enricoros/big-agi/pull/158))
- Latex Rendering
- Augmented Chat modes (Labs)

### July/Aug: More Better Faster

- **Camera OCR** - real-world AI - take a picture of a text, and chat with it
- **Anthropic models** support, e.g. Claude
- **Backup/Restore** - save chats, and restore them later
- **[Local model support with Oobabooga server](../docs/config-local-oobabooga)** - run your own LLMs!
- **Flatten conversations** - conversations summarizer with 4 modes
- **Fork conversations** - create a new chat, to try with different endings
- New commands: /s to add a System message, and /a for an Assistant message
- New Chat modes: Write-only - just appends the message, without assistant response
- Fix STOP generation - in sync with the Vercel team to fix a long-standing NextJS issue
- Fixes on the HTML block - particularly useful to see error pages

### June: scale UP

- **[New OpenAI Models](https://openai.com/blog/function-calling-and-other-api-updates) support** - 0613 models, including 16k and 32k
- **Cleaner UI** - with rationalized Settings, Modals, and Configurators
- **Dynamic Models Configurator** - easy connection with different model vendors
- **Multiple Model Vendors Support** framework to support many LLM vendors
- **Per-model Options** (temperature, tokens, etc.) for fine-tuning AI behavior to your needs
- Support for GPT-4-32k
- Improved Dialogs and Messages
- Much Enhanced DX: TRPC integration, modularization, pluggable UI, etc

### April / May: more #big-agi-energy

- **[Google Search](../docs/pixels/feature_react_google.png)** active in ReAct - add your keys to Settings > Google
  Search
- **[Reason+Act](../docs/pixels/feature_react_turn_on.png)** preview feature - activate with 2-taps on the 'Chat' button
- **[Image Generation](../docs/pixels/feature_imagine_command.png)** using Prodia (BYO Keys) - /imagine - or menu option
- **[Voice Synthesis](../docs/pixels/feature_voice_1.png)** 📣 with ElevenLabs, including selection of custom voices
- **[Precise Token Counter](../docs/pixels/feature_token_counter.png)** 📈 extra-useful to pack the context window
- **[Install Mobile APP](../docs/pixels/feature_pwa.png)** 📲 looks like native (@harlanlewis)
- **[UI language](../docs/pixels/feature_language.png)** with auto-detect, and future app language! (@tbodyston)
- **PDF Summarization** 🧩🤯 - ask questions to a PDF! (@fredliubojin)
- **Code Execution: [Codepen](https://codepen.io/)/[Replit](https://replit.com/)** 💻 (@harlanlewis)
- **[SVG Drawing](../docs/pixels/feature_svg_drawing.png)** - draw with AI 🎨
- Chats: multiple chats, AI titles, Import/Export, Selection mode
- Rendering: Markdown, SVG, improved Code blocks
- Integrations: OpenAI organization ID
- [Cloudflare deployment instructions](../docs/deploy-cloudflare.md),
  [awesome-agi](https://github.com/enricoros/awesome-agi)
- [Typing Avatars](../docs/pixels/gif_typing_040123.gif) ⌨️
  <!-- p><a href="../docs/pixels/gif_typing_040123.gif"><img src="../docs/pixels/gif_typing_040123.gif" width='700' alt="New Typing Avatars"/></a></p -->

### March: first release

- **[AI Personas](../docs/pixels/feature_purpose_two.png)** - including Code, Science, Corporate, and Chat 🎭
- **Privacy**: user-owned API keys 🔑 and localStorage 🛡️
- **Context** - Attach or [Drag & Drop files](../docs/pixels/feature_drop_target.png) to add them to the prompt 📁
- **Syntax highlighting** - for multiple languages 🌈
- **Code Execution: Sandpack** -
  [now on branch]((https://github.com/enricoros/big-agi/commit/f678a0d463d5e9cf0733f577e11bd612b7902d89)) `variant-code-execution`
- Chat with GPT-4 and 3.5 Turbo 🧠💨
- Real-time streaming of AI responses ⚡
- **Voice Input** 🎙️ - works great on Chrome / Windows
- Integration: **[Paste.gg](../docs/pixels/feature_paste_gg.png)** integration for chat sharing 📥
- Integration: **[Helicone](https://www.helicone.ai/)** integration for API observability 📊
- 🌙 Dark model - Wide mode ⛶
