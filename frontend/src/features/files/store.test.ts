import { beforeEach, describe, expect, it } from 'vitest';
import { useFileStore } from './store';

beforeEach(() =>
  useFileStore.setState({
    history: [''],
    historyIndex: 0,
    search: '',
    location: 'files',
    favorites: [],
  }),
);

describe('navigation history', () => {
  it('drops forward history when navigating from an earlier location', () => {
    useFileStore.getState().navigate('documents');
    useFileStore.getState().navigate('documents/old');
    useFileStore.getState().goBack();
    useFileStore.getState().navigate('documents/new');
    expect(useFileStore.getState().history).toEqual(['', 'documents', 'documents/new']);
    expect(useFileStore.getState().historyIndex).toBe(2);
  });
  it('clamps history boundaries and clears search when the location changes', () => {
    useFileStore.getState().goBack();
    expect(useFileStore.getState().historyIndex).toBe(0);
    useFileStore.getState().setSearch('a file');
    useFileStore.getState().navigate('documents');
    useFileStore.getState().goForward();
    expect(useFileStore.getState().historyIndex).toBe(1);
    expect(useFileStore.getState().search).toBe('');
  });
  it('opens a favorite folder in the regular filesystem view', () => {
    useFileStore.getState().showFavorites();
    useFileStore.getState().navigate('documents');
    expect(useFileStore.getState().location).toBe('files');
  });
});

describe('deleted favorites', () => {
  it('removes a deleted folder and descendants without removing similarly named folders', () => {
    useFileStore.setState({
      favorites: [
        { name: 'notes', path: 'notes', type: 'Folder', size: 0 },
        { name: 'draft', path: 'notes/draft.txt', type: 'File', size: 10 },
        { name: 'other', path: 'notes-old/draft.txt', type: 'File', size: 10 },
      ],
    });
    useFileStore
      .getState()
      .removeFavorites({ name: 'notes', path: 'notes', type: 'Folder', size: 0 });
    expect(useFileStore.getState().favorites.map((entry) => entry.path)).toEqual([
      'notes-old/draft.txt',
    ]);
  });
  it('removes only the deleted file', () => {
    useFileStore.setState({
      favorites: [
        { name: 'draft', path: 'notes/draft.txt', type: 'File', size: 10 },
        { name: 'notes', path: 'notes', type: 'Folder', size: 0 },
      ],
    });
    useFileStore
      .getState()
      .removeFavorites({ name: 'draft', path: 'notes/draft.txt', type: 'File', size: 10 });
    expect(useFileStore.getState().favorites.map((entry) => entry.path)).toEqual(['notes']);
  });
});
