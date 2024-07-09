# Advanced: Deploying big-AGI behind a Reverse Proxy

Note: if you don't have a reverse proxy set up, you can skip this guide.

If you're deploying big-AGI behind a reverse proxy, you may want to configure your proxy to support streaming output.
This guide provides instructions on how to configure your reverse proxy to support streaming output from big-AGI.

This is for advanced deployments, and you should have a basic understanding of how reverse proxies work.

## Nginx Configuration

If you're using Nginx as your reverse proxy, add the following configuration to your server block:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        # ...your specific proxy_pass configuration, example below...
        proxy_pass http://localhost:3000;  # Assuming big-AGI is running on port 3000
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        # ...

        # Important: Disable buffering for the streaming responses (SSE)
        chunked_transfer_encoding on;   # Turn on chunked transfer encoding
        proxy_buffering off;            # Turn off proxy buffering
        proxy_cache off;                # Turn off caching
        tcp_nodelay on;                 # Turn on TCP NODELAY option, disable delay ACK algorithm
        tcp_nopush on;                  # Turn on TCP NOPUSH option, disable Nagle algorithm

        # Important: Longer timeouts (5 min)
        keepalive_timeout 300;
        proxy_connect_timeout 300;
        proxy_read_timeout 300;
        proxy_send_timeout 300;
    }
}
```

This configuration disables caching and buffering, enables chunked transfer encoding, and adjusts TCP settings to optimize for streaming content.

## Troubleshooting

If you're experiencing issues with streaming not working, especially when deploying behind a reverse proxy,
ensure that your proxy is configured to support streaming output as described above.

## Additional Resources

- For Docker deployments, see our [Docker Deployment Guide](deploy-docker.md)
- For Kubernetes deployments, see our [Kubernetes Deployment Guide](deploy-k8s.md)
- For general installation instructions, see our [Installation Guide](installation.md)

If you continue to experience issues, please reach out to our [community support channels](README.md#support-and-community).
