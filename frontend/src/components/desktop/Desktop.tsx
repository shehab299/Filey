import { useCallback, useEffect, useState } from 'react';
import {
  CircleHelp,
  FolderClosed,
  Grid2X2,
  HardDrive,
  Maximize2,
  Minus,
  Volume2,
  Wifi,
  X,
} from 'lucide-react';
import { FileManager } from '../files/FileManager';
import { Modal } from '../common/Modal';
import './Desktop.css';

export function Desktop() {
  const [time, setTime] = useState(new Date());
  const [windowState, setWindowState] = useState<'open' | 'minimized' | 'closed'>('open');
  const [maximized, setMaximized] = useState(false);
  const [help, setHelp] = useState(false);
  const closeHelp = useCallback(() => setHelp(false), []);
  useEffect(() => {
    const timer = window.setInterval(() => setTime(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="desktop">
      <header className="desktop-panel">
        <button className="panel-brand" onClick={() => setWindowState('open')}>
          <Grid2X2 size={15} /> filee <span>desktop</span>
        </button>
        <time dateTime={time.toISOString()}>
          {time.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
          <span className="panel-time">
            {time.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
          </span>
        </time>
        <div className="system-tray">
          <Wifi size={15} />
          <Volume2 size={15} />
          <span className="session-dot" />
          <span>Local session</span>
        </div>
      </header>

      <div className="wallpaper-art" aria-hidden="true">
        <div className="orbit orbit-one" />
        <div className="orbit orbit-two" />
        <div className="orbit orbit-three" />
      </div>
      {windowState !== 'open' && (
        <div className="desktop-label">
          <span>YOUR OWN LITTLE CORNER</span>
          <h1>
            Everything.
            <br />
            Right at home.
          </h1>
          <p>A little space for your big ideas.</p>
        </div>
      )}

      <button className="desktop-shortcut" onClick={() => setWindowState('open')}>
        <span>
          <HardDrive size={30} strokeWidth={1.3} />
        </span>
        My files
      </button>

      {windowState === 'open' && (
        <main
          className={`app-window ${maximized ? 'app-window--maximized' : ''}`}
          aria-label="File manager"
        >
          <div className="window-titlebar">
            <div className="window-title">
              <FolderClosed size={16} />
              <strong>Files</strong>
              <span>—</span>
              <span>Filee</span>
            </div>
            <div className="window-controls">
              <button
                aria-label="Minimize window"
                title="Minimize"
                onClick={() => setWindowState('minimized')}
              >
                <Minus size={14} />
              </button>
              <button
                aria-label={maximized ? 'Restore window' : 'Maximize window'}
                title="Resize window"
                onClick={() => setMaximized(!maximized)}
              >
                <Maximize2 size={12} />
              </button>
              <button
                className="window-close"
                aria-label="Close window"
                title="Close"
                onClick={() => setWindowState('closed')}
              >
                <X size={14} />
              </button>
            </div>
          </div>
          <FileManager />
        </main>
      )}

      <footer className="desktop-bottom">
        <span>
          <span className="session-dot" /> A space that feels like you.
        </span>
        <span>
          Filee OS <span className="desktop-version">/ 01</span>
        </span>
      </footer>
      <nav className="dock" aria-label="Desktop applications">
        <button
          title="Open Files"
          aria-label="Open Files"
          className={windowState === 'open' ? 'dock-active' : ''}
          onClick={() => setWindowState('open')}
        >
          <FolderClosed size={27} />
          <span className="dock-tooltip">Files</span>
        </button>
        <span className="dock-divider" />
        <button title="Getting started" aria-label="Getting started" onClick={() => setHelp(true)}>
          <CircleHelp size={25} />
          <span className="dock-tooltip">Getting started</span>
        </button>
      </nav>

      {help && (
        <Modal title="Getting started" onClose={closeHelp} className="help-dialog">
          <div className="help-card">
            <span className="eyebrow">MAKE YOURSELF AT HOME</span>
            <h2 id="help-title">A familiar place for your files.</h2>
            <p>
              Click a file or folder to see its actions. Double-click a folder to explore it, or a
              file to preview it.
            </p>
            <ul>
              <li>
                <strong>Download</strong> saves a file to your device.
              </li>
              <li>
                <strong>Favorites</strong> keeps the things you love one click away.
              </li>
              <li>
                <strong>Search</strong> finds items in the current folder.
              </li>
              <li>
                <strong>Back and forward</strong> retrace your steps.
              </li>
            </ul>
            <button className="primary-button" onClick={() => setHelp(false)}>
              Got it, let's explore
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
