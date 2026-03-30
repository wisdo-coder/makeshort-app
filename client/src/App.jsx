import { io } from 'socket.io-client';  
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import SubtitleEditor from './components/SubtitleEditor';
import ProgressBar from './components/ProgressBar';
import gsap from 'gsap';

// 🪄 THE MAGIC FIX: Automatically detects your device's IP or localhost!
const API_URL = `http://${window.location.hostname}:5000`;

function App() {
  const [url, setUrl] = useState('');
  const [step, setStep] = useState('idle'); 
  const [clips, setClips] = useState([]);
  const [activeClipIndex, setActiveClipIndex] = useState(0);
  const [finalVideoUrl, setFinalVideoUrl] = useState('');
  
  // 2. Add this new state for the progress bar!
  const [renderProgress, setRenderProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('Starting engine...');

  // 3. Add this exact useEffect to listen to the backend
  useEffect(() => {
    const socket = io(API_URL);
    
    socket.on('render-progress', (data) => {
      setRenderProgress(data.percent);
    });
    
    // Listen for the live FFmpeg rendering percentage
  socket.on('status-update', (data) => {
      setStatusMessage(data.message);
    });

    return () => socket.disconnect();
  }, []);

  // Step 1: Send URL to Backend for AI Analysis
  const handleGenerate = async () => {
    if (!url) return alert("Please enter a YouTube URL");
    
    setStep('processing');
    try {
      const { data } = await axios.post(`${API_URL}/api/generate`, { videoUrl: url });
      setClips(data.clips);
      setStep('editing'); // Move to the subtitle editor
    } catch (err) {
      console.error(err);
      alert("Error processing video. Check console.");
      setStep('idle');
    }
  };

  // Step 2: Send edited clip back to FFmpeg for Rendering
  const handleRender = async (editedClip) => {
    setStep('rendering');
    try {
      const { data } = await axios.post(`${API_URL}/api/render`, { clip: editedClip });
      setFinalVideoUrl(data.url);
      setStep('results');
    } catch (err) {
      console.error(err);
      alert("Error rendering video.");
      setStep('editing');
    }
  };

  const handleStartOver = async () => {
    try {
      // Tell backend to delete files
      await axios.post(`${API_URL}/api/cleanup`);
    } catch (err) {
      console.error("Cleanup failed", err);
    }
    // Reset the frontend
    setUrl('');
    setClips([]);
    setFinalVideoUrl('');
    setStep('idle');
  };

  // 1. Create a reference for the main container
  const mainContainerRef = useRef(null);

  // 2. Trigger the GSAP animation when the app loads

  useEffect(() => {
    if (!mainContainerRef.current) return;

    // Wrap the animation in a context
    let ctx = gsap.context(() => {
      gsap.from(mainContainerRef.current, {
        y: 50,
        opacity: 0,
        duration: 1,
        ease: "power3.out"
      });
    });

    // THIS is the magic line that fixes the dark screen bug
    return () => ctx.revert(); 
    
  }, []);

  return (
    // 👇 THIS IS WHERE IT GOES! The ref is attached to this outermost div
    <div ref={mainContainerRef} className="min-h-screen bg-gray-950 text-white font-sans selection:bg-blue-500 selection:text-white">
      <div className="max-w-5xl mx-auto px-6 py-12">
        
        {/* Header */}
        <header className="text-center mb-16">
          <h1 className="text-5xl font-extrabold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
            MakeShort MVP
          </h1>
          <p className="text-gray-400 mt-4 text-lg">Turn long-form YouTube videos into viral Shorts in 1-click.</p>
        </header>

        {/* State 1: Idle Input */}
        {step === 'idle' && (
          <div className="max-w-2xl mx-auto space-y-6 bg-gray-900 p-8 rounded-2xl border border-gray-800 shadow-xl">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">YouTube URL</label>
              <input 
                className="w-full p-4 rounded-xl bg-gray-950 border border-gray-700 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                placeholder="https://www.youtube.com/watch?v=..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
            <button 
              onClick={handleGenerate}
              className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold text-lg transition-all transform hover:scale-[1.02] active:scale-95 shadow-lg shadow-blue-600/20"
            >
              Generate AI Shorts 🚀
            </button>
          </div>
        )}

        {/* State 2: Processing AI */}
        {step === 'processing' && (
          <div className="text-center py-20 animate-pulse">
            <div className="inline-block w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-6"></div>
            <h2 className="text-2xl font-bold text-gray-100 mb-4">AI is analyzing the video...</h2>
            
            {/* 🔴 LIVE STATUS MESSAGE HERE */}
            <div className="bg-gray-800/50 inline-block px-6 py-3 rounded-full border border-gray-700">
              <p className="text-blue-400 font-semibold animate-bounce">{statusMessage}</p>
            </div>
          </div>
        )}

        {/* State 3: Editor */}
        {step === 'editing' && clips.length > 0 && (
          <div className="space-y-8">
            <h2 className="text-2xl font-bold text-gray-100">AI Found {clips.length} Viral Hooks 🔥</h2>
            <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
              {clips.map((clip, idx) => (
                <button 
                  key={clip.id}
                  onClick={() => setActiveClipIndex(idx)}
                  className={`flex-shrink-0 p-5 rounded-2xl border text-left w-80 transition relative overflow-hidden ${
                    activeClipIndex === idx ? 'bg-blue-900/40 border-blue-500 shadow-lg shadow-blue-500/20' : 'bg-gray-900 border-gray-700 hover:border-gray-500'
                  }`}
                >
                  {/* Virality Score Badge */}
                  <div className="absolute top-4 right-4 bg-gray-950 border border-gray-800 px-3 py-1 rounded-full flex items-center gap-2 shadow-inner">
                    <span className="text-xs text-gray-400">Score</span>
                    <span className={`text-sm font-black ${clip.viralityScore >= 90 ? 'text-emerald-400' : 'text-yellow-400'}`}>
                      {clip.viralityScore}/100
                    </span>
                  </div>

                  {/* Clip Title and Reason */}
                  <h3 className="font-extrabold text-lg text-gray-100 mt-8 mb-2 leading-tight">
                    "{clip.title}"
                  </h3>
                  <p className="text-sm text-gray-400 line-clamp-3">
                    {clip.reason}
                  </p>
                </button>
              ))}
            </div>
            
            {/* The Subtitle Editor Component */}
            < SubtitleEditor 
              clip={clips[activeClipIndex]} 
              onRender={handleRender} 
            /> 
          </div>
        )}

        {/* State 4: FFmpeg Rendering */}
        {step === 'rendering' && (
           <div className="text-center py-20 bg-gray-900 rounded-2xl border border-gray-800 max-w-2xl mx-auto shadow-2xl">
             <div className="inline-block w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-6"></div>
             <h2 className="text-2xl font-bold text-gray-100 mb-2">Burning Subtitles & Cropping...</h2>
             <p className="text-gray-400 mb-8">Slicing your masterpiece in real-time.</p>
             
             {/* THE LIVE PROGRESS BAR */}
             <div className="w-full max-w-md mx-auto bg-gray-800 rounded-full h-6 border border-gray-700 overflow-hidden relative">
               <div 
                 className="bg-gradient-to-r from-emerald-500 to-cyan-500 h-6 transition-all duration-300 ease-out flex items-center justify-end pr-2"
                 style={{ width: `${renderProgress}%` }}
               >
                 <span className="text-xs font-black text-white drop-shadow-md">{renderProgress}%</span>
               </div>
             </div>
           </div>
        )}

        {/* State 5: Final Render Complete (Results) */}
        {step === 'results' && (
          <div className="max-w-4xl mx-auto bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-2xl mt-8">
            <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-500 mb-6 text-center">
              Your Viral Short is Ready! 🚀
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Left Column: The Video Player & Download Buttons */}
              <div className="flex flex-col items-center">
                
                {/* 🔴 FIXED VIDEO SRC: Just the raw finalVideoUrl */}
               <video 
                  src={`${API_URL}${finalVideoUrl}`} 
                  controls 
                  className="rounded-xl shadow-lg border border-gray-700 w-full max-w-sm aspect-[9/16] object-cover bg-black"
                />
                
                {/* 🔴 FIXED DOWNLOAD LINK */}
                <a 
                  href={`${API_URL}/api/download/${finalVideoUrl.split('/').pop()}`}
                  className="mt-6 w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-center transition shadow-[0_0_15px_rgba(37,99,235,0.4)] flex justify-center items-center gap-2"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                  Download MP4
                </a>

                {/* 🔴 NEW: CLEAN UP & START OVER BUTTON */}
                <button 
                  onClick={handleStartOver}
                  className="mt-4 w-full py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold rounded-xl text-center transition border border-gray-700 flex justify-center items-center gap-2"
                >
                  🗑️ Clean Up & Start Over
                </button>

              </div>

              {/* Right Column: The AI Caption Box */}
              <div className="flex flex-col h-full">
                <h3 className="text-xl font-bold text-gray-100 mb-3 flex items-center gap-2">
                  📝 Viral Caption
                </h3>
                <div className="bg-gray-950 border border-gray-800 rounded-xl p-5 flex-grow relative group shadow-inner">
                  <p className="text-gray-300 whitespace-pre-wrap font-medium text-sm leading-relaxed">
                    {clips[activeClipIndex]?.socialCaption}
                  </p>
                  
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(clips[activeClipIndex]?.socialCaption);
                      alert("Caption copied to clipboard! 📋");
                    }}
                    className="absolute top-3 right-3 bg-gray-800 hover:bg-gray-700 text-gray-200 px-4 py-2 rounded-lg text-sm font-semibold transition border border-gray-600 opacity-0 group-hover:opacity-100 focus:opacity-100 shadow-md"
                  >
                    Copy
                  </button>
                </div>
                <p className="text-gray-600 text-xs mt-4 text-center font-semibold tracking-wide uppercase">
                  Caption generated by Llama 3.1 ⚡️
                </p>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default App;