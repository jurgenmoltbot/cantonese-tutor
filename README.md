# 🇭🇰 Cantonese Learning App

An AI-powered Cantonese conversation practice web application that helps you learn Cantonese through interactive voice conversations.

## Features

- 🎤 **Voice Recording**: Record your Cantonese speech directly in the browser
- 📝 **Speech-to-Text**: Transcribes your Cantonese speech to Chinese characters
- 🔤 **Jyutping Romanization**: Shows pronunciation guide in Jyutping format
- 🗣️ **Text-to-Speech**: AI responds with natural Cantonese audio
- 💬 **Conversation History**: Track your practice sessions
- 🌐 **Mixed Language Support**: Handles Cantonese and occasional English

## Tech Stack

- **Frontend**: HTML, CSS, JavaScript (Vanilla JS + Web Audio API)
- **Backend**: Node.js, Express
- **Speech-to-Text**: [cantonese.ai](https://cantonese.ai/) API
- **Text-to-Speech**: [cantonese.ai](https://cantonese.ai/) API
- **Jyutping Conversion**: pycantonese (Python library)

## Prerequisites

- Node.js (v16 or higher)
- Python 3 (for Jyutping conversion)
- cantonese.ai API key

## Setup Instructions

### 1. Clone/Navigate to the Project

```bash
cd ~/projects/cantonese-tutor
```

### 2. Install Node.js Dependencies

```bash
npm install
```

### 3. Install Python Dependencies

```bash
pip3 install pycantonese
```

### 4. Get Your API Key

1. Visit [cantonese.ai](https://cantonese.ai/)
2. Sign up for an account
3. Go to [API Keys](https://cantonese.ai/api-keys)
4. Generate a new API key

### 5. Configure Environment Variables

```bash
cp .env.example .env
# Edit .env and add your API key
```

Your `.env` file should look like:
```
CANTONESE_AI_API_KEY=your_actual_api_key_here
PORT=3000
```

### 6. Run the Server

```bash
npm start
```

Or for development with auto-reload:
```bash
npm run dev
```

### 7. Open in Browser

Visit: http://localhost:3000

## Usage

1. **Grant Microphone Permission**: When prompted, allow the browser to access your microphone
2. **Click "Start Recording"**: Begin speaking in Cantonese
3. **Click "Stop Recording"**: The app will:
   - Transcribe your speech to Chinese characters
   - Show the Jyutping pronunciation
   - Generate an AI response in Cantonese
   - Play the audio response
4. **View History**: See your full conversation in the history section

## Project Structure

```
cantonese-tutor/
├── server.js              # Node.js Express backend
├── package.json           # Node dependencies
├── .env                   # Environment variables (API key)
├── .env.example           # Example env file
├── README.md              # This file
├── public/
│   ├── index.html         # Frontend HTML
│   ├── app.js             # Client-side JavaScript
│   └── styles.css         # CSS styling
├── utils/
│   └── jyutping.py        # Python script for Jyutping conversion
└── uploads/               # Temporary audio file storage

```

## API Endpoints

### POST `/api/transcribe`
- **Description**: Transcribes Cantonese audio to text
- **Input**: Audio file (multipart/form-data)
- **Output**: JSON with text, Jyutping, and duration

### POST `/api/synthesize`
- **Description**: Converts text to Cantonese speech
- **Input**: JSON with `text` field
- **Output**: JSON with base64 audio, text, and Jyutping

### GET `/api/health`
- **Description**: Health check endpoint
- **Output**: `{ status: 'ok' }`

## Future Enhancements

- [ ] Add actual LLM conversation logic (e.g., OpenAI GPT-4 with Cantonese context)
- [ ] Implement conversation topics/scenarios
- [ ] Add pronunciation scoring/feedback
- [ ] Support for tone practice
- [ ] Vocabulary flashcards
- [ ] Progress tracking
- [ ] Multiple voice options
- [ ] Offline mode with local models

## Troubleshooting

### Microphone not working
- Check browser permissions (Settings > Privacy > Microphone)
- Use HTTPS or localhost (required for microphone access)

### Python script errors
- Ensure `python3` is in your PATH
- Install pycantonese: `pip3 install pycantonese`
- Check Python version: `python3 --version` (should be 3.6+)

### API errors
- Verify your API key in `.env`
- Check cantonese.ai account credit/quota
- Review server logs for detailed error messages

## Credits

- **API Provider**: [cantonese.ai](https://cantonese.ai/) - Cantonese AI platform
- **Jyutping Library**: [pycantonese](https://pycantonese.org/) - Python library for Cantonese
- **Created by**: Roger (with help from Jurgen MoltBot 🦉)

## License

MIT

---

Happy learning! 加油！ (Gaa1 jau4!)
