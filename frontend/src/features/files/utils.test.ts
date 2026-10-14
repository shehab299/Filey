import { describe, expect, it } from 'vitest';
import { filterAndSort, formatSize } from './utils';
import type { FileEntry } from './types';

const entries: FileEntry[] = [
  { name: 'photo10.png', type: 'File', path: 'photo10.png', size: 10 },
  { name: '.private', type: 'File', path: '.private', size: 200 },
  { name: 'photo2.png', type: 'File', path: 'photo2.png', size: 20 },
  { name: 'work', type: 'Folder', path: 'work', size: 4096 },
];

describe('file listing transformations', () => {
  it('puts folders first, naturally sorts numbered names, and hides dotfiles', () => {
    expect(filterAndSort(entries, '', false, 'name').map((entry) => entry.name)).toEqual([
      'work',
      'photo2.png',
      'photo10.png',
    ]);
  });
  it('combines case-insensitive search with hidden-file visibility', () => {
    expect(filterAndSort(entries, 'PHOTO', false, 'name')).toHaveLength(2);
    expect(filterAndSort(entries, 'private', false, 'name')).toHaveLength(0);
    expect(filterAndSort(entries, 'private', true, 'name')).toHaveLength(1);
  });
  it('keeps folders first when sorting by descending file size without mutating the source', () => {
    const original = [...entries];
    expect(filterAndSort(entries, '', true, 'size').map((entry) => entry.name)).toEqual([
      'work',
      '.private',
      'photo2.png',
      'photo10.png',
    ]);
    expect(entries).toEqual(original);
  });
  it('formats empty, small, and larger file sizes', () => {
    expect(formatSize(0)).toBe('0 B');
    expect(formatSize(500)).toBe('500 B');
    expect(formatSize(1536)).toBe('1.5 KB');
    expect(formatSize(1024 ** 3)).toBe('1 GB');
  });
});
