const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const VOICES = require('../config/voices');
const BACKGROUNDS = require('../config/backgrounds');
const CAPTION_STYLES = require('../config/captionStyles');

const router = express.Router();

module.exports = function createConfigRoutes() {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

  router.get('/voices', (_req, res) => {
    res.json({ voices: VOICES });
  });

  router.get('/backgrounds', (_req, res) => {
    res.json({ backgrounds: BACKGROUNDS });
  });

  router.get('/caption-styles', (_req, res) => {
    res.json({ captionStyles: CAPTION_STYLES });
  });

  router.get('/my-videos', async (req, res) => {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'Missing userId' });

    const { data, error } = await supabase
      .from('videos')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Supabase query error:', error);
      return res.status(500).json({ error: 'Failed to fetch videos' });
    }

    res.json({ videos: data || [] });
  });

  return router;
};
