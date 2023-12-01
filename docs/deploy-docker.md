# Deploying `big-AGI` with Docker

Utilize Docker containers to deploy the big-AGI application for an efficient and automated deployment process.
Docker ensures faster development cycles, easier collaboration, and seamless environment management.

## Build and run your container 🔧

1. **Clone big-AGI**
   ```bash
   git clone https://github.com/enricoros/big-agi.git
   cd big-agi
   ``` 
2. **Build the Docker Image**: Build a local docker image from the provided Dockerfile:
   ```bash
   docker build -t big-agi .
   ```
3. **Run the Docker Container**: start a Docker container from the newly built image,
   and expose its http port 3000 to your `localhost:3000` using:
   ```bash
   docker run -d -p 3000:3000 big-agi
   ```
4. Browse to [http://localhost:3000](http://localhost:3000)

## Documentation

The big-AGI repository includes a Dockerfile and a GitHub Actions workflow for building and publishing a
Docker image of the application.

### Dockerfile

The [`Dockerfile`](../Dockerfile) describes how to create a Docker image. It establishes a Node.js environment,
installs dependencies, and creates a production-ready version of the application as a local container.

### Official container images

The [`.github/workflows/docker-image.yml`](../.github/workflows/docker-image.yml) file automates the
building and publishing of the Docker images to the GitHub Container Registry (ghcr) when changes are
pushed to the `main` branch.

Official pre-built containers: [ghcr.io/enricoros/big-agi](https://github.com/enricoros/big-agi/pkgs/container/big-agi)

Run official pre-built containers:
```bash
docker run -d -p 3000:3000 ghcr.io/enricoros/big-agi
```

### Run official containers

In addition, the repository also includes a `docker-compose.yaml` file, configured to run the pre-built
'ghcr image'. This file is used to define the `big-agi` service, the ports to expose, and the command to run.

If you have Docker Compose installed, you can run the Docker container with `docker-compose up`
to pull the Docker image (if it hasn't been pulled already) and start a Docker container. If you want to
update the image to the latest version, you can run `docker-compose pull` before starting the service.

```bash
docker-compose up -d
```

Leverage Docker's capabilities for a reliable and efficient big-AGI deployment.