# Filee

**Your files, in a browser.** A self-hosted file manager with a desktop-inspired
interface and a lightweight Rust API.

Browse, upload, download, and preview files from a directory you control. 

> **Use on a trusted network.** Filee currently has no authentication or access
> controls. Anyone who can reach the API can read, upload, and delete files within
> the configured root. Deletions are permanent; folders are deleted recursively.
> Do not expose it directly to the internet, and keep backups of important files.

## Quick start

### Requirements

- Linux or another Unix-like environment (the backend uses Unix filesystem APIs).
- A current stable Rust toolchain with support for edition 2024.
- Node.js 24+ (or 22.12+) and npm.

Run these commands from the repository root—the directory containing `Cargo.toml`.

### 1. Choose a file directory and start the API

Create a directory for files, then point the server at it:

```sh
mkdir -p assets
ROOT=./assets cargo run
```

To use an existing directory instead:

```sh
ROOT=/absolute/path/to/your/files cargo run
```

The directory must already exist. The API listens on `0.0.0.0:5000`.

### 2. Start the frontend

In a second terminal, from the repository root:

```sh
cd frontend
npm ci
npm run dev
```

Open the URL printed by Vite, usually **http://localhost:5173**. 

To access it from another device on your trusted network, use your computer's LAN
IP and the frontend port. Both development servers listen on all interfaces;
check your firewall before starting them.

