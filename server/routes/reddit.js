const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const { generateVoiceAndSubtitles } = require('../services/deepgram');
const { renderVideo } = require('../services/ffmpeg');
const { uploadVideo } = require('../services/cloudinary');
const { requireBody } = require('../middleware/validate');
const { generateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

module.exports = function createRedditRoutes({ assetsDir, outputDir, io }) {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

  router.post('/generate-reddit', generateLimiter, requireBody('redditUrl'), async (req, res) => {
    const { redditUrl, userId, socketId, aspectRatio } = req.body;
    res.status(202).json({ message: 'Job accepted. Cooking video in background...' });
    processRedditInBackground(redditUrl, userId, socketId, aspectRatio).catch(err => console.error('Background Reddit Error:', err));
  });

  async function processRedditInBackground(redditUrl, userId, socketId, aspectRatio = '9:16') {
    try {
      io.to(socketId).emit('status-update', { message: 'Reading Reddit story...' });

      let cleanUrl = redditUrl.split('?')[0];
      if (cleanUrl.endsWith('/')) cleanUrl = cleanUrl.slice(0, -1);

      const redditResponse = await axios.get(`${cleanUrl}.json`, {
        headers: { 'User-Agent': 'MakeShort-MVP/1.0' },
      });

      const postData = redditResponse.data[0].data.children[0].data;
      const story = postData.selftext;
      if (!story) throw new Error('Post has no text.');

      const fullScript = `${postData.title}... ${story}`.substring(0, 1000);

      io.to(socketId).emit('status-update', { message: 'Generating AI Voice...' });

      const tempDir = path.join(__dirname, '..', 'temp');
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
      const timestamp = Date.now();

      const { audioPath, assPath } = await generateVoiceAndSubtitles(fullScript, tempDir, timestamp, aspectRatio);

      io.to(socketId).emit('status-update', { message: 'Rendering final video...' });

      const backgrounds = ['background1.mp4'];
      const randomBg = backgrounds[Math.floor(Math.random() * backgrounds.length)];
      const backgroundVideoPath = path.join(assetsDir, randomBg);

      if (!fs.existsSync(backgroundVideoPath)) {
        throw new Error(`Background video missing at ${backgroundVideoPath}. Please add videos to the 'assets' folder.`);
      }

      const finalOutputPath = path.join(outputDir, `final_tiktok_${timestamp}.mp4`);

      await renderVideo({ backgroundVideoPath, audioPath, assPath, finalOutputPath, aspectRatio, io, socketId });

      io.to(socketId).emit('status-update', { message: 'Uploading to cloud...' });
      const uploadResult = await uploadVideo(finalOutputPath);

      if (userId) {
        await supabase.from('videos').insert([{
          user_id: userId,
          video_url: uploadResult.secure_url,
          title: postData.title.substring(0, 100),
          type: 'reddit',
        }]);
      }

      io.to(socketId).emit('video-done', {
        success: true,
        message: 'Video complete!',
        videoUrl: uploadResult.secure_url,
      });

      if (fs.existsSync(finalOutputPath)) fs.unlinkSync(finalOutputPath);
      if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
      if (fs.existsSync(assPath)) fs.unlinkSync(assPath);
    } catch (error) {
      console.error('Reddit Pipeline Error:', error.message);
      io.to(socketId).emit('status-update', { message: `Error: ${error.message}` });
    }
  }

  return router;
};
