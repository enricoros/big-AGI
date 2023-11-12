# Local LLM integration with `localai`

Integrate local Large Language Models (LLMs) with [LocalAI](https://localai.io).

_Last updated Nov 7, 2023_

## Instructions

### LocalAI installation and configuration

Follow the guide at: https://localai.io/basics/getting_started/

For instance with [Use luna-ai-llama2 with docker compose](https://localai.io/basics/getting_started/#example-use-luna-ai-llama2-model-with-docker-compose):

- clone LocalAI
- get the model
- copy the prompt template
- start docker
    - -> the server will be listening on `localhost:8080`
    - verify it works by going to [http://localhost:8080/v1/models](http://localhost:8080/v1/models) on
      your browser and seeing listed the model you downloaded

### Integrating LocalAI with big-AGI

- Go to Models > Add a model source of type: **LocalAI**
- Enter the address: `http://localhost:8080` (default)
    - If running remotely, replace localhost with the IP of the machine. Make sure to use the **IP:Port** format
- Load the models
- Select model & Chat

> NOTE: LocalAI does not list details about the mdoels. Every model is assumed to be
> capable of chatting, and with a context window of 4096 tokens.
> Please update the [src/modules/llms/transports/server/openai/models.data.ts](../src/modules/llms/transports/server/openai/models.data.ts)
> file with the mapping information between LocalAI model IDs and names/descriptions/tokens, etc.
