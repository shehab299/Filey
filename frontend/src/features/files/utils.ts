import type { FileEntry, SortMode } from './types';

export function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const unit = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), 4);
  return `${Number((bytes / 1024 ** unit).toFixed(unit === 0 ? 0 : 1))} ${['B', 'KB', 'MB', 'GB', 'TB'][unit]}`;
}

export function fileKind(entry: FileEntry): string {
  if (entry.type === 'Folder') return 'Folder';
  const extension = entry.name.split('.').pop()?.toLowerCase() ?? '';
  if (/^(png|jpg|jpeg|gif|webp|svg)$/.test(extension)) return 'Image';
  if (/^(mp4|webm|m4v|mov)$/.test(extension)) return 'Video';
  if (/^(mp3|wav|ogg|flac)$/.test(extension)) return 'Audio';
  if (/^(zip|gz|tar|rar|7z)$/.test(extension)) return 'Archive';
  if (/^(js|ts|tsx|jsx|rs|py|css|html|json|toml|yaml|yml|sh)$/.test(extension)) return 'Code';
  if (extension === 'pdf') return 'PDF';
  return 'Document';
}

export function filterAndSort(
  entries: FileEntry[],
  search: string,
  showHidden: boolean,
  sort: SortMode,
): FileEntry[] {
  return entries
    .filter(
      (entry) =>
        (showHidden || !entry.name.startsWith('.')) &&
        entry.name.toLowerCase().includes(search.toLowerCase()),
    )
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === 'Folder' ? -1 : 1;
      if (sort === 'size' && a.size !== b.size) return b.size - a.size;
      if (sort === 'type') {
        const result = fileKind(a).localeCompare(fileKind(b));
        if (result) return result;
      }
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    });
}
