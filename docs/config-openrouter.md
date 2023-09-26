# OpenRouter

[OpenRouter](https://openrouter.ai) is an independent, premium service
granting access to <Link href='https://openrouter.ai/docs#models' target='_blank'>exclusive models</Link> such
as GPT-4 32k, Claude, and more, typically unavailable to the public. This page explains how to link OpenRouter to big-AGI.

### 1. Sign up for OpenRouter and generate an API key

1. Sign up for OpenRouter at [openrouter.ai](https://openrouter.ai) > Sign In > Continue with Google
2. Add funds to the account (minimum $5) - [openrouter.ai/account](https://openrouter.ai/account) > Add Credits > Pay with Stripe
3. Generate an API key - [openrouter.ai/keys](https://openrouter.ai/keys) > API Key > Generate API Key
   - **copy and save your API key** - the key will not be shown again, and will be in the format `sk-or-v1-...`
   - keep the key secret, as it can be used to spend your credits

### 2. Add the API key to big-AGI

1. Launch big-AGI, and go to the AI **Models** settings
2. Add a Vendor, and select **OpenRouter**
   ![feature-openrouter-add.png](pixels/feature-openrouter-add.png)
3. Enter the API key in the **OpenRouter API Key** field, and load the Models
   ![feature-openrouter-configure.png](pixels/feature-openrouter-configure.png)
4. OpenAI GPT4-32k and other models will now be available and selectable in the app

### Pricing

OpenRouter provides the service and pricing, and it is not affiliated with big-AGI.
Please see [this page](https://openrouter.ai/docs#models) for more information details.

Note that large models such as GPT-4 32k are very expensive to run, and may consume
credits very quickly - one prompt may cost $1 or more, at the time of writing.
