import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ArrowDownWideNarrow, CheckCircle2, LoaderCircle, X } from 'lucide-react';
import { useFiles, useUploadFiles } from '../../features/files/hooks';
import { useFileStore } from '../../features/files/store';
import { filterAndSort } from '../../features/files/utils';
import type { FileEntry, SortMode } from '../../features/files/types';
import { Sidebar } from './Sidebar';
import { Toolbar } from './Toolbar';
import { FileGrid } from './FileGrid';
import { FileMenu, type MenuSelection } from './FileMenu';
import { FileDialog } from './FileDialog';
import { FileActionDialog, type FileAction } from './FileActionDialog';
import './FileManager.css';

export function FileManager() {
  const state = useFileStore();
  const path = state.history[state.historyIndex];
  const query = useFiles(path);
  const upload = useUploadFiles();
  const fileInput = useRef<HTMLInputElement>(null);
  const uploadPath = useRef(path);
  const container = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<MenuSelection | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ entry: FileEntry; mode: 'info' | 'preview' } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [action, setAction] = useState<FileAction | null>(null);
  const closeAction = useCallback(() => setAction(null), []);
  const closeMenu = useCallback(() => setMenu(null), []);
  const closeDialog = useCallback(() => setDialog(null), []);
  const isFavorites = state.location === 'favorites';
  const entries = useMemo(
    () =>
      filterAndSort(
        isFavorites ? state.favorites : (query.data ?? []),
        state.search,
        state.showHidden,
        state.sort,
      ),
    [isFavorites, state.favorites, query.data, state.search, state.showHidden, state.sort],
  );

  const folders = entries.filter((entry) => entry.type === 'Folder').length;

  useEffect(() => {
    setMenu(null);
    setSelected(null);
  }, [path, state.location, state.view, state.search]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        event.key === '/' &&
        !dialog &&
        !action &&
        !['INPUT', 'TEXTAREA'].includes(target.tagName)
      ) {
        event.preventDefault();
        container.current?.querySelector<HTMLInputElement>('input')?.focus();
      }
    };
    window.addEventListener('keydown', keyboard);
    return () => window.removeEventListener('keydown', keyboard);
  }, [dialog, action]);

  function openEntry(entry: FileEntry) {
    setMenu(null);
    if (entry.type === 'Folder') state.navigate(entry.path);
    else setDialog({ entry, mode: 'preview' });
  }

  function notifyDownload(entry: FileEntry) {
    // Keep the link mounted until its native click action has started the request.
    window.setTimeout(() => setMenu(null), 0);
    setNotice(`Download requested for ${entry.name}. Check your browser downloads.`);
  }

  function selectEntry(entry: FileEntry, element: HTMLElement, keyboard = false) {
    const bounds = element.getBoundingClientRect();
    setSelected(entry.path);
    const y = bounds.bottom + 310 > window.innerHeight ? bounds.top - 310 : bounds.bottom - 4;
    setMenu({ entry, x: bounds.right - 10, y, keyboard });
  }

  return (
    <div className="file-manager" ref={container}>
      <Sidebar />
      <section className="file-main" aria-label="Folder contents">
        <Toolbar
          refresh={() => void query.refetch()}
          refreshing={query.isFetching}
          uploading={upload.isPending}
          uploadDisabled={query.isPending || query.isError}
          onCreateDirectory={() => setAction({ type: 'create', path })}
          onUpload={() => {
            uploadPath.current = path;
            fileInput.current?.click();
          }}
        />
        <input
          ref={fileInput}
          type="file"
          multiple
          hidden
          aria-label="Choose files to upload"
          onChange={(event) => {
            const files = Array.from(event.currentTarget.files ?? []);
            event.currentTarget.value = '';
            if (files.length && !upload.isPending) {
              upload.mutate({ path: uploadPath.current, files });
            }
          }}
        />
        {!upload.isIdle && (
          <div
            className={`upload-feedback ${upload.isError ? 'upload-feedback--error' : ''}`}
            role={upload.isError ? 'alert' : 'status'}
          >
            {upload.isPending ? (
              <LoaderCircle size={16} className="spinning" />
            ) : upload.isError ? (
              <AlertCircle size={16} />
            ) : (
              <CheckCircle2 size={16} />
            )}
            <span>
              {upload.isError
                ? upload.error.message === 'Failed to fetch'
                  ? 'Could not upload your files. Check your connection and try again.'
                  : upload.error.message
                : `${upload.isPending ? 'Uploading' : 'Uploaded'} ${upload.variables?.files.length} ${upload.variables?.files.length === 1 ? 'file' : 'files'} to ${upload.variables?.path || 'Home'}${upload.isPending ? '…' : '.'}`}
            </span>
            {!upload.isPending && (
              <button aria-label="Dismiss upload notification" onClick={() => upload.reset()}>
                <X size={14} />
              </button>
            )}
          </div>
        )}
        <div className="collection-toolbar">
          <span>
            {state.search
              ? `RESULTS FOR “${state.search}”`
              : isFavorites
                ? 'SAVED FOR LATER'
                : 'FILES & FOLDERS'}{' '}
            <span className="item-count">{entries.length}</span>
          </span>
          <label className="sort-control">
            <ArrowDownWideNarrow size={13} />
            <span>Sort by</span>
            <select
              aria-label="Sort files"
              value={state.sort}
              onChange={(event) => state.setSort(event.target.value as SortMode)}
            >
              <option value="name">Name</option>
              <option value="size">Size</option>
              <option value="type">Type</option>
            </select>
          </label>
        </div>
        <div className="file-scroll" onScroll={closeMenu}>
          {!isFavorites && query.isPending ? (
            <div className="loading-state" role="status">
              <LoaderCircle size={24} className="spinning" />
              <p>Making room for your files…</p>
            </div>
          ) : !isFavorites && query.isError ? (
            <div className="empty-state error-state" role="alert">
              <AlertCircle size={35} strokeWidth={1} />
              <h3>We couldn't reach your files.</h3>
              <p>
                {query.error.message === 'Failed to fetch'
                  ? 'Check that your file server is running, then try again.'
                  : query.error.message}
              </p>
              <button className="primary-button" onClick={() => void query.refetch()}>
                Try again
              </button>
            </div>
          ) : (
            <FileGrid
              entries={entries}
              view={state.view}
              selected={selected}
              favorites={state.favorites}
              onSelect={selectEntry}
              onOpen={openEntry}
              searching={!!state.search}
              isFavorites={isFavorites}
            />
          )}
        </div>
        <footer className="file-status">
          <span>
            <span className="status-dot" />
            {entries.length} {entries.length === 1 ? 'item' : 'items'}
            <span className="status-divider">·</span>
            {folders} {folders === 1 ? 'folder' : 'folders'}
            <span className="status-divider">·</span>
            {entries.length - folders} {entries.length - folders === 1 ? 'file' : 'files'}
          </span>
          <span className="click-hint">Click for actions. Double-click to open.</span>
        </footer>
      </section>
      {menu && (
        <FileMenu
          selection={menu}
          favorite={state.favorites.some((entry) => entry.path === menu.entry.path)}
          onClose={closeMenu}
          onOpen={() => openEntry(menu.entry)}
          onDownload={() => notifyDownload(menu.entry)}
          onFavorite={() => {
            state.toggleFavorite(menu.entry);
            setMenu(null);
          }}
          onInfo={() => {
            setDialog({ entry: menu.entry, mode: 'info' });
            setMenu(null);
          }}
          onDelete={() => {
            setAction({ type: 'delete', entry: menu.entry });
            setMenu(null);
          }}
        />
      )}
      {dialog && (
        <FileDialog
          key={dialog.entry.path + dialog.mode}
          entry={dialog.entry}
          mode={dialog.mode}
          onClose={closeDialog}
          onDownload={() => notifyDownload(dialog.entry)}
        />
      )}
      {action && (
        <FileActionDialog
          action={action}
          onClose={closeAction}
          onSuccess={(message) => {
            setAction(null);
            setSelected(null);
            setNotice(message);
            if (
              action.type === 'delete' &&
              action.entry.type === 'Folder' &&
              (path === action.entry.path || path.startsWith(`${action.entry.path}/`))
            ) {
              state.navigate('');
            }
          }}
        />
      )}
      {notice && (
        <div className="toast" role="status">
          <CheckCircle2 size={16} />
          <span>{notice}</span>
          <button aria-label="Dismiss notification" onClick={() => setNotice(null)}>
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
