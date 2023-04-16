# Deploying Next.js App on Cloudflare Pages

Follow these steps to deploy your Next.js app on Cloudflare Pages. This guide is based on
the [official Cloudflare developer documentation](https://developers.cloudflare.com/pages/framework-guides/deploy-a-nextjs-site/),
with a few additional steps.

## Step 1: Fork the Repository

Fork the repository to your own GitHub account.

## Step 2: Connect Cloudflare Pages to Your GitHub Account

1. Go to the Cloudflare Pages section and click the `Create a project` button.
2. Click `Connect To Git` and give Cloudflare Pages either All GitHub account Repo access or selected Repo access. We
   recommend using selected Repo access and selecting the forked repo from step 1.

## Step 3: Setup Build and Deployments

1. Once you select the forked GitHub repo, click the `Begin Setup` button.
2. On this page, set your `Project name`, `Production branch` (e.g., main), and your Build settings.
3. Select `Next.js` from the `Framework preset` dropdown menu.
4. Leave the preset filled Build command and Build output directory as preset defaults.
5. Set `Environmental variables` (advanced) on this page to configure some variables as follows:

| Variable                  | Value   |
|---------------------------|---------|
| `GO_VERSION`              | `1.16`  |
| `NEXT_TELEMETRY_DISABLED` | `1`     |
| `NODE_VERSION`            | `17`    |
| `PHP_VERSION`             | `7.4`   |
| `PYTHON_VERSION`          | `3.7`   |
| `RUBY_VERSION`            | `2.7.1` |

6. Click the `Save and Deploy` button.

## Step 4: Monitor the Deployment Process

Watch the process run to initialize your build environment, clone the GitHub repo, build the application, and deploy to
the Cloudflare Network. Once that is done, proceed to the project you created.

## Step 5: Set up a Custom Domain

Use the `Custom domains` tab to set up your domain via CNAME.

## Step 6: Configure Access Policy and Web Analytics

Go to the `Settings` page and enable the following settings:

1. Access Policy: Restrict [preview deployments](https://developers.cloudflare.com/pages/platform/preview-deployments/)
   to members of your Cloudflare account via one-time pin and restrict primary `*.YOURPROJECT.pages.dev` domain.
   See [Cloudflare Pages known issues](https://developers.cloudflare.com/pages/platform/known-issues/#enabling-access-on-your-pagesdev-domain)
   for more information.
2. Enable Web Analytics.

Now you have successfully deployed your Next.js app on Cloudflare Pages.