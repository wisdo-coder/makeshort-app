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
  const [selectedClip, setSelectedClip] = useState(null);
  const [finalVideoUrl, setFinalVideoUrl] = useState('');
  const [aspectRatio, setAspectRatio] = useState('9:16');
  const [processingMode, setProcessingMode] = useState('shorts'); 
  const [renderProgress, setRenderProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('Starting engine...');
  const { userId } = useAuth();

 useEffect(() => {
    socketRef.current = io(API_URL, {
        transports: ['websocket', 'polling'],
        autoConnect: true,
        reconnectionAttempts: 5 
    });
    
    socketRef.current.on('connect', () => {
      console.log('✅ Connected to Render WebSocket server! ID:', socketRef.current.id);
    });
    socketRef.current.on('render-progress', (data) => setRenderProgress(data.percent));
    socketRef.current.on('status-update', (data) => setStatusMessage(data.message));

    socketRef.current.on('video-done', (data) => {
      console.log("🎉 Video received via socket!", data);
      setFinalVideoUrl(data.videoUrl || data.url);
      setStep('done');
    });

    return () => socketRef.current.disconnect();
  }, []);

  const handleGenerate = async () => {
    setStep('processing');
    try {
      if (inputType === 'video') {
        if (!videoFile) return alert("Please select a video file!");
        const formData = new FormData();
        formData.append('videoFile', videoFile); 
        formData.append('socketId', socketRef.current.id);
        
        setStatusMessage('Extracting viral clips... ✂️');
        const { data } = await axios.post(`${API_URL}/api/generate`, formData);
        
        setClips(data.clips);
        setStep('editing'); 

      } else if (inputType === 'reddit') {
        if (!redditUrl) return alert("Please paste a Reddit link!");
        setStatusMessage('Cooking your viral video... 🍳 (This takes about 1-2 minutes)');
        
       await axios.post(`${API_URL}/api/generate-reddit`, {
  redditUrl: redditUrl,
  userId: userId,
  socketId: socketRef.current.id // 🟢 ADD THIS
});

      } else if (inputType === 'text') {
        if (!scriptText) return alert("Please write a script!");
        setStatusMessage('Cooking your custom script... 🍳 (This takes about 1-2 minutes)');
        
        await axios.post(`${API_URL}/api/generate-text`, {
          script: scriptText,
          userId: userId 
        });
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
    setSelectedClip(editedClip); 
    setStep('processing');
    setStatusMessage('Rendering final video with AI Captions... 🎬');
    try {
      // 🟢 FIXED: We are now passing the aspectRatio to the backend!
     await axios.post(`${API_URL}/api/render`, { 
  clip: editedClip, 
  aspectRatio: aspectRatio,
  socketId: socketRef.current.id // 🟢 ADD THIS
});

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
    setSelectedClip(null);
    setFinalVideoUrl('');
    setRenderProgress(0); 
  };

  const mainContainerRef = useRef(null);
  const videoRef = useRef(null);
  const socketRef = useRef(null);
  useEffect(() => {
    if (!mainContainerRef.current) return;
    let ctx = gsap.context(() => {
      gsap.from(mainContainerRef.current, { y: 50, opacity: 0, duration: 1, ease: "power3.out" });
    });
    return () => ctx.revert(); 
  }, []);

  // 2. 🟢 ADD THIS NEW ONE RIGHT BELOW IT:
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.defaultMuted = true;
      videoRef.current.muted = true;
      
      videoRef.current.play().catch(err => {
        console.error("Autoplay still blocked:", err);
      });
    }
  }, []);

  return (
    <div ref={mainContainerRef} className="min-h-screen bg-gray-950 text-white font-sans selection:bg-blue-500 selection:text-white relative">
      
      {/* 🔒 LOGGED OUT STATE: The New Split-Screen Mobile-Optimized Login */}
      <SignedOut>
        <div className="flex min-h-screen w-full">
          {/* 🌟 LEFT SIDE: App Preview (Hidden on Mobile) */}
          <div className="hidden lg:flex lg:w-1/2 bg-gray-900 relative items-center justify-center border-r border-gray-800 p-8 flex-col overflow-hidden">
            {/* Background Glows */}
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600 rounded-full mix-blend-multiply filter blur-[128px] opacity-20"></div>
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-600 rounded-full mix-blend-multiply filter blur-[128px] opacity-20"></div>

            <div className="relative z-20 text-center max-w-lg">
              <div className="inline-block px-4 py-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-400 font-semibold text-sm mb-6">
                🚀 MakeShort v2.0 is Live
              </div>
              <h2 className="text-4xl lg:text-5xl font-extrabold mb-6 tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-emerald-400 to-cyan-400 leading-tight">
                Turn long videos into viral Shorts in 1-Click.
              </h2>
              <p className="text-gray-400 mb-10 text-lg">
                The AI-powered engine for Faceless Channels. Join thousands of creators automating their content.
              </p>
              
              {/* Phone Mockup for Video Preview */}
              <div className="w-[260px] h-[520px] bg-black rounded-[2.5rem] border-[8px] border-gray-800 shadow-2xl overflow-hidden mx-auto relative shadow-emerald-500/20">
                {/* Notch */}
                <div className="absolute top-0 inset-x-0 h-6 bg-gray-800 rounded-b-3xl w-1/2 mx-auto z-30"></div>
                
                {/* 🟢 Drop your best generated video here! */}
                <video 
  ref={videoRef}
  src="/assets/preview-clip.mp4" 
  autoPlay 
  loop 
  muted 
  defaultMuted 
  playsInline
  className="w-full h-full object-cover z-10 relative opacity-80"
/>
                <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent z-20"></div>
                <div className="absolute bottom-6 left-0 w-full text-center z-30 px-2">
                    <p className="text-white font-bold text-sm bg-black/60 inline-block px-3 py-1 rounded-lg backdrop-blur-sm">"AITAH for leaving..."</p>
                </div>
              </div>
            </div>
          </div>

          {/* 🔐 RIGHT SIDE: Clerk Login Form */}
          <div className="flex w-full lg:w-1/2 flex-col justify-center items-center p-4 sm:p-12 relative z-10">
            {/* Show simple header on mobile only, since left side is hidden */}
            <div className="lg:hidden text-center mb-8">
              <div className="inline-block px-3 py-1 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-400 font-semibold text-xs mb-4">
                🚀 MakeShort v2.0
              </div>
              <h1 className="text-3xl font-black text-white mb-2">Welcome Back</h1>
              <p className="text-gray-400 text-sm">Sign in to start creating viral content.</p>
            </div>

            <div className="w-full max-w-md flex justify-center transform transition duration-300 hover:scale-[1.01]">
              <SignIn routing="hash" />
            </div>
          </div>
        </div>
      </SignedOut>

      {/* 🔓 LOGGED IN STATE: The Mobile-Optimized Dashboard */}
      <SignedIn>
        {/* User Button fixed to top right */}
        <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-50">
          <UserButton afterSignOutUrl="/" />
        </div>

<div className="bg-amber-500/10 border border-amber-500/30 text-amber-200 p-4 rounded-xl mb-8 flex flex-col sm:flex-row items-start sm:items-center gap-4">
  <span className="text-3xl">⚠️</span>
  <div className="text-sm">
    <h4 className="font-bold text-amber-400 text-base mb-1">Beta Testing Mode</h4>
    <p>
      We are currently running on testing servers. <strong>Renders might take a few minutes</strong>, so grab a coffee while the AI works! <br/>
      <em>Note: To prevent server timeouts, please keep your input videos <strong>under 10 minutes</strong>.</em>
    </p>
  </div>
</div>

        {/* Adjusted padding for mobile (px-4 py-8) */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 mt-12 sm:mt-0">
          
          <header className="text-center mb-8 sm:mb-12">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white">Dashboard</h1>
            <p className="text-sm sm:text-base text-gray-400 mt-2">What are we turning viral today?</p>
          </header>

          {/* State 1: Idle Input */}
          {step === 'idle' && (
            <div className="max-w-2xl mx-auto space-y-6 bg-gray-900 p-5 sm:p-8 rounded-2xl border border-gray-800 shadow-xl">
              
              {/* Input Type Tabs - Now wrap nicely on mobile */}
<div className="flex flex-col sm:flex-row p-1 bg-gray-950 rounded-xl mb-6 border border-gray-800 gap-1 sm:gap-0">
  <button 
    onClick={() => setInputType('reddit')}
    className={`flex-1 py-2 sm:py-3 rounded-lg text-sm font-bold transition ${inputType === 'reddit' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white hover:bg-gray-800/50'}`}
  >
    🔥 Reddit Link
  </button>
  <button 
    onClick={() => setInputType('text')}
    className={`flex-1 py-2 sm:py-3 rounded-lg text-sm font-bold transition ${inputType === 'text' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white hover:bg-gray-800/50'}`}
  >
    ✍️ Text Script
  </button>
  <button 
    onClick={() => setInputType('video')}
    className={`flex-1 py-2 sm:py-3 rounded-lg text-sm font-bold transition ${inputType === 'video' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white hover:bg-gray-800/50'}`}
  >
    🎬 Video Upload
  </button>
</div>

{/* 🟢 DROP IT RIGHT HERE: */}
{inputType === 'video' && (
  <p className="text-xs text-gray-400 -mt-4 mb-6 ml-1">
    💡 Beta limit: Videos must be under 10 minutes long.
  </p>
)}

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
                      className="w-full bg-gray-950 border border-gray-700 rounded-xl p-3 sm:p-4 text-sm sm:text-base text-white focus:outline-none focus:border-blue-500 transition"
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
                      className="w-full bg-gray-950 border border-gray-700 rounded-xl p-3 sm:p-4 text-sm sm:text-base text-white focus:outline-none focus:border-blue-500 transition resize-none custom-scrollbar"
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
                      className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 sm:file:py-3 sm:file:px-6 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-gray-800 file:text-white hover:file:bg-gray-700 file:cursor-pointer bg-gray-950 border border-gray-700 rounded-xl p-2 cursor-pointer focus:outline-none focus:border-blue-500 transition"
                    />
                  </div>
                )}
              </div>

              {/* Format Options - Stack on mobile */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2 mt-2">Choose Format</label>
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                  <button 
                    onClick={() => setAspectRatio('9:16')}
                    className={`flex-1 py-3 rounded-xl font-bold text-sm sm:text-base transition-all border ${
                      aspectRatio === '9:16' 
                        ? 'bg-emerald-600 border-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)]' 
                        : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500'
                    }`}
                  >
                    📱 9:16 (Shorts)
                  </button>
                  <button 
                    onClick={() => setAspectRatio('16:9')}
                    className={`flex-1 py-3 rounded-xl font-bold text-sm sm:text-base transition-all border ${
                      aspectRatio === '16:9' 
                        ? 'bg-blue-600 border-blue-500 text-white shadow-[0_0_15px_rgba(37,99,235,0.3)]' 
                        : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500'
                    }`}
                  >
                    💻 16:9 (YouTube)
                  </button>
                </div>
              </div>

              {/* Goal Options - Stack on mobile */}
              {inputType === 'video' && (
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2 mt-4">Choose Goal</label>
                  <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                    <button 
                      onClick={() => setProcessingMode('shorts')}
                      className={`flex-1 py-3 rounded-xl font-bold text-sm sm:text-base transition-all border ${
                        processingMode === 'shorts' 
                          ? 'bg-purple-600 border-purple-500 text-white shadow-[0_0_15px_rgba(147,51,234,0.3)]' 
                          : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500'
                      }`}
                    >
                      ✂️ Find AI Hooks
                    </button>
                    <button 
  onClick={(e) => {
    e.preventDefault();
    alert("🚀 Full Video Rendering is a massive AI operation and is currently locked for the Beta. Pro tier coming soon!");
  }}
  className="flex-1 py-3 bg-gray-800 text-gray-500 rounded-xl cursor-not-allowed flex items-center justify-center gap-2 border border-gray-700 transition-all font-bold text-sm sm:text-base"
  title="Coming soon in Pro!"
>
  <span>🔒</span> Full Video Subtitles <span className="bg-gradient-to-r from-purple-400 to-pink-500 text-transparent bg-clip-text text-xs font-bold ml-1">(PRO)</span>
</button>
                  </div>
                </div>
              )}

              {/* Master Action Button */}
              <div className="pt-4 border-t border-gray-800 mt-6">
                <button 
                  onClick={inputType === 'video' && processingMode === 'full' ? handleFullVideo : handleGenerate}
                  className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold text-base sm:text-lg transition-all transform hover:scale-[1.02] active:scale-95 shadow-lg shadow-emerald-600/20"
                >
                  Generate Viral Video 🚀
                </button>
              </div>
              
            </div>
          )}

          {/* State 2: Processing */}
          {step === 'processing' && (
            <div className="text-center py-20 animate-fade-in px-4">
              <div className="w-16 h-16 sm:w-24 sm:h-24 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">{statusMessage}</h2>
              
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
              <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white text-center sm:text-left">✂️ Choose Your Viral Clip</h2>
                <button onClick={handleStartOver} className="w-full sm:w-auto px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm font-bold transition">
                  Start Over
                </button>
              </div>

              {clips.length === 0 ? (
                 <div className="text-center py-12 bg-gray-900 rounded-xl border border-gray-800">
                    <p className="text-gray-400">No clips found. Try uploading a different video.</p>
                 </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {clips.map((clip, idx) => (
                    <div key={idx} className="bg-gray-900 border border-gray-800 p-5 sm:p-6 rounded-xl hover:border-emerald-500 transition shadow-xl flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start mb-4">
                          <h3 className="text-lg sm:text-xl font-bold text-white">Clip {idx + 1}</h3>
                          <span className="bg-emerald-500/20 text-emerald-400 px-2 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold border border-emerald-500/30">
                            High Potential
                          </span>
                        </div>
                       <p className="italic text-gray-400 text-xs sm:text-sm mb-4 line-clamp-3">
                        "{clip.description || clip.summary || clip.title || clip.hook || clip.text || 'No description available.'}"
                       </p>
                      </div>
                      
                      <div className="flex flex-col xl:flex-row gap-2 xl:gap-3 mt-auto">
                        <button
                          onClick={() => {
                            setActiveClipIndex(idx);
                            setStep('editor'); 
                          }}
                          className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-bold text-xs sm:text-sm transition"
                        >
                          ✏️ Edit text
                        </button>
                        <button
                          onClick={() => handleRender(clip)}
                          className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-xs sm:text-sm transition"
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
            <div className="max-w-4xl mx-auto bg-gray-900 p-4 sm:p-6 rounded-xl border border-gray-800 animate-fade-in">
              <button 
                onClick={() => setStep('editing')} 
                className="text-gray-400 hover:text-white mb-6 flex items-center gap-2 font-bold text-sm sm:text-base"
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
            <div className="max-w-xl mx-auto bg-gray-900 p-5 sm:p-8 rounded-2xl border border-gray-800 shadow-xl text-center animate-fade-in">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-2">🎉 Video Ready!</h2>
              <p className="text-sm sm:text-base text-gray-400 mb-6">Your viral short is cooked. Download it before it expires in 10 mins.</p>
              
              <div className="relative w-48 sm:w-64 mx-auto rounded-xl overflow-hidden shadow-2xl shadow-emerald-500/20 border-4 border-gray-800 mb-8">
                <video 
                  src={finalVideoUrl} 
                  controls 
                  autoPlay 
                  loop 
                  playsInline
                  className="w-full h-auto"
                />
              </div>

              {selectedClip && selectedClip.socialCaption && (
                <div className="w-full bg-gray-950 p-4 rounded-xl border border-gray-800 text-left mb-8 shadow-inner">
                  <p className="font-bold text-white mb-2 flex items-center gap-2 text-sm sm:text-base">📝 AI Suggested Post:</p>
                  
                  <p className="text-xs sm:text-sm text-gray-300 mb-3 leading-relaxed">
                    {selectedClip.socialCaption}
                  </p>

                  {selectedClip.reason && (
                    <div className="mt-3 pt-3 border-t border-gray-800">
                      <p className="text-[10px] sm:text-xs font-bold text-blue-400">🧠 Why this is viral:</p>
                      <p className="text-[10px] sm:text-xs text-gray-400 mt-1 italic">{selectedClip.reason}</p>
                    </div>
                  )}
                </div>
              )} 

              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <button 
                  onClick={handleStartOver}
                  className="w-full sm:flex-1 py-3 sm:py-4 bg-gray-800 hover:bg-gray-700 rounded-xl font-bold text-base sm:text-lg transition-all"
                >
                  Start Over
                </button>

                <a 
                  href={finalVideoUrl} 
                  download="MakeShort_Viral.mp4"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:flex-1 py-3 sm:py-4 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold text-base sm:text-lg transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2"
                >
                  ⬇️ Download
                </a>
              </div>
            </div>
          )}

        </div>
      </SignedIn>
    </div>
  );
}

export default App;