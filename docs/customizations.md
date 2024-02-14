# Customizing and Creating Derivative Applications

This document outlines how to develop applications derived from big-AGI, allowing for extension of its functionalities, adaptation to specific needs, or targeting new user groups.

## Manual Customization

Application customization requires manual code modifications or the use of environment variables. Currently, there is no graphical interface for customization. Changes include editing source code for persona modifications, feature additions, or API integrations.

| Required Code Alteration                                                              | Not Required                                                                                                              |
|---------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------|
| - Persona changes<br>- UI theme customization<br>- Feature additions or modifications | - Setting API keys in [environment variables](environment-variables.md)<br>- Toggling features with environment variables |

How:

- **Code alterations**: Apply these to the source code before building the application.
- **Environment variables**: Set these post-build on local machines or cloud deployment, before application launch.

<br/>

## Code changes

Start by creating a fork of the [big-AGI repository](https://github.com/enricoros/big-AGI) on GitHub for a personal development space.
Understand the Architecture: big-AGI uses Next.js, React for the front end, and Node.js (Next.js edge functions) for the back end.

### Add authentication

This necessitates a code change (file renaming) before build initiation, detailed in [deploy-authentication.md](deploy-authentication.md).

### Change the Personas

Edit the `src/data.ts` file to customize personas. This file houses the default personas. You can add, remove, or modify these to meet your project's needs.

- [ ] Modify `src/data.ts` to alter default personas.

### Change the UI

Adapt the UI to match your project's aesthetic, incorporate new features, or exclude unnecessary ones.

- [ ] Adjust `src/common/app.theme.ts` for theme changes: colors, spacing, button appearance, animations, etc.
- [ ] Modify `src/common/app.config.tsx` to alter the application's name.
- [ ] Update `src/common/app.nav.tsx` to revise the navigation bar.

## Other: Add or Modify Features

- **Integrate New APIs**: Add new endpoints in the `pages/api` directory for additional API integrations.
- **Enhance Functionality**: Edit React components and backend logic to modify existing features or introduce new ones.

## Testing & Deployment

Test your application thoroughly using local development (refer to README.md for local build instructions). Deploy using your preferred hosting service. big-AGI supports deployment on platforms like Vercel, Docker, or any Node.js-compatible service, especially those supporting NextJS's "Edge Runtime."

- Refer to [deploy-cloudflare.md](deploy-cloudflare.md) for Cloudflare Workers deployment.
- See [deploy-docker.md](deploy-docker.md) for Docker deployment instructions and examples.

<br/> 

## Community Projects - Share Your Project

After deployment, share your project with the community. We will link to your project to help others discover and learn from your work.

| Project                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Features                                                                                                  | GitHub                                                                              |
|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------|
| 🚀 CoolAGI: Where AI meets Imagination<br/>![CoolAGI Logo](https://private-user-images.githubusercontent.com/150797204/286567670-9b0e1232-4791-4d61-b949-16f9eb284c22.png?jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJnaXRodWIuY29tIiwiYXVkIjoicmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSIsImtleSI6ImtleTUiLCJleHAiOjE3MDc5MTU3ODAsIm5iZiI6MTcwNzkxNTQ4MCwicGF0aCI6Ii8xNTA3OTcyMDQvMjg2NTY3NjcwLTliMGUxMjMyLTQ3OTEtNGQ2MS1iOTQ5LTE2ZjllYjI4NGMyMi5wbmc_WC1BbXotQWxnb3JpdGhtPUFXUzQtSE1BQy1TSEEyNTYmWC1BbXotQ3JlZGVudGlhbD1BS0lBVkNPRFlMU0E1M1BRSzRaQSUyRjIwMjQwMjE0JTJGdXMtZWFzdC0xJTJGczMlMkZhd3M0X3JlcXVlc3QmWC1BbXotRGF0ZT0yMDI0MDIxNFQxMjU4MDBaJlgtQW16LUV4cGlyZXM9MzAwJlgtQW16LVNpZ25hdHVyZT1jYWU0ODM5Y2EzMjA5ZjMyODg0NGEwZTNiOGM2ODAwMjAwZTk5ODkzZDY3NDBjYTBiZmRmMDdhNjE5MGZiZmEzJlgtQW16LVNpZ25lZEhlYWRlcnM9aG9zdCZhY3Rvcl9pZD0wJmtleV9pZD0wJnJlcG9faWQ9MCJ9.t5F2OL3dQBV1LphRWVqiYCiSdN6j5wKhBy2JGLjh9E8) | Code Interpreter, Vision, Mind maps, Web Searches, Advanced Data Analytics, Large Data Handling and more! | [nextgen-user/CoolAGI](https://github.com/nextgen-user/CoolAGI)                     | 
| HL-GPT                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Fully remodeled UI                                                                                        | [harlanlewis/nextjs-chatgpt-app](https://github.com/harlanlewis/nextjs-chatgpt-app) |  

For public projects, update your README.md with your modifications and submit a pull request to add your project to our list, aiding in its discovery.

<br/> 

## Best Practices

- **Stay Updated**: Frequently merge updates from the main big-AGI repository to incorporate bug fixes and new features.
- **Keep It Open Source**: Consider maintaining your derivative as open source to foster community contributions.
- **Engage with the Community**: Leverage platforms like GitHub, Discord, or Reddit for feedback, collaboration, and project promotion.

Developing a derivative application is an opportunity to explore new possibilities with AI and share your innovations with the global community. We look forward to seeing your contributions.