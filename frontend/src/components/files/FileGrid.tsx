import { FolderSearch, Star } from 'lucide-react';
import type { FileEntry, ViewMode } from '../../features/files/types';
import { fileKind, formatSize } from '../../features/files/utils';
import { FileIcon } from './FileIcon';

interface Props {
  entries: FileEntry[];
  view: ViewMode;
  selected: string | null;
  favorites: FileEntry[];
  onSelect: (entry: FileEntry, element: HTMLElement, keyboard?: boolean) => void;
  onOpen: (entry: FileEntry) => void;
  searching: boolean;
  isFavorites: boolean;
}

export function FileGrid({
  entries,
  view,
  selected,
  favorites,
  onSelect,
  onOpen,
  searching,
  isFavorites,
}: Props) {
  if (!entries.length)
    return (
      <div className="empty-state">
        <FolderSearch size={40} strokeWidth={1} />
        <h3>
          {searching
            ? 'No matches, just yet.'
            : isFavorites
              ? 'Keep your favorites close.'
              : 'A little room to grow.'}
        </h3>
        <p>
          {searching
            ? 'Try a different name or show hidden files.'
            : isFavorites
              ? 'Click an item and choose “Add to favorites”.'
              : 'This folder has no visible files.'}
        </p>
      </div>
    );
  return (
    <div className={`file-collection file-collection--${view}`} aria-label="Files">
      {view === 'list' && (
        <div className="list-head">
          <span>Name</span>
          <span>Type</span>
          <span>Size</span>
        </div>
      )}
      {entries.map((entry) => (
        <button
          key={entry.path}
          className={`file-item ${selected === entry.path ? 'file-item--selected' : ''}`}
          aria-label={`${entry.name}, ${fileKind(entry)}. Press Enter for actions.`}
          aria-haspopup="menu"
          onClick={(event) => onSelect(entry, event.currentTarget, event.detail === 0)}
          onContextMenu={(event) => {
            event.preventDefault();
            onSelect(entry, event.currentTarget);
          }}
          onDoubleClick={() => onOpen(entry)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowRight' && entry.type === 'Folder') {
              event.preventDefault();
              onOpen(entry);
            }
          }}
        >
          <FileIcon entry={entry} small={view === 'list'} />
          <span className="file-name" title={entry.name}>
            {entry.name}
          </span>
          {favorites.some((favorite) => favorite.path === entry.path) && (
            <Star className="file-star" size={10} fill="currentColor" />
          )}
          <span className="file-type">{fileKind(entry)}</span>
          <span className="file-size">
            {entry.type === 'Folder' ? '—' : formatSize(entry.size)}
          </span>
        </button>
      ))}
    </div>
  );
}
