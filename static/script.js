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

    let audioFile = null;

    // --- 事件監聽 ---

    // 監聽檔案選擇事件
    fileInput.addEventListener('change', (event) => {
        const files = event.target.files;
        if (files.length > 0) {
            handleFile(files[0]);
        }
    });

    // 處理檔案拖曳事件
    fileUploadLabel.addEventListener('dragover', (e) => {
        e.preventDefault();
        fileUploadLabel.classList.add('bg-indigo-50', 'border-indigo-500');
    });
    fileUploadLabel.addEventListener('dragleave', (e) => {
        e.preventDefault();
        fileUploadLabel.classList.remove('bg-indigo-50', 'border-indigo-500');
    });
    fileUploadLabel.addEventListener('drop', (e) => {
        e.preventDefault();
        fileUploadLabel.classList.remove('bg-indigo-50', 'border-indigo-500');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            fileInput.files = files;
            handleFile(files[0]);
        }
    });

    // 監聽 "分析上傳檔案" 按鈕
    analyzeBtn.addEventListener('click', async () => {
        if (!audioFile) {
            showError('請先選擇一個音訊檔案。');
            return;
        }
        
        const formData = new FormData();
        formData.append('file', audioFile);

        await performAnalysis('/api/analyze-audio', {
            method: 'POST',
            body: formData,
        });
    });

    // 監聽 "從 YouTube 分析" 按鈕
    youtubeBtn.addEventListener('click', async () => {
        const url = youtubeUrlInput.value.trim();
        if (!url) {
            showError('請輸入有效的 YouTube 網址。');
            return;
        }
        if (!isValidYoutubeUrl(url)) {
            showError('您輸入的似乎不是有效的 YouTube 網址。');
            return;
        }

        await performAnalysis('/api/download-from-youtube', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url: url }),
        });
    });

    // --- 核心功能函式 ---

    function handleFile(file) {
        audioFile = file;
        fileNameDisplay.textContent = file.name;
        fileNameDisplay.classList.add('text-indigo-700', 'font-semibold');
        analyzeBtn.disabled = false;
        hideError();
        resultContainer.classList.add('hidden');
    }
    
    async function performAnalysis(endpoint, options) {
        setLoading(true);
        hideError();
        resultContainer.classList.add('hidden');

        try {
            const response = await fetch(endpoint, options);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || `請求失敗，狀態碼：${response.status}`);
            }

            const result = await response.json();
            displayResult(result.transcript);

        } catch (error) {
            console.error('分析過程中發生錯誤:', error);
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
            analyzeBtn.disabled = !audioFile; // 只有在有檔案時才啟用
            youtubeBtn.disabled = false;
            analyzeBtn.textContent = '分析上傳檔案';
        }
    }

    function displayResult(text) {
        // --- NEW CODE ---
        // 1. Save the transcript to localStorage so the next page can access it.
        localStorage.setItem('transcriptForLLM', text.trim());
    
        // 2. Redirect the user to the new analysis page.
        window.location.href = '/llm';
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