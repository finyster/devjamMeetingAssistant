// static/llm.js (請使用此最終版本)
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const notesListContainer = document.getElementById('notes-list-container');
    const chatContainer = document.getElementById('chat-container');
    const chatInput = document.getElementById('chat-input');
    const sendButton = document.getElementById('send-button');
    const modal = document.getElementById('transcript-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const modalCloseBtn = document.getElementById('modal-close-btn');

    // --- State ---
    let allNotes = []; // 這裡現在會儲存包含 content 的完整筆記

    // --- Functions ---

    // 1. 從後端獲取並顯示筆記列表
    async function loadNotes() {
        try {
            const response = await fetch('/api/transcripts');
            if (!response.ok) throw new Error('Failed to fetch notes.');
            const notes = await response.json();
            
            allNotes = notes; // 儲存包含 content 的完整資料

            if (notes.length === 0) {
                notesListContainer.innerHTML = '<p class="text-slate-500">No notes found.</p>';
                return;
            }

notesListContainer.innerHTML = notes.map(note => `
   <div id="note-item-${note.id}" class="note-item p-3 mb-2 rounded-lg border bg-white hover:bg-indigo-50 transition-colors duration-200">
       <div class="flex items-center">
           <label class="flex items-center cursor-pointer flex-grow">
               <input type="checkbox" data-note-id="${note.id}" class="custom-checkbox h-4 w-4 rounded border-gray-300 mr-3 shrink-0 appearance-none">
               <div class="flex-grow">
                   <p class="font-semibold text-gray-800">${note.title}</p>
                   <p class="text-xs text-gray-500">${new Date(note.created_at).toLocaleString()}</p>
               </div>
           </label>
           <button class="view-transcript-btn text-xs font-semibold text-indigo-600 hover:underline ml-2 px-2" data-note-id="${note.id}">View</button>
           
           <button class="delete-note-btn text-xs font-semibold text-red-600 hover:underline px-2" data-note-id="${note.id}">Delete</button>
       </div>
   </div>
`).join('');

        } catch (error) {
            notesListContainer.innerHTML = `<p class="text-red-500">${error.message}</p>`;
        }
    }

    // 2. 將訊息加入聊天視窗 (確保 prose class 生效)
    function addMessageToChat(sender, message) {
        const messageWrapper = document.createElement('div');
        messageWrapper.className = `flex flex-col mb-4 ${sender === 'user' ? 'items-end' : 'items-start'}`;
        const messageBubble = document.createElement('div');
        messageBubble.className = `p-3 rounded-lg max-w-2xl prose ${sender === 'user' ? 'bg-indigo-500 text-white prose-invert' : 'bg-gray-200 text-gray-800'}`;
        messageBubble.innerHTML = message;
        messageWrapper.appendChild(messageBubble);
        chatContainer.appendChild(messageWrapper);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    // 3. 處理聊天訊息的發送
    async function handleSendMessage() {
        const question = chatInput.value.trim();
        if (!question) return;

        const selectedCheckboxes = document.querySelectorAll('.note-item input[type="checkbox"]:checked');
        if (selectedCheckboxes.length === 0) {
            alert('Please select at least one note to analyze.');
            return;
        }

        const selectedTranscripts = Array.from(selectedCheckboxes).map(checkbox => {
            const noteId = parseInt(checkbox.dataset.noteId, 10);
            const foundNote = allNotes.find(note => note.id === noteId);
            // 現在 foundNote.content 一定有值
            return foundNote ? foundNote.content : '';
        }).filter(content => content);

        addMessageToChat('user', `<p>${question}</p>`);
        chatInput.value = '';

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ transcripts: selectedTranscripts, question: question }),
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || 'An API error occurred.');
            }

            const result = await response.json();
            addMessageToChat('analyzer', result.answer);

        } catch (error) {
            addMessageToChat('analyzer', `<div class="text-red-500 font-bold">Error: ${error.message}</div>`);
        }
    }
    
    // 4. 開啟/關閉逐字稿 Modal
    function openModal(noteId) {
        const note = allNotes.find(n => n.id === noteId);
        if (!note) return;

        modalTitle.textContent = note.title;
        // 將逐字稿文字中的換行符號轉換為 HTML 的 <br>，讓格式更美觀
        modalBody.innerHTML = `<p>${note.content.replace(/\n/g, '<br><br>')}</p>`;
        
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        setTimeout(() => {
            modal.style.opacity = '1';
            modal.querySelector('.modal-content').style.transform = 'scale(1)';
        }, 10);
    }

    function closeModal() {
        modal.style.opacity = '0';
        modal.querySelector('.modal-content').style.transform = 'scale(0.95)';
        setTimeout(() => {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }, 250);
    }

    // --- Event Listeners ---
    sendButton.addEventListener('click', handleSendMessage);
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    });

notesListContainer.addEventListener('click', async (e) => {
    // 處理 "View" 按鈕的點擊
    if (e.target.classList.contains('view-transcript-btn')) {
        const noteId = parseInt(e.target.dataset.noteId, 10);
        openModal(noteId);
    }

    // 新增：處理 "Delete" 按鈕的點擊
    if (e.target.classList.contains('delete-note-btn')) {
        const noteId = parseInt(e.target.dataset.noteId, 10);
        
        // 彈出確認視窗，防止使用者誤刪
        if (confirm(`您確定要刪除這筆會議紀錄嗎？`)) {
            try {
                const response = await fetch(`/api/transcripts/${noteId}`, {
                    method: 'DELETE',
                });

                if (response.ok) {
                    // 如果後端成功刪除，就重新載入整個列表以更新畫面
                    // 這是最簡單且確保資料同步的方式
                    loadNotes();
                } else {
                    const err = await response.json();
                    alert(`刪除失敗: ${err.detail || '未知錯誤'}`);
                }
            } catch (error) {
                alert(`刪除時發生錯誤: ${error.message}`);
            }
        }
    }
});
    
    modalCloseBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });

    // --- Initial Load ---
    loadNotes();
    addMessageToChat('analyzer', '<p>Welcome! Please select one or more notes from the left to begin your analysis.</p>');
});