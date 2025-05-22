import express from 'express';
import multer from 'multer';
import fs from 'fs/promises';

const app = express();
const upload = multer({ dest: 'uploads/' });

app.post('/cut', upload.single('audio'), async (req, res) => {
  console.log('[cut] Incoming request to /cut');

  const start = req.body?.start || '00:00:00';
  const duration = req.body?.duration || '00:00:30';

  console.log('[cut] start:', start, '| duration:', duration);

  if (!req.file) {
    console.warn('[cut] No file provided in the request.');
    return res.status(400).json({ error: 'Audio file is required.' });
  }

  console.log('[cut] File received:', req.file.originalname, '| Size:', req.file.size, 'bytes');

  try {
    console.time('[cut] Load ffmpeg');
    const { createFFmpeg, fetchFile } = await import('@ffmpeg/ffmpeg');
    const ffmpeg = createFFmpeg({ log: true });

    await ffmpeg.load();
    console.timeEnd('[cut] Load ffmpeg');

    console.log('[cut] Reading input buffer from disk...');
    const buffer = await fs.readFile(req.file.path);

    console.log('[cut] Writing input.mp3 to virtual FS...');
    ffmpeg.FS('writeFile', 'input.mp3', await fetchFile(buffer));

    console.time('[cut] Running ffmpeg command');
    await ffmpeg.run('-i', 'input.mp3', '-ss', start, '-t', duration, '-c', 'copy', 'output.mp3');
    console.timeEnd('[cut] Running ffmpeg command');

    console.log('[cut] Reading output file from virtual FS...');
    const output = ffmpeg.FS('readFile', 'output.mp3');

    console.log('[cut] Success, sending output');
    res.setHeader('Content-Type', 'audio/mpeg');
    res.send(Buffer.from(output));
  } catch (err) {
    console.error('[cut] Error occurred:', err);
    res.status(502).json({
      error: 'ffmpeg failed',
      message: err.message,
    });
  } finally {
    try {
      console.log('[cut] Cleaning up uploaded temp file');
      await fs.unlink(req.file.path);
    } catch (err) {
      console.warn('[cut] Cleanup failed:', err.message);
    }
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`ffmpeg.wasm API running on port ${PORT}`);
});

