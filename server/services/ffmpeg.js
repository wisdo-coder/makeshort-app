const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(require('ffmpeg-static'));

function renderVideo({ backgroundVideoPath, audioPath, assPath, finalOutputPath, aspectRatio, io, socketId }) {
  return new Promise((resolve, reject) => {
    const escapedAssPath = assPath.replace(/\\/g, '/');
    const isWidescreen = aspectRatio === '16:9';

    const videoFilterString = isWidescreen
      ? `scale=1920:1080,subtitles='${escapedAssPath}'`
      : `crop=ih*(9/16):ih,subtitles='${escapedAssPath}'`;

    ffmpeg()
      .input(backgroundVideoPath)
      .input(audioPath)
      .videoFilters(videoFilterString)
      .outputOptions([
        '-map 0:v:0',
        '-map 1:a:0',
        '-c:v libx264',
        '-preset ultrafast',
        '-crf 32',
        '-threads 1',
        '-c:a aac',
        '-shortest',
        '-max_muxing_queue_size 1024',
      ])
      .on('start', (cmd) => {
        console.log('FFmpeg command:', cmd);
      })
      .on('error', (err) => {
        console.error('FFmpeg Error:', err.message);
        reject(err);
      })
      .on('end', () => resolve())
      .save(finalOutputPath);
  });
}

function renderClip(input, subtitleFile, output, start, duration, aspectRatio = '9:16') {
  return new Promise((resolve, reject) => {
    const outputFolder = path.dirname(output);
    if (!fs.existsSync(outputFolder)) fs.mkdirSync(outputFolder, { recursive: true });

    const relativeSubPath = path.relative(process.cwd(), subtitleFile).replace(/\\/g, '/');
    const filters = [];

    if (aspectRatio === '9:16') {
      filters.push('crop=ih*(9/16):ih');
      filters.push('scale=1080:1920');
    } else {
      filters.push('scale=1920:1080:force_original_aspect_ratio=decrease');
      filters.push('pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black');
    }
    filters.push(`subtitles='${relativeSubPath}'`);

    ffmpeg(input)
      .setStartTime(start)
      .setDuration(duration)
      .videoFilters(filters)
      .outputOptions(['-c:v libx264', '-preset fast', '-crf 22', '-c:a copy'])
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .save(output);
  });
}

module.exports = { renderVideo, renderClip };
