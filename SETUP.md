# Quick Setup Guide

## 📋 What You Need

1. **Cantonese.ai API Key**
   - Visit: https://cantonese.ai/
   - Sign up for an account
   - Go to: https://cantonese.ai/api-keys
   - Generate a new API key

## 🚀 Get Started

### Step 1: Configure API Key

Create a `.env` file in the project root:

```bash
cd ~/projects/cantonese-tutor
cp .env.example .env
```

Edit `.env` and add your API key:
```
CANTONESE_AI_API_KEY=your_actual_api_key_here
PORT=3000
```

### Step 2: Verify Dependencies

Everything is already installed! ✅

- ✅ Node.js packages installed (`npm install` completed)
- ✅ Python pycantonese installed (`pip3 install pycantonese` completed)
- ✅ Jyutping conversion tested and working

### Step 3: Start the Server

```bash
npm start
```

Or for development mode with auto-reload:
```bash
npm run dev
```

### Step 4: Open in Browser

Visit: **http://localhost:3000**

## 🎤 Usage

1. Click "**Start Recording**"
2. Speak in Cantonese
3. Click "**Stop Recording**"
4. See your transcription with Jyutping
5. Hear the AI response

## 🧪 Test the Setup

Before getting your API key, you can test individual components:

### Test Jyutping Conversion (Works Now!)
```bash
python3 utils/jyutping.py "你好"
# Output: nei5 hou2
```

### Test the Server (Will need API key for full functionality)
```bash
npm start
# Server will start even without API key
# But STT/TTS endpoints will fail until you add your key
```

## 💡 Current Status

**What's Working:**
- ✅ Server setup complete
- ✅ Frontend UI ready
- ✅ Jyutping conversion tested (`你好` → `nei5 hou2`)
- ✅ All dependencies installed

**What's Needed:**
- 🔑 Cantonese.ai API key (from https://cantonese.ai/api-keys)
- 🎯 Add actual conversation logic with LLM (future enhancement)

## 📁 Project Files

```
cantonese-tutor/
├── server.js              ✅ Ready
├── package.json           ✅ Ready
├── .env                   ⚠️  Need to create (copy .env.example)
├── public/
│   ├── index.html         ✅ Ready
│   ├── app.js             ✅ Ready
│   └── styles.css         ✅ Ready
└── utils/
    └── jyutping.py        ✅ Working (tested!)
```

## 🔧 Troubleshooting

### If the server starts but API calls fail:
- Make sure you added your API key to `.env`
- Check cantonese.ai account has credits/quota
- Look at server logs for detailed errors

### If Jyutping doesn't work:
- Already tested and working! ✅
- But if issues: run `pip3 install pycantonese` again

## Next Steps

1. Get your API key from cantonese.ai
2. Add it to `.env`
3. Run `npm start`
4. Open http://localhost:3000
5. Start practicing Cantonese!

加油！(Gaa1 jau4!) - Good luck!
