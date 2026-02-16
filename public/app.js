let mediaRecorder;
let audioChunks = [];
let isRecording = false;
let practiceMode = false;
let targetText = ''; // Text to practice pronunciation against

// DOM elements
const recordBtn = document.getElementById('recordBtn');
const recordIcon = document.getElementById('recordIcon');
const recordText = document.getElementById('recordText');
const recordingStatus = document.getElementById('recordingStatus');
const userTranscription = document.getElementById('userTranscription');
const aiResponse = document.getElementById('aiResponse');
const audioPlayer = document.getElementById('audioPlayer');
const conversationHistory = document.getElementById('conversationHistory');
const practiceBtn = document.getElementById('practiceBtn');
const pronunciationScore = document.getElementById('pronunciationScore');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    checkMicrophonePermission();
});

// Check microphone permission
async function checkMicrophonePermission() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        recordBtn.disabled = false;
    } catch (error) {
        console.error('Microphone permission denied:', error);
        recordingStatus.textContent = 'Microphone access denied. Please enable it.';
        recordBtn.disabled = true;
    }
}

// Record button click handler
recordBtn.addEventListener('click', async () => {
    if (!isRecording) {
        startRecording();
    } else {
        stopRecording();
    }
});

// Practice button click handler
if (practiceBtn) {
    practiceBtn.addEventListener('click', () => {
        if (targetText) {
            practiceMode = true;
            recordingStatus.textContent = `Practice mode: Say "${targetText}"`;
            practiceBtn.classList.add('active');
        } else {
            recordingStatus.textContent = 'No target phrase yet. Chat first!';
        }
    });
}

// New conversation button handler
const newConvoBtn = document.getElementById('newConvoBtn');
if (newConvoBtn) {
    newConvoBtn.addEventListener('click', async () => {
        try {
            await fetch('/api/clear-history', { method: 'POST' });
            
            // Clear UI
            conversationHistory.innerHTML = '<p class="placeholder">Your conversation will be logged here...</p>';
            userTranscription.innerHTML = '<p class="placeholder">Your transcription will appear here...</p>';
            aiResponse.innerHTML = '<p class="placeholder">AI response will appear here...</p>';
            if (pronunciationScore) pronunciationScore.style.display = 'none';
            if (practiceBtn) practiceBtn.style.display = 'none';
            audioPlayer.style.display = 'none';
            targetText = '';
            
            recordingStatus.textContent = 'New conversation started! Say something in Cantonese.';
        } catch (error) {
            console.error('Error clearing history:', error);
            recordingStatus.textContent = 'Error starting new conversation.';
        }
    });
}

// Start recording
async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
        };

        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            await transcribeAudio(audioBlob);
        };

        mediaRecorder.start();
        isRecording = true;

        // Update UI
        recordBtn.classList.add('recording');
        recordIcon.textContent = '⏹️';
        recordText.textContent = 'Stop Recording';
        recordingStatus.textContent = 'Recording... Speak now!';
        
    } catch (error) {
        console.error('Error starting recording:', error);
        recordingStatus.textContent = 'Error starting recording.';
    }
}

// Stop recording
function stopRecording() {
    if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
        isRecording = false;

        // Update UI
        recordBtn.classList.remove('recording');
        recordIcon.textContent = '🎤';
        recordText.textContent = 'Start Recording';
        recordingStatus.textContent = 'Processing...';
    }
}

// Transcribe audio
async function transcribeAudio(audioBlob) {
    try {
        // If in practice mode, score pronunciation instead of transcribing
        if (practiceMode && targetText) {
            await scorePronunciation(audioBlob, targetText);
            practiceMode = false;
            if (practiceBtn) practiceBtn.classList.remove('active');
            return;
        }

        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');

        const response = await fetch('/api/transcribe', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error('Transcription failed');
        }

        const data = await response.json();
        displayUserTranscription(data);
        
        // Add to conversation history
        addToHistory('user', data.text, data.jyutping);

        // Generate AI response
        await generateAIResponse(data.text);

    } catch (error) {
        console.error('Transcription error:', error);
        recordingStatus.textContent = 'Error: ' + error.message;
        userTranscription.innerHTML = '<p class="error">Transcription failed. Please try again.</p>';
    }
}

// Score pronunciation against target text
async function scorePronunciation(audioBlob, target) {
    try {
        recordingStatus.textContent = 'Scoring your pronunciation...';
        
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');
        formData.append('text', target);

        const response = await fetch('/api/score', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error('Scoring failed');
        }

        const data = await response.json();
        displayPronunciationScore(data);
        
    } catch (error) {
        console.error('Scoring error:', error);
        recordingStatus.textContent = 'Error scoring pronunciation.';
        if (pronunciationScore) {
            pronunciationScore.innerHTML = '<p class="error">Scoring failed. Please try again.</p>';
        }
    }
}

// Display pronunciation score
function displayPronunciationScore(data) {
    const scoreClass = data.score >= 90 ? 'excellent' : data.score >= 70 ? 'good' : data.score >= 50 ? 'fair' : 'needs-work';
    const emoji = data.score >= 90 ? '🌟' : data.score >= 70 ? '👍' : data.score >= 50 ? '💪' : '🔄';
    
    if (pronunciationScore) {
        pronunciationScore.innerHTML = `
            <div class="score-result ${scoreClass}">
                <div class="score-number">${emoji} ${data.score}/100</div>
                <div class="score-status">${data.passed ? '✅ Passed!' : '❌ Keep practicing!'}</div>
                <div class="jyutping-comparison">
                    <div class="expected">
                        <span class="label">Expected:</span>
                        <span class="jyutping">${data.expectedJyutping}</span>
                    </div>
                    <div class="transcribed">
                        <span class="label">You said:</span>
                        <span class="jyutping">${data.transcribedJyutping}</span>
                    </div>
                </div>
            </div>
        `;
        pronunciationScore.style.display = 'block';
    }
    
    recordingStatus.textContent = data.passed 
        ? 'Great pronunciation! Try another phrase.' 
        : 'Keep practicing! Click Practice to try again.';
}

// Display user transcription
function displayUserTranscription(data) {
    userTranscription.innerHTML = `
        <div class="transcription-content">
            <p class="chinese">${data.text}</p>
            <p class="jyutping">${data.jyutping || 'Jyutping unavailable'}</p>
            ${data.english ? `<p class="english">${data.english}</p>` : ''}
        </div>
    `;
    recordingStatus.textContent = 'Transcription complete!';
}

// Generate AI response
async function generateAIResponse(userText) {
    try {
        recordingStatus.textContent = 'Generating AI response...';
        
        // TODO: Add actual conversation logic with LLM
        // For now, just echo a simple response
        const responseText = '你好！你今日點呀？';
        
        const response = await fetch('/api/synthesize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: responseText })
        });

        if (!response.ok) {
            throw new Error('Speech synthesis failed');
        }

        const data = await response.json();
        displayAIResponse(data);
        playAudio(data.audio);
        
        // Add to conversation history
        addToHistory('ai', data.text, data.jyutping);

        recordingStatus.textContent = 'Ready to record again!';

    } catch (error) {
        console.error('AI response error:', error);
        recordingStatus.textContent = 'Error generating response.';
        aiResponse.innerHTML = '<p class="error">Failed to generate response.</p>';
    }
}

// Display AI response
function displayAIResponse(data) {
    // Set target text for practice mode
    targetText = data.text;
    
    aiResponse.innerHTML = `
        <div class="transcription-content">
            <p class="chinese">${data.text}</p>
            <p class="jyutping">${data.jyutping || 'Jyutping unavailable'}</p>
        </div>
    `;
    
    // Show practice button if it exists
    if (practiceBtn) {
        practiceBtn.style.display = 'inline-block';
        practiceBtn.textContent = '🎯 Practice this phrase';
    }
    
    // Hide previous score
    if (pronunciationScore) {
        pronunciationScore.style.display = 'none';
    }
}

// Play audio
function playAudio(base64Audio) {
    const audioBlob = base64ToBlob(base64Audio, 'audio/mp3');
    const audioUrl = URL.createObjectURL(audioBlob);
    audioPlayer.src = audioUrl;
    audioPlayer.style.display = 'block';
    audioPlayer.play();
}

// Convert base64 to blob
function base64ToBlob(base64, mimeType) {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
}

// Add to conversation history
function addToHistory(speaker, text, jyutping) {
    const historyItem = document.createElement('div');
    historyItem.className = `history-item ${speaker}`;
    
    const timestamp = new Date().toLocaleTimeString();
    const speakerLabel = speaker === 'user' ? 'You' : 'AI';
    
    historyItem.innerHTML = `
        <div class="history-header">
            <span class="speaker">${speakerLabel}</span>
            <span class="timestamp">${timestamp}</span>
        </div>
        <p class="chinese">${text}</p>
        ${jyutping ? `<p class="jyutping"><span class="jyutping-label">Jyutping:</span> ${jyutping}</p>` : ''}
    `;
    
    // Remove placeholder if it exists
    const placeholder = conversationHistory.querySelector('.placeholder');
    if (placeholder) {
        placeholder.remove();
    }
    
    conversationHistory.appendChild(historyItem);
    conversationHistory.scrollTop = conversationHistory.scrollHeight;
}
