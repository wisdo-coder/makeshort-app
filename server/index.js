const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

console.log("TESTING API KEYS:");
console.log("Groq Key Found:", !!process.env.GROQ_API_KEY);
console.log("Gemini Key Found:", !!process.env.GEMINI_API_KEY);

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { exec } = require('child_process');
const ffmpeg = require('fluent-ffmpeg');
const OpenAI = require('openai');
const fs = require('fs');
const axios = require('axios');
const { GoogleGenAI } = require('@google/genai');
const multer = require('multer'); // Brought in Multer for the Heist

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

// Configure Multer to save uploaded files from the Extension
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`);
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

// Route to delete all heavy video files
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
// ROUTE 1: UPLOAD & AI ANALYSIS (The New Way)
// ==========================================
app.post('/api/upload', upload.single('video'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "No video file uploaded." });
    }

    const inputPath = req.file.path;
    const videoId = path.parse(req.file.filename).name;
    const audioPath = path.join(uploadsDir, `${videoId}.mp3`);

    try {
        console.log(`[1/3] Video received from extension! Extracting audio...`);
        io.emit('status-update', { message: '🚀 Video received! Extracting audio...' });
        
        await runCommand(`ffmpeg -i "${inputPath}" -vn -ac 1 -ar 16000 -b:a 32k "${audioPath}"`);

        console.log(`[2/3] Transcribing with Whisper...`);
        io.emit('status-update', { message: '🗣️ AI is listening to the video...' });
        
        const transcription = await openai.audio.transcriptions.create({
            file: fs.createReadStream(audioPath),
            model: "whisper-large-v3",
            response_format: "verbose_json",
            timestamp_granularities: ["word"]
        });

        console.log(`[3/3] AI Analysis with Gemini...`);
        io.emit('status-update', { message: '🧠 Gemini is finding the viral hooks...' });
        
        const highlights = await getHighlightsFromAI(transcription.text);

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
        console.log("\n===================================");
        console.log("🕵️‍♂️ SUBTITLE DEBUGGER:");
        console.log("Clip ID:", clip.id);
        console.log("Does clip have segments?:", !!clip.segments);
        console.log("Number of words in clip:", clip.segments ? clip.segments.length : "MISSING FROM FRONTEND!");
        
        const assContent = generateASS(clip.segments || [], clip.start);
        
        console.log("ASS File Preview (First 100 chars):\n", assContent.substring(0, 100) || "[EMPTY ASS FILE]");
        console.log("===================================\n");

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
        if (err) {
            console.error("Download error:", err);
            res.status(404).send("File not found");
        }
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
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

    const chunkSize = 3; 

    for (let i = 0; i < words.length; i += chunkSize) {
        const chunk = words.slice(i, i + chunkSize);
        
        for (let j = 0; j < chunk.length; j++) {
            const activeWord = chunk[j];
            const startSec = Math.max(0, (activeWord.start || 0) - clipStart);
            
            let endSec;
            if (j < chunk.length - 1) {
                endSec = Math.max(0, (chunk[j + 1].start || 0) - clipStart);
            } else {
                endSec = Math.max(0, (activeWord.end || 0) - clipStart);
            }
            
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
        if (!fs.existsSync(outputFolder)) {
            fs.mkdirSync(outputFolder, { recursive: true });
        }

        const relativeSubPath = path.relative(process.cwd(), subtitleFile).replace(/\\/g, '/');
        console.log("FFmpeg reading subtitles from:", relativeSubPath);
        
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
                if (progress.percent) {
                    io.emit('render-progress', { percent: Math.round(progress.percent) });
                }
            })
            .on('end', () => {
                console.log("✅ Render Complete!");
                resolve();
            })
            .on('error', (err) => {
                console.error("❌ FFmpeg Error:", err.message);
                reject(err);
            })
            .save(output);
    });
}

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));