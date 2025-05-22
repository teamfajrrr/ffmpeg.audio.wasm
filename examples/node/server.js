import express from 'express';
import multer from 'multer';
import fs from 'fs/promises';

const app = express();
const upload = multer({ dest: 'uploads/' });

app.post('/cut', upload.single('data'), async (req, res) => {
  const start = req.body?.start || '00:00:00';
  const duration = req.body?.duration || '00:00:30';

  if (!req.file) {
    return res.status(400).json({ error: 'Audio file is required.' });
  }

  // Import dynamically
  const { createFFmpeg, fetchFile } = await import('@ffmpeg/ffmpeg');
  const ffmpeg = createFFmpeg({ log: true });

  await ffmpeg.load();

  const buffer = await fs.readFile(req.file.path);
  ffmpeg.FS('writeFile', 'input.mp3', await fetchFile(buffer));

  await ffmpeg.run('-i', 'input.mp3', '-ss', start, '-t', duration, '-c', 'copy', 'output.mp3');

  const output = ffmpeg.FS('readFile', 'output.mp3');

  res.setHeader('Content-Type', 'audio/mpeg');
  res.send(Buffer.from(output));

  await fs.unlink(req.file.path);
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`ffmpeg.wasm API running on port ${PORT}`);
});
