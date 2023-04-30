# Deploy `big-AGI` with Docker 🐳

Deploy the big-AGI application using Docker containers for a consistent, efficient, and automated deployment process. Enjoy faster development cycles, easier collaboration, and seamless environment management. 🚀

Docker is a platform for developing, packaging, and deploying applications as lightweight containers, ensuring consistent behavior across environments.

## `big-AGI` Docker Components

The big-AGI repository includes a Dockerfile and a GitHub Actions workflow for building and publishing a Docker image of the application.

### Dockerfile

The [`Dockerfile`](../Dockerfile) sets up a Node.js environment, installs dependencies, and creates a production-ready version of the application.

### GitHub Actions Workflow

The [`.github/workflows/docker-image.yml`](../.github/workflows/docker-image.yml) file automates building and publishing the Docker image when changes are pushed to the `main` branch.

## Deploy Steps

1. Clone the big-AGI repository
2. Navigate to the project directory
3. Build the Docker image using the provided Dockerfile
4. Run the Docker container with the built image

Embrace the benefits of Docker for a reliable and efficient big-AGI deployment. 🎉