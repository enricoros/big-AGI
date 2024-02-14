# Customizing and Creating Derivative Applications

Creating a derivative application from big-AGI allows you to extend its capabilities, tailor the experience to your needs, or even target a completely new audience. This guide provides an overview of how to start this exciting journey.

## Manual Customization

Customizing the application happens through manual code alterations or at best through environment variables.
At the moment there is no "Wizard" or administation panel to customize the application.
You will need to manually edit the source code to make changes, and this includes modifying the personas,
adding new features, or integrating additional APIs.

| Code Alteration Required                                              | Not Required                                                                                                                         |
|-----------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------|
| - Change personas<br>- Customize UI Theme<br>- Add or modify features | - Setting API keys in [environment variables](environment-variables.md)<br>- Toggle some dynamic features with environment variables |

When changes are needed/used:

- **Code alterations**: on the source, before building the application
  - **Authentication**: requires a code alteration (renaming a file) before starting the build, see [deploy-authentication.md](deploy-authentication.md)
- **Environment variables**: after building the application on your local computers or deploying to the cloud, and before running it

### Code Alterations

Begin by forking the [big-AGI repository](https://github.com/enricoros/big-AGI). This will create a copy under your GitHub account, providing a personal workspace for your project.

Understand the Architecture: big-AGI is built using Next.js, leveraging React for the frontend and Node.js for the backend. Familiarize yourself with the project structure and the technologies used. This understanding is crucial for making meaningful modifications.

### Customize the Personas

You can customize the personas by editing the `src/data.ts` file. This file contains the default personas used in the application. You can add new personas, remove existing ones, or modify the existing ones to fit your project's requirements.

- [ ] edit `src/data.ts` to change the default personas

## Customize the UI

The UI can be customized to fit your project's theme, add new features, or remove existing ones that are not needed.

- [ ] edit `src/common/app.theme.ts` to change the theme: colors, spacing, looks of buttons, animations, etc.
- [ ] edit `src/common/app.config.tsx` to change the name of the application
- [ ] edit `src/common/app.nav.tsx` to change the navigation bar

## Other: Add or Modify Features

- **Integrate New APIs**: You can integrate additional APIs by adding new endpoints in the `pages/api` directory.
- **Enhance Functionality**: Modify existing features or add new ones by editing the React components and the backend logic.

## Testing & Deployment

Ensure to thoroughly test your application, by means of local development (see the README.md for how to build locally, it's simple).
Deploy your application using your preferred hosting service. big-AGI can be deployed on Vercel, Docker, or any platform that supports Node.js
applications, and in particular platforms that support the "Edge Runtime" of NextJS.

- see [deploy-cloudflare.md](deploy-cloudflare.md) for an example of deploying to Cloudflare Workers
- see [deploy-docker.md](deploy-docker.md) for instructions and examples with Docker

## Share Your Project

Once your variant is live, don't forget to share it with the community, and we will link to your project, for instance:

| Project                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Features                                                                                                  | GitHub                                                                              |
|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------|
| 🚀 CoolAGI: Where AI meets Imagination<br/>![CoolAGI Logo](https://private-user-images.githubusercontent.com/150797204/286567670-9b0e1232-4791-4d61-b949-16f9eb284c22.png?jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJnaXRodWIuY29tIiwiYXVkIjoicmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSIsImtleSI6ImtleTUiLCJleHAiOjE3MDc5MTU3ODAsIm5iZiI6MTcwNzkxNTQ4MCwicGF0aCI6Ii8xNTA3OTcyMDQvMjg2NTY3NjcwLTliMGUxMjMyLTQ3OTEtNGQ2MS1iOTQ5LTE2ZjllYjI4NGMyMi5wbmc_WC1BbXotQWxnb3JpdGhtPUFXUzQtSE1BQy1TSEEyNTYmWC1BbXotQ3JlZGVudGlhbD1BS0lBVkNPRFlMU0E1M1BRSzRaQSUyRjIwMjQwMjE0JTJGdXMtZWFzdC0xJTJGczMlMkZhd3M0X3JlcXVlc3QmWC1BbXotRGF0ZT0yMDI0MDIxNFQxMjU4MDBaJlgtQW16LUV4cGlyZXM9MzAwJlgtQW16LVNpZ25hdHVyZT1jYWU0ODM5Y2EzMjA5ZjMyODg0NGEwZTNiOGM2ODAwMjAwZTk5ODkzZDY3NDBjYTBiZmRmMDdhNjE5MGZiZmEzJlgtQW16LVNpZ25lZEhlYWRlcnM9aG9zdCZhY3Rvcl9pZD0wJmtleV9pZD0wJnJlcG9faWQ9MCJ9.t5F2OL3dQBV1LphRWVqiYCiSdN6j5wKhBy2JGLjh9E8) | Code Interpreter, Vision, Mind maps, Web Searches, Advanced Data Analytics, Large Data Handling and more! | [nextgen-user/CoolAGI](https://github.com/nextgen-user/CoolAGI)                     | 
| HL-GPT                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Fully remodeled UI                                                                                        | [harlanlewis/nextjs-chatgpt-app](https://github.com/harlanlewis/nextjs-chatgpt-app) |  

If your project is public, please highlight your updates in the README.md and open a pull request to add your project to the list. This will help others discover your project and learn from your experience.

## Best Practices

- **Stay Updated**: Regularly merge updates from the original big-AGI repository to benefit from bug fixes and new features
- **Keep It Open Source**: Consider keeping your derivative open source to encourage community contributions
- **Engage with the Community**: Use platforms like GitHub, Discord, or Reddit to gather feedback, find collaborators, and showcase your project

---

Creating a derivative application is not just about adding new features; it's about reimagining what's possible with AI and sharing it with the world.
We can't wait to see what you build!