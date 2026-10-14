import { useEffect, useRef } from 'react';
import { Download, Eye, FolderOpen, Info, Star, Trash2 } from 'lucide-react';
import type { FileEntry } from '../../features/files/types';
import { getDownloadUrl } from '../../features/files/api';
import { FileIcon } from './FileIcon';
import { fileKind, formatSize } from '../../features/files/utils';
import './FileMenu.css';

export interface MenuSelection {
  entry: FileEntry;
  x: number;
  y: number;
  keyboard?: boolean;
}
interface Props {
  selection: MenuSelection;
  favorite: boolean;
  onClose: () => void;
  onOpen: () => void;
  onDownload: () => void;
  onFavorite: () => void;
  onInfo: () => void;
  onDelete: () => void;
}

/** The same accessible action menu is used for left click, right click and Enter. */
export function FileMenu({
  selection,
  favorite,
  onClose,
  onOpen,
  onDownload,
  onFavorite,
  onInfo,
  onDelete,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const { entry } = selection;
  useEffect(() => {
    if (selection.keyboard) ref.current?.querySelector<HTMLButtonElement>('button')?.focus();
  }, [selection]);
  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose();
    };
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const buttons = Array.from(
          ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [],
        );
        const current = buttons.indexOf(document.activeElement as HTMLElement);
        buttons[
          (current + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length
        ]?.focus();
      }
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', keyboard);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', keyboard);
    };
  }, [onClose]);
  return (
    <div
      ref={ref}
      className="file-menu"
      role="menu"
      aria-label={`Actions for ${entry.name}`}
      style={{
        left: Math.max(8, Math.min(selection.x, window.innerWidth - 248)),
        top: Math.max(40, Math.min(selection.y, window.innerHeight - 310)),
      }}
    >
      <div className="menu-file-heading">
        <FileIcon entry={entry} small />
        <div>
          <strong>{entry.name}</strong>
          <span>
            {fileKind(entry)}
            {entry.type === 'File' && ` · ${formatSize(entry.size)}`}
          </span>
        </div>
      </div>
      <button role="menuitem" onClick={onOpen}>
        {entry.type === 'Folder' ? <FolderOpen size={16} /> : <Eye size={16} />}
        {entry.type === 'Folder' ? 'Open folder' : 'Preview file'}
        <kbd>↵</kbd>
      </button>
      {entry.type === 'File' && (
        <a
          role="menuitem"
          className="menu-download"
          href={getDownloadUrl(entry.path)}
          download={entry.name}
          onClick={onDownload}
        >
          <Download size={16} />
          Download
          <span className="menu-action-dot" />
        </a>
      )}
      <div className="menu-separator" />
      <button role="menuitem" onClick={onFavorite}>
        <Star size={16} fill={favorite ? 'currentColor' : 'none'} />
        {favorite ? 'Remove from favorites' : 'Add to favorites'}
      </button>
      <button role="menuitem" onClick={onInfo}>
        <Info size={16} />
        File information
      </button>
      <button role="menuitem" onClick={onDelete}>
        <Trash2 size={16} />
        Delete {entry.type === 'Folder' ? 'folder' : 'file'}
      </button>
      <div className="menu-footer">A little order. A lot of possibility.</div>
    </div>
  );
}
