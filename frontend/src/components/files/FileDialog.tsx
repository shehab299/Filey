import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, FileQuestion, LoaderCircle } from 'lucide-react';
import { getDownloadUrl, getFileBlob, getMediaUrl } from '../../features/files/api';
import type { FileEntry } from '../../features/files/types';
import { fileKind, formatSize } from '../../features/files/utils';
import { Modal } from '../common/Modal';
import { FileIcon } from './FileIcon';
import './FileDialog.css';

interface Props {
  entry: FileEntry;
  mode: 'preview' | 'info';
  onClose: () => void;
  onDownload: () => void;
}

export function FileDialog({ entry, mode, onClose, onDownload }: Props) {
  // Avoid fetching unsupported previews or unexpectedly loading very large files.
  const kind = fileKind(entry);
  const isMedia = kind === 'Audio' || kind === 'Video';
  const isText = kind === 'Code' || /\.(txt|md|csv|log)$/i.test(entry.name);
  const previewable =
    entry.type === 'File' &&
    (isMedia || ((isText || ['Image', 'PDF'].includes(kind)) && entry.size <= 25 * 1024 * 1024));
  const query = useQuery({
    queryKey: ['preview', entry.path],
    queryFn: ({ signal }) => getFileBlob(entry.path, signal),
    enabled: mode === 'preview' && previewable && !isMedia,
    gcTime: 0,
  });
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [mediaError, setMediaError] = useState(false);
  const [mediaAttempt, setMediaAttempt] = useState(0);
  useEffect(() => {
    if (!query.data) return;
    const objectUrl = URL.createObjectURL(query.data);
    setUrl(objectUrl);
    let active = true;
    if (isText)
      void query.data
        .slice(0, 1024 * 1024)
        .text()
        .then((value) => {
          if (active) setText(value);
        });
    return () => {
      active = false;
      URL.revokeObjectURL(objectUrl);
    };
  }, [query.data, isText]);

  return (
    <Modal title={entry.name} onClose={onClose}>
      {mode === 'info' ? (
        <div className="file-information">
          <FileIcon entry={entry} />
          <h3>{entry.name}</h3>
          <dl>
            <div>
              <dt>Type</dt>
              <dd>{fileKind(entry)}</dd>
            </div>
            <div>
              <dt>Location</dt>
              <dd>Home/{entry.path}</dd>
            </div>
            {entry.type === 'File' && (
              <div>
                <dt>Size</dt>
                <dd>
                  {formatSize(entry.size)} <span>({entry.size.toLocaleString()} bytes)</span>
                </dd>
              </div>
            )}
          </dl>
        </div>
      ) : (
        <div className="preview-content">
          {!previewable ? (
            <div className="preview-unavailable">
              <FileQuestion size={40} strokeWidth={1} />
              <h3>
                {entry.size > 25 * 1024 * 1024
                  ? 'This file is a little big to preview.'
                  : 'No preview for this file, yet.'}
              </h3>
              <p>Download it to open it with your favorite app.</p>
            </div>
          ) : isMedia ? (
            mediaError ? (
              <div className="preview-unavailable" role="alert">
                <h3>This media could not be played.</h3>
                <p>
                  Check your connection, or download the file if its format is not supported by your
                  browser.
                </p>
                <button
                  className="primary-button"
                  onClick={() => {
                    setMediaError(false);
                    setMediaAttempt((attempt) => attempt + 1);
                  }}
                >
                  Try again
                </button>
              </div>
            ) : kind === 'Video' ? (
              <video
                key={mediaAttempt}
                controls
                playsInline
                preload="metadata"
                src={getMediaUrl(entry.path)}
                aria-label={entry.name}
                onError={() => setMediaError(true)}
              />
            ) : (
              <audio
                key={mediaAttempt}
                controls
                preload="metadata"
                src={getMediaUrl(entry.path)}
                aria-label={entry.name}
                onError={() => setMediaError(true)}
              />
            )
          ) : query.isPending ? (
            <div className="preview-unavailable">
              <LoaderCircle className="spinning" size={25} />
              <p>Opening your file…</p>
            </div>
          ) : query.isError ? (
            <div className="preview-unavailable">
              <p>{query.error.message}</p>
              <button className="primary-button" onClick={() => void query.refetch()}>
                Try again
              </button>
            </div>
          ) : isText ? (
            <>
              <pre>{text}</pre>
              {entry.size > 1024 * 1024 && (
                <p className="preview-note">Showing the first 1 MB. Download for the full file.</p>
              )}
            </>
          ) : url && kind === 'Image' ? (
            <img src={url} alt={entry.name} />
          ) : url && kind === 'PDF' ? (
            <iframe src={url} title={`Preview of ${entry.name}`} />
          ) : null}
        </div>
      )}
      <footer className="dialog-footer">
        <span>
          {fileKind(entry)}
          {entry.type === 'File' && ` · ${formatSize(entry.size)}`}
        </span>
        {entry.type === 'File' && (
          <a
            className="primary-button"
            href={getDownloadUrl(entry.path)}
            download={entry.name}
            onClick={onDownload}
          >
            <Download size={14} />
            Download file
          </a>
        )}
      </footer>
    </Modal>
  );
}
