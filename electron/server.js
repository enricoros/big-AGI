const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const path = require('path');

// const dev = process.env.NODE_ENV !== 'production';
const dir = path.join(__dirname, '..'); // This points to the root of your project
const app = next({ dev: false, dir });
const handle = app.getRequestHandler();

function startServer(port) {
  return new Promise((resolve, reject) => {
    app.prepare()
      .then(() => {
        const server = createServer((req, res) => {
          // Basic request logging
          console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);

          // Simple rate limiting
          if (rateLimiter(req)) {
            res.statusCode = 429;
            res.end('Too Many Requests');
            return;
          }

          // Handle the request
          const parsedUrl = parse(req.url, true);
          handle(req, res, parsedUrl);
        });

        server.listen(port, (err) => {
          if (err) reject(err);
          console.log(`> Ready on http://localhost:${port}`);
          resolve(server);
        });

        // Graceful shutdown
        process.on('SIGTERM', () => {
          console.log('SIGTERM signal received: closing HTTP server');
          server.close(() => {
            console.log('HTTP server closed');
          });
        });
      })
      .catch(err => reject(err));
  });
}

// Simple in-memory rate limiter
const MAX_REQUESTS_PER_MINUTE = 100;
const requestCounts = new Map();

function rateLimiter(req) {
  const ip = req.socket.remoteAddress;
  const now = Date.now();
  const windowStart = now - 60000; // 1 minute ago

  const requestTimestamps = requestCounts.get(ip) || [];
  const requestsInWindow = requestTimestamps.filter(timestamp => timestamp > windowStart);

  if (requestsInWindow.length >= MAX_REQUESTS_PER_MINUTE) {
    return true; // Rate limit exceeded
  }

  requestTimestamps.push(now);
  requestCounts.set(ip, requestTimestamps);

  return false; // Rate limit not exceeded
}

module.exports = startServer;