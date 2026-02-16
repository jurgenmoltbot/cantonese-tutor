require('dotenv').config();
const express = require('express');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Anthropic API for conversation logic
// Since we're running inside OpenClaw, we can use the API key if provided in .env
// or I can simulate the logic here.
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

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
const TTS_ENDPOINT = 'https://paid-api.cantonese.ai/api/tts';

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
    const { text, context = [] } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'No text provided' });
    }

    // Call LLM to get a Cantonese response if this is a user message
    // For the prototype, we'll implement a simple chat logic
    let aiText = text;
    let userText = '';

    if (req.body.isUser) {
      userText = text;
      // In a real app, you'd call Claude/GPT here.
      // For this prototype, I'll provide a helper to generate a smart response
      aiText = await generateAIResponse(userText, context);
    }

    // Call cantonese.ai TTS API
    const response = await axios.post(TTS_ENDPOINT, {
      api_key: CANTONESE_AI_API_KEY,
      text: aiText,
      language: 'cantonese',
      voice_id: 'eb545e15-28ec-42ba-badf-e13eec7ed4c8', // Echo (emotional)
      output_extension: 'mp3',
      frame_rate: '24000',
      speed: 1.0,
      should_enhance: true
    }, {
      responseType: 'arraybuffer'
    });

    // Get Jyutping for the AI text
    const jyutping = await getJyutping(aiText);

    res.json({
      audio: Buffer.from(response.data).toString('base64'),
      text: aiText,
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

// AI Response Generator (Mocking a call to Claude/GPT for now)
async function generateAIResponse(userText, context) {
    // This is where you'd call Anthropic/OpenAI
    // For now, I'll use a few smart patterns to make it feel like a tutor
    const lowerText = userText.toLowerCase();
    
    if (lowerText.includes('你好') || lowerText.includes('hello')) {
        return '你好！我係你嘅廣東話老師。你今日食咗飯未呀？';
    } else if (lowerText.includes('食') || lowerText.includes('飯')) {
        return '聽落唔錯喎！你想學下點樣喺餐廳用廣東話點菜嗎？';
    } else {
        return '明白。不如我哋繼續用廣東話傾偈啦，你想講咩話題？';
    }
}

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
