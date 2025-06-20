import google.generativeai as genai
from datetime import datetime, timezone, timedelta
from github import Github, GithubException
from google.api_core.exceptions import GoogleAPICallError
from dotenv import load_dotenv
import os
import logging
from pathlib import Path
import yt_dlp
import markdown

# 設定日誌
logger = logging.getLogger(__name__)

# 載入 .env 檔案中的環境變數
load_dotenv()
API_KEY = os.getenv("GEMINI_API_KEY")

if not API_KEY:
    logger.error("GEMINI_API_KEY not found in environment variables.")
    raise ValueError("請在 .env 檔案中設定您的 GEMINI_API_KEY")

genai.configure(api_key=API_KEY)

# 定義 Gemini 模型的設定和 Prompt
GENERATION_CONFIG = {
    "temperature": 0.3,
    "top_p": 0.95,
    "top_k": 64,
    "max_output_tokens": 8192,
    "response_mime_type": "text/plain",
}

# In app/services.py

SYSTEM_PROMPT = """你是一位專業的逐字稿分析師。你的任務是處理一段可能包含多位說話者的音訊。
請你遵循以下指示：
1.  將音訊內容完整轉換為**繁體中文**逐字稿。
2.  你的核心目標是根據聲音特徵，準確識別出音訊中所有不同的說話者。
3.  為每位說話者依序分配一個編號，格式為「[說話者 1]」、「[說話者 2]」等。
4.  每一段對話都必須以時間戳記和說話者標籤開頭，並在新的一行顯示。格式必須為 `[MM:SS] [說話者 1]: <對話內容>`。
5.  即使音訊中只有一位說話者，也請使用「[說話者 1]」來標示。
最終輸出的逐字稿必須清晰、準確，且易於閱讀。"""

async def analyze_audio_file(audio_contents: bytes, mime_type: str) -> str:
    """
    使用 Gemini API 分析音訊內容。
    """
    try:
        logger.info(f"Initializing Gemini 1.5 Flash model for mime_type: {mime_type}.")
        model = genai.GenerativeModel(
            model_name="gemini-1.5-flash-latest",
            generation_config=GENERATION_CONFIG,
        )
        
        audio_file = {"mime_type": mime_type, "data": audio_contents}
        
        logger.info("Sending request to Gemini API.")
        response = await model.generate_content_async([SYSTEM_PROMPT, audio_file])
        
        if not response.parts:
             logger.warning("Gemini API returned no parts in the response.")
             raise ValueError("API 未返回有效的分析結果。")
             
        logger.info("Successfully received response from Gemini API.")
        return response.text.strip()

    except GoogleAPICallError as e:
        logger.error(f"Google API call failed: {e}")
        raise RuntimeError(f"與 Gemini API 通訊時發生錯誤: {e.message}")
    except Exception as e:
        logger.error(f"An unexpected error occurred in analyze_audio_file: {e}")
        raise

async def download_youtube_audio(url: str) -> Path:
    """
    使用 yt-dlp 從 YouTube 下載音訊並存為暫存檔。
    """
    # 建立一個暫存資料夾
    temp_dir = Path("./temp_audio")
    temp_dir.mkdir(exist_ok=True)
    
    output_template = temp_dir / "%(id)s.%(ext)s"

    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': str(output_template),
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }],
        'noplaylist': True,
        'logger': logger,
    }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            logger.info(f"Starting download for URL: {url}")
            info = ydl.extract_info(str(url), download=True)
            downloaded_file = Path(ydl.prepare_filename(info)).with_suffix('.mp3')
            logger.info(f"Successfully downloaded and converted to {downloaded_file}")
            return downloaded_file
    except yt_dlp.utils.DownloadError as e:
        logger.error(f"yt-dlp download failed: {e}")
        raise ValueError(f"無法從指定的 URL 下載音訊，請檢查網址是否正確。")
    except Exception as e:
        logger.error(f"An unexpected error occurred in download_youtube_audio: {e}")
        raise RuntimeError(f"下載 YouTube 音訊時發生未知錯誤。")

def cleanup_file(file_path: Path):
    """
    刪除指定的暫存檔案。
    """
    try:
        if file_path and file_path.exists():
            os.remove(file_path)
            logger.info(f"Cleaned up temporary file: {file_path}")
    except OSError as e:
        logger.error(f"Error cleaning up file {file_path}: {e}")


# --- Add the following new prompt and function at the end of the file ---
# --- 用下面的版本替換 CHAT_PROMPT ---
# --- 使用這個版本的 CHAT_PROMPT ---
CHAT_PROMPT = """You are 'Audio Analyzer', a helpful AI assistant. You are having a conversation with a user about one or more meeting transcripts they have provided.

Your primary goal is to answer the user's questions based *only* on the provided transcript(s).
- If multiple transcripts are provided, you can compare them or synthesize information from them if the user asks.
- Be conversational and direct.
- If the user asks for a summary, provide a bulleted list of key points for each transcript, clearly labeling which summary belongs to which transcript.
- If the information to answer the question is not in the transcript(s), clearly state that.
- Format your response using Markdown.
- Respond in **繁體中文**.

**Provided Transcript(s) Context:**
---
{transcripts_context}
---

**User's Question:**
"{question}"
"""

# --- 使用這個版本的 get_chat_response ---
async def get_chat_response(transcripts: list[str], question: str) -> str:
    """
    Uses Gemini to generate a conversational response about one or more transcripts.
    """
    try:
        # 將多份逐字稿合併成一個上下文
        transcripts_context = "\n\n---\n\n".join(transcripts)

        logger.info("Initializing Gemini model for chat.")
        model = genai.GenerativeModel(
            model_name="gemini-1.5-flash-latest",
        )
        # 確保 CHAT_PROMPT 的 .format() 方法正確無誤
        prompt = CHAT_PROMPT.format(transcripts_context=transcripts_context, question=question)

        logger.info("Sending chat request to Gemini API.")
        response = await model.generate_content_async(prompt)

        html_response = markdown.markdown(response.text.strip(), extensions=['fenced_code', 'tables'])
        return html_response

    except Exception as e:
        logger.error(f"An unexpected error occurred in get_chat_response: {e}")
        # 這裡的錯誤訊息會更明確
        raise RuntimeError(f"Error during Gemini API call: {e}")
    
# --- ▼▼▼ 請在檔案最下方加入這個新函式 ▼▼▼ ---
def create_github_issue(token: str, repo_name: str, title: str, body: str) -> str:
    """
    使用提供的 token 在指定的 repo 建立一個 GitHub Issue。

    :param token: 使用者的 GitHub Personal Access Token.
    :param repo_name: Repository 的名稱，格式為 "owner/repo" (例如 "my-username/my-project").
    :param title: Issue 的標題.
    :param body: Issue 的內容描述.
    :return: 新建立的 Issue 的 URL.
    """
    try:
        # 使用 token 初始化 Github instance
        g = Github(token)
        
        # 獲取 repository 物件
        repo = g.get_repo(repo_name)
        
        # 建立 issue
        issue = repo.create_issue(
            title=title,
            body=body
        )
        
        logger.info(f"Successfully created issue #{issue.number} in repo {repo_name}")
        return issue.html_url # 回傳新建 issue 的網址

    except GithubException as e:
        logger.error(f"Failed to create GitHub issue in repo {repo_name}: {e}")
        # 拋出一個更具體的錯誤訊息給後端 API
        if e.status == 401:
            raise ValueError("GitHub token is invalid or has insufficient permissions.")
        elif e.status == 404:
            raise ValueError(f"Repository '{repo_name}' not found or token does not have access.")
        else:
            raise ConnectionError(f"Could not connect to GitHub: {e}")
    except Exception as e:
        logger.error(f"An unexpected error occurred in create_github_issue: {e}")
        raise