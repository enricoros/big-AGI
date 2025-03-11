# Big-AGI Data Ownership Guide

Big-AGI is a **client-first** web application, which means it prioritizes speed and data ownership compared to cloud apps.
Your *API keys*, *chat history*, and *settings* live in your
browser's [local storage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage), not
on cloud servers.

You can use Big-AGI in two ways:

1. Run it yourself (open-source)
2. Use big-agi.com (hosted service)

This guide explains how the open-source version handles your data. You can verify everything in [the source code](https://github.com/enricoros/big-agi).

## Client-Side Storage

Within Big-AGI almost all chat/keys data is handled client-side in your browser using two
standard browser storage mechanisms:

- **Local Storage**: API keys, settings, and configurations ([learn more](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage))
- **IndexedDB**: Chat history and larger files ([learn more](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API))

The Big-AGI backend mainly passes requests to AI services (OpenAI, Anthropic, etc.). It doesn't store your data, except for the chat-sharing function if used.

You can see your data in your browser's local storage and IndexedDB - try it yourself:

1. In Chrome: Open DevTools (press F12 on Windows, ⌘ + ⌥ + I on Mac)
2. Click 'Application' > 'Local Storage'
3. See your settings and API keys

![Browser local storage showing API keys and chat data](pixels/data_ownership_local_storage.png)

### What This Means For You

Storing data in your browser means:

- Your data stays on **one device/browser only**
- Clearing browser data **erases your chats** - make backups
- Anyone using your browser can see your chats and keys
- Running your own server needs technical skills

### Local Device Identifier

Big-AGI generates a _device identifier_ that combines timestamp and random components, stored only on your device. This identifier:

- Is used only for the **optional sync functionality** between your devices (not yet ready)
- Helps maintain data consistency when using Big-AGI across multiple devices
- Remains completely local unless you explicitly enable sync
- Is not used for tracking, analytics, or telemetry
- Can be deleted anytime by clearing local storage
- Is fully transparent - see the implementation in `src/common/stores/store-client.ts`

## How Data Flows

AI interactions in Big-AGI, such as chats, AI titles, text to speech, browsing, flow through three components:

1. **Browser** (client/installed App) - Stores your keys & data locally
2. **Backend** (routing server) - Passes requests to AI services
3. **AI Services** - Where the actual AI processing happens

### Self-Deployed Version: Your Infrastructure

You run the server. Your data only leaves when making AI requests.
The keys and chats are under your control and pass through your code, and are sent to
the upstream AI services on a per-request basis.

![data_ownership_local.png](pixels/data_ownership_deployed.png)

### Web Version: Using big-agi.com

Your data passes through the hosted Big-AGI edge network to reach AI services. The keys
and chats pass through Big-AGI's edge network to reach the AI services on a per-request basis,
and then are send to the upstream AI services.

![data_ownership_hosted.png](pixels/data_ownership_hosted.png)

## Security Best Practices

**Basic Security**:

- **Never share API keys**
- **Don't use shared computers**
- Use private browsing for one-off sessions
- Use trusted networks
- Back up your data

**When Running Your Own Server**:

- Use [environment variables](environment-variables.md) for API keys
- Run on trusted infrastructure
- Keep your installation updated

## TL;DR

Your API keys and chats stay in your browser. The server only passes requests to AI services.

Use big-agi.com for convenience, or [run it yourself](installation.md) for full control.

Need help? Join our [Discord](https://discord.gg/MkH4qj2Jp9) or open a [GitHub issue](https://github.com/enricoros/big-agi/issues).
