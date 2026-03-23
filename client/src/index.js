import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// If you haven't set up Tailwind's CSS file yet, 
// you might need to comment out the line below for now!
// import './index.css'; 

const container = document.getElementById('root');
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);