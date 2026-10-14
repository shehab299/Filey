import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronRight,
  Eye,
  EyeOff,
  Grid2X2,
  Home,
  List,
  RefreshCw,
  Search,
  Upload,
  LoaderCircle,
  FolderPlus,
  X,
} from 'lucide-react';
import { useFileStore } from '../../features/files/store';

export function Toolbar({
  refresh,
  refreshing,
  onUpload,
  uploading,
  uploadDisabled,
  onCreateDirectory,
}: {
  refresh: () => void;
  refreshing: boolean;
  onUpload: () => void;
  uploading: boolean;
  uploadDisabled: boolean;
  onCreateDirectory: () => void;
}) {
  const state = useFileStore();
  const path = state.history[state.historyIndex];
  const segments = path.split('/').filter(Boolean);
  return (
    <>
      <div className="navigation-toolbar">
        <div className="navigation-buttons">
          <button
            className="icon-button"
            title="Back"
            aria-label="Back"
            disabled={state.historyIndex === 0}
            onClick={state.goBack}
          >
            <ArrowLeft size={16} />
          </button>
          <button
            className="icon-button"
            title="Forward"
            aria-label="Forward"
            disabled={state.historyIndex === state.history.length - 1}
            onClick={state.goForward}
          >
            <ArrowRight size={16} />
          </button>
          <button
            className="icon-button"
            title="Parent folder"
            aria-label="Parent folder"
            disabled={!path || state.location === 'favorites'}
            onClick={() => state.navigate(segments.slice(0, -1).join('/'))}
          >
            <ArrowUp size={16} />
          </button>
        </div>
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <button onClick={() => state.navigate('')}>
            <Home size={14} />
            <span>Home</span>
          </button>
          {state.location === 'favorites' ? (
            <>
              <ChevronRight size={12} />
              <span>Favorites</span>
            </>
          ) : (
            segments.map((segment, index) => (
              <span className="breadcrumb-part" key={index}>
                <ChevronRight size={12} />
                <button onClick={() => state.navigate(segments.slice(0, index + 1).join('/'))}>
                  {segment}
                </button>
              </span>
            ))
          )}
        </nav>
        <button
          className="icon-button refresh-button"
          title="Refresh files"
          aria-label="Refresh files"
          onClick={refresh}
        >
          <RefreshCw size={14} className={refreshing ? 'spinning' : ''} />
        </button>
        <label className="search-field">
          <Search size={15} />
          <input
            aria-label="Search this folder"
            placeholder="Search files…"
            value={state.search}
            onChange={(event) => state.setSearch(event.target.value)}
          />
          {state.search && (
            <button
              title="Clear search"
              aria-label="Clear search"
              onClick={() => state.setSearch('')}
            >
              <X size={12} />
            </button>
          )}
          <kbd>/</kbd>
        </label>
      </div>
      <div className="folder-heading">
        <div>
          <div className="eyebrow">
            {state.location === 'favorites'
              ? 'THE THINGS YOU LOVE'
              : path
                ? 'A PLACE FOR EVERYTHING'
                : 'A LITTLE MORE ORGANIZED'}
          </div>
          <h2>
            {state.location === 'favorites' ? 'Favorites' : segments.at(-1) || 'Home'}
            <span className="heading-dot">.</span>
          </h2>
          <p>
            {state.location === 'favorites'
              ? 'Your favorite files and folders, all together.'
              : path
                ? 'Make room for your next big idea.'
                : 'All your files. One familiar place.'}
          </p>
        </div>
        <div className="view-options">
          {state.location !== 'favorites' && (
            <button
              className="icon-button"
              aria-label="New folder"
              title="New folder"
              onClick={onCreateDirectory}
              disabled={uploadDisabled}
            >
              <FolderPlus size={16} />
            </button>
          )}
          {state.location !== 'favorites' && (
            <button
              className="primary-button upload-button"
              onClick={onUpload}
              disabled={uploadDisabled || uploading}
            >
              {uploading ? <LoaderCircle size={14} className="spinning" /> : <Upload size={14} />}
              {uploading ? 'Uploading…' : 'Upload files'}
            </button>
          )}
          <button
            className={`icon-button ${state.showHidden ? 'selected' : ''}`}
            aria-label="Toggle hidden files"
            title={state.showHidden ? 'Hide hidden files' : 'Show hidden files'}
            onClick={state.toggleHidden}
          >
            {state.showHidden ? <Eye size={16} /> : <EyeOff size={16} />}
          </button>
          <div className="view-toggle">
            <button
              className={state.view === 'grid' ? 'selected' : ''}
              title="Grid view"
              aria-label="Grid view"
              aria-pressed={state.view === 'grid'}
              onClick={() => state.setView('grid')}
            >
              <Grid2X2 size={15} />
            </button>
            <button
              className={state.view === 'list' ? 'selected' : ''}
              title="List view"
              aria-label="List view"
              aria-pressed={state.view === 'list'}
              onClick={() => state.setView('list')}
            >
              <List size={16} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
