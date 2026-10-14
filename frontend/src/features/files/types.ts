/** Matches the Rust /files response. Paths are always relative to the server root. */
export interface FileEntry {
  name: string;
  type: 'File' | 'Folder';
  path: string;
  size: number;
}
export type ViewMode = 'grid' | 'list';
export type SortMode = 'name' | 'size' | 'type';
