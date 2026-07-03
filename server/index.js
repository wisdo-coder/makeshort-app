const fs = require('fs');
const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const multer = require('multer');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const errorHandler = require('./middleware/errorHandler');
const { apiLimiter } = require('./middleware/rateLimiter');
const createVideoRoutes = require('./routes/video');
const createRedditRoutes = require('./routes/reddit');
const createTextRoutes = require('./routes/text');

// --- Directory setup ---
const uploadsDir = path.join(__dirname, 'uploads');
const outputDir = path.join(__dirname, 'output');
const assetsDir = path.join(__dirname, 'assets');
[uploadsDir, outputDir, assetsDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
});

// --- Multer config ---
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const videoId = Date.now();
    const ext = path.extname(file.originalname) || '.mp4';
    cb(null, `${videoId}${ext}`);
  },
});
const upload = multer({ storage });

// --- Express + Socket.io ---
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['*'];

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: allowedOrigins, methods: ['GET', 'POST'] },
});

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());
app.use(apiLimiter);

// --- Static files ---
app.use('/output', express.static(outputDir));
app.use('/temp', express.static(path.join(__dirname, 'temp')));
app.use('/uploads', express.static(uploadsDir));

// --- WebSocket ---
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
});

// --- Health check ---
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --- Routes ---
const routeContext = { upload, uploadsDir, outputDir, assetsDir, io };
app.use('/api', createVideoRoutes(routeContext));
app.use('/api', createRedditRoutes(routeContext));
app.use('/api', createTextRoutes(routeContext));

// --- Error handler (must be last) ---
app.use(errorHandler);

// --- Start ---
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
