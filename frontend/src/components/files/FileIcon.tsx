import { Archive, Braces, FileText, Film, Image, Music } from 'lucide-react';
import { fileKind } from '../../features/files/utils';
import type { FileEntry } from '../../features/files/types';
import './FileIcon.css';

export function FileIcon({ entry, small = false }: { entry: FileEntry; small?: boolean }) {
  const kind = fileKind(entry);
  const Icon =
    { Image, Video: Film, Audio: Music, Archive, Code: Braces, PDF: FileText, Document: FileText }[
      kind
    ] ?? FileText;
  return (
    <span
      className={`file-icon ${small ? 'file-icon--small' : ''} file-icon--${kind.toLowerCase()}`}
      aria-hidden="true"
    >
      {kind === 'Folder' ? (
        <span className="folder-art" />
      ) : (
        <span className="document-art">
          <Icon />
          <span>
            {kind === 'PDF' ? 'PDF' : entry.name.split('.').pop()?.slice(0, 5).toUpperCase()}
          </span>
        </span>
      )}
    </span>
  );
}
