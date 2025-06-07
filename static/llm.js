// static/llm.js (Complete new version)
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const chatHistory = document.getElementById('chat-history');
    const chatInput = document.getElementById('chat-input');
    const sendButton = document.getElementById('send-button');
    const transcribeBtn = document.getElementById('transcribe-btn');
    const sidebar = document.getElementById('transcript-sidebar');
    const closeSidebarBtn = document.getElementById('close-sidebar-btn');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    const sidebarContent = document.getElementById('sidebar-content');

    // --- State ---
    const transcript = localStorage.getItem('transcriptForLLM');

    // --- Functions ---

    // Function to add a message to the chat UI
    function addMessageToChat(sender, message) {
        // (This function remains the same as before)
        const thinkingMessage = document.getElementById('thinking');
        if (thinkingMessage) {
            thinkingMessage.remove();
        }
        const messageWrapper = document.createElement('div');
        messageWrapper.className = `flex items-end gap-3 p-4 ${sender === 'user' ? 'justify-end' : 'justify-start'}`;
        if (message.includes('Thinking...')) {
            messageWrapper.id = 'thinking';
        }
        const contentWrapper = document.createElement('div');
        contentWrapper.className = `flex flex-col gap-1 max-w-2xl ${sender === 'user' ? 'items-end' : 'items-start'}`;
        const senderName = document.createElement('p');
        senderName.className = 'text-[#637488] text-[13px] font-normal px-1';
        senderName.textContent = sender === 'user' ? 'You' : 'Audio Analyzer';
        const messageBubble = document.createElement('div');
        messageBubble.className = `text-base font-normal leading-relaxed rounded-xl px-4 py-2 ${sender === 'user' ? 'bg-[#1978e5] text-white' : 'bg-[#f0f2f4] text-[#111418]'}`;
        messageBubble.innerHTML = message;
        contentWrapper.appendChild(senderName);
        contentWrapper.appendChild(messageBubble);
        messageWrapper.appendChild(contentWrapper);
        chatHistory.appendChild(messageWrapper);
        chatHistory.scrollTop = chatHistory.scrollHeight;
    }

    // Main function to handle sending a message
    async function handleSendMessage() {
        // (This function remains the same as before)
        const question = chatInput.value.trim();
        if (!question || !transcript) return;
        addMessageToChat('user', question);
        chatInput.value = '';
        addMessageToChat('analyzer', 'Thinking...');
        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ transcript: transcript, question: question }),
            });
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || 'An API error occurred.');
            }
            const result = await response.json();
            addMessageToChat('analyzer', result.answer);
        } catch (error) {
            addMessageToChat('analyzer', `Sorry, an error occurred: ${error.message}`);
        }
    }

    // --- NEW: Sidebar Functions ---

    // Function to parse the transcript and display it in the sidebar
    function populateSidebar(transcriptText) {
        if (!transcriptText) {
            sidebarContent.innerHTML = '<p class="text-gray-500">No transcript available.</p>';
            return;
        }

        const lines = transcriptText.split('\n').filter(line => line.trim() !== '');
        const htmlContent = lines.map(line => {
            // Regex to capture [time], [speaker], and text
            const match = line.match(/^\[(.*?)\]\s+\[(.*?)\]:\s+(.*)$/);

            if (match) {
                const timestamp = match[1];
                const speaker = match[2];
                const text = match[3];
                return `
                    <div class="mb-4">
                        <p class="text-sm text-gray-500 font-mono">${timestamp}</p>
                        <p class="text-md text-gray-800"><strong class="font-semibold text-indigo-600">${speaker}:</strong> ${text}</p>
                    </div>
                `;
            }
            // Fallback for lines that don't match the format
            return `<p class="mb-2 text-gray-600">${line}</p>`;
        }).join('');

        sidebarContent.innerHTML = htmlContent;
    }

    // Function to open the sidebar
    function openSidebar() {
        populateSidebar(transcript);
        sidebar.classList.remove('translate-x-full');
        sidebarOverlay.classList.remove('hidden');
    }

    // Function to close the sidebar
    function closeSidebar() {
        sidebar.classList.add('translate-x-full');
        sidebarOverlay.classList.add('hidden');
    }

    // --- Event Listeners ---
    sendButton.addEventListener('click', handleSendMessage);
    chatInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            handleSendMessage();
        }
    });
    
    // NEW: Sidebar event listeners
    transcribeBtn.addEventListener('click', (e) => {
        e.preventDefault(); // Prevent the link from navigating
        openSidebar();
    });
    
    closeSidebarBtn.addEventListener('click', closeSidebar);
    sidebarOverlay.addEventListener('click', closeSidebar);

    // --- Initial Load ---
    if (!transcript) {
        addMessageToChat('analyzer', '<strong>Error:</strong> Transcript not found. Please go back and analyze an audio file first.');
        transcribeBtn.style.display = 'none'; // Hide button if no transcript
    } else {
        addMessageToChat('analyzer', 'Hello! I have the transcript loaded. Ask me anything about it or click "Transcribe" to view the full log.');
    }
});