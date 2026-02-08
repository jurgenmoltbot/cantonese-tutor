require('dotenv').config();
const express = require('express');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Multer for file uploads
const upload = multer({ dest: 'uploads/' });

// Cantonese.ai API configuration
const CANTONESE_AI_API_KEY = process.env.CANTONESE_AI_API_KEY;
const STT_ENDPOINT = 'https://paid-api.cantonese.ai';
const TTS_ENDPOINT = 'https://cantonese.ai/api/tts';

// Speech-to-Text endpoint
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    const filePath = req.file.path;

    // Call cantonese.ai STT API
    const formData = new FormData();
    formData.append('api_key', CANTONESE_AI_API_KEY);
    formData.append('data', fs.createReadStream(filePath));
    formData.append('with_timestamp', 'false');

    const response = await axios.post(STT_ENDPOINT, formData, {
      headers: formData.getHeaders()
    });

    // Clean up uploaded file
    fs.unlinkSync(filePath);

    // Get Jyutping romanization
    const jyutping = await getJyutping(response.data.text);

    res.json({
      text: response.data.text,
      jyutping: jyutping,
      duration: response.data.duration
    });

  } catch (error) {
    console.error('Transcription error:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Transcription failed', 
      details: error.response?.data || error.message 
    });
  }
});

// Text-to-Speech endpoint
app.post('/api/synthesize', async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'No text provided' });
    }

    // Call cantonese.ai TTS API
    const response = await axios.post(TTS_ENDPOINT, {
      api_key: CANTONESE_AI_API_KEY,
      text: text,
      language: 'cantonese',
      output_extension: 'mp3',
      frame_rate: '24000',
      speed: 1.0,
      should_enhance: true
    }, {
      responseType: 'arraybuffer'
    });

    // Get Jyutping for the text
    const jyutping = await getJyutping(text);

    res.json({
      audio: Buffer.from(response.data).toString('base64'),
      text: text,
      jyutping: jyutping
    });

  } catch (error) {
    console.error('Synthesis error:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Speech synthesis failed',
      details: error.response?.data || error.message 
    });
  }
});

// Jyutping conversion helper
async function getJyutping(text) {
  return new Promise((resolve, reject) => {
    // Call Python script for Jyutping conversion
    const pythonProcess = spawn('python3', [
      path.join(__dirname, 'utils', 'jyutping.py'),
      text
    ]);

    let result = '';
    let error = '';

    pythonProcess.stdout.on('data', (data) => {
      result += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      error += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        console.error('Jyutping conversion error:', error);
        resolve(''); // Return empty string on error
      } else {
        resolve(result.trim());
      }
    });

    // Timeout after 5 seconds
    setTimeout(() => {
      pythonProcess.kill();
      resolve('');
    }, 5000);
  });
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
