import express from 'express';
import multer from 'multer';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Setup Express and file upload middleware
const app = express();
const upload = multer({ dest: 'uploads/' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cut audio route
app.post('/cut', upload.single('audio'), async (req, res) => {
  console.log('[cut] ▶ Incoming request to /cut');

  const start = req.body?.start || '00:00:00';
  const duration = req.body?.duration || '00:00:30';

  if (!req.file) {
    console.warn('[cut] ❌ No file received in request');
    return res.status(400).json({ error: 'Audio file is required.' });
  }

  console.log(`[cut] 📦 File received: ${req.file.originalname} (${req.file.size} bytes)`);
  console.log(`[cut] ⏱️ Cut from ${start} for ${duration}`);

  try {
    console.time('[cut] ⬇ Load ffmpeg');
    const { createFFmpeg, fetchFile } = await import('@ffmpeg/ffmpeg');

    // ✅ Absolute path to wasm loader required in Railway
    const ffmpeg = createFFmpeg({
      log: true,
      corePath: '/app/node_modules/@ffmpeg/core/dist/ffmpeg-core.js',
    });

    await ffmpeg.load();
    console.timeEnd('[cut] ⬇ Load ffmpeg');

    const buffer = await fs.readFile(req.file.path);
    ffmpeg.FS('writeFile', 'input.mp3', await fetchFile(buffer));

    console.time('[cut] 🛠️ Processing with ffmpeg');
    await ffmpeg.run('-i', 'input.mp3', '-ss', start, '-t', duration, '-c', 'copy', 'output.mp3');
    console.timeEnd('[cut] 🛠️ Processing with ffmpeg');

    const output = ffmpeg.FS('readFile', 'output.mp3');
    console.log('[cut] ✅ Audio cut complete — sending file');

    res.setHeader('Content-Type', 'audio/mpeg');
    res.send(Buffer.from(output));
  } catch (err) {
    console.error('[cut] 💥 ffmpeg error:', err);
    res.status(502).json({
      error: 'ffmpeg failed',
      message: err.message,
    });
  } finally {
    try {
      await fs.unlink(req.file.path);
      console.log('[cut] 🧹 Temp file cleaned up');
    } catch (cleanupErr) {
      console.warn('[cut] ⚠️ Cleanup failed:', cleanupErr.message);
    }
  }
});

// Start server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 ffmpeg.wasm API running on port ${PORT}`);
});
