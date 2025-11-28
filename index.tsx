import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  // StrictMode can sometimes cause double-initialization issues with complex webcam/canvas logic in dev,
  // but we'll keep it for best practices. The App logic uses refs to handle single-instantiation of models.
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
