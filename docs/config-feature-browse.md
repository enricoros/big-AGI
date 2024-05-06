# Browse Functionality in big-AGI 🌐

Allows users to load web pages across various components of `big-AGI`. This feature is supported by Puppeteer-based
browsing services, which are the most common way to render web pages in a headless environment.

Once configured, the Browsing service provides the following functionality:

- ✅ **Paste a URL**: Simply paste/drag a URL into the chat, and `big-AGI` will load and attach the page (very effective)
- ✅ **Use /browse**: Type `/browse [URL]` in the chat to command `big-AGI` to load the specified web page
- ✅ **ReAct**: ReAct will automatically use the `loadURL()` function whenever a URL is encountered

It does not yet support the following functionality:

- ✖️ **Auto-browsing by LLMs**: if an LLM encounters a URL, it will NOT load the page and will likely respond
  that it cannot browse the web - No technical limitation, just haven't gotten to implement this yet outside of `/react` yet

First of all, you need to procure a Puppteer web browsing service endpoint. `big-AGI` supports services like:

| Service                                                                              | Working | Type        | Location       | Special Features                            |
|--------------------------------------------------------------------------------------|---------|-------------|----------------|---------------------------------------------|
| [BrightData Scraping Browser](https://brightdata.com/products/scraping-browser)      | Yes     | Proprietary | Cloud          | Advanced scraping tools, global IP pool     |
| [Cloudflare Browser Rendering](https://developers.cloudflare.com/browser-rendering/) | ?       | Proprietary | Cloud          | Integrated CDN, optimized browser rendering |
| ⬇️ [Browserless 2.0](#-browserless-20)                                               | Okay    | OpenSource  | Local (Docker) | Parallelism, debug viewer, advanced APIs    |
| ⬇️ [Your Chrome Browser (ALPHA)](#-your-own-chrome-browser)                          | Alpha   | Proprietary | Local (Chrome) | Personal, experimental use (ALPHA!)         |
| other Puppeteer-based WSS Services                                                   | ?       | Varied      | Cloud/Local    | Service-specific features                   |

## Configuration

1. **Procure an Endpoint**
   - Ensure that your browsing service is running (remote or local) and has a WebSocket endpoint available
   - Write down the address: `wss://${auth}@{some host}:{port}`, or ws:// for local services on your machine

2. **Configure `big-AGI`**
   - navigate to **Preferences** > **Tools** > **Browse**
   - Enter the 'wss://...' connection string provided by your browsing service

3. **Enable Features**: Choose which browse-related features you want to enable:
   - **Attach URLs**: Automatically load and attach a page when pasting a URL into the composer
   - **/browse Command**: Use the `/browse` command in the chat to load a web page
   - **ReAct**: Enable the `loadURL()` function in ReAct for advanced interactions

### 🌐 Browserless 2.0

[Browserless 2.0](https://github.com/browserless/browserless) is a Docker-based service that provides a headless
browsing experience compatible with `big-AGI`. An open-source solution that simplifies web automation tasks,
in a scalable manner.

Launch Browserless with:

```bash
docker run -p 9222:3000 browserless/chrome:latest
```

Now you can use the following connection string in `big-AGI`: `ws://127.0.0.1:9222`.
You can also browse to [http://127.0.0.1:9222](http://127.0.0.1:9222) to see the Browserless debug viewer
and configure some options.

The chat agent won't be able to access the web sites if the browserless container does not have direct Internet access. You can resolve the issue by defining internet proxy for the running container. You can then use the evironment file in the a `docker-compose.yaml

```
 browserless:
    image: browserless/chrome:latest
    env_file:
      - .env
    ports:
      - "9222:3000"  # Map host's port 9222 to container's port 3000
    environment:
      - MAX_CONCURRENT_SESSIONS=10
```

You can then add the proxy lines to your `.env` file.

```
https_proxy=http://PROXY-IP:PROXY-PORT
http_proxy=http://PROXY-IP:PROXY-PORT
```

This is how you can define it in a one liner docker
`docker run --env https_proxy=http://PROXY-IP:PROXY-PORT --env http_proxy=http://PROXY-IP:PROXY-PORT -p 9222:3000 browserless/chrome:latest `

Note: if you are using `docker-compose`, please see the
[docker/docker-compose-browserless.yaml](docker/docker-compose-browserless.yaml) file for an example
on how to run `big-AGI` and Browserless simultaneously in a single application.


### 🌐 Your own Chrome browser

***EXPERIMENTAL - UNTESTED*** - You can use your own Chrome browser as a browsing service, by configuring it to expose
a WebSocket endpoint.

- close all the Chrome instances (on Windows, check the Task Manager if still running)
- start Chrome with the following command line options (on Windows, you can edit the shortcut properties):
  - `--remote-debugging-port=9222`
- go to http://localhost:9222/json/version and copy the `webSocketDebuggerUrl` value
  - it should be something like: `ws://localhost:9222/...`
- paste the value into the Endpoint configuration (see point 2 in the configuration)

### Server-Side Configuration

You can set the Puppeteer WebSocket endpoint (`PUPPETEER_WSS_ENDPOINT`) in the deployment before running it.
This is useful for self-hosted instances or when you want to pre-configure the endpoint for all users, and will
allow your to skip points 2 and 3 above.

Always deploy your own user authentication, authorization and security solution. For this feature, the tRPC
route that provides browsing service, shall be secured with a user authentication and authorization solution,
to prevent unauthorized access to the browsing service.

## Support

If you encounter any issues or have questions about configuring the browse functionality, join our community on Discord for support and discussions.

[![Official Discord](https://discordapp.com/api/guilds/1098796266906980422/widget.png?style=banner2)](https://discord.gg/MkH4qj2Jp9)

---

Enjoy the enhanced browsing experience within `big-AGI` and explore the web without ever leaving your chat!

Last updated on Feb 27, 2024 ([edit on GitHub](https://github.com/enricoros/big-AGI/edit/main/docs/config-feature-browse.md))
