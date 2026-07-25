# NVIDIA NIM Configuration

[NVIDIA NIM](https://build.nvidia.com) is NVIDIA's hosted API catalog: free, rate-limited access
to open frontier models (Nemotron 3, GPT-OSS, DeepSeek V4, GLM, Llama, and more) served on
NVIDIA's own infrastructure at `integrate.api.nvidia.com`. This document details the process of
integrating NVIDIA NIM with big-AGI.

### 1. NVIDIA Account Setup and API Key Generation

1. Sign in at [build.nvidia.com](https://build.nvidia.com) (a free NVIDIA account; phone
   verification may be required).
2. Generate an API key at [build.nvidia.com/settings/api-keys](https://build.nvidia.com/settings/api-keys).
   - **Important**: when creating the key, make sure it includes the **Public API Endpoints**
     scope - keys without it look valid but fail all inference with
     `404 "Function not found for account"`.
   - The key has the format `nvapi-...` and a user-chosen expiration date. Copy and store it
     securely.

### 2. Integrating NVIDIA NIM with big-AGI

1. Launch big-AGI, and navigate to the AI **Models** settings.
2. Add a Vendor, and select **NVIDIA NIM**.
3. Input the API key into the **NVIDIA API Key** field, and load the Models.
4. A curated list of live-verified models will appear, with measured context windows and
   reasoning controls where the model supports them.

In addition to using the UI, configuration can also be done using
[environment variables](environment-variables.md) (`NVIDIANIM_API_KEY`, and optionally
`NVIDIANIM_API_HOST`).

### Notes on the free service

- **Rate limits**: NVIDIA does not publish a rate; in practice the free tier allows roughly
  40 requests per minute per account, varying with load. The limit applies to requests, not
  tokens - long prompts and long answers are not penalized. big-AGI automatically paces
  requests on the default host to avoid instant rate-limit errors.
- **Catalog churn**: NVIDIA retires hosted models regularly, and its raw model list includes
  many retired entries. big-AGI curates the list to live-verified models, so retired models do
  not appear or fail mid-chat. Genuinely new models appear with a `[?]` prefix until verified.
- **Terms**: the hosted endpoint is free of charge, and NVIDIA's trial terms disallow
  production use and allow NVIDIA to use prompts and outputs to improve its services. Review
  the [API trial terms](https://build.nvidia.com/terms) before use.

### Self-hosted NIM and DGX Spark

The same big-AGI service can point at a self-hosted NVIDIA endpoint (a NIM container, vLLM, or
similar OpenAI-compatible server), which uses the identical protocol and model naming:

1. In the NVIDIA NIM service settings, open the advanced options and set the **API Host** to
   your endpoint, e.g. `http://localhost:8000` or `http://spark-xxxx.local:8000` for a DGX
   Spark on your network.
2. The API key is optional for most self-hosted servers.
3. On custom hosts you can also enable browser-direct requests (the hosted NVIDIA endpoint
   does not allow them).
