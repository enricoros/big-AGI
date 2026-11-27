# Using Rapid-MLX with big-AGI

[Rapid-MLX](https://github.com/raullenchai/Rapid-MLX) is a local OpenAI-compatible LLM server for Apple Silicon.

## Start the server

Install with Homebrew or pip:

```bash
brew install raullenchai/rapid-mlx/rapid-mlx
# Or: pip install rapid-mlx
```

Serve a model:

```bash
rapid-mlx serve mlx-community/Qwen3.5-4B-MLX-4bit --port 8000
```

The OpenAI API is at `http://localhost:8000/v1`. No API key is required by default.

## Configure big-AGI

1. Open **Models** > **Add** > **OpenAI**.
2. Open **Advanced** if **API Endpoint** is hidden. Set it to `http://localhost:8000`.
   A trailing `/v1` also works; big-AGI avoids duplicating it.
3. Leave **API Key** empty. The field is marked required, but custom endpoints accept an empty key.
4. Click **Models** to refresh the list. Select the served chat model and start a conversation.

For a self-hosted big-AGI instance, set this in the project-root `.env` instead:

```bash
OPENAI_API_HOST=http://localhost:8000
```

Restart big-AGI, leave the UI endpoint and key empty, and refresh **Models** for the OpenAI source.
No `OPENAI_API_KEY` is needed. See [environment variables](environment-variables.md).
UI settings override server configuration; environment variables apply to server-side requests only.

## Troubleshooting

- Check the server with `curl http://localhost:8000/v1/models` and use a chat model from that list.
- **Direct Connection** is off by default: model listing and chat run through the big-AGI server.
  `localhost` must then reach the Mac from that server. For Docker on macOS, use
  `http://host.docker.internal:8000` and ensure Rapid-MLX listens on an address reachable from the container.
  A remote big-AGI server needs a reachable Mac address instead of `localhost`.
- With **Advanced** > **Direct Connection** on, requests run from the browser and use the UI endpoint.
  `localhost` refers to the browser's machine. Rapid-MLX must allow the big-AGI origin through CORS;
  browser mixed-content and local-network restrictions may also apply. If blocked, run big-AGI locally
  with Direct Connection off, or configure the server and browser to permit the connection.
