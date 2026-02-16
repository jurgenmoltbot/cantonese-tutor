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
const TTS_ENDPOINT = 'https://cantonese.ai/api/tts';
const SCORE_ENDPOINT = 'https://cantonese.ai/api/score';

// Conversation history storage (in-memory, per session)
// In production, you'd want to use sessions or a database
let conversationHistory = [];

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

// Helper to delay execution
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Retry with progressive backoff: 30s, 60s, 2min, 5min
const RETRY_DELAYS = [30000, 60000, 120000, 300000];

async function callWithRetry(fn, retryDelays = RETRY_DELAYS) {
  let lastError;
  
  // First attempt (no delay)
  try {
    return await fn();
  } catch (error) {
    lastError = error;
    const status = error.response?.status;
    // Only retry on 5xx errors (server errors) or network errors
    if (status && status < 500) {
      throw error;
    }
    console.log(`TTS failed with status ${status}, will retry...`);
  }
  
  // Retry attempts with backoff
  for (let i = 0; i < retryDelays.length; i++) {
    const delayMs = retryDelays[i];
    console.log(`Waiting ${delayMs/1000}s before retry ${i + 1}/${retryDelays.length}...`);
    await delay(delayMs);
    
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const status = error.response?.status;
      if (status && status < 500) {
        throw error;
      }
      console.log(`Retry ${i + 1} failed with status ${status}`);
    }
  }
  
  throw lastError;
}

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

    // Call cantonese.ai TTS API with retry on 5xx errors
    const response = await callWithRetry(async () => {
      return await axios.post(TTS_ENDPOINT, {
        api_key: CANTONESE_AI_API_KEY,
        text: aiText,
        language: 'cantonese',
        voice_id: '776fc91d-9d92-46b6-8522-e8317f687892', // Bill
        output_extension: 'mp3',
        frame_rate: '24000',
        speed: 1.0,
        should_enhance: true
      }, {
        headers: {
          'Content-Type': 'application/json'
        },
        responseType: 'arraybuffer'
      });
    });

    // Get Jyutping for the AI text
    const jyutping = await getJyutping(aiText);

    res.json({
      audio: Buffer.from(response.data).toString('base64'),
      text: aiText,
      jyutping: jyutping
    });

  } catch (error) {
    // Better error logging - decode buffer if it's HTML
    let errorDetails = error.response?.data || error.message;
    if (Buffer.isBuffer(errorDetails)) {
      errorDetails = errorDetails.toString('utf8').substring(0, 500);
    }
    console.error('Synthesis error:', errorDetails);
    console.error('Status:', error.response?.status);
    res.status(500).json({ 
      error: 'Speech synthesis failed',
      details: errorDetails
    });
  }
});

// AI Response Generator using Claude
async function generateAIResponse(userText, context) {
    // Add user message to history
    conversationHistory.push({
        role: 'user',
        content: userText
    });

    // Keep only last 20 messages to avoid token limits
    if (conversationHistory.length > 20) {
        conversationHistory = conversationHistory.slice(-20);
    }

    // If no Anthropic API key, use fallback responses
    if (!ANTHROPIC_API_KEY) {
        const fallbackResponse = getFallbackResponse(userText);
        conversationHistory.push({
            role: 'assistant',
            content: fallbackResponse
        });
        return fallbackResponse;
    }

    try {
        const response = await axios.post('https://api.anthropic.com/v1/messages', {
            model: 'claude-sonnet-4-20250514',
            max_tokens: 300,
            system: `You are a friendly Cantonese language tutor. You MUST respond ONLY in Cantonese (Traditional Chinese characters used in Hong Kong). 

Your role:
- Help the user practice conversational Cantonese
- Keep responses short (1-2 sentences) for easy pronunciation practice
- Use natural, everyday Cantonese expressions
- If the user makes mistakes, gently correct them in Cantonese
- Ask follow-up questions to keep the conversation going
- Adjust difficulty based on the user's level

IMPORTANT: Respond ONLY in Cantonese. No English, no Mandarin, no Pinyin - only Cantonese with Traditional Chinese characters.`,
            messages: conversationHistory
        }, {
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01'
            }
        });

        const aiText = response.data.content[0].text;
        
        // Add assistant response to history
        conversationHistory.push({
            role: 'assistant',
            content: aiText
        });

        return aiText;

    } catch (error) {
        console.error('Claude API error:', error.response?.data || error.message);
        // Fallback to simple responses if API fails
        const fallbackResponse = getFallbackResponse(userText);
        conversationHistory.push({
            role: 'assistant',
            content: fallbackResponse
        });
        return fallbackResponse;
    }
}

// Fallback responses when Claude API is unavailable
function getFallbackResponse(userText) {
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

// Pronunciation Scoring endpoint
app.post('/api/score', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    const targetText = req.body.text;
    if (!targetText) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'No target text provided' });
    }

    const filePath = req.file.path;

    // Call cantonese.ai Score API
    const formData = new FormData();
    formData.append('api_key', CANTONESE_AI_API_KEY);
    formData.append('audio', fs.createReadStream(filePath));
    formData.append('text', targetText);

    const response = await axios.post(SCORE_ENDPOINT, formData, {
      headers: formData.getHeaders()
    });

    // Clean up uploaded file
    fs.unlinkSync(filePath);

    res.json({
      success: response.data.success,
      score: response.data.score,
      passed: response.data.passed,
      expectedJyutping: response.data.expectedJyutping,
      transcribedJyutping: response.data.transcribedJyutping,
      targetText: targetText
    });

  } catch (error) {
    console.error('Scoring error:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Pronunciation scoring failed', 
      details: error.response?.data || error.message 
    });
  }
});

// Clear conversation history
app.post('/api/clear-history', (req, res) => {
  conversationHistory = [];
  res.json({ success: true, message: 'Conversation history cleared' });
});

// Check grammar/naturalness of Cantonese statement
app.post('/api/check-grammar', async (req, res) => {
  try {
    const { text, withAudio } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'No text provided' });
    }
    
    // Add the grammar check question to conversation history
    const questionText = `我想問下：「${text}」呢句啱唔啱？`;
    conversationHistory.push({
      role: 'user',
      content: questionText
    });
    
    let aiResponse;
    
    if (ANTHROPIC_API_KEY) {
      // Use Claude to check the grammar
      const response = await axios.post('https://api.anthropic.com/v1/messages', {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        system: `You are a Cantonese language tutor. The user will ask if their Cantonese statement is correct.

Your job is to:
1. Evaluate if the statement sounds natural in colloquial Hong Kong Cantonese
2. If correct, praise them briefly
3. If there are issues, explain what's wrong and provide the correct way to say it
4. Keep response SHORT (2-3 sentences max)
5. Respond ONLY in Cantonese (Traditional Chinese characters)

Be encouraging but honest. Focus on natural colloquial usage, not formal/written Chinese.`,
        messages: conversationHistory
      }, {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        }
      });
      
      aiResponse = response.data.content[0].text;
    } else {
      // Fallback if no API key
      aiResponse = '我冇辦法檢查你嘅廣東話，因為API未設定好。';
    }
    
    // Add AI response to history
    conversationHistory.push({
      role: 'assistant',
      content: aiResponse
    });
    
    // Keep only last 20 messages
    if (conversationHistory.length > 20) {
      conversationHistory = conversationHistory.slice(-20);
    }
    
    // Get Jyutping for the response
    const jyutping = await getJyutping(aiResponse);
    
    // Generate audio if requested
    let audio = null;
    if (withAudio) {
      try {
        const ttsResponse = await callWithRetry(async () => {
          return await axios.post(TTS_ENDPOINT, {
            api_key: CANTONESE_AI_API_KEY,
            text: aiResponse,
            language: 'cantonese',
            voice_id: '776fc91d-9d92-46b6-8522-e8317f687892', // Bill
            output_extension: 'mp3',
            frame_rate: '24000',
            speed: 1.0,
            should_enhance: true
          }, {
            headers: {
              'Content-Type': 'application/json'
            },
            responseType: 'arraybuffer'
          });
        });
        audio = Buffer.from(ttsResponse.data).toString('base64');
      } catch (ttsError) {
        console.error('TTS error for grammar check:', ttsError.message);
        // Continue without audio
      }
    }
    
    res.json({
      text: aiResponse,
      jyutping: jyutping,
      audio: audio
    });
    
  } catch (error) {
    console.error('Grammar check error:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Grammar check failed',
      details: error.response?.data || error.message 
    });
  }
});

// Import conversation history
app.post('/api/import-history', (req, res) => {
  try {
    const { history } = req.body;
    
    if (!Array.isArray(history)) {
      return res.status(400).json({ error: 'Invalid history format' });
    }
    
    // Convert imported history to Claude format
    conversationHistory = history.map(item => ({
      role: item.speaker === 'user' ? 'user' : 'assistant',
      content: item.chinese
    }));
    
    // Keep only last 20 messages
    if (conversationHistory.length > 20) {
      conversationHistory = conversationHistory.slice(-20);
    }
    
    res.json({ success: true, message: `Imported ${conversationHistory.length} messages` });
  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ error: 'Failed to import history' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', conversationLength: conversationHistory.length });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
