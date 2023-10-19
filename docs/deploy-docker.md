# Deploying `big-AGI` with Docker

Utilize Docker containers to deploy the big-AGI application for an efficient and automated deployment process.
Docker ensures faster development cycles, easier collaboration, and seamless environment management.

## 🔧 Local Build & Deployment

1. **Clone big-AGI**
2. **Build the Docker Image**: Build a local docker image from the provided Dockerfile. The command is typically `docker build -t big-agi .`
3. **Run the Docker Container**: Start a Docker container using the built image with the command `docker run -d -p 3000:3000 big-agi`

> Note: If the Docker container is built without setting environment variables,
> the frontend UI will be unaware of them, despite the backend being able to use them at runtime.
> Therefore, ensure all necessary environment variables are set during the build process.

## Documentation

The big-AGI repository includes a Dockerfile and a GitHub Actions workflow for building and publishing a
Docker image of the application.

### Dockerfile: Containers

> A local build is recommended, as the 'ghcr' container is built without environment variables.

The [`Dockerfile`](../Dockerfile) is used to create a Docker image. It establishes a Node.js environment,
installs dependencies, and creates a production-ready version of the application as a local container.

### GitHub Actions workflow

The [`.github/workflows/docker-image.yml`](../.github/workflows/docker-image.yml) file automates the
building and publishing of the Docker images to the GitHub Container Registry (ghcr) when changes are
pushed to the `main` branch.

### Docker Compose

In addition, the repository also includes a `docker-compose.yaml` file, configured to run the pre-built
'ghcr image'. This file is used to define the `big-agi` service, the ports to expose, and the command to run.

If you have Docker Compose installed, you can run the Docker container with `docker-compose up`
to pull the Docker image (if it hasn't been pulled already) and start a Docker container. If you want to
update the image to the latest version, you can run `docker-compose pull` before starting the service.

```bash
docker-compose up -d
```

Leverage Docker's capabilities for a reliable and efficient big-AGI deployment.