const fs = require('fs');
const path = require('path');
const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(require('ffmpeg-static'));
require('dotenv').config({ path: path.join(__dirname, '.env') });
const cloudinary = require('cloudinary').v2;

// 🗄️ THE DATABASE: Initialize Supabase
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET 
});

console.log("TESTING API KEYS:");
console.log("Groq Key Found:", !!process.env.GROQ_API_KEY);
console.log("Gemini Key Found:", !!process.env.GEMINI_API_KEY);
console.log("ElevenLabs Key Found:", !!process.env.ELEVENLABS_API_KEY);

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { exec } = require('child_process');
const Groq = require('groq-sdk');
const { GoogleGenAI } = require('@google/genai');
const multer = require('multer'); 

// 🧠 THE BRAIN: Gemini 2.5 Flash for finding viral highlights
const ai = new GoogleGenAI({}); 

// 👂 THE EARS: Groq Whisper strictly for word-level timestamps 
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// --- Auto-create required folders so FFmpeg doesn't crash ---
const uploadsDir = path.join(__dirname, 'uploads');
const outputDir = path.join(__dirname, 'output');
const assetsDir = path.join(__dirname, 'assets');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);
if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir);

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
app.use('/temp', express.static(path.join(__dirname, 'temp')));
app.use('/uploads', express.static(uploadsDir)); 

io.on('connection', (socket) => {
    console.log('Client connected for WebSocket updates', socket.id);
});

// ==========================================
// ROUTE: GET ALL LOCAL VIDEOS
// ==========================================
app.get('/api/videos', (req, res) => {
    fs.readdir(uploadsDir, (err, files) => {
        if (err) return res.status(500).json({ error: "Failed to read uploads folder" });
        const videos = files
            .filter(f => f.endsWith('.mp4'))
            .map(f => ({
                id: path.parse(f).name,
                url: `/uploads/${f}`,
                filename: f
            }));
        res.json({ videos });
    });
});

// ==========================================
// ROUTE 0: CLEANUP (Empty Trash)
// ==========================================
app.post('/api/cleanup', (req, res) => {
  const foldersToClean = ['uploads', 'output', 'temp'];
  foldersToClean.forEach(folder => {
    const directory = path.join(__dirname, folder);
    if (!fs.existsSync(directory)) return;
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
    if (!req.file) return res.status(400).json({ error: "No video file was uploaded." });

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
        
        const stats = fs.statSync(audioPath);
        if (stats.size === 0) throw new Error("Extracted audio is 0 bytes. Video might not have sound.");

        let transcription = null;
        let groqRetries = 3;
        
        for (let attempt = 1; attempt <= groqRetries; attempt++) {
            try {
                transcription = await groq.audio.transcriptions.create({
                    file: fs.createReadStream(audioPath),
                    model: "whisper-large-v3",
                    response_format: "verbose_json", 
                });
                break; 
            } catch (error) {
                console.warn(`⚠️ Groq Attempt ${attempt} failed:`, error.message);
                if (attempt === groqRetries) throw new Error(`Groq API Error: ${error.message}`);
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }

        console.log(`[4/5] AI Analysis with Gemini...`);
        io.emit('status-update', { message: '🧠 Gemini is finding the viral hooks...' });
        
        const highlights = await getHighlightsFromAI(transcription.text);

        console.log(`[5/5] Packaging draft clips...`);
        let wordsArray = [];
        if (transcription.words) {
            wordsArray = transcription.words;
        } else if (transcription.segments) {
            transcription.segments.forEach(seg => {
                const words = seg.text.trim().split(/\s+/);
                const duration = seg.end - seg.start;
                const timePerWord = duration / Math.max(words.length, 1);
                
                words.forEach((w, i) => {
                    wordsArray.push({
                        word: w,
                        start: seg.start + (i * timePerWord),
                        end: seg.start + ((i + 1) * timePerWord)
                    });
                });
            });
        }

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
                segments: wordsArray.filter(w => w.start >= safeStart && w.end <= (safeStart + safeDuration))
            };
        });

        res.json({ success: true, clips: draftClips });

    } catch (error) {
        console.error("Backend Error:", error.message);
        res.status(500).json({ error: "AI Processing failed on the server." });
    }
});


// ==========================================
// ROUTE 2: RENDERING (FFmpeg & Subtitles) - 🟢 FIXED (ASYNC)
// ==========================================
app.post('/api/render', (req, res) => {
    const { clip, aspectRatio } = req.body; 
    
    // 🟢 INSTANT RESPONSE: Prevents Render 100s timeout
    res.status(202).json({ message: "Render started in background..." });

    // Run in background without awaiting
    processRenderInBackground(clip, aspectRatio).catch(err => console.error("Background Render Error:", err));
});

async function processRenderInBackground(clip, aspectRatio) {
    const subtitlePath = path.join(uploadsDir, `${clip.id}.ass`);
    const outputPath = path.join(outputDir, `${clip.id}-final.mp4`);

    try {
        io.emit('status-update', { message: '🎬 Initializing render engine...' });
        const assContent = generateASS(clip.segments || [], clip.start, aspectRatio);
        fs.writeFileSync(subtitlePath, assContent);
        
        // 1. Wait for FFmpeg to finish rendering locally on Render
        await runFFmpegRender(clip.sourcePath, subtitlePath, outputPath, clip.start, clip.duration, aspectRatio);
        
        io.emit('status-update', { message: '☁️ Uploading to cloud...' });

        // 2. 🟢 Upload the local video to Cloudinary
        const uploadResult = await cloudinary.uploader.upload(outputPath, {
            resource_type: "video",
            folder: "makeshort_viral" 
        });
        
        // 3. 🟢 Emit the final Cloudinary URL back to Vercel
        io.emit('video-done', { 
            success: true, 
            url: uploadResult.secure_url 
        });
        
        io.emit('status-update', { message: '✅ Video perfectly rendered and uploaded!' });

        // 4. 🧹 Clean up the local files so Render doesn't run out of storage space
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        if (fs.existsSync(subtitlePath)) fs.unlinkSync(subtitlePath);

    } catch (error) {
        console.error("Render/Upload failed:", error);
        io.emit('status-update', { message: '❌ Rendering or upload failed' });
    }
}

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
// ROUTE 4: FULL VIDEO SUBTITLING (No AI Cuts)
// ==========================================
app.post('/api/transcribe-only', upload.single('videoFile'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No video file was uploaded." });

        const videoPath = req.file.path;
        const fileId = path.parse(req.file.filename).name;
        const audioPath = path.join(uploadsDir, `${fileId}.mp3`);

        io.emit('status-update', { message: '🎵 Extracting audio track...' });
        await runCommand(`ffmpeg -i "${videoPath}" -vn -ac 1 -ar 16000 -b:a 32k "${audioPath}"`);

        io.emit('status-update', { message: '🗣️ AI is transcribing the full video...' });
        
        let transcription = null;
        let groqRetries = 3;
        
        for (let attempt = 1; attempt <= groqRetries; attempt++) {
            try {
                transcription = await groq.audio.transcriptions.create({
                    file: fs.createReadStream(audioPath),
                    model: "whisper-large-v3",
                    response_format: "verbose_json", 
                });
                break; 
            } catch (error) {
                if (attempt === groqRetries) throw new Error(`Groq API Error: ${error.message}`);
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }

        let wordsArray = [];
        if (transcription.words) {
            wordsArray = transcription.words;
        } else if (transcription.segments) {
            transcription.segments.forEach(seg => {
                const words = seg.text.trim().split(/\s+/);
                const duration = seg.end - seg.start;
                const timePerWord = duration / Math.max(words.length, 1);
                words.forEach((w, i) => {
                    wordsArray.push({
                        word: w,
                        start: seg.start + (i * timePerWord),
                        end: seg.start + ((i + 1) * timePerWord)
                    });
                });
            });
        }

        const totalDuration = wordsArray.length > 0 ? wordsArray[wordsArray.length - 1].end : 60;

        const fullClip = {
            id: fileId,
            videoId: fileId,
            title: "Full Video (Auto-Subtitled)",
            reason: "Complete raw video with burned-in subtitles.",
            start: 0,
            duration: totalDuration,
            segments: wordsArray, 
            sourcePath: videoPath,
            socialCaption: "Check out this full video! 🚀 #AutoSubtitled"
        };

        res.json({ success: true, clips: [fullClip] });
    } catch (error) {
        console.error("Transcription failed:", error);
        res.status(500).json({ error: "Transcription failed" });
    }
});


// ==========================================
// ROUTE 5: REDDIT SCRAPER - 🟢 FIXED (ASYNC)
// ==========================================
app.post('/api/generate-reddit', (req, res) => {
  const { redditUrl, userId } = req.body; 
  if (!redditUrl) return res.status(400).json({ error: 'Missing Reddit URL' });

  // 🟢 INSTANT RESPONSE: Prevents Render 100s timeout
  res.status(202).json({ message: "Job accepted. Cooking video in background..." });

  // Run in background without awaiting
  processRedditInBackground(redditUrl, userId).catch(err => console.error("Background Reddit Error:", err));
});

async function processRedditInBackground(redditUrl, userId) {
  try {
    console.log(`🕵️‍♂️ 1. Scraping Reddit: ${redditUrl}`);
    io.emit('status-update', { message: '🕵️‍♂️ Reading Reddit story...' }); 

    let cleanUrl = redditUrl.split('?')[0]; 
    if (cleanUrl.endsWith('/')) cleanUrl = cleanUrl.slice(0, -1);
    
    const redditResponse = await axios.get(`${cleanUrl}.json`, {
      headers: { 'User-Agent': 'MakeShort-MVP/1.0' }
    });

    const postData = redditResponse.data[0].data.children[0].data;
    const story = postData.selftext;
    if (!story) throw new Error('Post has no text.');

    const fullScript = `${postData.title}... ${story}`.substring(0, 1000); 

    console.log(`🎙️ 2. Generating Deepgram AI Voice...`);
    io.emit('status-update', { message: '🎙️ Generating AI Voice...' }); 

    let voiceResponse;
    try {
      voiceResponse = await axios({
        method: 'post',
        url: 'https://api.deepgram.com/v1/speak?model=aura-orion-en',
        headers: {
          'Authorization': `Token ${process.env.DEEPGRAM_API_KEY}`, 
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg'
        },
        data: { text: fullScript },
        responseType: 'arraybuffer'
      });
    } catch (error) {
       console.error("❌ Deepgram TTS Error:", error.response ? error.response.data : error.message);
       throw new Error(`Deepgram Audio API failed!`);
    }

    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
    
    const timestamp = Date.now();
    const audioPath = path.join(tempDir, `voice_${timestamp}.mp3`);
    
    fs.writeFileSync(audioPath, Buffer.from(voiceResponse.data));

    console.log(`🧠 3. Analyzing audio with Deepgram...`);
    io.emit('status-update', { message: '🧠 Transcribing voice audio...' }); 
    
    const audioBuffer = fs.readFileSync(audioPath);
    const deepgramResponse = await axios({
      method: 'post',
      url: 'https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true',
      headers: {
        'Authorization': `Token ${process.env.DEEPGRAM_API_KEY}`,
        'Content-Type': 'audio/mpeg'
      },
      data: audioBuffer
    });

    const wordsArray = deepgramResponse.data.results.channels[0].alternatives[0].words;

    console.log(`✍️ 4. Generating Subtitle File...`);
    io.emit('status-update', { message: '✍️ Writing subtitles...' }); 

    let chunks = [];
    for (let i = 0; i < wordsArray.length; i += 3) {
        const chunk = wordsArray.slice(i, i + 3);
        chunks.push({
            start: chunk[0].start,
            end: chunk[chunk.length - 1].end,
            text: chunk.map(w => w.word).join(' ')
        });
    }

    let assContent = `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, Bold, Alignment, MarginV
Style: Main,Arial,110,&H0000FFFF,&H00000000,&H00000000,-1,5,960

[Events]
Format: Layer, Start, End, Style, Text\n`;

    chunks.forEach(chunk => {
        assContent += `Dialogue: 0,${formatAssTime(chunk.start)},${formatAssTime(chunk.end)},Main,${chunk.text}\n`;
    });

    const assPath = path.join(tempDir, `subs_${timestamp}.ass`);
    fs.writeFileSync(assPath, assContent);

    console.log(`🎬 5. Final Video Stitching...`);
    io.emit('status-update', { message: '🎬 Rendering final video...' }); 

    const backgrounds = ['background1.mp4', 'background2.mp4'];
    const randomBg = backgrounds[Math.floor(Math.random() * backgrounds.length)];
    const backgroundVideoPath = path.join(assetsDir, randomBg);
    
    if (!fs.existsSync(backgroundVideoPath)) {
        throw new Error(`Background video missing at ${backgroundVideoPath}. Please add videos to the 'assets' folder.`);
    }

    const finalOutputPath = path.join(outputDir, `final_tiktok_${timestamp}.mp4`);
    
    // 🟢 Fix for Linux pathing: FFmpeg requires pure forward slashes
    const escapedAssPath = assPath.replace(/\\/g, '/');

    ffmpeg()
      .input(backgroundVideoPath)
      .input(audioPath)
      // 🟢 Wrapped escapedAssPath in single quotes (crucial for Linux)
      .videoFilters(`crop=ih*(9/16):ih,subtitles='${escapedAssPath}'`) 
     .outputOptions([
          '-map 0:v:0',        // 🟢 FORCES the video from Input 0 (background.mp4)
          '-map 1:a:0',        // 🟢 FORCES the audio from Input 1 (AI Voice.mp3)
          '-c:v libx264', 
          '-preset ultrafast', 
          '-crf 32',           
          '-threads 1',        
          '-c:a aac', 
          '-shortest',         // 🟢 Now this will correctly stop at 49 seconds!
          '-max_muxing_queue_size 1024'
      ])
      // 🟢 THE X-RAY GLASSES: These two events will print FFmpeg's internal thoughts to your Render logs
      .on('start', (commandLine) => {
          console.log('🚀 Spawned FFmpeg with command: ' + commandLine);
      })
      .on('stderr', (stderrLine) => {
          // This prints the frame-by-frame rendering progress and any hidden errors
          console.log('FFmpeg Log: ' + stderrLine);
      })
      .on('error', (err) => { 
          console.error(`❌ FFmpeg Error:`, err.message);
          io.emit('status-update', { message: '❌ Video stitching failed!' });
      })
      .on('end', async () => {
        console.log(`🚀 Video stitched locally: ${finalOutputPath}`);
        io.emit('status-update', { message: '☁️ Uploading to cloud...' }); 

        try {
          const uploadResult = await cloudinary.uploader.upload(finalOutputPath, {
            resource_type: "video",
            folder: "makeshort_viral" 
          });

          if (userId) {
            const { error: dbError } = await supabase
              .from('videos')
              .insert([{
                  user_id: userId,
                  video_url: uploadResult.secure_url,
                  title: postData.title ? postData.title.substring(0, 50) + "..." : "Generated Video", 
                  type: 'reddit'
              }]);
          }

          io.emit('video-done', { 
            success: true, 
            message: 'Video complete!', 
            videoUrl: uploadResult.secure_url 
          });

          if (fs.existsSync(finalOutputPath)) fs.unlinkSync(finalOutputPath);
          if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
          if (fs.existsSync(assPath)) fs.unlinkSync(assPath);

        } catch (uploadError) {
          console.error('❌ Cloudinary/DB Error:', uploadError);
          io.emit('status-update', { message: '❌ Failed to save video to cloud.' });
        }
      })
      .save(finalOutputPath);

  } catch (error) {
    console.error('❌ Error Pipeline:', error.message);
    io.emit('status-update', { message: `❌ Error: ${error.message}` });
  }
}

// ==========================================
// ROUTE 6: TEXT SCRIPT TO VIDEO
// ==========================================
app.post('/api/generate-text', (req, res) => {
  const { script, userId } = req.body; 
  if (!script) return res.status(400).json({ error: 'Missing script text' });

  // 🟢 INSTANT RESPONSE: Prevents Render 100s timeout
  res.status(202).json({ message: "Job accepted. Cooking video in background..." });

  // Run in background without awaiting
  processTextInBackground(script, userId).catch(err => console.error("Background Text Error:", err));
});

async function processTextInBackground(script, userId) {
  try {
    console.log(`📝 1. Received Custom Script: ${script.substring(0, 30)}...`);
    io.emit('status-update', { message: '📝 Reading your script...' }); 

    // Limit to 1000 chars to avoid massive API bills, just like Reddit
    const fullScript = script.substring(0, 1000); 

    console.log(`🎙️ 2. Generating Deepgram AI Voice...`);
    io.emit('status-update', { message: '🎙️ Generating AI Voice...' }); 

    let voiceResponse;
    try {
      voiceResponse = await axios({
        method: 'post',
        url: 'https://api.deepgram.com/v1/speak?model=aura-orion-en',
        headers: {
          'Authorization': `Token ${process.env.DEEPGRAM_API_KEY}`, 
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg'
        },
        data: { text: fullScript },
        responseType: 'arraybuffer'
      });
    } catch (error) {
       console.error("❌ Deepgram TTS Error:", error.response ? error.response.data : error.message);
       throw new Error(`Deepgram Audio API failed!`);
    }

    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
    
    const timestamp = Date.now();
    const audioPath = path.join(tempDir, `voice_${timestamp}.mp3`);
    
    fs.writeFileSync(audioPath, Buffer.from(voiceResponse.data));

    console.log(`🧠 3. Analyzing audio with Deepgram...`);
    io.emit('status-update', { message: '🧠 Transcribing voice audio...' }); 
    
    const audioBuffer = fs.readFileSync(audioPath);
    const deepgramResponse = await axios({
      method: 'post',
      url: 'https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true',
      headers: {
        'Authorization': `Token ${process.env.DEEPGRAM_API_KEY}`,
        'Content-Type': 'audio/mpeg'
      },
      data: audioBuffer
    });

    const wordsArray = deepgramResponse.data.results.channels[0].alternatives[0].words;

    console.log(`✍️ 4. Generating Subtitle File...`);
    io.emit('status-update', { message: '✍️ Writing subtitles...' }); 

    let chunks = [];
    for (let i = 0; i < wordsArray.length; i += 3) {
        const chunk = wordsArray.slice(i, i + 3);
        chunks.push({
            start: chunk[0].start,
            end: chunk[chunk.length - 1].end,
            text: chunk.map(w => w.word).join(' ')
        });
    }

    let assContent = `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, Bold, Alignment, MarginV
Style: Main,Arial,110,&H0000FFFF,&H00000000,&H00000000,-1,5,960

[Events]
Format: Layer, Start, End, Style, Text\n`;

    chunks.forEach(chunk => {
        assContent += `Dialogue: 0,${formatAssTime(chunk.start)},${formatAssTime(chunk.end)},Main,${chunk.text}\n`;
    });

    const assPath = path.join(tempDir, `subs_${timestamp}.ass`);
    fs.writeFileSync(assPath, assContent);

    console.log(`🎬 5. Final Video Stitching...`);
    io.emit('status-update', { message: '🎬 Rendering final video...' }); 

    const backgrounds = ['background1.mp4', 'background2.mp4'];
    const randomBg = backgrounds[Math.floor(Math.random() * backgrounds.length)];
    const backgroundVideoPath = path.join(assetsDir, randomBg);
    
    if (!fs.existsSync(backgroundVideoPath)) {
        throw new Error(`Background video missing at ${backgroundVideoPath}. Please add videos to the 'assets' folder.`);
    }

    const finalOutputPath = path.join(outputDir, `final_tiktok_${timestamp}.mp4`);
    
    // 🟢 Fix for Linux pathing: FFmpeg requires pure forward slashes
    const escapedAssPath = assPath.replace(/\\/g, '/');

    ffmpeg()
      .input(backgroundVideoPath)
      .input(audioPath)
      // 🟢 Wrapped escapedAssPath in single quotes (crucial for Linux)
      .videoFilters(`crop=ih*(9/16):ih,subtitles='${escapedAssPath}'`) 
    .outputOptions([
          '-map 0:v:0',        // 🟢 FORCES the video from Input 0 (background.mp4)
          '-map 1:a:0',        // 🟢 FORCES the audio from Input 1 (AI Voice.mp3)
          '-c:v libx264', 
          '-preset ultrafast', 
          '-crf 32',           
          '-threads 1',        
          '-c:a aac', 
          '-shortest',         // 🟢 Now this will correctly stop at 49 seconds!
          '-max_muxing_queue_size 1024'
      ])
      // 🟢 THE X-RAY GLASSES: These two events will print FFmpeg's internal thoughts to your Render logs
      .on('start', (commandLine) => {
          console.log('🚀 Spawned FFmpeg with command: ' + commandLine);
      })
      .on('stderr', (stderrLine) => {
          // This prints the frame-by-frame rendering progress and any hidden errors
          console.log('FFmpeg Log: ' + stderrLine);
      })
      .on('error', (err) => { 
          console.error(`❌ FFmpeg Error:`, err.message);
          io.emit('status-update', { message: '❌ Video stitching failed!' });
      })
      .on('end', async () => {
        console.log(`🚀 Video stitched locally: ${finalOutputPath}`);
        io.emit('status-update', { message: '☁️ Uploading to cloud...' }); 

        try {
          const uploadResult = await cloudinary.uploader.upload(finalOutputPath, {
            resource_type: "video",
            folder: "makeshort_viral" 
          });

          if (userId) {
            const { error: dbError } = await supabase
              .from('videos')
              .insert([{
                  user_id: userId,
                  video_url: uploadResult.secure_url,
                  title: postData.title ? postData.title.substring(0, 50) + "..." : "Generated Video", 
                  type: 'reddit'
              }]);
          }

          io.emit('video-done', { 
            success: true, 
            message: 'Video complete!', 
            videoUrl: uploadResult.secure_url 
          });

          if (fs.existsSync(finalOutputPath)) fs.unlinkSync(finalOutputPath);
          if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
          if (fs.existsSync(assPath)) fs.unlinkSync(assPath);

        } catch (uploadError) {
          console.error('❌ Cloudinary/DB Error:', uploadError);
          io.emit('status-update', { message: '❌ Failed to save video to cloud.' });
        }
      })
      .save(finalOutputPath);

  } catch (error) {
    console.error('❌ Error Pipeline:', error.message);
    io.emit('status-update', { message: `❌ Error: ${error.message}` });
  }
}

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

async function getHighlightsFromAI(text, retries = 3) {
    const prompt = `You are an elite TikTok/YouTube Shorts algorithm strategist. Analyze this video transcript and extract the 3 most viral, highly engaging segments.

STRICT RULES:
1. LENGTH: Each clip MUST be exactly between 45 and 60 seconds long. Do not pick short 20-second clips.
2. HOOK: The 'start' timestamp must begin right when the speaker says something controversial, educational, or highly energetic.
3. STORY: Ensure the clip has a beginning, middle, and satisfying end.
4. ACCURACY: DO NOT invent timestamps. You must ONLY use 'start' timestamps that physically exist in the transcript provided. If you choose a timestamp outside the transcript, the system will crash.

Return ONLY a valid JSON object with a 'highlights' array. Format: {"highlights": [{"start": <number_in_seconds>, "duration": <number_between_45_and_60>, "title": "Catchy Title", "viralityScore": 95, "reason": "Why it works", "socialCaption": "Caption with hashtags"}]}

Transcript:
${text}`;

    let currentModel = 'gemini-2.5-flash';

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            if (attempt === 3) {
                console.log("🔄 2.5-Flash is too busy. Swapping to backup model...");
                currentModel = 'gemini-2.5-flash-lite'; 
            }

            const response = await ai.models.generateContent({
                model: currentModel,
                contents: prompt,
                config: { responseMimeType: "application/json" }
            });

            let cleanText = response.text || "";
            cleanText = cleanText.replace(/```json/g, '').replace(/```/g, '').trim();

            const parsed = JSON.parse(cleanText);
            return parsed.highlights || parsed;
            
        } catch (error) {
            console.warn(`⚠️ Gemini Attempt ${attempt} failed:`, error.message);
            if (attempt === retries) throw error;
            const waitTime = attempt * 5000; 
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
    }
}

function generateASS(words, clipStart = 0, aspectRatio = '9:16') {
    const isLandscape = aspectRatio === '16:9';
    const resX = isLandscape ? 1280 : 720;
    const resY = isLandscape ? 720 : 1280;

    let assContent = `[Script Info]
ScriptType: v4.00+
PlayResX: ${resX}
PlayResY: ${resY}

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
            const startTime = formatAssTime(startSec);
            const endTime = formatAssTime(endSec);
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

function formatAssTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    const cs = Math.floor((seconds % 1) * 100).toString().padStart(2, '0');
    return `${h}:${m}:${s}.${cs}`;
}

function runFFmpegRender(input, subtitleFile, output, start, duration, aspectRatio = '9:16') {
    return new Promise((resolve, reject) => {
        const outputFolder = path.dirname(output);
        if (!fs.existsSync(outputFolder)) fs.mkdirSync(outputFolder, { recursive: true });

        const relativeSubPath = path.relative(process.cwd(), subtitleFile).replace(/\\/g, '/');
        
        const filters = [];
        if (aspectRatio === '9:16') {
            filters.push('crop=ih*(9/16):ih'); 
            filters.push('scale=720:1280');    
        } else {
            filters.push('scale=1280:720');    
        }
        filters.push(`subtitles='${relativeSubPath}'`); 

        ffmpeg(input)
            .setStartTime(start)
            .setDuration(duration)
            .videoFilters(filters)
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