# Filee desktop

A Linux-inspired file manager for the Filee Rust API. Built with React, TypeScript,
React Query, Zustand, and plain, component-scoped CSS.

## Run locally

Use Node.js 24+ (or 22.12+) and a current Rust toolchain.

The frontend lives inside the backend repository. From the repository root
(the directory containing `Cargo.toml`), start the backend:

```sh
mkdir -p assets
ROOT=./assets cargo run
```

In another terminal, also starting from the repository root:

```sh
cd frontend
npm ci
npm run dev
```

Open the URL printed by Vite (usually `http://localhost:5173`). The dev server
proxies `/api/v2/*` to `http://127.0.0.1:5000`, preserving the full path; no CORS setup is needed. The backend
lists the directory configured by `ROOT`, defaulting to `./assets`.

```sh
npm run build    # Type-check and produce dist/
npm run test     # File sorting/filtering and navigation-state checks
npm run format  # Consistent, readable formatting for React and CSS
```

For deployment, serve `dist/` with your static web server and proxy `/api/v2/*` to
the Rust server, preserving the `/api/v2` prefix. `vite preview` previews the static
build only; use the same reverse proxy for API access in production.

## Find your way around

```text
src/
  main.tsx                   React and React Query providers
  styles/global.css          Shared tokens, reset, buttons, and modal backdrop
  components/
    desktop/                 Wallpaper, desktop panel, dock, window controls
    common/Modal.tsx          Shared dialog with keyboard focus handling
    files/
      FileManager.tsx        Coordinates data, selection, menus, and downloads
      Sidebar.tsx            Home, favorites, and real server-root folders
      Toolbar.tsx            Breadcrumbs, navigation, search, and view controls
      FileGrid.tsx           Grid/list presentation
      FileIcon.tsx           File-type icons and CSS folder illustrations
      FileMenu.tsx           Left/right-click action menu
      FileDialog.tsx         Preview and file information
  features/files/
    api.ts                   Fetch, response errors, and browser downloads
    hooks.ts                 React Query folder queries
    store.ts                 Zustand navigation and persisted preferences
    types.ts                 API and UI types
    utils.ts                 File kinds, size formatting, filtering, sorting
```

**State ownership:** React Query owns server listings, previews, loading, and errors.
The browser owns native downloads and their progress. Zustand owns navigation,
search, view preferences, and favorites.
Transient selection, dialogs, and notifications stay local to their component.
Only preferences and favorites persist in local storage. Styles live beside their
components; no inline styling except dynamically positioned action menus.

## Interaction

- Single-click any item for its action menu; right-click works too.
- Double-click folders to navigate and files to preview.
- Download is available for files in the menu and preview dialog. The backend
  does not support folder archives, so folders have an Open action instead.
- Downloads use real links to `/api/v2/download?path=...&mode=d` with an attachment response.
  They do not fetch a Blob first. Check your browser's download list for progress
  and completion; the app's notification only confirms the download was requested.
- Navigate with breadcrumbs, Home, sidebar folders, or back/forward/up buttons.
- Search filters the current folder; press `/` to focus it.
- Sort by name, size, or type. Folders always appear first.
- Star files or folders to keep them in Favorites.
- Create folders with the New folder toolbar button; upload files into the current folder.
- Delete files or folders from their action menu after confirmation. Folder deletion
  permanently removes everything inside, and deleted items are removed from Favorites.
- Use Tab/Enter to activate controls, arrow keys within the action menu, and
  Escape to dismiss menus/dialogs. ArrowRight opens a focused folder.
- Preview images, PDFs, and text/code up to 25 MB. Text previews show at most 1 MB.
  Audio and video stream directly without the 25 MB limit, with native playback
  controls and seeking. Playback depends on the browser's codec support.

## API contract

- `GET /api/v2/directory?path=<relative-path>` → `{ entries: [{ name, type, path, size }] }`
- `POST /api/v2/directory?path=<parent-path>` with JSON `{ name }` → `201`
- `DELETE /api/v2/directory` with JSON `{ path }` → `204` (recursive)
- `DELETE /api/v2/file` with JSON `{ path }` → `204`
- `POST /api/v2/upload?path=<relative-path>` with multipart files → `201`
- `GET /api/v2/download?path=<relative-path>&mode=d` → file bytes with `Content-Disposition: attachment`
- `GET /api/v2/download?path=<relative-path>&mode=p` → preview bytes
- `GET /api/v2/media?path=<relative-path>` → inline media bytes with HTTP range support

The frontend never fabricates filesystem entries. Empty and unavailable
directories have dedicated states. All frontend API calls use v2 endpoints
with URL-encoded query parameters where applicable. Create/delete requests send
JSON; uploads use browser-generated multipart data (up to 1 GiB per request).

After changing the Rust handler, restart `cargo run`. On your phone, open the
frontend using your computer's LAN IP and the port printed by Vite, then reload
the page. The frontend uses same-origin `/api/v2` URLs; do not use `localhost` on
the phone to reach your computer.
