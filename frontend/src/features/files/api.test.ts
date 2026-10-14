import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createDirectory,
  deleteEntry,
  getDownloadUrl,
  getFileBlob,
  getMediaUrl,
  listFiles,
  uploadFiles,
} from './api';

afterEach(() => vi.unstubAllGlobals());

describe('Rust API integration contract', () => {
  it('creates folders using a JSON name and URL-encoded parent path', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 201 }));
    vi.stubGlobal('fetch', fetch);
    await createDirectory('notes & ideas', 'New folder');
    expect(fetch).toHaveBeenCalledWith('/api/v2/directory?path=notes+%26+ideas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New folder' }),
    });
  });
  it.each(['File', 'Folder'] as const)(
    'deletes a %s using a JSON path and accepts an empty 204 response',
    async (type) => {
      const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
      vi.stubGlobal('fetch', fetch);
      await deleteEntry({ name: 'résumé & ideas', path: 'notes/résumé & ideas', type, size: 0 });
      expect(fetch).toHaveBeenCalledWith(`/api/v2/${type === 'Folder' ? 'directory' : 'file'}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: 'notes/résumé & ideas' }),
      });
    },
  );
  it('preserves folder creation errors from the backend', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ error: 'There exists a file with this name' }), {
            status: 400,
          }),
        ),
    );
    await expect(createDirectory('', 'existing')).rejects.toThrow(
      'There exists a file with this name',
    );
  });
  it('handles non-JSON deletion errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('unavailable', { status: 502 })));
    await expect(
      deleteEntry({ name: 'file', path: 'file', type: 'File', size: 0 }),
    ).rejects.toThrow('The operation failed (502)');
  });
  it('uploads multiple files as multipart data to the selected folder', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 201 }));
    vi.stubGlobal('fetch', fetch);
    const files = [new File(['hello'], 'hello.txt'), new File(['world'], 'world.txt')];
    await uploadFiles('notes & ideas', files);
    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe('/api/v2/upload?path=notes+%26+ideas');
    expect(options.method).toBe('POST');
    expect(options.headers).toBeUndefined();
    const uploaded = options.body.getAll('file') as File[];
    expect(uploaded.map((file) => file.name)).toEqual(['hello.txt', 'world.txt']);
    expect(await uploaded[0].text()).toBe('hello');
    expect(await uploaded[1].text()).toBe('world');
  });
  it('shows backend upload errors such as filename collisions', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'There exists a file with this name' }), {
          status: 400,
        }),
      ),
    );
    await expect(uploadFiles('', [new File(['hello'], 'hello.txt')])).rejects.toThrow(
      'There exists a file with this name',
    );
  });
  it('explains the upload limit even when the 413 response is not JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('too large', { status: 413 })));
    await expect(uploadFiles('', [new File(['hello'], 'hello.txt')])).rejects.toThrow('1 GiB');
  });
  it('handles non-JSON server upload failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('unavailable', { status: 502 })));
    await expect(uploadFiles('', [new File(['hello'], 'hello.txt')])).rejects.toThrow(
      'The upload failed (502)',
    );
  });
  it('encodes paths and forwards the React Query cancellation signal', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ entries: [] })));
    vi.stubGlobal('fetch', fetch);
    const controller = new AbortController();
    expect(await listFiles('notes & ideas', controller.signal)).toEqual([]);
    expect(fetch).toHaveBeenCalledWith('/api/v2/directory?path=notes+%26+ideas', {
      signal: controller.signal,
    });
  });
  it('uses v2 GET preview mode, preserves file bytes, and forwards cancellation', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response('hello filee', { headers: { 'Content-Type': 'text/plain' } }),
      );
    vi.stubGlobal('fetch', fetch);
    const controller = new AbortController();
    const blob = await getFileBlob('notes/hello & world.txt', controller.signal);
    expect(fetch).toHaveBeenCalledWith('/api/v2/download?path=notes%2Fhello+%26+world.txt&mode=p', {
      signal: controller.signal,
    });
    expect(await blob.text()).toBe('hello filee');
  });
  it('creates a native download URL without fetching bytes or corrupting special characters', () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const path = 'notes/résumé & ideas #1?.txt';
    const url = getDownloadUrl(path);
    expect(new URL(url, 'http://localhost').searchParams.get('path')).toBe(path);
    expect(new URL(url, 'http://localhost').pathname).toBe('/api/v2/download');
    expect(new URL(url, 'http://localhost').searchParams.get('mode')).toBe('d');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('provides a useful error when a saved location is no longer available', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 400 })));
    await expect(listFiles('missing')).rejects.toThrow('This location is no longer available');
  });
  it('streams media through the proxy without fetching the file into memory', () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const path = 'videos/résumé & ideas #1?.mp4';
    const url = new URL(getMediaUrl(path), 'http://localhost');
    expect(url.pathname).toBe('/api/v2/media');
    expect(url.searchParams.get('path')).toBe(path);
    expect(fetch).not.toHaveBeenCalled();
  });
});
