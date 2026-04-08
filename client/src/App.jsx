// Force Deploy: Socket Fix
import { io } from 'socket.io-client';  
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import SubtitleEditor from './components/SubtitleEditor';
import ProgressBar from './components/ProgressBar';
import gsap from 'gsap';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

console.log("TESTING API KEYS:");
console.log("Groq Key Found:", !!process.env.GROQ_API_KEY);
console.log("Gemini Key Found:", !!process.env.GEMINI_API_KEY);

const API_URL = 'https://makeshort-backend.onrender.com';
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { exec } = require('child_process');
const ffmpeg = require('fluent-ffmpeg');
const OpenAI = require('openai');
const fs = require('fs');
const { GoogleGenAI } = require('@google/genai');
const multer = require('multer'); // 📦 Added Multer for local uploads

// 🧠 THE BRAIN: Gemini 2.5 Flash for finding viral highlights
const ai = new GoogleGenAI({}); 

// 👂 THE EARS: Groq Whisper strictly for word-level timestamps 
const openai = new OpenAI({
    apiKey: process.env.GROQ_API_KEY, 
    baseURL: "https://api.groq.com/openai/v1",
});

// --- Auto-create required folders so FFmpeg doesn't crash ---
const uploadsDir = path.join(__dirname, 'uploads');
const outputDir = path.join(__dirname, 'output');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

// --- Configure Multer to save uploaded files directly to 'uploads' ---
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsDir); 
    },
    filename: function (req, file, cb) {
        const videoId = Date.now();
        const ext = path.extname(file.originalname) || '.mp4';
        cb(null, `${videoId}${ext}`);
    }
});
const upload = multer({ storage: storage });

// Helper to force ANY weird AI time format into pure seconds
function parseAITime(timeVal) {
    if (timeVal === undefined || timeVal === null) return 0;
    if (typeof timeVal === 'number') return timeVal;
    
    const strVal = String(timeVal).trim();
    if (strVal.includes(':')) {
        const parts = strVal.split(':').reverse();
        let seconds = 0;
        for (let i = 0; i < parts.length; i++) {
            seconds += (Number(parts[i]) || 0) * Math.pow(60, i);
        }
        return seconds;
    }
    return Number(strVal.replace(/[^0-9.]/g, '')) || 0;
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use('/output', express.static(outputDir));

io.on('connection', (socket) => {
    console.log('Client connected for WebSocket updates');
});

// ==========================================
// ROUTE 0: CLEANUP (Empty Trash)
// ==========================================
app.post('/api/cleanup', (req, res) => {
  const foldersToClean = ['uploads', 'output'];
  foldersToClean.forEach(folder => {
    const directory = path.join(__dirname, folder);
    fs.readdir(directory, (err, files) => {
      if (err) return;
      for (const file of files) {
        fs.unlink(path.join(directory, file), err => {
          if (err) console.error("Failed to delete file:", file);
        });
      }
    });
  });
  res.json({ message: "Trash emptied!" });
});

// ==========================================
// ROUTE 1: GENERATE (Local Upload + AI Analysis)
// ==========================================
app.post('/api/generate', upload.single('videoFile'), async (req, res) => {
    
    // 1. Check if a file was actually uploaded
    if (!req.file) {
        return res.status(400).json({ error: "No video file was uploaded." });
    }

    // 2. Set up our file paths (Multer already saved the video to inputPath)
    const inputPath = req.file.path;
    const videoId = path.parse(req.file.filename).name; 
    const audioPath = path.join(uploadsDir, `${videoId}.mp3`);

    try {
        console.log(`[1/5] Received local video upload: ${req.file.originalname}`);
        io.emit('status-update', { message: '📥 Video securely uploaded! Starting processing...' });

        console.log(`[2/5] Extracting audio with FFmpeg...`);
        io.emit('status-update', { message: '🎵 Extracting audio track...' });
        
        await runCommand(`ffmpeg -i "${inputPath}" -vn -ac 1 -ar 16000 -b:a 32k "${audioPath}"`);

        console.log(`[3/5] Transcribing with Whisper...`);
        io.emit('status-update', { message: '🗣️ AI is listening to the video...' });
        
        const transcription = await openai.audio.transcriptions.create({
            file: fs.createReadStream(audioPath),
            model: "whisper-large-v3",
            response_format: "verbose_json",
            timestamp_granularities: ["word"]
        });

        console.log(`[4/5] AI Analysis with Gemini...`);
        io.emit('status-update', { message: '🧠 Gemini is finding the viral hooks...' });
        
        const highlights = await getHighlightsFromAI(transcription.text);

        console.log(`[5/5] Packaging draft clips...`);
        const draftClips = highlights.map((highlight, index) => {
            let safeStart = parseAITime(highlight.start);
            let safeDuration = parseAITime(highlight.duration) || 45;
            return {
                id: `${videoId}-${index}`,
                videoId,
                sourcePath: inputPath,
                start: safeStart,
                duration: safeDuration,
                title: highlight.title,
                viralityScore: highlight.viralityScore,
                reason: highlight.reason,
                socialCaption: highlight.socialCaption,
                segments: transcription.words.filter(w => w.start >= safeStart && w.end <= (safeStart + safeDuration))
            };
        });

        res.json({ success: true, clips: draftClips });

    } catch (error) {
        console.error("Backend Error:", error.message);
        res.status(500).json({ error: "AI Processing failed on the server." });
    }
});

// ==========================================
// ROUTE 2: RENDERING (FFmpeg & Subtitles)
// ==========================================
app.post('/api/render', async (req, res) => {
    const { clip } = req.body;
    const subtitlePath = path.join(uploadsDir, `${clip.id}.ass`);
    const outputPath = path.join(outputDir, `${clip.id}-final.mp4`);

    try {
        const assContent = generateASS(clip.segments || [], clip.start);
        fs.writeFileSync(subtitlePath, assContent);
        await runFFmpegRender(clip.sourcePath, subtitlePath, outputPath, clip.start, clip.duration);
        
        res.json({ 
            success: true, 
            url: `/output/${clip.id}-final.mp4`
        });
    } catch (error) {
        console.error("Render failed:", error);
        res.status(500).json({ error: "Rendering failed" });
    }
});

// ==========================================
// ROUTE 3: 1-CLICK DOWNLOAD
// ==========================================
app.get('/api/download/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(outputDir, filename); 
    
    res.download(filePath, `MakeShort-${filename}`, (err) => {
        if (err) res.status(404).send("File not found");
    });
});

// ==========================================
// HELPER FUNCTIONS
// ==========================================
function runCommand(cmd) {
    return new Promise((resolve, reject) => {
        exec(cmd, (error, stdout, stderr) => {
            if (error) reject(error);
            else resolve(stdout);
        });
    });
}

async function getHighlightsFromAI(text) {
    const prompt = `You are an elite TikTok/YouTube Shorts algorithm strategist. Analyze this video transcript and extract the 3 most viral, highly engaging segments.

STRICT RULES:
1. LENGTH: Each clip MUST be exactly between 45 and 60 seconds long. Do not pick short 20-second clips.
2. HOOK: The 'start' timestamp must begin right when the speaker says something controversial, educational, or highly energetic.
3. STORY: Ensure the clip has a beginning, middle, and satisfying end.
4. ACCURACY: DO NOT invent timestamps. You must ONLY use 'start' timestamps that physically exist in the transcript provided. If you choose a timestamp outside the transcript, the system will crash.

Return ONLY a valid JSON object with a 'highlights' array. Format: {"highlights": [{"start": <number_in_seconds>, "duration": <number_between_45_and_60>, "title": "Catchy Title", "viralityScore": 95, "reason": "Why it works", "socialCaption": "Caption with hashtags"}]}

Transcript:
${text}`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
            }
        });

        const parsed = JSON.parse(response.text);
        return parsed.highlights || parsed;
    } catch (error) {
        console.error("Failed to parse Gemini output:", error);
        throw error;
    }
}

function generateASS(words, clipStart = 0) {
    let assContent = `[Script Info]
ScriptType: v4.00+
PlayResX: 720
PlayResY: 1280

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,80,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,4,3,5,40,40,640,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`;

    const chunkSize = 3; 
    for (let i = 0; i < words.length; i += chunkSize) {
        const chunk = words.slice(i, i + chunkSize);
        for (let j = 0; j < chunk.length; j++) {
            const activeWord = chunk[j];
            const startSec = Math.max(0, (activeWord.start || 0) - clipStart);
            let endSec = (j < chunk.length - 1) ? Math.max(0, (chunk[j + 1].start || 0) - clipStart) : Math.max(0, (activeWord.end || 0) - clipStart);
            const startTime = formatASSTime(startSec);
            const endTime = formatASSTime(endSec);
            let lineText = chunk.map((w, index) => {
                const wordText = w.word.trim();
                if (index === j) return `{\\c&H00FFFF&}${wordText}{\\c&HFFFFFF&}`;
                return wordText;
            }).join(" ");
            assContent += `Dialogue: 0,${startTime},${endTime},Default,,0,0,0,,${lineText}\n`;
        }
    }
    return assContent;
}

function formatASSTime(seconds) {
    const date = new Date(0);
    date.setSeconds(seconds);
    const hh = Math.floor(seconds / 3600);
    const mm = date.toISOString().substr(14, 2);
    const ss = date.toISOString().substr(17, 2);
    const cs = Math.floor((seconds % 1) * 100).toString().padStart(2, '0');
    return `${hh}:${mm}:${ss}.${cs}`;
}

function runFFmpegRender(input, subtitleFile, output, start, duration) {
    return new Promise((resolve, reject) => {
        const outputFolder = path.dirname(output);
        if (!fs.existsSync(outputFolder)) fs.mkdirSync(outputFolder, { recursive: true });

        const relativeSubPath = path.relative(process.cwd(), subtitleFile).replace(/\\/g, '/');
        
        ffmpeg(input)
            .setStartTime(start)
            .setDuration(duration)
            .videoFilters([
                'crop=ih*(9/16):ih', 
                'scale=720:1280',    
                `subtitles='${relativeSubPath}'` 
            ])
            .outputOptions(['-c:v libx264', '-preset fast', '-crf 22', '-c:a copy'])
            .on('progress', (progress) => {
                if (progress.percent) io.emit('render-progress', { percent: Math.round(progress.percent) });
            })
            .on('end', () => resolve())
            .on('error', (err) => reject(err))
            .save(output);
    });
}

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

function App() {
  // 🔴 1. Changed 'url' to 'videoFile'
  const [videoFile, setVideoFile] = useState(null);
  const [step, setStep] = useState('idle'); 
  const [clips, setClips] = useState([]);
  const [activeClipIndex, setActiveClipIndex] = useState(0);
  const [finalVideoUrl, setFinalVideoUrl] = useState('');
  
  const [renderProgress, setRenderProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('Starting engine...');

  useEffect(() => {
    const socket = io('https://makeshort-backend.onrender.com', {
        transports: ['websocket', 'polling']
    });
    
    socket.on('render-progress', (data) => {
      setRenderProgress(data.percent);
    });
    
  socket.on('status-update', (data) => {
      setStatusMessage(data.message);
    });

    return () => socket.disconnect();
  }, []);

  // 🔴 2. Updated to send FormData instead of JSON
  const handleGenerate = async () => {
    if (!videoFile) return alert("Please select a video file first!");
    
    setStep('processing');
    try {
      // Pack the file for shipping to the backend
      const formData = new FormData();
      formData.append('videoFile', videoFile); 

      // Axios automatically handles the multipart/form-data headers!
      const { data } = await axios.post(`${API_URL}/api/generate`, formData);
      setClips(data.clips);
      setStep('editing'); 
    } catch (err) {
      console.error(err);
      alert("Error processing video. Check console.");
      setStep('idle');
    }
  };

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
      await axios.post(`${API_URL}/api/cleanup`);
    } catch (err) {
      console.error("Cleanup failed", err);
    }
    // 🔴 3. Clear the file state
    setVideoFile(null);
    setClips([]);
    setFinalVideoUrl('');
    setStep('idle');
  };

  const mainContainerRef = useRef(null);

  useEffect(() => {
    if (!mainContainerRef.current) return;
    let ctx = gsap.context(() => {
      gsap.from(mainContainerRef.current, {
        y: 50,
        opacity: 0,
        duration: 1,
        ease: "power3.out"
      });
    });
    return () => ctx.revert(); 
  }, []);

  return (
    <div ref={mainContainerRef} className="min-h-screen bg-gray-950 text-white font-sans selection:bg-blue-500 selection:text-white">
      <div className="max-w-5xl mx-auto px-6 py-12">
        
        {/* Header */}
        <header className="text-center mb-16">
          <h1 className="text-5xl font-extrabold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
            MakeShort MVP
          </h1>
          <p className="text-gray-400 mt-4 text-lg">Turn your raw videos into viral Shorts in 1-click.</p>
        </header>

        {/* State 1: Idle Input */}
        {step === 'idle' && (
          <div className="max-w-2xl mx-auto space-y-6 bg-gray-900 p-8 rounded-2xl border border-gray-800 shadow-xl">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Upload Raw Video</label>
              {/* 🔴 4. Changed the text input to a beautifully styled file input */}
              <input 
                type="file"
                accept="video/mp4,video/quicktime,video/*"
                onChange={(e) => setVideoFile(e.target.files[0])}
                className="block w-full text-sm text-gray-400
                  file:mr-4 file:py-3 file:px-6
                  file:rounded-xl file:border-0
                  file:text-sm file:font-bold
                  file:bg-gray-800 file:text-white
                  hover:file:bg-gray-700
                  file:transition-all file:cursor-pointer
                  bg-gray-950 border border-gray-700 rounded-xl p-2 cursor-pointer focus:outline-none focus:border-blue-500 transition"
              />
            </div>
            <button 
              onClick={handleGenerate}
              className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold text-lg transition-all transform hover:scale-[1.02] active:scale-95 shadow-lg shadow-blue-600/20"
            >
              Upload & Generate AI Shorts 🚀
            </button>
          </div>
        )}

        {/* State 2: Processing AI */}
        {step === 'processing' && (
          <div className="text-center py-20 animate-pulse">
            <div className="inline-block w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-6"></div>
            <h2 className="text-2xl font-bold text-gray-100 mb-4">Processing Video...</h2>
            
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
                  <div className="absolute top-4 right-4 bg-gray-950 border border-gray-800 px-3 py-1 rounded-full flex items-center gap-2 shadow-inner">
                    <span className="text-xs text-gray-400">Score</span>
                    <span className={`text-sm font-black ${clip.viralityScore >= 90 ? 'text-emerald-400' : 'text-yellow-400'}`}>
                      {clip.viralityScore}/100
                    </span>
                  </div>

                  <h3 className="font-extrabold text-lg text-gray-100 mt-8 mb-2 leading-tight">
                    "{clip.title}"
                  </h3>
                  <p className="text-sm text-gray-400 line-clamp-3">
                    {clip.reason}
                  </p>
                </button>
              ))}
            </div>
            
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
              <div className="flex flex-col items-center">
                
               <video 
                  src={`${API_URL}${finalVideoUrl}`} 
                  controls 
                  className="rounded-xl shadow-lg border border-gray-700 w-full max-w-sm aspect-[9/16] object-cover bg-black"
                />
                
                <a 
                  href={`${API_URL}/api/download/${finalVideoUrl.split('/').pop()}`}
                  className="mt-6 w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-center transition shadow-[0_0_15px_rgba(37,99,235,0.4)] flex justify-center items-center gap-2"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                  Download MP4
                </a>

                <button 
                  onClick={handleStartOver}
                  className="mt-4 w-full py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold rounded-xl text-center transition border border-gray-700 flex justify-center items-center gap-2"
                >
                  🗑️ Clean Up & Start Over
                </button>

              </div>

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
                  Caption generated by Gemini ⚡️
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