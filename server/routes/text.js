const express = require('express');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { generateVoiceAndSubtitles } = require('../services/deepgram');
const { renderVideo } = require('../services/ffmpeg');
const { uploadVideo } = require('../services/cloudinary');
const { requireBody } = require('../middleware/validate');
const { generateLimiter } = require('../middleware/rateLimiter');
const BACKGROUNDS = require('../config/backgrounds');
const CAPTION_STYLES = require('../config/captionStyles');

const router = express.Router();

module.exports = function createTextRoutes({ assetsDir, outputDir, io }) {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

  router.post('/generate-text', generateLimiter, requireBody('script'), async (req, res) => {
    const { script, userId, socketId, aspectRatio, voiceId, backgroundId, captionStyleId } = req.body;
    res.status(202).json({ message: 'Job accepted. Cooking video in background...' });
    processTextInBackground(script, userId, socketId, aspectRatio, { voiceId, backgroundId, captionStyleId }).catch(err => console.error('Background Text Error:', err));
  });

  async function processTextInBackground(script, userId, socketId, aspectRatio = '9:16', options = {}) {
    try {
      io.to(socketId).emit('status-update', { message: 'Reading your script...' });

      const fullScript = script.substring(0, 1000);

      io.to(socketId).emit('status-update', { message: 'Generating AI Voice...' });

      const tempDir = path.join(__dirname, '..', 'temp');
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
      const timestamp = Date.now();

      const captionStyle = options.captionStyleId
        ? CAPTION_STYLES.find(s => s.id === options.captionStyleId)
        : null;

      const { audioPath, assPath } = await generateVoiceAndSubtitles(
        fullScript, tempDir, timestamp, aspectRatio,
        { voiceId: options.voiceId, captionStyle }
      );

      io.to(socketId).emit('status-update', { message: 'Rendering final video...' });

      const bgConfig = options.backgroundId
        ? BACKGROUNDS.find(b => b.id === options.backgroundId)
        : null;
      const bgFilename = bgConfig ? bgConfig.filename : 'background1.mp4';
      const backgroundVideoPath = path.join(assetsDir, bgFilename);

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
          title: 'Custom Script Video',
          type: 'custom',
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
      console.error('Text Pipeline Error:', error.message);
      io.to(socketId).emit('status-update', { message: `Error: ${error.message}` });
    }
  }

  return router;
};
