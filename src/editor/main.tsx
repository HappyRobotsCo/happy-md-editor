import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { PerfLogger } from '../shared/logger';
import '../styles/light.css';
import '../styles/dark.css';
import '../styles/editor.css';
import '../styles/toolbar.css';

// Apply theme synchronously before render to avoid flash of wrong theme
import { detectOSTheme, applyTheme } from './theme-service';
applyTheme(detectOSTheme());

PerfLogger.start('extension:init');

const root = document.getElementById('root');
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

PerfLogger.end('extension:init');
PerfLogger.summary();
