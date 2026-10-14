import { ChevronRight, FolderClosed, HardDrive, Home, Star } from 'lucide-react';
import { useFiles } from '../../features/files/hooks';
import { useFileStore } from '../../features/files/store';
import './Sidebar.css';

export function Sidebar() {
  const state = useFileStore();
  const path = state.history[state.historyIndex];
  const root = useFiles('');
  const folders =
    root.data?.filter(
      (entry) => entry.type === 'Folder' && (state.showHidden || !entry.name.startsWith('.')),
    ) ?? [];
  return (
    <aside className="sidebar" aria-label="File locations">
      <div className="sidebar-heading">
        filee<span>Your files, at home.</span>
      </div>
      <div className="sidebar-section-label">PLACES</div>
      <nav>
        <button
          className={
            state.location === 'files' && path === '' ? 'sidebar-link active' : 'sidebar-link'
          }
          onClick={() => state.navigate('')}
        >
          <Home size={17} />
          Home{state.location === 'files' && path === '' && <span className="active-dot" />}
        </button>
        <button
          className={state.location === 'favorites' ? 'sidebar-link active' : 'sidebar-link'}
          onClick={state.showFavorites}
        >
          <Star size={17} />
          Favorites
          {state.favorites.length > 0 && (
            <span className="sidebar-count">{state.favorites.length}</span>
          )}
        </button>
      </nav>
      {folders.length > 0 && (
        <>
          <div className="sidebar-section-label folders-label">YOUR FOLDERS</div>
          <nav>
            {folders.map((folder) => (
              <button
                key={folder.path}
                className={
                  state.location === 'files' && path === folder.path
                    ? 'sidebar-link active'
                    : 'sidebar-link'
                }
                onClick={() => state.navigate(folder.path)}
              >
                <FolderClosed size={16} />
                <span className="sidebar-folder-name">{folder.name}</span>
                <ChevronRight className="folder-chevron" size={13} />
              </button>
            ))}
          </nav>
        </>
      )}
      <div className="sidebar-bottom">
        <div className="drive-icon">
          <HardDrive size={19} />
        </div>
        <div>
          <strong>Filee drive</strong>
          <span>Your connected filesystem</span>
        </div>
        <span
          className={`drive-dot ${root.isError ? 'offline' : ''}`}
          title={root.isError ? 'Server unavailable' : 'Connected'}
        />
      </div>
    </aside>
  );
}
