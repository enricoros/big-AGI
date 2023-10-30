# `BIG-AGI` 🤖💬

Fork with basic auth added.

## Basic Auth
Add the following environment variables

BASIC_AUTH_USERNAME=<your username>
BASIC_AUTH_PASSWORD=<your password>

Update the middleware.ts to use the basic auth middleware on all routes in src/pages

# Deploy
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fenricoros%2Fbig-agi&env=OPENAI_API_KEY,OPENAI_API_HOST&envDescription=OpenAI%20KEY%20for%20your%20deployment.%20Set%20HOST%20only%20if%20non-default.)