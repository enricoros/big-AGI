# Deploying a Next.js App on Cloudflare Pages

***NOTE: See https://github.com/enricoros/big-agi/issues/174 for a recent issue we are aware of*** 

This guide provides steps to deploy your Next.js app on Cloudflare Pages.
It is based on the [official Cloudflare developer documentation](https://developers.cloudflare.com/pages/framework-guides/deploy-a-nextjs-site/), 
with some additional steps.

## Step 1: Repository Forking

Fork the repository to your personal GitHub account.

## Step 2: Linking Cloudflare Pages to Your GitHub Account

1. Navigate to the Cloudflare Pages section and click on the `Create a project` button.
2. Click `Connect To Git` and grant Cloudflare Pages access to either all GitHub account repositories or selected repositories.
   We recommend using selected Repo access and selecting the forked repository from step 1.

## Step 3: Configuring Build and Deployments

1. After selecting the forked GitHub repository, click the `Begin Setup` button.
2. On this page, set your `Project name`, `Production branch` (e.g., main), and your Build settings.
3. Choose `Next.js` from the `Framework preset` dropdown menu.
4. Keep the preset filled Build command and Build output directory as default.
5. Set `Environmental variables` (advanced) on this page as follows:

| Variable                  | Value   |
|---------------------------|---------|
| `GO_VERSION`              | `1.16`  |
| `NEXT_TELEMETRY_DISABLED` | `1`     |
| `NODE_VERSION`            | `17`    |
| `PHP_VERSION`             | `7.4`   |
| `PYTHON_VERSION`          | `3.7`   |
| `RUBY_VERSION`            | `2.7.1` |

6. Click the `Save and Deploy` button.

## Step 4: Monitoring the Deployment Process

Observe the process as it initializes your build environment, clones the GitHub repository, builds the application, and deploys it
to the Cloudflare Network. Once complete, proceed to the project you created.

## Step 5: Custom Domain Configuration

Use the `Custom domains` tab to set up your domain via CNAME.

## Step 6: Access Policy and Web Analytics Configuration

Navigate to the `Settings` page and enable the following settings:

1. Access Policy: Restrict [preview deployments](https://developers.cloudflare.com/pages/platform/preview-deployments/)
   to members of your Cloudflare account via one-time pin and restrict primary `*.YOURPROJECT.pages.dev` domain.
   Refer to [Cloudflare Pages known issues](https://developers.cloudflare.com/pages/platform/known-issues/#enabling-access-on-your-pagesdev-domain)
   for more details.
2. Enable Web Analytics.

Congratulations! You have successfully deployed your Next.js app on Cloudflare Pages.