import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { FileEntry, SortMode, ViewMode } from './types';

interface FileState {
  history: string[];
  historyIndex: number;
  search: string;
  view: ViewMode;
  sort: SortMode;
  showHidden: boolean;
  favorites: FileEntry[];
  location: 'files' | 'favorites';
  navigate: (path: string) => void;
  goBack: () => void;
  goForward: () => void;
  setSearch: (search: string) => void;
  setView: (view: ViewMode) => void;
  setSort: (sort: SortMode) => void;
  toggleHidden: () => void;
  showFavorites: () => void;
  toggleFavorite: (entry: FileEntry) => void;
  removeFavorites: (entry: FileEntry) => void;
}

/** Zustand owns UI state; server data belongs exclusively to React Query. */
export const useFileStore = create<FileState>()(
  persist(
    (set) => ({
      history: [''],
      historyIndex: 0,
      search: '',
      view: 'grid',
      sort: 'name',
      showHidden: false,
      favorites: [],
      location: 'files',
      navigate: (path) =>
        set((state) => ({
          history: [...state.history.slice(0, state.historyIndex + 1), path],
          historyIndex: state.historyIndex + 1,
          search: '',
          location: 'files',
        })),
      goBack: () =>
        set((state) => ({
          historyIndex: Math.max(0, state.historyIndex - 1),
          search: '',
          location: 'files',
        })),
      goForward: () =>
        set((state) => ({
          historyIndex: Math.min(state.history.length - 1, state.historyIndex + 1),
          search: '',
          location: 'files',
        })),
      setSearch: (search) => set({ search }),
      setView: (view) => set({ view }),
      setSort: (sort) => set({ sort }),
      toggleHidden: () => set((state) => ({ showHidden: !state.showHidden })),
      showFavorites: () => set({ location: 'favorites', search: '' }),
      toggleFavorite: (entry) =>
        set((state) => ({
          favorites: state.favorites.some((item) => item.path === entry.path)
            ? state.favorites.filter((item) => item.path !== entry.path)
            : [...state.favorites, entry],
        })),
      removeFavorites: (entry) =>
        set((state) => ({
          favorites: state.favorites.filter(
            (item) =>
              item.path !== entry.path &&
              !(entry.type === 'Folder' && item.path.startsWith(`${entry.path}/`)),
          ),
        })),
    }),
    {
      name: 'filee-preferences',
      partialize: ({ view, sort, showHidden, favorites }) => ({
        view,
        sort,
        showHidden,
        favorites,
      }),
    },
  ),
);
