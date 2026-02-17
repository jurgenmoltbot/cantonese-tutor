#!/usr/bin/env python3
"""
Edge TTS wrapper for Cantonese speech synthesis.
Usage: python3 edge_tts.py "你好" [voice] [output_file]

Voices:
  - zh-HK-WanLungNeural (Male, default)
  - zh-HK-HiuGaaiNeural (Female)
  - zh-HK-HiuMaanNeural (Female)
"""

import sys
import asyncio
import edge_tts
import tempfile
import base64
import os

DEFAULT_VOICE = "zh-HK-WanLungNeural"  # Male voice

async def synthesize(text: str, voice: str = DEFAULT_VOICE, output_path: str = None) -> bytes:
    """Synthesize text to speech and return audio bytes."""
    
    # Use temp file if no output path specified
    if output_path is None:
        fd, output_path = tempfile.mkstemp(suffix=".mp3")
        os.close(fd)
        cleanup = True
    else:
        cleanup = False
    
    try:
        communicate = edge_tts.Communicate(text, voice)
        await communicate.save(output_path)
        
        with open(output_path, "rb") as f:
            audio_data = f.read()
        
        return audio_data
    finally:
        if cleanup and os.path.exists(output_path):
            os.remove(output_path)

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 edge_tts.py <text> [voice] [output_file]", file=sys.stderr)
        sys.exit(1)
    
    text = sys.argv[1]
    voice = sys.argv[2] if len(sys.argv) > 2 else DEFAULT_VOICE
    output_file = sys.argv[3] if len(sys.argv) > 3 else None
    
    audio_data = asyncio.run(synthesize(text, voice, output_file))
    
    if output_file:
        print(f"Saved to {output_file}")
    else:
        # Output base64-encoded audio to stdout
        print(base64.b64encode(audio_data).decode('utf-8'))

if __name__ == "__main__":
    main()
