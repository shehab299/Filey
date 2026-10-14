import type { FileEntry } from './types';

async function checkResponse(response: Response): Promise<Response> {
  if (!response.ok) {
    throw new Error(
      response.status === 400
        ? 'This location is no longer available. Try returning to Home.'
        : `The file server returned an error (${response.status}). Please try again.`,
    );
  }
  return response;
}

export async function listFiles(path: string, signal?: AbortSignal): Promise<FileEntry[]> {
  const response = await checkResponse(
    await fetch(`/api/v2/directory?${new URLSearchParams({ path })}`, { signal }),
  );
  const data: { entries: FileEntry[] } = await response.json();
  return data.entries;
}

export async function uploadFiles(path: string, files: File[]): Promise<void> {
  const body = new FormData();
  for (const file of files) body.append('file', file, file.name);

  // The browser sets Content-Type together with the multipart boundary.
  const response = await fetch(`/api/v2/upload?${new URLSearchParams({ path })}`, {
    method: 'POST',
    body,
  });
  if (response.ok) return;
  if (response.status === 413) {
    throw new Error('The upload is too large. Select fewer or smaller files (1 GiB per request).');
  }

  const data = await response.json().catch(() => null);
  throw new Error(
    typeof data?.error === 'string'
      ? data.error
      : `The upload failed (${response.status}). Please try again.`,
  );
}

export async function getFileBlob(path: string, signal?: AbortSignal): Promise<Blob> {
  const response = await checkResponse(
    await fetch(`/api/v2/download?${new URLSearchParams({ path, mode: 'p' })}`, { signal }),
  );
  return response.blob();
}

async function mutateEntry(url: string, method: 'POST' | 'DELETE', body: object): Promise<void> {
  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (response.ok) return;
  const data = await response.json().catch(() => null);
  throw new Error(
    typeof data?.error === 'string'
      ? data.error
      : `The operation failed (${response.status}). Please try again.`,
  );
}

export function createDirectory(path: string, name: string): Promise<void> {
  return mutateEntry(`/api/v2/directory?${new URLSearchParams({ path })}`, 'POST', { name });
}

export function deleteEntry(entry: FileEntry): Promise<void> {
  return mutateEntry(`/api/v2/${entry.type === 'Folder' ? 'directory' : 'file'}`, 'DELETE', {
    path: entry.path,
  });
}

/** Native links let the browser own downloads, including progress and large files. */
export function getDownloadUrl(path: string): string {
  return `/api/v2/download?${new URLSearchParams({ path, mode: 'd' })}`;
}

/** Give native media elements a URL so playback and seeking use HTTP range requests. */
export function getMediaUrl(path: string): string {
  return `/api/v2/media?${new URLSearchParams({ path })}`;
}
