// Force Deploy: Cookies Path Fix
const path = require('path');
// ☢️ The Nuclear Option: Force it to look in the exact right folder
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
const { GoogleGenAI } = require('@google/genai');

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

// Expose the 'output' folder so the React video player can see the MP4s
app.use('/output', express.static(outputDir));

// WebSocket connection for real-time progress
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
// ROUTE 1: DRAFTING (Download & AI Analysis)
// ==========================================
// Add 'axios' to the top of your index.js if it's not there
const axios = require('axios');

app.post('/api/generate', async (req, res) => {
    const { videoUrl } = req.body;
    const videoId = Date.now();
    const inputPath = path.join(uploadsDir, `${videoId}.mp4`);
    const audioPath = path.join(uploadsDir, `${videoId}.mp3`);

    try {
        console.log(`[1/4] Requesting stable download link...`);
        io.emit('status-update', { message: '🚀 Routing through high-speed bypass...' });

        // NEW API: Social Download All (v1)
        const options = {
            method: 'POST',
            url: 'https://social-download-all.p.rapidapi.com/v1/social/autodownload',
            headers: {
                'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
                'X-RapidAPI-Host': 'social-download-all.p.rapidapi.com',
                'Content-Type': 'application/json'
            },
            data: { url: videoUrl }
        };

        const apiResponse = await axios.request(options);
        
        // This API returns a list of formats. We want the best MP4.
        const videoData = apiResponse.data.medias.find(m => m.extension === 'mp4' && m.quality === '720p') 
                          || apiResponse.data.medias.find(m => m.extension === 'mp4')
                          || apiResponse.data.medias[0];

        if (!videoData || !videoData.url) {
            throw new Error("Could not find a valid MP4 link in API response.");
        }

        console.log("Found Video Link. Streaming to server...");
        const writer = fs.createWriteStream(inputPath);
        const videoStream = await axios({
            url: videoData.url,
            method: 'GET',
            responseType: 'stream'
        });

        videoStream.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });

        // --- BACK TO NORMAL FLOW ---
        console.log(`[2/4] Extracting audio...`);
        io.emit('status-update', { message: '🎵 Audio extraction in progress...' });
        await runCommand(`ffmpeg -i ${inputPath} -vn -ac 1 -ar 16000 -b:a 32k ${audioPath}`);

        console.log(`[3/4] Transcribing...`);
        io.emit('status-update', { message: '🎙️ Whisper AI is listening...' });
        const transcription = await openai.audio.transcriptions.create({
            file: fs.createReadStream(audioPath),
            model: "whisper-large-v3",
            response_format: "verbose_json",
            timestamp_granularities: ["word"]
        });

        console.log(`[4/4] AI Analysis...`);
        io.emit('status-update', { message: '🧠 Gemini is picking the best parts...' });
        const highlights = await getHighlightsFromAI(transcription.text);

        const draftClips = highlights.map((highlight, index) => {
            let safeStart = parseAITime(highlight.start);
            let safeDuration = parseAITime(highlight.duration) || 45;
            let clipWords = transcription.words.filter(w => w.start >= safeStart && w.end <= (safeStart + safeDuration));

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
                segments: clipWords
            };
        });

        res.json({ success: true, clips: draftClips });

    } catch (error) {
        console.error("API Error Details:", error.response ? error.response.data : error.message);
        res.status(500).json({ error: "Download path failed. Try a different video or check API credits." });
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
        // 🕵️‍♂️ OGA TROUBLESHOOTING LOGS: Let's see if the words arrived!
        console.log("\n===================================");
        console.log("🕵️‍♂️ SUBTITLE DEBUGGER:");
        console.log("Clip ID:", clip.id);
        console.log("Does clip have segments?:", !!clip.segments);
        console.log("Number of words in clip:", clip.segments ? clip.segments.length : "MISSING FROM FRONTEND!");
        
        // Generate the text file
        const assContent = generateASS(clip.segments || [], clip.start);
        
        // 🚨 FIX: Changed srtContent to assContent here!
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

// 🧠 GEMINI HIGHLIGHT EXTRACTION
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
                responseMimeType: "application/json", // Forces perfect JSON every time
            }
        });

        const parsed = JSON.parse(response.text);
        return parsed.highlights || parsed;
    } catch (error) {
        console.error("Failed to parse Gemini output:", error);
        throw error;
    }
}

// 🚀 V2: Word-by-Word ASS Subtitle Generator
function generateASS(words, clipStart = 0) {
    // This is the blueprint for a viral Shorts subtitle style
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

    const chunkSize = 3; // Show 3 words on screen at a time

    for (let i = 0; i < words.length; i += chunkSize) {
        const chunk = words.slice(i, i + chunkSize);
        
        // Loop through each word in the chunk to move the highlight
        for (let j = 0; j < chunk.length; j++) {
            const activeWord = chunk[j];
            const startSec = Math.max(0, (activeWord.start || 0) - clipStart);
            
            // To prevent flickering, the subtitle stays until the NEXT word starts
            let endSec;
            if (j < chunk.length - 1) {
                endSec = Math.max(0, (chunk[j + 1].start || 0) - clipStart);
            } else {
                endSec = Math.max(0, (activeWord.end || 0) - clipStart);
            }
            
            const startTime = formatASSTime(startSec);
            const endTime = formatASSTime(endSec);
            
            // Build the text line, coloring only the active word
            let lineText = chunk.map((w, index) => {
                const wordText = w.word.trim();
                // &H00FFFF& is ASS code for Yellow (it reads colors backwards as Blue-Green-Red)
                if (index === j) return `{\\c&H00FFFF&}${wordText}{\\c&HFFFFFF&}`;
                return wordText;
            }).join(" ");
            
            assContent += `Dialogue: 0,${startTime},${endTime},Default,,0,0,0,,${lineText}\n`;
        }
    }
    return assContent;
}

// ASS uses a slightly different time format than SRT: H:MM:SS.cs
function formatASSTime(seconds) {
    const date = new Date(0);
    date.setSeconds(seconds);
    const hh = Math.floor(seconds / 3600);
    const mm = date.toISOString().substr(14, 2);
    const ss = date.toISOString().substr(17, 2);
    const cs = Math.floor((seconds % 1) * 100).toString().padStart(2, '0');
    return `${hh}:${mm}:${ss}.${cs}`;
}

// 🛠️ THE FFMPEG FIX
function runFFmpegRender(input, subtitleFile, output, start, duration) {
    return new Promise((resolve, reject) => {
        const outputFolder = path.dirname(output);
        if (!fs.existsSync(outputFolder)) {
            fs.mkdirSync(outputFolder, { recursive: true });
        }

        // 🚨 MAGIC WINDOWS FIX: Use relative paths! FFmpeg on Windows hates C:/ paths for subtitles
        const relativeSubPath = path.relative(process.cwd(), subtitleFile).replace(/\\/g, '/');
        console.log("FFmpeg reading subtitles from:", relativeSubPath);
        
        // 🗑️ We deleted the "const style" line here because ASS files handle their own styling!

        ffmpeg(input)
            .setStartTime(start)
            .setDuration(duration)
            .videoFilters([
                'crop=ih*(9/16):ih', 
                'scale=720:1280',    
                // 🚨 No more force_style needed!
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