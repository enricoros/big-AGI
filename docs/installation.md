# Installation Guide

Welcome to the FylloAI Installation Guide - Whether you're a developer
eager to explore, a system integrator, or an enterprise looking for a
white-label solution, this comprehensive guide ensures a smooth setup
process for your own instance of FylloAI and related products.

**Try FylloAI** - You don't need to install anything if you want to play with FylloAI
and have your API keys to various model services. You can access our free instance on [fyllo.m7ai.top](https://fyllo.m7ai.top).
The free instance runs the latest `main-stable` branch from this repository.

## 🧩 Build-your-own

If you want to change the code, have a deeper configuration,
add your own models, or run your own instance, follow the steps below.

### Local Development

**Prerequisites:**

- Node.js and npm installed on your machine.

**Steps:**

1. Clone the FylloAI repository (Note: The actual repo URL might remain big-AGI for a while):
   ```bash
   git clone https://github.com/enricoros/big-AGI.git
   cd big-AGI
   ```
   (Assuming project directory name might not change immediately even if app name does)
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
   Your FylloAI instance is now running at `http://localhost:3000`.

### Local Production build

The production build is optimized for performance and follows
the same steps 1 and 2 as for [local development](#local-development).

3. Build the production version:
   ```bash
   # .. repeat the steps above up to `npm install`, then:
   npm run build
   ```
4. Start the production server (`npx` may be optional):
   ```bash
   npx next start --port 3000
   ```
   Your FylloAI production instance is on `http://localhost:3000`.

### Advanced Customization

Want to pre-enable models, customize the interface, or deploy with username/password or alter code to your needs?
Check out the [Customizations Guide](README.md) for detailed instructions.

## ☁️ Cloud Deployment Options

To deploy FylloAI on a public server, you have several options. Choose the one that best fits your needs.

### Deploy on Vercel

Install FylloAI on Vercel with just a few clicks.

Create your GitHub fork, create a Vercel project over that fork, and deploy it. Or press the button below for convenience.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fenricoros%2Fbig-AGI&env=OPENAI_API_KEY&envDescription=Backend%20API%20keys%2C%20optional%20and%20may%20be%20overridden%20by%20the%20UI.&envLink=https%3A%2F%2Fgithub.com%2Fenricoros%2Fbig-AGI%2Fblob%2Fmain%2Fdocs%2Fenvironment-variables.md&project-name=FylloAI)

### Deploy on Cloudflare

Deploy on Cloudflare's global network by installing FylloAI on
Cloudflare Pages. Check out the [Cloudflare Installation Guide](deploy-cloudflare.md)
for step-by-step instructions.

### Docker Deployments

Containerize your FylloAI installation using Docker for portability and scalability.
Our [Docker Deployment Guide](deploy-docker.md) will walk you through the process,
or follow the steps below for a quick start.

1. (optional) Build the Docker image - if you do not want to use the [pre-built Docker images](https://github.com/enricoros/big-AGI/pkgs/container/big-agi) (Note: package name might change later):
   ```bash
   docker build -t fylloai .
   ```
2. Run the Docker container with either:
   ```bash
   # 2A. if you built the image yourself:
   docker run -d -p 3000:3000 fylloai

   # 2B. or use the pre-built image (Note: path might change once new images are published):
   docker run -d -p 3000:3000 ghcr.io/enricoros/big-agi
   ```
   (Keeping ghcr.io/enricoros/big-agi for now, as this is an external resource that won't change instantly)
   ```bash
   # 2C. or use docker-compose:
   docker-compose up
   ```
   Access your FylloAI instance at `http://localhost:3000`.

If you deploy FylloAI behind a reverse proxy, you may want to check out the [Reverse Proxy Configuration Guide](deploy-reverse-proxy.md).

### Kubernetes Deployment

Deploy FylloAI on a Kubernetes cluster for enhanced scalability and management. Follow these steps for a Kubernetes deployment:

1. Clone the FylloAI repository (Note: The actual repo URL might remain big-AGI for a while):
   ```bash
   git clone https://github.com/enricoros/big-AGI.git
   cd big-AGI
   ```
   (Assuming project directory name might not change immediately even if app name does)

2. Configure the environment variables:
   ```bash
   cp docs/k8s/env-secret.yaml env-secret.yaml
   vim env-secret.yaml  # Edit the file to set your environment variables
   ```

3. Apply the Kubernetes configurations:
   ```bash
   kubectl create namespace ns-fylloai
   kubectl apply -f docs/k8s/big-agi-deployment.yaml -f env-secret.yaml
   ```
   (Note: YAML filenames like `big-agi-deployment.yaml` might need renaming in a future step if they are part of this repo and not external)

4. Verify the deployment:
   ```bash
   kubectl -n ns-fylloai get svc,pod,deployment
   ```

5. Access the FylloAI application:
   ```bash
   kubectl -n ns-fylloai port-forward service/svc-big-agi 3000:3000
   ```
   (Note: service name `svc-big-agi` might need renaming if defined in the YAML)
   Your FylloAI instance is now accessible at `http://localhost:3000`.

For more detailed instructions on Kubernetes deployment, including updating and troubleshooting, refer to our [Kubernetes Deployment Guide](deploy-k8s.md).

### Midori AI Subsystem for Docker Deployment

Follow the instructions found on [Midori AI Subsystem Site](https://io.midori-ai.xyz/subsystem/manager/)
for your host OS. After completing the setup process, install the FylloAI docker backend to the Midori AI Subsystem.

## Enterprise-Grade Installation

For businesses seeking a fully-managed, scalable solution, consider our managed installations.
Enjoy all the features of FylloAI without the hassle of infrastructure management. [hello@fyllo.m7ai.top](mailto:hello@fyllo.m7ai.top) to learn more.

## Support

Join our vibrant community of developers, researchers, and AI enthusiasts. Share your projects, get help, and collaborate with others.

- [Discord Community](https://discord.gg/MkH4qj2Jp9)
- [Twitter](https://twitter.com/enricoros)

For any questions or inquiries, please don't hesitate to [reach out to our team](mailto:hello@fyllo.m7ai.top).
