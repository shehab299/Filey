import { useCallback, useState } from 'react';
import { useCreateDirectory, useDeleteEntry } from '../../features/files/hooks';
import type { FileEntry } from '../../features/files/types';
import { Modal } from '../common/Modal';
import './FileDialog.css';
import './FileActionDialog.css';

export type FileAction = { type: 'create'; path: string } | { type: 'delete'; entry: FileEntry };

export function FileActionDialog({
  action,
  onClose,
  onSuccess,
}: {
  action: FileAction;
  onClose: () => void;
  onSuccess: (message: string) => void;
}) {
  const create = useCreateDirectory();
  const remove = useDeleteEntry();
  const [name, setName] = useState('');
  const mutation = action.type === 'create' ? create : remove;
  const close = useCallback(() => {
    if (!mutation.isPending) onClose();
  }, [mutation.isPending, onClose]);
  const validName = name.length > 0 && name !== '.' && name !== '..' && !/[/\\\0]/.test(name);

  return (
    <Modal
      title={action.type === 'create' ? 'New folder' : `Delete ${action.entry.name}?`}
      onClose={close}
      className="file-action-dialog"
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (mutation.isPending) return;
          if (action.type === 'create') {
            if (!validName) return;
            create.mutate(
              { path: action.path, name },
              { onSuccess: () => onSuccess(`Created folder ${name}.`) },
            );
          } else {
            remove.mutate(action.entry, {
              onSuccess: () => onSuccess(`Deleted ${action.entry.name}.`),
            });
          }
        }}
      >
        <div className="file-action-content">
          {action.type === 'create' ? (
            <label>
              Folder name
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={mutation.isPending}
                required
                aria-describedby="folder-name-help"
              />
              <small id="folder-name-help">Use a name without slashes, other than . or ..</small>
            </label>
          ) : (
            <p>
              Permanently delete “{action.entry.name}”
              {action.entry.type === 'Folder' ? ' and everything inside it' : ''}? This cannot be
              undone.
            </p>
          )}
          {mutation.isError && (
            <p role="alert">
              {mutation.error.message === 'Failed to fetch'
                ? 'Check your connection and try again.'
                : mutation.error.message}
            </p>
          )}
        </div>
        <footer className="dialog-footer">
          <button type="button" onClick={close} disabled={mutation.isPending}>
            Cancel
          </button>
          <button
            className="primary-button"
            type="submit"
            disabled={mutation.isPending || (action.type === 'create' && !validName)}
          >
            {mutation.isPending
              ? 'Working…'
              : action.type === 'create'
                ? 'Create folder'
                : 'Delete permanently'}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
