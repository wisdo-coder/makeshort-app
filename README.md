# AI Video Auto-Generator Pipeline

An automated, full-stack video rendering application that turns text scripts or Reddit URLs into fully edited, ready-to-post vertical/horizontal videos. 

# Features
* **Multi-Input Support:** Paste a custom text script or scrape a Reddit URL.
* **AI Voice & Subtitles:** Integrates with Deepgram API to generate high-fidelity AI voiceovers and perfectly synced word-by-word subtitles (`.ass` format).
* **Dynamic Video Processing:** Uses FFmpeg to dynamically crop, scale, and stitch audio/subtitles over background footage.
* **Smart Aspect Ratios:** Toggle between 9:16 (TikTok/Shorts/Reels) and 16:9 (YouTube) rendering on the fly.
* **Real-Time UI Updates:** WebSockets stream live background rendering progress directly to the frontend.

# Tech Stack
* **Frontend:** React, Tailwind CSS, Vite, Axios, Socket.io-client
* **Backend:** Node.js, Express.js, Socket.io
* **Video/Audio Engine:** FFmpeg (fluent-ffmpeg)
* **AI Integration:** Deepgram API (Text-to-Speech & Speech-to-Text Transcription)
* **Deployment:** Vercel (Frontend), Render (Backend Engine)

# How It Works (The Architecture)
1. **The Request:** The user submits text/URL and selects an aspect ratio via the React frontend.
2. **Audio Generation:** The Node.js backend sends the text to Deepgram to generate an `.mp3` AI voiceover.
3. **Transcription & Sync:** Deepgram analyzes the new audio file and returns exact timestamps for every word to generate a custom SubStation Alpha (`.ass`) subtitle file.
4. **The FFmpeg Engine:** The backend spawns an FFmpeg child process that takes a background video, loops it, crops/scales it to the requested ratio, overlays the `.ass` subtitles, and multiplexes the audio track.
5. **Real-time Feedback:** Throughout the pipeline, WebSockets emit status updates back to the UI so the user isn't left guessing.

# Local Setup
Want to run this locally? 

1. Clone the repo:
   ```bash
   git clone [https://github.com/wisdo-coder/makeshort-app.git](https://github.com/wisdo-coder/makeshort-app.git)
2. Install dependencies for both client and server:
cd client && npm install
cd ../server && npm install
3. Set up your .env variables in the server:
   PORT=5000
   DEEPGRAM_API_KEY=your_api_key_here
4. Make sure you have FFmpeg installed on your local machine!
5. Start the dev servers:
   # In terminal 1 (Backend)
   cd server && npm start

   # In terminal 2 (Frontend)
   cd client && npm run dev
Future Roadmap

    [ ] Add support for direct local video file uploads.

    [ ] Implement AI image generation for B-roll footage.

    [ ] Add user authentication and history.
