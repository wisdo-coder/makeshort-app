import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

// 🟢 STRICTLY pointing to your live Render backend
const API_URL = 'https://makeshort-backend.onrender.com';

const ProgressBar = () => {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('Initializing rendering engine...');

  useEffect(() => {
    // 🟢 Connect ONLY when the component actually mounts!
    const socket = io(API_URL, {
        transports: ['websocket', 'polling']
    });

    // Listen for progress updates from FFmpeg
    socket.on('render-progress', (data) => {
      setProgress(data.percent);
      setStatus('Encoding frames & burning subtitles...');
    });

    // Listen for completion or error status
    socket.on('render-status', (msg) => {
      setStatus(msg);
      if (msg === 'Complete!') setProgress(100);
    });

    socket.on('render-error', (err) => {
      setStatus(`Error: ${err}`);
    });

    // Cleanup the listener when the component unmounts
    return () => {
      socket.disconnect(); // Properly kill the connection
    };
  }, []);

  return (
    <div className="w-full max-w-xl mx-auto mt-6 bg-gray-950 p-6 rounded-xl border border-gray-800">
      <div className="flex justify-between mb-3">
        <span className="text-sm font-medium text-blue-400 animate-pulse">{status}</span>
        <span className="text-sm font-bold text-emerald-400">{progress}%</span>
      </div>
      
      {/* The Progress Track */}
      <div className="w-full bg-gray-800 rounded-full h-5 overflow-hidden shadow-inner">
        {/* The Progress Fill */}
        <div 
          className="bg-gradient-to-r from-blue-600 to-emerald-500 h-5 rounded-full transition-all duration-300 ease-out relative"
          style={{ width: `${progress}%` }}
        >
          {/* A cool little shine effect on the progress bar */}
          <div className="absolute top-0 left-0 right-0 bottom-0 bg-white/20 blur-sm w-full"></div>
        </div>
      </div>
      
      <p className="text-xs text-gray-500 mt-4 italic">
        Pro tip: Shorter clips render exponentially faster.
      </p>
    </div>
  );
};

export default ProgressBar;