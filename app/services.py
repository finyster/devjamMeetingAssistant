import google.generativeai as genai
from google.api_core.exceptions import GoogleAPICallError
from dotenv import load_dotenv
import os
import logging
from pathlib import Path
import yt_dlp

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

SYSTEM_PROMPT = """你是一位專業的逐字稿分析師。你的任務是處理一段可能包含多位說話者的音訊。
請你遵循以下指示：
1.  將音訊內容完整轉換為**繁體中文**逐字稿。
2.  你的核心目標是根據聲音特徵，準確識別出音訊中所有不同的說話者。
3.  為每位說話者依序分配一個編號，格式為「[說話者 1]」、「[說話者 2]」等。
4.  每一段對話都必須以說話者標籤開頭，並在新的一行顯示。
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