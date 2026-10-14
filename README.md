# Filee

**Your files, in a browser.** A self-hosted file manager with a desktop-inspired
interface and a lightweight Rust API.

Browse, upload, download, and preview files from a directory you control. Filee
pairs a React + TypeScript frontend with an Axum backend—no database required.

## Features

- **Browse comfortably:** grid and list views, breadcrumbs, back/forward navigation,
  folder-first sorting, and search within the current folder.
- **Manage files:** upload files, create folders, and delete files or folders with
  confirmation.
- **Preview before downloading:** images, PDFs, text, and code; stream audio and
  video with seeking where your browser supports the codec.
- **Keep favorites close:** starred files and folders, with preferences saved in
  your browser.
- **Download directly:** native browser downloads without buffering the entire
  file in the frontend.
- **Use the API independently:** REST endpoints for directory listings, uploads,
  downloads, and media streaming.

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

Open the URL printed by Vite, usually **http://localhost:5173**. The development
server proxies `/api/v2` requests to `http://127.0.0.1:5000`, so no separate CORS
configuration is needed.

To access it from another device on your trusted network, use your computer's LAN
IP and the frontend port. Both development servers listen on all interfaces;
check your firewall before starting them.

## Configuration

The backend reads environment variables and optionally a `.env` file:

| Setting | Default    | Description                                                                                           |
| ------- | ---------- | ----------------------------------------------------------------------------------------------------- |
| `ROOT`  | `./assets` | Existing directory to browse and manage. Relative paths resolve from the backend's working directory. |

For persistent local configuration, copy `.env.example` to `.env` if you do not
already have one, then edit `ROOT`. Explicit environment variables take precedence
over `.env`. Restart the backend after changing configuration.

The backend address is currently fixed at `0.0.0.0:5000`. The frontend's development
proxy is configured in [`frontend/vite.config.ts`](frontend/vite.config.ts).

## Using Filee

- Double-click a folder to open it or a file to preview it.
- Single-click or right-click an item to open its action menu.
- Use the toolbar to upload files, create folders, switch views, and sort.
- Press `/` to focus search; search only filters the current folder.
- Star items to add them to Favorites. Favorites are local to your browser.
- Check your browser's download list for download progress and completion.

Image, PDF, and text/code previews support files up to 25 MB; text previews display
at most 1 MB. Audio and video stream without that preview limit. Upload requests
are limited to 1 GiB. Folder downloads and archive creation are not supported.

## Production deployment

Build both applications from the repository root:

```sh
cargo build --release
cd frontend
npm ci
npm run build
```

Run `target/release/filee` from the repository root with `ROOT` set to an existing
directory. Serve `frontend/dist/` with a static web server and reverse-proxy
`/api/v2/*` to the Rust server on port 5000, **preserving the `/api/v2` prefix**.
The backend does not serve the frontend files itself.

Use a single origin for the UI and API. Configure your proxy's upload limit and
timeouts as needed, and preserve range requests for media seeking. `npm run
preview` is for checking a build locally, not a production server.

Before providing remote access, put authentication and HTTPS in front of **both
the frontend and every API route**, restrict direct access to port 5000, and run
the backend with filesystem permissions limited to the intended directory.

## API overview

All routes are under `/api/v2`. Paths are relative to `ROOT`; URL-encode query
parameter values. Create and delete requests use JSON; uploads use multipart form
data.

| Method   | Endpoint                       | Purpose                                                  |
| -------- | ------------------------------ | -------------------------------------------------------- |
| `GET`    | `/directory?path=<path>`       | List entries; omit `path` to list the root.              |
| `POST`   | `/directory?path=<parent>`     | Create a folder with `{ "name": "new-folder" }`.         |
| `DELETE` | `/directory`                   | Recursively delete a folder with `{ "path": "folder" }`. |
| `DELETE` | `/file`                        | Delete a file with `{ "path": "file.txt" }`.             |
| `POST`   | `/upload?path=<folder>`        | Upload multipart files to a directory.                   |
| `GET`    | `/download?path=<file>&mode=d` | Download a file as an attachment.                        |
| `GET`    | `/download?path=<file>&mode=p` | Retrieve file bytes for a preview.                       |
| `HEAD`   | `/download?path=<file>`        | Retrieve file response headers without the body.         |
| `GET`    | `/media?path=<file>`           | Stream media with HTTP range support.                    |

For example, list the root directory:

```sh
curl http://127.0.0.1:5000/api/v2/directory
```

## Development

```text
filee/
├── src/              Rust API, filesystem handlers, and configuration
├── frontend/
│   ├── src/          React components, file features, and styles
│   └── package.json  Frontend scripts and dependencies
├── Cargo.toml        Backend dependencies
└── .env.example      Example local configuration
```

Backend checks (from the repository root):

```sh
cargo test
cargo fmt --check
```

Frontend checks (from `frontend/`):

```sh
npm test
npm run build
npm run format:check
```

See [`frontend/README.md`](frontend/README.md) for the frontend architecture and
interaction details.

## Troubleshooting

- **“Root directory does not exist”:** create the directory or update `ROOT` to
  an existing path. Check the working directory when using relative paths.
- **The UI loads but files do not:** check that the API is running on port 5000
  and that the development or deployment proxy preserves `/api/v2`.
- **Uploads or deletions fail:** check the backend user's filesystem permissions
  and, for uploads, the request-size limits on your proxy.
- **Media does not play:** browser codec support varies; try downloading the file
  and opening it in a local player.
