# Authentication

`big-AGI` does not come with built-in authentication. To secure your deployment, you can implement authentication
in one of the following ways:

1. Build `big-AGI` with support for ⬇️ [HTTP Authentication](#http-authentication)
2. Utilize user authentication features provided by your ⬇️ [cloud deployment platform](#cloud-deployments-authentication)
3. Develop a custom authentication solution

<br/>

### HTTP Authentication

[HTTP Basic Authentication](https://developer.mozilla.org/en-US/docs/Web/HTTP/Authentication) is a simple method
to secure your application.

To enable it in `big-AGI`, you **must manually build the application**:

- Build `big-AGI` with HTTP authentication enabled:
  - Clone the repository
  - Rename `middleware_BASIC_AUTH.ts` to `middleware.ts`
  - Build: usual simple build procedure (e.g. [Deploy manually](installation.md#Local-Production-build) or [Deploying with Docker](deploy-docker.md))

- Configure the following [environment variables](environment-variables.md) before launching `big-AGI`:
```dotenv
HTTP_BASIC_AUTH_USERNAME=<your username>
HTTP_BASIC_AUTH_PASSWORD=<your password>
```

- Start the application 🔒

<br/>

### Cloud Deployments Authentication

> This approach allows you to enable authentication without rebuilding the application by using the features
> provided by your cloud platform to manage user accounts and access.

Many cloud deployment platforms offer built-in authentication mechanisms. Refer to the platform's documentation
for setup instructions:

1. [CloudFlare Access / Zero Trust](https://www.cloudflare.com/zero-trust/products/access/)
2. [Vercel Authentication](https://vercel.com/docs/security/deployment-protection/methods-to-protect-deployments/vercel-authentication)
3. [Vercel Password Protection](https://vercel.com/docs/security/deployment-protection/methods-to-protect-deployments/password-protection)
4. Let us know when you test more solutions (Heroku, AWS IAM, Google IAP, etc.)
