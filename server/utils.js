const fs = require('fs');
const path = require('path');
const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(require('ffmpeg-static'));

// ==========================================
// DIRECTORY HELPERS
// ==========================================

function ensureDirExists(dirPath) {
    if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function selectRandomBackground(assetsDir) {
    const backgrounds = ['background1.mp4'];
    const randomBg = backgrounds[Math.floor(Math.random() * backgrounds.length)];
    const bgPath = path.join(assetsDir, randomBg);
    if (!fs.existsSync(bgPath)) {
        throw new Error(`Background video missing at ${bgPath}. Please add videos to the 'assets' folder.`);
    }
    return bgPath;
}

// ==========================================
// TRANSCRIPTION HELPERS
// ==========================================

async function transcribeWithRetry(groq, audioPath, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const transcription = await groq.audio.transcriptions.create({
                file: fs.createReadStream(audioPath),
                model: "whisper-large-v3",
                response_format: "verbose_json",
            });
            return transcription;
        } catch (error) {
            console.warn(`⚠️ Groq Attempt ${attempt} failed:`, error.message);
            if (attempt === maxRetries) throw new Error(`Groq API Error: ${error.message}`);
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }
}

function extractWordsFromTranscription(transcription) {
    if (transcription.words) {
        return transcription.words;
    }
    const wordsArray = [];
    if (transcription.segments) {
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
    return wordsArray;
}

// ==========================================
// DEEPGRAM API HELPERS
// ==========================================

async function generateVoiceWithDeepgram(text, apiKey) {
    try {
        const response = await axios({
            method: 'post',
            url: 'https://api.deepgram.com/v1/speak?model=aura-orion-en',
            headers: {
                'Authorization': `Token ${apiKey}`,
                'Content-Type': 'application/json',
                'Accept': 'audio/mpeg'
            },
            data: { text },
            responseType: 'arraybuffer'
        });
        return response;
    } catch (error) {
        console.error("❌ Deepgram TTS Error:", error.response ? error.response.data : error.message);
        throw new Error('Deepgram Audio API failed!');
    }
}

async function transcribeAudioWithDeepgram(audioPath, apiKey) {
    const audioBuffer = fs.readFileSync(audioPath);
    const response = await axios({
        method: 'post',
        url: 'https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true',
        headers: {
            'Authorization': `Token ${apiKey}`,
            'Content-Type': 'audio/mpeg'
        },
        data: audioBuffer
    });
    return response.data.results.channels[0].alternatives[0].words;
}

// ==========================================
// SUBTITLE HELPERS
// ==========================================

function chunkWordsForSubtitles(wordsArray, chunkSize = 3) {
    const chunks = [];
    for (let i = 0; i < wordsArray.length; i += chunkSize) {
        const chunk = wordsArray.slice(i, i + chunkSize);
        chunks.push({
            start: chunk[0].start,
            end: chunk[chunk.length - 1].end,
            text: chunk.map(w => w.word).join(' ')
        });
    }
    return chunks;
}

function buildInlineASS(chunks) {
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
    return assContent;
}

function formatAssTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    const cs = Math.floor((seconds % 1) * 100).toString().padStart(2, '0');
    return `${h}:${m}:${s}.${cs}`;
}

function generateASS(words, clipStart = 0, aspectRatio = '9:16') {
    const isWidescreen = aspectRatio === '16:9';
    const resX = isWidescreen ? 1920 : 1080;
    const resY = isWidescreen ? 1080 : 1920;
    const marginV = isWidescreen ? 100 : 960;

    let assContent = `[Script Info]
ScriptType: v4.00+
PlayResX: ${resX}
PlayResY: ${resY}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, Bold, Alignment, MarginV
Style: Main,Arial,110,&H0000FFFF,&H00000000,&H00000000,-1,5,${marginV}

[Events]
Format: Layer, Start, End, Style, Text\n`;

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

// ==========================================
// FFMPEG HELPERS
// ==========================================

function runCommand(cmd) {
    const { exec } = require('child_process');
    return new Promise((resolve, reject) => {
        exec(cmd, (error, stdout, stderr) => {
            if (error) reject(error);
            else resolve(stdout);
        });
    });
}

function extractAudio(inputPath, audioPath) {
    return runCommand(`ffmpeg -i "${inputPath}" -vn -ac 1 -ar 16000 -b:a 32k "${audioPath}"`);
}

function runFFmpegRender(input, subtitleFile, output, start, duration, aspectRatio, io, socketId) {
    return new Promise((resolve, reject) => {
        const outputFolder = path.dirname(output);
        ensureDirExists(outputFolder);

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
            .on('progress', (progress) => {
                if (progress.percent) io.to(socketId).emit('render-progress', { percent: Math.round(progress.percent) });
            })
            .on('end', () => resolve())
            .on('error', (err) => reject(err))
            .save(output);
    });
}

function stitchVideoWithAudio({ backgroundVideoPath, audioPath, assPath, finalOutputPath, aspectRatio, io, socketId, cloudinary, supabase, userId, dbTitle, dbType }) {
    const escapedAssPath = assPath.replace(/\\/g, '/');
    const isWidescreen = aspectRatio === '16:9';
    const videoFilterString = isWidescreen
        ? `scale=1920:1080,subtitles='${escapedAssPath}'`
        : `crop=ih*(9/16):ih,subtitles='${escapedAssPath}'`;

    return new Promise((resolve, reject) => {
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
                '-max_muxing_queue_size 1024'
            ])
            .on('start', (commandLine) => {
                console.log('🚀 Spawned FFmpeg with command: ' + commandLine);
            })
            .on('stderr', (stderrLine) => {
                console.log('FFmpeg Log: ' + stderrLine);
            })
            .on('error', (err) => {
                console.error('❌ FFmpeg Error:', err.message);
                io.to(socketId).emit('status-update', { message: '❌ Video stitching failed!' });
                reject(err);
            })
            .on('end', async () => {
                console.log(`🚀 Video stitched locally: ${finalOutputPath}`);
                io.to(socketId).emit('status-update', { message: '☁️ Uploading to cloud...' });

                try {
                    const uploadResult = await cloudinary.uploader.upload(finalOutputPath, {
                        resource_type: "video",
                        folder: "makeshort_viral"
                    });

                    if (userId) {
                        await supabase
                            .from('videos')
                            .insert([{
                                user_id: userId,
                                video_url: uploadResult.secure_url,
                                title: dbTitle || "Custom Script Video",
                                type: dbType || 'custom'
                            }]);
                    }

                    io.to(socketId).emit('video-done', {
                        success: true,
                        message: 'Video complete!',
                        videoUrl: uploadResult.secure_url
                    });

                    if (fs.existsSync(finalOutputPath)) fs.unlinkSync(finalOutputPath);
                    if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
                    if (fs.existsSync(assPath)) fs.unlinkSync(assPath);

                    resolve(uploadResult);
                } catch (uploadError) {
                    console.error('❌ Cloudinary/DB Error:', uploadError);
                    io.to(socketId).emit('status-update', { message: '❌ Failed to save video to cloud.' });
                    reject(uploadError);
                }
            })
            .save(finalOutputPath);
    });
}

// ==========================================
// TTS + SUBTITLE PIPELINE
// ==========================================

async function ttsAndSubtitlePipeline({ script, tempDir, apiKey }) {
    ensureDirExists(tempDir);
    const timestamp = Date.now();
    const audioPath = path.join(tempDir, `voice_${timestamp}.mp3`);

    const voiceResponse = await generateVoiceWithDeepgram(script, apiKey);
    fs.writeFileSync(audioPath, Buffer.from(voiceResponse.data));

    const wordsArray = await transcribeAudioWithDeepgram(audioPath, apiKey);
    const chunks = chunkWordsForSubtitles(wordsArray);
    const assContent = buildInlineASS(chunks);
    const assPath = path.join(tempDir, `subs_${timestamp}.ass`);
    fs.writeFileSync(assPath, assContent);

    return { audioPath, assPath, timestamp };
}

module.exports = {
    ensureDirExists,
    selectRandomBackground,
    transcribeWithRetry,
    extractWordsFromTranscription,
    generateVoiceWithDeepgram,
    transcribeAudioWithDeepgram,
    chunkWordsForSubtitles,
    buildInlineASS,
    formatAssTime,
    generateASS,
    runCommand,
    extractAudio,
    runFFmpegRender,
    stitchVideoWithAudio,
    ttsAndSubtitlePipeline,
};
