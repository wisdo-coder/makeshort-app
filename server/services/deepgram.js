const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { formatAssTime } = require('../utils');

async function generateVoice(text, voiceId = 'aura-orion-en') {
  const response = await axios({
    method: 'post',
    url: `https://api.deepgram.com/v1/speak?model=${voiceId}`,
    headers: {
      'Authorization': `Token ${process.env.DEEPGRAM_API_KEY}`,
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg',
    },
    data: { text },
    responseType: 'arraybuffer',
  });
  return Buffer.from(response.data);
}

async function transcribeAudio(audioBuffer) {
  const response = await axios({
    method: 'post',
    url: 'https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true',
    headers: {
      'Authorization': `Token ${process.env.DEEPGRAM_API_KEY}`,
      'Content-Type': 'audio/mpeg',
    },
    data: audioBuffer,
  });
  return response.data.results.channels[0].alternatives[0].words;
}

function buildSubtitleChunks(wordsArray) {
  const chunks = [];
  for (let i = 0; i < wordsArray.length; i += 3) {
    const chunk = wordsArray.slice(i, i + 3);
    chunks.push({
      start: chunk[0].start,
      end: chunk[chunk.length - 1].end,
      text: chunk.map(w => w.word).join(' '),
    });
  }
  return chunks;
}

function buildSimpleASS(chunks, aspectRatio = '9:16', captionStyle = null) {
  const isWidescreen = aspectRatio === '16:9';
  const style = captionStyle || {
    fontName: 'Arial',
    fontSize: 110,
    primaryColour: '&H0000FFFF',
    outlineColour: '&H00000000',
    backColour: '&H00000000',
    bold: -1,
  };

  let assContent = `[Script Info]
ScriptType: v4.00+
PlayResX: ${isWidescreen ? 1920 : 1080}
PlayResY: ${isWidescreen ? 1080 : 1920}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, Bold, Alignment, MarginV
Style: Main,${style.fontName},${style.fontSize},${style.primaryColour},${style.outlineColour},${style.backColour},${style.bold},5,${isWidescreen ? 100 : 960}

[Events]
Format: Layer, Start, End, Style, Text\n`;

  chunks.forEach(chunk => {
    assContent += `Dialogue: 0,${formatAssTime(chunk.start)},${formatAssTime(chunk.end)},Main,${chunk.text}\n`;
  });
  return assContent;
}

async function generateVoiceAndSubtitles(script, tempDir, timestamp, aspectRatio, options = {}) {
  const { voiceId, captionStyle } = options;
  const audioBuffer = await generateVoice(script, voiceId);
  const audioPath = path.join(tempDir, `voice_${timestamp}.mp3`);
  fs.writeFileSync(audioPath, audioBuffer);

  const wordsArray = await transcribeAudio(fs.readFileSync(audioPath));
  const chunks = buildSubtitleChunks(wordsArray);
  const assContent = buildSimpleASS(chunks, aspectRatio, captionStyle);
  const assPath = path.join(tempDir, `subs_${timestamp}.ass`);
  fs.writeFileSync(assPath, assContent);

  return { audioPath, assPath };
}

module.exports = {
  generateVoice,
  transcribeAudio,
  buildSubtitleChunks,
  buildSimpleASS,
  generateVoiceAndSubtitles,
};
