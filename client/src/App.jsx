import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';  
import axios from 'axios';
import SubtitleEditor from './components/SubtitleEditor';
import { SignedIn, SignedOut, SignIn, UserButton, useAuth } from "@clerk/clerk-react";
import gsap from 'gsap';

const API_URL = 'https://makeshort-backend.onrender.com';

function App() {
  const [videoFile, setVideoFile] = useState(null);
  const [inputType, setInputType] = useState('reddit'); 
  const [redditUrl, setRedditUrl] = useState('');
  const [scriptText, setScriptText] = useState('');

  const [step, setStep] = useState('idle'); 
  const [clips, setClips] = useState([]);
  const [activeClipIndex, setActiveClipIndex] = useState(0);
  const [finalVideoUrl, setFinalVideoUrl] = useState('');
  const [aspectRatio, setAspectRatio] = useState('9:16');
  const [processingMode, setProcessingMode] = useState('shorts'); 
  const [renderProgress, setRenderProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('Starting engine...');
  const { userId } = useAuth();

  useEffect(() => {
    const socket = io(API_URL, {
        transports: ['websocket', 'polling'],
        autoConnect: true,
        reconnectionAttempts: 5 
    });
    
    socket.on('connect', () => console.log('✅ Connected to Render WebSocket server!'));
    socket.on('render-progress', (data) => setRenderProgress(data.percent));
    socket.on('status-update', (data) => setStatusMessage(data.message));

    // 🟢 NEW: Listen for the final video from the backend
    socket.on('video-done', (data) => {
      console.log("🎉 Video received via socket!", data);
      setFinalVideoUrl(data.videoUrl || data.url);
      setStep('done');
    });

    return () => socket.disconnect();
  }, []);

  const handleGenerate = async () => {
    setStep('processing');
    try {
      if (inputType === 'video') {
        if (!videoFile) return alert("Please select a video file!");
        const formData = new FormData();
        formData.append('videoFile', videoFile); 
        
        setStatusMessage('Extracting viral clips... ✂️');
        const { data } = await axios.post(`${API_URL}/api/generate`, formData);
        
        setClips(data.clips);
        setStep('editing'); 

      } else if (inputType === 'reddit') {
        if (!redditUrl) return alert("Please paste a Reddit link!");
        setStatusMessage('Cooking your viral video... 🍳 (This takes about 1-2 minutes)');
        
        // 🟢 NEW: Just kick off the process. Do NOT wait for the final video URL here!
        await axios.post(`${API_URL}/api/generate-reddit`, {
          redditUrl: redditUrl,
          userId: userId 
        });

        // The socket listener 'video-done' will handle moving us to step 'done' when ready.

     } else if (inputType === 'text') {
        if (!scriptText) return alert("Please write a script!");
        setStatusMessage('Cooking your custom script... 🍳 (This takes about 1-2 minutes)');
        
        // 🟢 Send the actual request to your backend
        await axios.post(`${API_URL}/api/generate-text`, {
          script: scriptText,
          userId: userId 
        });

        // We DO NOT change the step to 'editing' here.
        // The socket listener 'video-done' will handle moving us to step 'done' when the backend is finished.
      }
      
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || "Error processing. Check console.");
      setStep('idle');
    }
  };

  const handleFullVideo = async () => {
    setStep('processing');
    try {
      if (!videoFile) return alert("Please select a video file!");
      const formData = new FormData();
      formData.append('videoFile', videoFile);
      setStatusMessage('Transcribing full video... 🗣️');
      const { data } = await axios.post(`${API_URL}/api/transcribe-only`, formData);
      setClips(data.clips);
      setStep('editing');
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || "Error processing full video.");
      setStep('idle');
    }
  };

  const handleRender = async (editedClip) => { 
    setStep('processing');
    setStatusMessage('Rendering final video with AI Captions... 🎬');
    try {
      // 🟢 NEW: Just tell the backend to start rendering.
      // Do NOT wait for the final video URL here! 
      // Ensure your backend sends io.emit('video-done', { videoUrl: ... }) when it finishes.
      await axios.post(`${API_URL}/api/render`, { clip: editedClip });
      
    } catch (err) {
      console.error(err);
      alert('Failed to start render. Check console.');
      setStep('editing');
    }
  };

  const handleStartOver = () => { 
    setStep('idle');
    setVideoFile(null);
    setRedditUrl('');
    setScriptText('');
    setClips([]);
    setFinalVideoUrl('');
    setRenderProgress(0); // Reset progress just in case
  };

  const mainContainerRef = useRef(null);
  useEffect(() => {
    if (!mainContainerRef.current) return;
    let ctx = gsap.context(() => {
      gsap.from(mainContainerRef.current, { y: 50, opacity: 0, duration: 1, ease: "power3.out" });
    });
    return () => ctx.revert(); 
  }, []);

  return (
    <div ref={mainContainerRef} className="min-h-screen bg-gray-950 text-white font-sans selection:bg-blue-500 selection:text-white relative">
      
      <div className="absolute top-6 right-6 z-50">
        <SignedIn>
          <UserButton afterSignOutUrl="/" />
        </SignedIn>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-12">
        
        {/* 🔒 LOGGED OUT STATE */}
        <SignedOut>
          <div className="text-center max-w-3xl mx-auto mb-12 mt-8 animate-fade-in">
            <div className="inline-block px-4 py-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-400 font-semibold text-sm mb-6">
              🚀 MakeShort v2.0 is Live
            </div>
            <h1 className="text-5xl md:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-emerald-400 to-cyan-400 mb-6 leading-tight">
              Turn any long video or text into viral Shorts.
            </h1>
            <p className="text-xl text-gray-400 mb-8 font-medium">
              The AI-powered engine for Faceless Channels. <br className="hidden md:block"/>
              <span className="text-gray-300">YouTube → Shorts | Reddit → TikTok | Blog → Reels</span>
            </p>
            
            <div className="flex flex-col md:flex-row justify-center items-center gap-12 mt-12">
              <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl shadow-2xl w-full max-w-sm transform -rotate-2 hover:rotate-0 transition duration-300">
                <SignIn routing="hash" />
              </div>
              
              <div className="hidden md:flex flex-col items-center">
                <div className="w-48 h-[340px] bg-black border-4 border-gray-800 rounded-2xl relative overflow-hidden shadow-2xl shadow-emerald-500/20">
                  <div className="absolute inset-0 bg-gradient-to-t from-gray-900 to-transparent z-10"></div>
                  <div className="absolute bottom-4 left-0 w-full text-center z-20 px-2">
                     <p className="text-white font-bold text-sm bg-black/60 inline-block px-2 py-1 rounded">"AITAH for leaving..."</p>
                  </div>
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-5xl">🎮</div>
                </div>
                <p className="text-gray-500 mt-4 text-sm font-semibold uppercase tracking-widest">Live Preview</p>
              </div>
            </div>
          </div>
        </SignedOut>

        {/* 🔓 LOGGED IN STATE */}
        <SignedIn>
          <header className="text-center mb-12">
            <h1 className="text-4xl font-extrabold text-white">Dashboard</h1>
            <p className="text-gray-400 mt-2">What are we turning viral today?</p>
          </header>

          {/* State 1: Idle Input */}
          {step === 'idle' && (
            <div className="max-w-2xl mx-auto space-y-6 bg-gray-900 p-8 rounded-2xl border border-gray-800 shadow-xl">
              
              {/* Input Type Tabs */}
              <div className="flex p-1 bg-gray-950 rounded-xl mb-6 border border-gray-800">
                <button 
                  onClick={() => setInputType('reddit')}
                  className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${inputType === 'reddit' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                >
                  🔥 Reddit Link
                </button>
                <button 
                  onClick={() => setInputType('text')}
                  className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${inputType === 'text' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                >
                  ✍️ Text Script
                </button>
                <button 
                  onClick={() => setInputType('video')}
                  className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${inputType === 'video' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                >
                  🎬 Video Upload
                </button>
              </div>

              {/* Dynamic Input Area */}
              <div className="min-h-[120px]">
                {inputType === 'reddit' && (
                  <div className="animate-fade-in">
                    <label className="block text-sm font-medium text-gray-400 mb-2">Paste Reddit Post URL</label>
                    <input 
                      type="text" 
                      placeholder="https://www.reddit.com/r/AITAH/comments/..."
                      value={redditUrl}
                      onChange={(e) => setRedditUrl(e.target.value)}
                      className="w-full bg-gray-950 border border-gray-700 rounded-xl p-4 text-white focus:outline-none focus:border-blue-500 transition"
                    />
                  </div>
                )}

                {inputType === 'text' && (
                  <div className="animate-fade-in">
                    <label className="block text-sm font-medium text-gray-400 mb-2">Write your script</label>
                    <textarea 
                      rows="4"
                      placeholder="Once upon a time..."
                      value={scriptText}
                      onChange={(e) => setScriptText(e.target.value)}
                      className="w-full bg-gray-950 border border-gray-700 rounded-xl p-4 text-white focus:outline-none focus:border-blue-500 transition resize-none custom-scrollbar"
                    />
                  </div>
                )}

                {inputType === 'video' && (
                  <div className="animate-fade-in">
                    <label className="block text-sm font-medium text-gray-400 mb-2">Upload Raw Video</label>
                    <input 
                      type="file"
                      accept="video/mp4,video/quicktime,video/*"
                      onChange={(e) => setVideoFile(e.target.files[0])}
                      className="block w-full text-sm text-gray-400 file:mr-4 file:py-3 file:px-6 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-gray-800 file:text-white hover:file:bg-gray-700 file:cursor-pointer bg-gray-950 border border-gray-700 rounded-xl p-2 cursor-pointer focus:outline-none focus:border-blue-500 transition"
                    />
                  </div>
                )}
              </div>

              {/* Format Options */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2 mt-2">Choose Format</label>
                <div className="flex gap-4">
                  <button 
                    onClick={() => setAspectRatio('9:16')}
                    className={`flex-1 py-3 rounded-xl font-bold transition-all border ${
                      aspectRatio === '9:16' 
                        ? 'bg-emerald-600 border-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)]' 
                        : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500'
                    }`}
                  >
                    📱 9:16 (Shorts)
                  </button>
                  <button 
                    onClick={() => setAspectRatio('16:9')}
                    className={`flex-1 py-3 rounded-xl font-bold transition-all border ${
                      aspectRatio === '16:9' 
                        ? 'bg-blue-600 border-blue-500 text-white shadow-[0_0_15px_rgba(37,99,235,0.3)]' 
                        : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500'
                    }`}
                  >
                    💻 16:9 (YouTube)
                  </button>
                </div>
              </div>

              {/* Goal Options */}
              {inputType === 'video' && (
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2 mt-4">Choose Goal</label>
                  <div className="flex gap-4">
                    <button 
                      onClick={() => setProcessingMode('shorts')}
                      className={`flex-1 py-3 rounded-xl font-bold transition-all border ${
                        processingMode === 'shorts' 
                          ? 'bg-purple-600 border-purple-500 text-white shadow-[0_0_15px_rgba(147,51,234,0.3)]' 
                          : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500'
                      }`}
                    >
                      ✂️ Find AI Hooks
                    </button>
                    <button 
                      onClick={() => setProcessingMode('full')}
                      className={`flex-1 py-3 rounded-xl font-bold transition-all border ${
                        processingMode === 'full' 
                          ? 'bg-orange-600 border-orange-500 text-white shadow-[0_0_15px_rgba(234,88,12,0.3)]' 
                          : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500'
                      }`}
                    >
                      🎬 Subtitle Full Video
                    </button>
                  </div>
                </div>
              )}

              {/* Master Action Button */}
              <div className="pt-4 border-t border-gray-800 mt-6">
                <button 
                  onClick={inputType === 'video' && processingMode === 'full' ? handleFullVideo : handleGenerate}
                  className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold text-lg transition-all transform hover:scale-[1.02] active:scale-95 shadow-lg shadow-emerald-600/20"
                >
                  Generate Viral Video 🚀
                </button>
              </div>
              
            </div>
          )}

          {/* State 2: Processing */}
          {step === 'processing' && (
            <div className="text-center py-20 animate-fade-in">
              <div className="w-24 h-24 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
              <h2 className="text-3xl font-bold text-white mb-4">{statusMessage}</h2>
              
              {/* 🟢 NEW: Progress Bar injected here */}
              {renderProgress > 0 && (
                <div className="max-w-md mx-auto w-full bg-gray-800 rounded-full h-4 mt-6 overflow-hidden border border-gray-700">
                  <div 
                    className="bg-gradient-to-r from-blue-500 to-emerald-500 h-4 rounded-full transition-all duration-300" 
                    style={{ width: `${renderProgress}%` }}
                  ></div>
                </div>
              )}
            </div>
          )}

          {/* State 3: Clip Selection */}
          {step === 'editing' && (
            <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-3xl font-extrabold text-white">✂️ Choose Your Viral Clip</h2>
                <button onClick={handleStartOver} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm font-bold transition">
                  Start Over
                </button>
              </div>

              {clips.length === 0 ? (
                 <div className="text-center py-12 bg-gray-900 rounded-xl border border-gray-800">
                    <p className="text-gray-400">No clips found. Try uploading a different video.</p>
                 </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {clips.map((clip, idx) => (
                    <div key={idx} className="bg-gray-900 border border-gray-800 p-6 rounded-xl hover:border-emerald-500 transition shadow-xl flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start mb-4">
                          <h3 className="text-xl font-bold text-white">Clip {idx + 1}</h3>
                          <span className="bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-xs font-bold border border-emerald-500/30">
                            High Potential
                          </span>
                        </div>
                        <p className="text-gray-400 text-sm mb-6 h-24 overflow-hidden relative italic">
                          "{clip.transcript || clip.text || 'No transcript generated...'}"
                          <span className="absolute bottom-0 left-0 w-full h-12 bg-gradient-to-t from-gray-900 to-transparent"></span>
                        </p>
                      </div>
                      
                      <div className="flex gap-3 mt-auto">
                        <button
                          onClick={() => {
                            setActiveClipIndex(idx);
                            setStep('editor'); 
                          }}
                          className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-bold text-sm transition"
                        >
                          ✏️ Edit text
                        </button>
                        <button
                          onClick={() => handleRender(clip)}
                          className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-sm transition"
                        >
                          🚀 Render
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* State 4: Subtitle Editor Wrapper */}
          {step === 'editor' && (
            <div className="max-w-4xl mx-auto bg-gray-900 p-6 rounded-xl border border-gray-800 animate-fade-in">
              <button 
                onClick={() => setStep('editing')} 
                className="text-gray-400 hover:text-white mb-6 flex items-center gap-2 font-bold"
              >
                ← Back to Clips
              </button>
              <SubtitleEditor 
                clip={clips[activeClipIndex]} 
                onRender={handleRender} 
              />
            </div>
          )}

          {/* State 5: Finished Video */}
          {step === 'done' && (
            <div className="max-w-xl mx-auto bg-gray-900 p-8 rounded-2xl border border-gray-800 shadow-xl text-center animate-fade-in">
              <h2 className="text-3xl font-extrabold text-white mb-2">🎉 Video Ready!</h2>
              <p className="text-gray-400 mb-6">Your viral short is cooked. Download it before it expires in 10 mins.</p>
              
              <div className="relative w-64 mx-auto rounded-xl overflow-hidden shadow-2xl shadow-emerald-500/20 border-4 border-gray-800 mb-8">
                <video 
                  src={finalVideoUrl} 
                  controls 
                  autoPlay 
                  loop 
                  className="w-full h-auto"
                />
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={handleStartOver}
                  className="flex-1 py-4 bg-gray-800 hover:bg-gray-700 rounded-xl font-bold text-lg transition-all"
                >
                  Start Over
                </button>

                <a 
                  href={finalVideoUrl} 
                  download="MakeShort_Viral.mp4"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold text-lg transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2"
                >
                  ⬇️ Download
                </a>
              </div>
            </div>
          )}
          
        </SignedIn>
      </div>
    </div>
  );
}

export default App;