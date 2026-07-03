const express = require('express');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const Groq = require('groq-sdk');
const { GoogleGenAI } = require('@google/genai');
const { parseAITime } = require('../utils');
const { generateASS } = require('../utils');
const { uploadVideo } = require('../services/cloudinary');
const { renderClip } = require('../services/ffmpeg');
const { requireFile } = require('../middleware/validate');
const { generateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const ai = new GoogleGenAI({});

module.exports = function createVideoRoutes({ upload, uploadsDir, outputDir, assetsDir, io }) {
  function runCommand(cmd) {
    return new Promise((resolve, reject) => {
      exec(cmd, (error, stdout) => {
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
        if (attempt === 3) currentModel = 'gemini-2.5-flash-lite';

        const response = await ai.models.generateContent({
          model: currentModel,
          contents: prompt,
          config: { responseMimeType: 'application/json' },
        });

        let cleanText = response.text || '';
        cleanText = cleanText.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanText);
        return parsed.highlights || parsed;
      } catch (error) {
        console.warn(`Gemini Attempt ${attempt} failed:`, error.message);
        if (attempt === retries) throw error;
        await new Promise(resolve => setTimeout(resolve, attempt * 5000));
      }
    }
  }

  function extractWordsFromTranscription(transcription) {
    if (transcription.words) return transcription.words;
    if (!transcription.segments) return [];

    const wordsArray = [];
    transcription.segments.forEach(seg => {
      const words = seg.text.trim().split(/\s+/);
      const duration = seg.end - seg.start;
      const timePerWord = duration / Math.max(words.length, 1);
      words.forEach((w, i) => {
        wordsArray.push({
          word: w,
          start: seg.start + i * timePerWord,
          end: seg.start + (i + 1) * timePerWord,
        });
      });
    });
    return wordsArray;
  }

  // GET /api/videos - List uploaded videos
  router.get('/videos', (req, res) => {
    fs.readdir(uploadsDir, (err, files) => {
      if (err) return res.status(500).json({ error: 'Failed to read uploads folder' });
      const videos = files
        .filter(f => f.endsWith('.mp4'))
        .map(f => ({
          id: path.parse(f).name,
          url: `/uploads/${f}`,
          filename: f,
        }));
      res.json({ videos });
    });
  });

  // POST /api/cleanup - Delete all temp files
  router.post('/cleanup', (req, res) => {
    const foldersToClean = ['uploads', 'output', 'temp'];
    foldersToClean.forEach(folder => {
      const directory = path.join(__dirname, '..', folder);
      if (!fs.existsSync(directory)) return;
      fs.readdir(directory, (err, files) => {
        if (err) return;
        for (const file of files) {
          fs.unlink(path.join(directory, file), err => {
            if (err) console.error('Failed to delete file:', file);
          });
        }
      });
    });
    res.json({ message: 'Trash emptied!' });
  });

  // POST /api/generate - Upload video + AI analysis
  router.post('/generate', generateLimiter, upload.single('videoFile'), requireFile, async (req, res) => {
    const socketId = req.body.socketId;
    const inputPath = req.file.path;
    const videoId = path.parse(req.file.filename).name;
    const audioPath = path.join(uploadsDir, `${videoId}.mp3`);

    try {
      io.to(socketId).emit('status-update', { message: 'Extracting audio track...' });
      await runCommand(`ffmpeg -i "${inputPath}" -vn -ac 1 -ar 16000 -b:a 32k "${audioPath}"`);

      io.to(socketId).emit('status-update', { message: 'AI is listening to the video...' });
      const stats = fs.statSync(audioPath);
      if (stats.size === 0) throw new Error('Extracted audio is 0 bytes. Video might not have sound.');

      let transcription = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          transcription = await groq.audio.transcriptions.create({
            file: fs.createReadStream(audioPath),
            model: 'whisper-large-v3',
            response_format: 'verbose_json',
          });
          break;
        } catch (error) {
          if (attempt === 3) throw new Error(`Groq API Error: ${error.message}`);
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }

      io.to(socketId).emit('status-update', { message: 'Gemini is finding the viral hooks...' });
      const highlights = await getHighlightsFromAI(transcription.text);
      const wordsArray = extractWordsFromTranscription(transcription);

      const draftClips = highlights.map((highlight, index) => {
        const safeStart = parseAITime(highlight.start);
        const safeDuration = parseAITime(highlight.duration) || 45;
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
          segments: wordsArray.filter(w => w.start >= safeStart && w.end <= safeStart + safeDuration),
        };
      });

      res.json({ success: true, clips: draftClips });
    } catch (error) {
      console.error('Generate Error:', error.message);
      res.status(500).json({ error: 'AI Processing failed on the server.' });
    }
  });

  // POST /api/render - Render a clip with subtitles
  router.post('/render', (req, res) => {
    const { clip, aspectRatio, socketId } = req.body;
    res.status(202).json({ message: 'Render started in background...' });
    processRenderInBackground(clip, aspectRatio, socketId).catch(err => console.error('Background Render Error:', err));
  });

  async function processRenderInBackground(clip, aspectRatio, socketId) {
    const subtitlePath = path.join(uploadsDir, `${clip.id}.ass`);
    const outputPath = path.join(outputDir, `${clip.id}-final.mp4`);

    try {
      io.to(socketId).emit('status-update', { message: 'Initializing render engine...' });

      const assContent = generateASS(clip.segments || [], clip.start, aspectRatio);
      fs.writeFileSync(subtitlePath, assContent);

      await renderClip(clip.sourcePath, subtitlePath, outputPath, clip.start, clip.duration, aspectRatio);

      io.to(socketId).emit('status-update', { message: 'Uploading to cloud...' });
      const uploadResult = await uploadVideo(outputPath);

      io.to(socketId).emit('video-done', { success: true, url: uploadResult.secure_url });
      io.to(socketId).emit('status-update', { message: 'Video perfectly rendered and uploaded!' });

      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
      if (fs.existsSync(subtitlePath)) fs.unlinkSync(subtitlePath);
    } catch (error) {
      console.error('Render/Upload failed:', error);
      io.to(socketId).emit('status-update', { message: 'Rendering or upload failed' });
    }
  }

  // POST /api/transcribe-only - Full video subtitling
  router.post('/transcribe-only', generateLimiter, upload.single('videoFile'), requireFile, async (req, res) => {
    const socketId = req.body.socketId;
    const videoPath = req.file.path;
    const fileId = path.parse(req.file.filename).name;
    const audioPath = path.join(uploadsDir, `${fileId}.mp3`);

    try {
      io.to(socketId).emit('status-update', { message: 'Extracting audio track...' });
      await runCommand(`ffmpeg -i "${videoPath}" -vn -ac 1 -ar 16000 -b:a 32k "${audioPath}"`);

      io.to(socketId).emit('status-update', { message: 'AI is transcribing the full video...' });

      let transcription = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          transcription = await groq.audio.transcriptions.create({
            file: fs.createReadStream(audioPath),
            model: 'whisper-large-v3',
            response_format: 'verbose_json',
          });
          break;
        } catch (error) {
          if (attempt === 3) throw new Error(`Groq API Error: ${error.message}`);
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }

      if (!transcription || !transcription.text || transcription.text.trim() === '') {
        io.to(socketId).emit('status-update', { message: 'Failed to transcribe audio. Please try again.' });
        return res.status(422).json({ error: 'Transcription returned empty results.' });
      }

      const wordsArray = extractWordsFromTranscription(transcription);
      const totalDuration = wordsArray.length > 0 ? wordsArray[wordsArray.length - 1].end : 60;

      res.json({
        success: true,
        clips: [{
          id: fileId,
          videoId: fileId,
          title: 'Full Video (Auto-Subtitled)',
          reason: 'Complete raw video with burned-in subtitles.',
          start: 0,
          duration: totalDuration,
          segments: wordsArray,
          sourcePath: videoPath,
          socialCaption: 'Check out this full video! #AutoSubtitled',
        }],
      });
    } catch (error) {
      console.error('Transcription failed:', error);
      res.status(500).json({ error: 'Transcription failed' });
    }
  });

  // GET /api/download/:filename
  router.get('/download/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(outputDir, filename);
    res.download(filePath, `MakeShort-${filename}`, (err) => {
      if (err) res.status(404).send('File not found');
    });
  });

  return router;
};
