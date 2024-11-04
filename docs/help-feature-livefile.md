# LiveFile: Synchronize Your Documents with Local Files

## Introduction

**LiveFile** is a powerful feature in big-AGI that allows you to **pair and synchronize
your documents and code blocks** with files on your local system.

This feature enables a **two-way connection between big-AGI and your local files on disk**,
saving you time and effort.

With LiveFile, you can:

- **Pair** documents and code blocks with local files.
- **Monitor** changes in local files and update content in big-AGI.
- **Refresh** chat attachments with the latest content.
- **Save** edits made in big-AGI back to your local files.
- **Store** AI-generated code and content.

---

## Requirements

- **Supported Browsers:**
  - **Google Chrome** (desktop)
  - **Microsoft Edge** (desktop)
- **Operating Systems:**
  - **Desktop platforms only**
  - **Note:** Mobile devices (iOS and Android) are **not supported** due to browser limitations.
- **File Types:**
  - Designed for **text-based files** (e.g., `.txt`, `.md`, `.js`, `.py`).
- **Performance:**
  - Can handle **dozens of files efficiently**.
- **Limitations:**
  - **File Size Limit**: 
    - Supports text files up to **10 MB**.
  - **Pairing Persistence:**
    - LiveFile connections **do not persist across sessions**.
    - After reloading the page, you will need to re-pair your files.
  - **Saving Overwrites:**
    - Saving changes in big-AGI will **overwrite the entire file**.
    - Use external tools for version control or incremental backups.

---

## Enabling LiveFile

LiveFile can be enabled automatically or manually in your Big-AGI workflow.

### Automatic Pairing

When you:

- **Attach**, **drop**, or **paste** a file into a chat message,

LiveFile is **automatically enabled** for that attachment. This means you can start
monitoring and reloading changes without any additional setup.

### Manual Pairing

For existing attachments or code blocks that:

- **Do not have LiveFile enabled** (e.g., created on other devices),
- **Are AI-generated code snippets without an associated file**,

You can manually pair them with a local file.

#### Pairing Attachments

1. **Select the Attachment:**
  - Click on the attachment in the chat to view it in the previewer.

2. **Initiate Pairing:**
  - Click on **"Pair File"** (🔗).
  - If you have open LiveFiles, they will be listed for easy selection.
  - Alternatively, you can select a new file from your local system.

3. **Grant Permissions**
  - When prompted, allow big-AGI to access the file.

#### Pairing Code Blocks

1. **Access Code Block Options:**
  - Click on the code block to reveal the header with options.

2. **Initiate Pairing:**
  - Click the **"Pair File"** button (🔗).
  - Select from your open LiveFiles or choose a new file.

3. **Confirm Pairing:**
  - Grant permission when prompted.

---

## Using LiveFile

### Monitoring Changes

- **Automatic Monitoring:**
  - LiveFile watches for changes in your paired local files.
  - If the file is modified outside of big-AGI, you'll be shown the changes in the LiveFile bar.
  - There is also a **"Replace with File"** option to manually load the latest content and see the changes.

- **Refreshing Content:**
  - Click **"Replace with File"** (🔄) to load the latest content from the paired file into big-AGI.

### Saving Edits Back to Paired Files

- **Editing Attachments or Code Blocks:**
  - Modify the content directly within big-AGI.
  - Attachments: Click on the attachment to open the previewer and click on "Edit" to make changes.
  - Code Blocks: Select "Edit" on the chat message to update code blocks.

- **Saving Changes:**
  - Click **"Save to File"** (💾) to overwrite the local file with your changes.
  - **Note:** This action overwrites the entire file. Ensure this is what you want before proceeding.

---

## Best Practices

- **Monitor External Changes:**
  - Refresh content in big-AGI if the local file has been modified outside the application.

- **Use a Version Control System:**
  - For critical files, consider using Git or other version control systems to track and monitor changes, authorship, and history.

---

## Troubleshooting

- **LiveFile Options Not Visible:**
  - Ensure you are using a **supported desktop browser**.
  - Check that you have the latest version of big-AGI.

- **Permission Issues:**
  - Confirm that you granted big-AGI permission to access your files.
  - Check your browser's settings to ensure file access is allowed.

---

## Technical Details

LiveFile uses the [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API) to 
interact with your local files securely. It leverages the [browser-fs-access](https://github.com/GoogleChromeLabs/browser-fs-access) library, 
an open-source project by Google Chrome Labs, which provides an easy interface to the File System Access API with fallbacks for broader browser support.

- **Security:**
  - Access to files requires explicit user permission.

- **Performance:** 
  - Designed to handle dozens of files efficiently (tested on hundreds).
  - Works with the Big-AGI attachment system to recursively add directories.

- **Browser Support:**
  - Fully supported on **Google Chrome** and **Microsoft Edge** desktop versions.

---

## Another Big-AGI First!

You can significantly boost your productivity and streamline your workflow within big-AGI
by understanding how to utilize LiveFile's features fully.

This Feature is in Beta as there are a few limitations and improvements to be made. 
Join us in enjoying and enhancing this feature on [big-AGI.com](https://big-agi.com), or
[GitHub](https://github.com/enricoros/big-AGI) for support and [Discord](https://discord.gg/MkH4qj2Jp9)
to share the love.