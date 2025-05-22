import express from 'express';
import multer from 'multer';
import fs from 'fs/promises';

const app = express();
const upload = multer({ dest: 'uploads/' });

app.post('/cut', upload.single('audio'), async (req, res) => {
  try {
    const { createFFmpeg, fetchFile } = await import('@ffmpeg/ffmpeg'); // ✅ here

    const ffmpeg = createFFmpeg({ log: true });
    await ffmpeg.load();

    const buffer = await fs.readFile(req.file.path);
    ffmpeg.FS('writeFile', 'input.mp3', await fetchFile(buffer));

    const start = req.body?.start || '00:00:00';
    const duration = req.body?.duration || '00:00:30';

    await ffmpeg.run('-i', 'input.mp3', '-ss', start, '-t', duration, '-c', 'copy', 'output.mp3');
    const output = ffmpeg.FS('readFile', 'output.mp3');

    res.setHeader('Content-Type', 'audio/mpeg');
    res.send(Buffer.from(output));
  } catch (err) {
    console.error('Error in /cut:', err);
    res.status(502).json({ error: 'ffmpeg crashed', message: err.message });
  }
});
