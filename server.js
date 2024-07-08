const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev: false, dir: __dirname });
const handle = app.getRequestHandler();

function startServer(port) {
  return new Promise((resolve, reject) => {
    app.prepare()
      .then(() => {
        createServer((req, res) => {
          const parsedUrl = parse(req.url, true);
          handle(req, res, parsedUrl);
        }).listen(port, (err) => {
          if (err) reject(err);
          console.log(`> Ready on http://localhost:${port}`);
          resolve();
        });
      })
      .catch(err => reject(err));
  });
}

module.exports = startServer;