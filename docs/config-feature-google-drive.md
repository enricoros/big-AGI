# Google Drive Integration

Attach files from Google Drive directly in the chat composer.

## Setup

### 1. Enable APIs

In [Google Cloud Console](https://console.cloud.google.com/):

1. Go to **APIs & Services > Library**
2. Enable **Google Drive API** and **Google Picker API**

### 2. Configure OAuth

1. Go to **APIs & Services > OAuth consent screen**
2. Create consent screen (External or Internal)
3. Add scope: `https://www.googleapis.com/auth/drive.file`
4. Add test users if in testing mode

### 3. Create Credentials

1. Go to **APIs & Services > Credentials**
2. Create **OAuth client ID** (Web application)
3. Add JavaScript origins:
  - `http://localhost:3000` (dev)
  - `https://your-domain.com` (prod)

### 4. Set Environment Variable

```bash
NEXT_PUBLIC_GOOGLE_DRIVE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

## Usage

- Click **Drive** button in attachment menu

## Supported Files

| Type            | Export Format       |
|-----------------|---------------------|
| Regular files   | Downloaded directly |
| Google Docs     | Markdown (.md)      |
| Google Sheets   | CSV (.csv)          |
| Google Slides   | PDF (.pdf)          |
| Google Drawings | SVG (.svg)          |

## Troubleshooting

**Picker won't open**: Check `NEXT_PUBLIC_GOOGLE_DRIVE_CLIENT_ID` is set and APIs are enabled.

**OAuth errors**: Verify your domain is in authorized JavaScript origins. Add yourself as test user if app is in testing mode.

**Download fails**: Check file permissions and that Drive API is enabled.
