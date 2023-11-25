# Browse Functionality in big-AGI 🌐

Allows users to load web pages across various components of `big-AGI`. This feature is supported by Puppeteer-based
browsing services, which are the most common way to render web pages in a headless environment.

First of all, you need to procure a Puppteer web browsing service endpoint. `big-AGI` supports services like:

- [BrightData](https://brightdata.com/products/scraping-browser) Scraping Browser
- [Cloudflare](https://developers.cloudflare.com/browser-rendering/) Browser Rendering, or
- any other Puppeteer-based service that provides a WebSocket endpoint (WSS)
- **including [your own browser](#your-own-chrome-browser)**

## Configuration

1. **Procure an Endpoint**: Ensure that your browsing service is running and has a WebSocket endpoint available:
    - this mustbe in the form: `wss://${auth}@{some host}:{port}`

2. **Configure `big-AGI`**:  navigate to **Preferences** > **Tools** > **Browse** and enter the 'wss://...' connection
   string provided by your browsing service

3. **Enable Features**: Choose which browse-related features you want to enable:
    - **Attach URLs**: Automatically load and attach a page when pasting a URL into the composer
    - **/browse Command**: Use the `/browse` command in the chat to load a web page
    - **ReAct**: Enable the `loadURL()` function in ReAct for advanced interactions

### Server-Side Configuration

You can set the Puppeteer WebSocket endpoint (`PUPPETEER_WSS_ENDPOINT`) in the deployment before running it.
This is useful for self-hosted instances or when you want to pre-configure the endpoint for all users, and will
allow your to skip points 2 and 3 above.

Always deploy your own user authentication, authorization and security solution. For this feature, the tRPC
route that provides browsing service, shall be secured with a user authentication and authorization solution,
to prevent unauthorized access to the browsing service.

### Your own Chrome browser

***EXPERIMENTAL - UNTESTED*** - You can use your own Chrome browser as a browsing service, by configuring it to expose
a WebSocket endpoint.

- close all the Chrome instances (on Windows, check the Task Manager if still running)
- start Chrome with the following command line options (on Windows, you can edit the shortcut properties):
    - `--remote-debugging-port=9222`
- go to http://localhost:9222/json/version and copy the `webSocketDebuggerUrl` value
    - it should be something like: `ws://localhost:9222/...`
- paste the value into the Endpoint configuration (see point 2 above)

## Usage

Once configured, you can start using the browse functionality:

- **Paste a URL**: Simply paste a URL into the chat, and `big-AGI` will load the page if the Attach URLs feature is enabled
- **Use /browse**: Type `/browse [URL]` in the chat to command `big-AGI` to load the specified web page
- **ReAct**: ReAct will automatically use the `loadURL()` function whenever a URL is encountered

## Support

If you encounter any issues or have questions about configuring the browse functionality, join our community on Discord for support and discussions.

[![Official Discord](https://discordapp.com/api/guilds/1098796266906980422/widget.png?style=banner2)](https://discord.gg/MkH4qj2Jp9)

---

Enjoy the enhanced browsing experience within `big-AGI` and explore the web without ever leaving your chat!