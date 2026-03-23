const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { exec } = require('child_process');
const ffmpeg = require('fluent-ffmpeg');
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// --- NEW: Auto-create required folders so FFmpeg doesn't crash ---
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
const io = new Server(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());

// Expose the 'output' folder so the React video player can actually see the MP4s
app.use('/output', express.static(outputDir));

// Point the OpenAI library to Groq's free API endpoint
const openai = new OpenAI({ 
    apiKey: process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1" 
});

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
        // Keeps the folders, but deletes the files inside them
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
app.post('/api/generate', async (req, res) => {
    const { videoUrl } = req.body;
    const videoId = Date.now();
    const inputPath = path.join(uploadsDir, `${videoId}.mp4`);
    const audioPath = path.join(uploadsDir, `${videoId}.mp3`);

    try {
        console.log(`[1/4] Downloading YouTube video...`);
        await runCommand(`yt-dlp --js-runtimes node --remote-components ejs:github -f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/mp4" "${videoUrl}" -o ${inputPath}`);

        console.log(`[2/4] Extracting audio for Whisper...`);
        await runCommand(`ffmpeg -i ${inputPath} -vn -ac 1 -ar 16000 -b:a 32k ${audioPath}`);

        console.log(`[3/4] Transcribing with OpenAI Whisper...`);
        const transcription = await openai.audio.transcriptions.create({
            file: fs.createReadStream(audioPath),
            model: "whisper-large-v3",
            response_format: "verbose_json",
            timestamp_granularities: ["word"]
        });

        console.log(`[4/4] Analyzing for viral highlights with GPT-4...`);
        const highlights = await getHighlightsFromAI(transcription.text);
        
        const draftClips = highlights.map((highlight, index) => {
            const safeStart = parseAITime(highlight.start || highlight.startTime || highlight.start_time);
            const safeDuration = parseAITime(highlight.duration || highlight.length) || 30;

            let clipWords = transcription.words.filter(
                w => w.start >= safeStart && w.end <= (safeStart + safeDuration)
            );

            if (clipWords.length === 0) {
                clipWords = [{ word: "(Audio playing)", start: safeStart, end: safeStart + 2 }];
            }

           return {
                id: `${videoId}-${index}`,
                videoId,
                sourcePath: inputPath,
                start: safeStart,
                duration: safeDuration,
                title: highlight.title || `Viral Clip ${index + 1}`,
                viralityScore: highlight.viralityScore || highlight.score || 85,
                reason: highlight.reason || "Viral highlight identified by AI",
                socialCaption: highlight.socialCaption || "Check out this awesome clip! 🚀 #viral #shorts",
                segments: clipWords
            };
        });

        res.json({ success: true, clips: draftClips });
    } catch (error) {
        console.error("Error in generation:", error);
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// ROUTE 2: RENDERING (FFmpeg & Subtitles)
// ==========================================
app.post('/api/render', async (req, res) => {
    const { clip } = req.body;
    const srtPath = path.join(uploadsDir, `${clip.id}.srt`);
    const outputPath = path.join(outputDir, `${clip.id}-final.mp4`);

    try {
        fs.writeFileSync(srtPath, generateSRT(clip.segments));
        await runFFmpegRender(clip.sourcePath, srtPath, outputPath, clip.start, clip.duration);

        res.json({ 
            success: true, 
            url: `http://localhost:5000/output/${clip.id}-final.mp4` 
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
    const response = await openai.chat.completions.create({
        model: "llama-3.1-8b-instant",
        response_format: { type: "json_object" }, 
        messages: [{
            role: "system",
           content: "You are an expert TikTok/Shorts algorithm strategist. Identify 3 highly engaging hooks/highlights from this transcript that are between 60 and 90 seconds long. Return ONLY a valid JSON object with a 'highlights' array containing objects with exactly this format: [{\"start\": seconds_as_number, \"duration\": length_in_seconds_as_number, \"title\": \"CATCHY_HOOK_TITLE\", \"viralityScore\": 95, \"reason\": \"string_why_it_will_go_viral\", \"socialCaption\": \"Engaging caption with hashtags. STRICT RULE: Must be a single continuous string. DO NOT use line breaks or unescaped newlines in this string.\"}]"
        }, { role: "user", content: text }]
    });
    const parsed = JSON.parse(response.choices[0].message.content);
    return parsed.highlights || parsed;
}

function generateSRT(words) {
    let srtContent = "";
    let chunk = [];
    let chunkIndex = 1;

    for (let i = 0; i < words.length; i++) {
        chunk.push(words[i]);
        if (chunk.length === 3 || i === words.length - 1) {
            const start = formatSRTTime(chunk[0].start);
            const end = formatSRTTime(chunk[chunk.length - 1].end);
            const text = chunk.map(w => w.word).join(" ");
            srtContent += `${chunkIndex}\n${start} --> ${end}\n${text}\n\n`;
            chunk = [];
            chunkIndex++;
        }
    }
    return srtContent;
}

function formatSRTTime(seconds) {
    const date = new Date(0);
    date.setSeconds(seconds);
    const hhmmss = date.toISOString().substr(11, 8);
    const ms = Math.floor((seconds % 1) * 1000).toString().padStart(3, '0');
    return `${hhmmss},${ms}`;
}

function runFFmpegRender(input, srt, output, start, duration) {
    return new Promise((resolve, reject) => {
        const relativeSrt = srt.replace(/\\/g, '/').split('server/')[1] || srt; 

        ffmpeg(input)
            .setStartTime(start)
            .setDuration(duration)
            .videoFilters([
                'crop=ih*(9/16):ih', 
                'scale=720:1280',    
                `subtitles=${relativeSrt}:force_style='Alignment=2,FontSize=24,PrimaryColour=&H00FFFF,Outline=2,OutlineColour=&H000000'`
            ])
            .outputOptions(['-c:v libx264', '-preset veryfast', '-crf 22', '-c:a copy'])
            .on('progress', (progress) => {
                if (progress.percent) {
                    io.emit('render-progress', { percent: Math.round(progress.percent) });
                }
            })
            .on('end', () => {
                io.emit('render-status', 'Complete!');
                resolve();
            })
            .on('error', (err) => {
                io.emit('render-error', err.message);
                reject(err);
            })
            .save(output);
    });
}

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));