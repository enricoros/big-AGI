# Customizing and Creating Derivative Applications

This document outlines how to develop applications derived from big-AGI.

## Manual Customization

Application customization _requires manual code modifications or the use of environment variables_. Currently, **there is no admin panel to "managed" deployment customization** for enterprise use cases.

| Required Code Alteration                                                              | Not Required                                                                                                              |
|---------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------|
| - Persona changes<br>- UI theme customization<br>- Feature additions or modifications | - Setting API keys in [environment variables](environment-variables.md)<br>- Toggling features with environment variables |
| Apply these to the source code before building the application                        | Set these post-build on local machines or cloud deployment, before application launch                                     |

<br/>

## Code Alterations

Start by creating a fork of the [big-AGI repository](https://github.com/enricoros/big-AGI) on GitHub for a personal development space.
Understand the Architecture: big-AGI uses Next.js, React for the front end, and Node.js (Next.js edge functions) for the back end.

### Add Authentication

This necessitates a code change (file renaming) before build initiation, detailed in [deploy-authentication.md](deploy-authentication.md).

### Increase Vercel Functions Timeout

For long-running operations, Vercel allows paid deployments to increase the timeout on Functions.
Note that this applies to old-style Vercel Functions (based on Node.js) and not the new Edge Functions.

At time of writing, big-AGI has only 2 operations that run on Node.js Functions:
browsing (fetching web pages) and sharing. They both can exceed 10 seconds, especially
when fetching large pages or waiting for websites to be completed.

We provide `vercel_PRODUCTION.json` to raise the duration to 25 seconds (from a default of 10), to use it,
make sure to rename it to `vercel.json` before build.

From the Vercel Project > Settings > General > Build & Development Settings,
you can for instance set the build command to:

```bash
mv vercel_PRODUCTION.json vercel.json; next build
```

### Change the Personas

Edit the `src/data.ts` file to customize personas. This file houses the default personas. You can add, remove, or modify these to meet your project's needs.

- [ ] Modify `src/data.ts` to alter default personas

### Change the UI

Adapt the UI to match your project's aesthetic, incorporate new features, or exclude unnecessary ones.

- [ ] Adjust `src/common/app.theme.ts` for theme changes: colors, spacing, button appearance, animations, etc
- [ ] Modify `src/common/app.config.tsx` to alter the application's name
- [ ] Update `src/common/app.nav.tsx` to revise the navigation bar

## Testing & Deployment

Test your application thoroughly using local development (refer to README.md for local build instructions). Deploy using your preferred hosting service. big-AGI supports deployment on platforms like Vercel, Docker, or any Node.js-compatible service, especially those supporting NextJS's "Edge Runtime."

- [deploy-cloudflare.md](deploy-cloudflare.md): for Cloudflare Workers deployment
- [deploy-docker.md](deploy-docker.md): for Docker deployment instructions and examples
- [deploy-k8s.md](deploy-k8s.md): for Kubernetes deployment instructions and examples

## Debugging

We introduced the `/info/debug` page that provides a detailed overview of the application's environment, including the API keys, environment variables, and other configuration settings.

<br/>

## Community Projects - Share Your Project

After deployment, share your project with the community. We will link to your project to help others discover and learn from your work.

| Project                                                                                                                                                        | Features                                                                                                  | GitHub                                                                              |
|----------------------------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------|
| 🚀 CoolAGI: Where AI meets Imagination<br/>![CoolAGI Logo](https://github.com/nextgen-user/freegpt4plus/assets/150797204/9b0e1232-4791-4d61-b949-16f9eb284c22) | Code Interpreter, Vision, Mind maps, Web Searches, Advanced Data Analytics, Large Data Handling and more! | [nextgen-user/CoolAGI](https://github.com/nextgen-user/CoolAGI)                     |
| HL-GPT                                                                                                                                                         | Fully remodeled UI                                                                                        | [harlanlewis/nextjs-chatgpt-app](https://github.com/harlanlewis/nextjs-chatgpt-app) |

For public projects, update your README.md with your modifications and submit a pull request to add your project to our list, aiding in its discovery.

<br/>

## Best Practices

- **Stay Updated**: Frequently merge updates from the main big-AGI repository to incorporate bug fixes and new features.
- **Keep It Open Source**: Consider maintaining your derivative as open source to foster community contributions.
- **Engage with the Community**: Leverage platforms like GitHub, Discord, or Reddit for feedback, collaboration, and project promotion.

Developing a derivative application is an opportunity to explore new possibilities with AI and share your innovations with the global community. We look forward to seeing your contributions.