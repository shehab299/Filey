import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createDirectory, deleteEntry, listFiles, uploadFiles } from './api';
import type { FileEntry } from './types';
import { useFileStore } from './store';

export function useFiles(path: string) {
  return useQuery({ queryKey: ['files', path], queryFn: ({ signal }) => listFiles(path, signal) });
}

export function useCreateDirectory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ path, name }: { path: string; name: string }) => createDirectory(path, name),
    onSuccess: (_data, { path }) =>
      queryClient.invalidateQueries({ queryKey: ['files', path], exact: true }),
  });
}

export function useDeleteEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (entry: FileEntry) => deleteEntry(entry),
    onSuccess: (_data, entry) => {
      useFileStore.getState().removeFavorites(entry);
      return queryClient.invalidateQueries({ queryKey: ['files'] });
    },
  });
}

export function useUploadFiles() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ path, files }: { path: string; files: File[] }) => uploadFiles(path, files),
    // A failed multi-file request may still have saved earlier files.
    onSettled: (_data, _error, { path }) =>
      queryClient.invalidateQueries({ queryKey: ['files', path], exact: true }),
  });
}
