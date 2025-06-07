// /static/issue.js
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const tokenInput = document.getElementById('github-token');
    const repoInput = document.getElementById('repo-name');
    const titleInput = document.getElementById('issue-title');
    const descriptionTextarea = document.getElementById('issue-description');
    const transcriptSelect = document.getElementById('transcript-select');
    const createIssueBtn = document.getElementById('create-issue-btn');
    const feedbackMessage = document.getElementById('feedback-message');

    let allNotes = []; // 用來儲存從 API 獲取的完整會議紀錄

    // --- Functions ---

    // 1. 從後端獲取會議紀錄列表並填入下拉選單
    async function populateTranscriptsDropdown() {
        try {
            const response = await fetch('/api/transcripts');
            if (!response.ok) throw new Error('Failed to fetch transcripts.');
            
            const notes = await response.json();
            allNotes = notes; // 儲存完整資料

            // 清空舊的選項（除了第一個提示選項）
            transcriptSelect.options.length = 1;

            notes.forEach(note => {
                const option = document.createElement('option');
                option.value = note.id;
                option.textContent = `${note.title} (${new Date(note.created_at).toLocaleDateString()})`;
                transcriptSelect.appendChild(option);
            });
        } catch (error) {
            feedbackMessage.innerHTML = `<p class="text-red-600">Error loading notes: ${error.message}</p>`;
        }
    }

    // 2. 當使用者選擇一筆紀錄時，自動填入描述欄
    function handleTranscriptSelection() {
        const selectedId = parseInt(transcriptSelect.value, 10);
        const selectedNote = allNotes.find(note => note.id === selectedId);

        if (selectedNote) {
            // 自動產生格式化的描述內容
            descriptionTextarea.value = `### 相關會議紀錄\n\n**標題:** ${selectedNote.title}\n**時間:** ${new Date(selectedNote.created_at).toLocaleString()}\n\n---\n\n### 會議逐字稿\n\n\`\`\`\n${selectedNote.content}\n\`\`\``;
        } else {
            descriptionTextarea.value = '';
        }
    }

    // 3. 處理 "Create Issue" 按鈕點擊事件
    async function handleCreateIssue() {
        // 從輸入框獲取所有資料
        const githubToken = tokenInput.value.trim();
        const repoName = repoInput.value.trim();
        const title = titleInput.value.trim();
        const body = descriptionTextarea.value.trim();

        // 基本的驗證
        if (!githubToken || !repoName || !title || !body) {
            feedbackMessage.innerHTML = `<p class="text-red-600">Please fill out all fields.</p>`;
            return;
        }

        // 顯示載入中狀態
        createIssueBtn.disabled = true;
        createIssueBtn.textContent = 'Creating...';
        feedbackMessage.innerHTML = '';

        try {
            const response = await fetch('/api/github/issue', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    github_token: githubToken,
                    repo_name: repoName,
                    title: title,
                    body: body,
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.detail || 'An unknown error occurred.');
            }
            
            // 顯示成功訊息
            feedbackMessage.innerHTML = `<div class="p-4 bg-green-100 text-green-800 rounded-md">✅ Issue created successfully! <a href="${result.issue_url}" target="_blank" class="font-bold underline">View it on GitHub</a></div>`;
            // 清空表單
            titleInput.value = '';
            descriptionTextarea.value = '';
            transcriptSelect.value = '';

        } catch (error) {
            feedbackMessage.innerHTML = `<p class="text-red-600">❌ Error: ${error.message}</p>`;
        } finally {
            // 恢復按鈕狀態
            createIssueBtn.disabled = false;
            createIssueBtn.textContent = 'Create Issue';
        }
    }

    // --- Event Listeners ---
    transcriptSelect.addEventListener('change', handleTranscriptSelection);
    createIssueBtn.addEventListener('click', handleCreateIssue);

    // --- Initial Load ---
    populateTranscriptsDropdown();
});