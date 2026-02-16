let mediaRecorder;
let audioChunks = [];
let isRecording = false;
let lastRequest = null; // Store last request for retry

// DOM elements
const recordBtn = document.getElementById('recordBtn');
const recordIcon = document.getElementById('recordIcon');
const recordText = document.getElementById('recordText');
const recordingStatus = document.getElementById('recordingStatus');
const userTranscription = document.getElementById('userTranscription');
const aiResponse = document.getElementById('aiResponse');
const audioPlayer = document.getElementById('audioPlayer');
const conversationHistory = document.getElementById('conversationHistory');

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

// Space key to toggle recording
document.addEventListener('keydown', (e) => {
    // Ignore if typing in an input field
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
    }
    
    if (e.code === 'Space') {
        e.preventDefault(); // Prevent page scroll
        if (!isRecording) {
            startRecording();
        } else {
            stopRecording();
        }
    }
});

// Export conversation history as Markdown
const exportBtn = document.getElementById('exportBtn');
if (exportBtn) {
    exportBtn.addEventListener('click', () => {
        const historyItems = document.querySelectorAll('#conversationHistory .history-item');
        
        if (historyItems.length === 0) {
            alert('No conversation to export');
            return;
        }
        
        let markdown = `# Cantonese Conversation\n`;
        markdown += `**Date:** ${new Date().toLocaleDateString()}\n\n---\n\n`;
        
        historyItems.forEach(item => {
            const speaker = item.classList.contains('user') ? '🗣️ **You**' : '🤖 **AI (Bill)**';
            const chinese = item.querySelector('.chinese')?.textContent || '';
            const jyutping = item.querySelector('.jyutping')?.textContent?.replace('Jyutping: ', '') || '';
            const timestamp = item.querySelector('.timestamp')?.textContent || '';
            
            markdown += `### ${speaker} *(${timestamp})*\n\n`;
            markdown += `**Chinese:** ${chinese}\n\n`;
            if (jyutping) {
                markdown += `**Jyutping:** ${jyutping}\n\n`;
            }
            markdown += `---\n\n`;
        });
        
        const blob = new Blob([markdown], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cantonese-conversation-${new Date().toISOString().slice(0,10)}.md`;
        a.click();
        URL.revokeObjectURL(url);
    });
}

// Import conversation history (supports MD and JSON)
const importInput = document.getElementById('importInput');
if (importInput) {
    importInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        try {
            const text = await file.text();
            let importData;
            
            if (file.name.endsWith('.md')) {
                // Parse Markdown format
                importData = parseMarkdownConversation(text);
            } else {
                // Parse JSON format
                importData = JSON.parse(text);
            }
            
            if (!Array.isArray(importData) || importData.length === 0) {
                throw new Error('Invalid format or empty file');
            }
            
            // Clear current history UI
            conversationHistory.innerHTML = '';
            
            // Add imported items
            importData.forEach(item => {
                addToHistory(item.speaker, item.chinese, item.jyutping);
            });
            
            // Also send to server to restore context
            await fetch('/api/import-history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ history: importData })
            });
            
            recordingStatus.textContent = `Imported ${importData.length} messages`;
            
        } catch (error) {
            console.error('Import error:', error);
            alert('Failed to import conversation. Make sure it\'s a valid export file.');
        }
        
        // Reset input so same file can be imported again
        e.target.value = '';
    });
}

// Handle replay button clicks
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('btn-replay')) {
        const audio = e.target.dataset.audio;
        if (audio) {
            playAudio(audio);
        }
    }
});

// Handle "Did I say this correctly?" button clicks
document.addEventListener('click', async (e) => {
    if (e.target.classList.contains('btn-check-grammar')) {
        const userText = e.target.dataset.text;
        
        // Disable button to prevent double-clicks
        e.target.disabled = true;
        e.target.textContent = '⏳ Checking...';
        
        try {
            await checkGrammar(userText);
            // Remove the button after checking
            e.target.remove();
        } catch (error) {
            console.error('Grammar check error:', error);
            e.target.disabled = false;
            e.target.textContent = '❓ Did I say this correctly?';
        }
    }
});

// Ask AI to check if statement is correct Cantonese
async function checkGrammar(userText) {
    // Store for retry
    lastRequest = { type: 'grammar', text: userText };
    hideRetryButton();
    
    // Add the question to history (without the check button)
    const questionText = `我想問下：「${userText}」呢句啱唔啱？`;
    addToHistory('user', questionText, '', false);
    
    recordingStatus.textContent = 'Checking your Cantonese...';
    
    try {
        // Send to server for AI response with TTS
        const response = await fetch('/api/check-grammar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: userText, withAudio: true })
        });
        
        if (!response.ok) {
            throw new Error('Grammar check failed');
        }
        
        const data = await response.json();
        
        // Display in AI Response section and play audio
        displayAIResponse(data);
        if (data.audio) {
            playAudio(data.audio);
        }
        
        // Add AI response to history (with audio for replay)
        addToHistory('ai', data.text, data.jyutping, true, data.audio);
        
        recordingStatus.textContent = 'Ready to record!';
        lastRequest = null; // Clear on success
        
    } catch (error) {
        recordingStatus.textContent = 'Error checking grammar. Click Retry to try again.';
        showRetryButton();
        throw error;
    }
}

// Parse Markdown conversation format
function parseMarkdownConversation(markdown) {
    const messages = [];
    
    // Split by message blocks (### headers)
    const blocks = markdown.split(/###\s+/).filter(b => b.trim());
    
    for (const block of blocks) {
        // Skip header block
        if (block.startsWith('# ') || !block.includes('**Chinese:**')) {
            continue;
        }
        
        // Determine speaker
        const isUser = block.includes('**You**') || block.includes('🗣️');
        const speaker = isUser ? 'user' : 'ai';
        
        // Extract Chinese text
        const chineseMatch = block.match(/\*\*Chinese:\*\*\s*(.+?)(?:\n|$)/);
        const chinese = chineseMatch ? chineseMatch[1].trim() : '';
        
        // Extract Jyutping
        const jyutpingMatch = block.match(/\*\*Jyutping:\*\*\s*(.+?)(?:\n|$)/);
        const jyutping = jyutpingMatch ? jyutpingMatch[1].trim() : '';
        
        if (chinese) {
            messages.push({ speaker, chinese, jyutping });
        }
    }
    
    return messages;
}

// Retry button handlers
const retryBtn = document.getElementById('retryBtn');

function showRetryButton() {
    if (retryBtn) retryBtn.style.display = 'inline-block';
}

function hideRetryButton() {
    if (retryBtn) retryBtn.style.display = 'none';
}

if (retryBtn) {
    retryBtn.addEventListener('click', async () => {
        if (!lastRequest) {
            recordingStatus.textContent = 'Nothing to retry.';
            hideRetryButton();
            return;
        }
        
        retryBtn.disabled = true;
        retryBtn.textContent = '⏳ Retrying...';
        
        try {
            if (lastRequest.type === 'synthesize') {
                await generateAIResponse(lastRequest.userText);
            } else if (lastRequest.type === 'grammar') {
                await checkGrammar(lastRequest.text);
            }
        } finally {
            retryBtn.disabled = false;
            retryBtn.textContent = '🔁 Retry';
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
            audioPlayer.style.display = 'none';
            
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

// Score pronunciation inline (returns score data, doesn't display separately)
async function scorePronunciationInline(audioBlob, targetText) {
    try {
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');
        formData.append('text', targetText);

        const response = await fetch('/api/score', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            console.error('Scoring failed');
            return null;
        }

        return await response.json();
        
    } catch (error) {
        console.error('Scoring error:', error);
        return null;
    }
}

// Display user transcription (legacy, without score)
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

// Display user transcription with pronunciation score
function displayUserTranscriptionWithScore(data, scoreData) {
    const scoreHtml = scoreData ? getScoreBadgeHtml(scoreData.score) : '';
    
    userTranscription.innerHTML = `
        <div class="transcription-content">
            <div class="transcription-header">
                <p class="chinese">${data.text}</p>
                ${scoreHtml}
            </div>
            <p class="jyutping">${data.jyutping || 'Jyutping unavailable'}</p>
            ${scoreData ? `
                <div class="inline-score-details">
                    <span class="score-label">Your pronunciation:</span>
                    <span class="transcribed-jyutping">${scoreData.transcribedJyutping || ''}</span>
                </div>
            ` : ''}
        </div>
    `;
    recordingStatus.textContent = scoreData 
        ? `Score: ${scoreData.score}/100 ${scoreData.passed ? '✅' : '- Keep practicing!'}`
        : 'Transcription complete!';
}

// Get score badge HTML
function getScoreBadgeHtml(score) {
    const scoreClass = score >= 90 ? 'excellent' : score >= 70 ? 'good' : score >= 50 ? 'fair' : 'needs-work';
    const emoji = score >= 90 ? '🌟' : score >= 70 ? '👍' : score >= 50 ? '💪' : '🔄';
    return `<span class="score-badge ${scoreClass}">${emoji} ${score}</span>`;
}

// Generate AI response
async function generateAIResponse(userText) {
    // Store for retry
    lastRequest = { type: 'synthesize', userText };
    
    try {
        recordingStatus.textContent = 'Generating AI response...';
        hideRetryButton();
        
        // Call backend to generate AI response and synthesize speech
        const response = await fetch('/api/synthesize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: userText, isUser: true })
        });

        if (!response.ok) {
            throw new Error('Speech synthesis failed');
        }

        const data = await response.json();
        displayAIResponse(data);
        if (data.audio) {
            playAudio(data.audio);
        }
        
        // Add to conversation history (with audio for replay)
        addToHistory('ai', data.text, data.jyutping, true, data.audio);

        recordingStatus.textContent = 'Ready to record again!';
        lastRequest = null; // Clear on success

    } catch (error) {
        console.error('AI response error:', error);
        recordingStatus.textContent = 'Error generating response. Click Retry to try again.';
        aiResponse.innerHTML = '<p class="error">Failed to generate response.</p>';
        showRetryButton();
    }
}

// Display AI response
function displayAIResponse(data) {
    aiResponse.innerHTML = `
        <div class="transcription-content">
            <p class="chinese">${data.text}</p>
            <p class="jyutping">${data.jyutping || 'Jyutping unavailable'}</p>
        </div>
    `;
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
function addToHistory(speaker, text, jyutping, showCheckButton = true, audio = null) {
    const historyItem = document.createElement('div');
    historyItem.className = `history-item ${speaker}`;
    
    const timestamp = new Date().toLocaleTimeString();
    const speakerLabel = speaker === 'user' ? 'You' : 'AI';
    
    // Only show "Did I say this correctly?" button for user messages (not for check requests)
    const checkButton = (speaker === 'user' && showCheckButton) 
        ? `<button class="btn-check-grammar" data-text="${text.replace(/"/g, '&quot;')}" title="Ask AI if this is correct Cantonese">❓ Did I say this correctly?</button>`
        : '';
    
    // Replay button for AI messages with audio
    const replayButton = (speaker === 'ai' && audio)
        ? `<button class="btn-replay" data-audio="${audio}" title="Replay audio">🔊 Replay</button>`
        : '';
    
    historyItem.innerHTML = `
        <div class="history-header">
            <span class="speaker">${speakerLabel}</span>
            <span class="timestamp">${timestamp}</span>
        </div>
        <p class="chinese">${text}</p>
        ${jyutping ? `<p class="jyutping"><span class="jyutping-label">Jyutping:</span> ${jyutping}</p>` : ''}
        ${checkButton}
        ${replayButton}
    `;
    
    // Remove placeholder if it exists
    const placeholder = conversationHistory.querySelector('.placeholder');
    if (placeholder) {
        placeholder.remove();
    }
    
    conversationHistory.appendChild(historyItem);
    conversationHistory.scrollTop = conversationHistory.scrollHeight;
}
