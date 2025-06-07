// static/script.js (請使用此最終版本來修正按鈕問題)
document.addEventListener('DOMContentLoaded', () => {
    // 獲取所有需要的 DOM 元素
    const fileInput = document.getElementById('audio-file');
    const analyzeBtn = document.getElementById('analyze-btn');
    const fileNameDisplay = document.getElementById('file-name-display');
    const fileUploadLabel = document.getElementById('file-upload-label');
    const youtubeUrlInput = document.getElementById('youtube-url');
    const youtubeBtn = document.getElementById('youtube-btn');
    
    const loader = document.getElementById('loader');
    const resultContainer = document.getElementById('result-container');
    const resultText = document.getElementById('result-text');
    const errorMessage = document.getElementById('error-message');
    const goToLlmBtn = document.getElementById('go-to-llm-btn'); // 獲取新按鈕

    let audioFile = null;

    // --- 事件監聽 ---

    fileInput.addEventListener('change', (event) => {
        const files = event.target.files;
        if (files.length > 0) {
            handleFile(files[0]);
        }
    });

    fileUploadLabel.addEventListener('dragover', (e) => { e.preventDefault(); fileUploadLabel.classList.add('bg-indigo-50', 'border-indigo-500'); });
    fileUploadLabel.addEventListener('dragleave', (e) => { e.preventDefault(); fileUploadLabel.classList.remove('bg-indigo-50', 'border-indigo-500'); });
    fileUploadLabel.addEventListener('drop', (e) => {
        e.preventDefault();
        fileUploadLabel.classList.remove('bg-indigo-50', 'border-indigo-500');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            fileInput.files = files;
            handleFile(files[0]);
        }
    });

    analyzeBtn.addEventListener('click', async () => {
        if (!audioFile) {
            showError('請先選擇一個音訊檔案。');
            return;
        }
        const formData = new FormData();
        formData.append('file', audioFile);
        await performAnalysis('/api/analyze-audio', { method: 'POST', body: formData });
    });

youtubeBtn.addEventListener('click', async () => {
    const url = youtubeUrlInput.value.trim();
    if (!url || !isValidYoutubeUrl(url)) {
        showError('請輸入有效的 YouTube 網址。');
        return;
    }

    // 步驟 1: 在送出分析請求前，先用彈出視窗請使用者為這筆紀錄命名
    const title = prompt("請為這個 YouTube 會議紀錄命名：", "YouTube Meeting");

    // 如果使用者沒有輸入名稱或按下取消，就停止後續操作
    if (!title) {
        return;
    }

    // 步驟 2: 將 url 和使用者輸入的 title 一起打包送到後端
    await performAnalysis('/api/download-from-youtube', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // 在這裡同時傳送 url 和 title
        body: JSON.stringify({ url: url, title: title }),
    });
});
    
    // 為新按鈕增加點擊事件監聽
    if(goToLlmBtn) {
        goToLlmBtn.addEventListener('click', () => {
            // 跳轉到 llm.html 頁面
            window.location.href = '/llm';
        });
    }

    // --- 核心功能函式 ---

    function handleFile(file) {
        audioFile = file;
        fileNameDisplay.textContent = file.name;
        fileNameDisplay.classList.add('text-indigo-700', 'font-semibold');
        analyzeBtn.disabled = false;
        hideError();
        resultContainer.classList.add('hidden');
        if (goToLlmBtn) {
            goToLlmBtn.classList.add('hidden'); // 選擇新檔案時，隱藏按鈕
        }
    }
    
    async function performAnalysis(endpoint, options) {
        setLoading(true);
        hideError();
        resultContainer.classList.add('hidden');
        if (goToLlmBtn) {
            goToLlmBtn.classList.add('hidden');
        }

        try {
            const response = await fetch(endpoint, options);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || `請求失敗`);
            }
            const result = await response.json();
            // 注意：我們在這裡呼叫 displayResult，而不是直接跳轉
            displayResult(result.transcript); 
        } catch (error) {
            showError(`分析失敗：${error.message}`);
        } finally {
            setLoading(false);
        }
    }

    // --- UI 更新函式 ---

    function setLoading(isLoading) {
        if (isLoading) {
            loader.classList.remove('hidden');
            analyzeBtn.disabled = true;
            youtubeBtn.disabled = true;
            analyzeBtn.textContent = '分析中...';
        } else {
            loader.classList.add('hidden');
            analyzeBtn.disabled = !audioFile;
            youtubeBtn.disabled = false;
            analyzeBtn.textContent = '分析上傳檔案';
        }
    }

    // 這個函式負責在當前頁面顯示結果和按鈕
    function displayResult(text) {
        resultText.textContent = text.trim();
        resultContainer.classList.remove('hidden');

        localStorage.setItem('transcriptForLLM', text.trim());

        if (goToLlmBtn) {
            goToLlmBtn.classList.remove('hidden');
        }
    }

    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.classList.remove('hidden');
    }

    function hideError() {
        errorMessage.classList.add('hidden');
    }

    function isValidYoutubeUrl(url) {
        const pattern = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;
        return pattern.test(url);
    }
});