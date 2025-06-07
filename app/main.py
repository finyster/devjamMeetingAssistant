from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path
import logging

from . import services, schemas

# 設定日誌
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 初始化 FastAPI 應用
app = FastAPI(
    title="Gemini AI 音訊分析工具",
    description="一個使用 FastAPI 和 Google Gemini 1.5 Flash 模型的音訊分析 API",
    version="1.0.0"
)

# 取得根目錄路徑
BASE_DIR = Path(__file__).resolve().parent.parent

# 掛載 static 資料夾以提供前端檔案
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")

@app.get("/", response_class=HTMLResponse, include_in_schema=False)
async def read_root():
    """
    提供前端主頁面 (index.html)
    """
    try:
        with open(BASE_DIR / "static/index.html", "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    except FileNotFoundError:
        logger.error("index.html not found.")
        raise HTTPException(status_code=404, detail="index.html not found")

@app.post("/api/analyze-audio", response_model=schemas.AnalysisResponse)
async def analyze_audio(file: UploadFile = File(...)):
    """
    分析上傳的音訊檔案。
    接收一個 MP3 檔案，並返回 Gemini API 的分析結果。
    """
    if not file.content_type.startswith("audio/"):
        logger.warning(f"Invalid file type uploaded: {file.content_type}")
        raise HTTPException(status_code=400, detail="不支援的檔案類型，請上傳音訊檔。")

    try:
        logger.info(f"Received file for analysis: {file.filename}")
        contents = await file.read()
        result_text = await services.analyze_audio_file(contents, file.content_type)
        logger.info("Successfully analyzed audio file.")
        return schemas.AnalysisResponse(transcript=result_text)
    except Exception as e:
        logger.exception("An error occurred during audio analysis.")
        raise HTTPException(status_code=500, detail=f"分析過程中發生錯誤: {str(e)}")

@app.post("/api/download-from-youtube", response_model=schemas.AnalysisResponse)
async def download_and_analyze(data: schemas.YouTubeRequest):
    """
    從 YouTube 下載音訊並進行分析。
    接收一個 YouTube URL，下載音訊後交由 Gemini API 分析。
    """
    audio_path = None # Initialize audio_path to None
    try:
        logger.info(f"Received YouTube URL for analysis: {data.url}")
        audio_path = await services.download_youtube_audio(data.url)
        with open(audio_path, "rb") as f:
            contents = f.read()
        
        # 假設 yt-dlp 下載的是 mp3 或 m4a，MIME type 需要對應
        # Gemini 1.5 支援多種格式，這裡用 "audio/mpeg" 是一個常見選項
        result_text = await services.analyze_audio_file(contents, "audio/mpeg")
        logger.info("Successfully analyzed YouTube audio.")
        return schemas.AnalysisResponse(transcript=result_text)
    except ValueError as ve: # 捕捉無效 URL 的錯誤
        logger.error(f"Invalid YouTube URL provided: {data.url}. Error: {ve}")
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.exception("An error occurred during YouTube processing.")
        raise HTTPException(status_code=500, detail=f"處理 YouTube 音訊時發生錯誤: {str(e)}")
    finally:
        if audio_path: # Check if audio_path is not None before cleanup
            services.cleanup_file(audio_path) # 刪除暫存檔案

# --- Add the following new endpoints at the end of the file, before the final "if" block if you have one ---

@app.get("/llm", response_class=HTMLResponse, include_in_schema=False)
async def read_llm_page():
    """
    Provides the LLM chat analysis page (llm.html)
    """
    try:
        with open(BASE_DIR / "static/llm.html", "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    except FileNotFoundError:
        logger.error("llm.html not found.")
        raise HTTPException(status_code=404, detail="llm.html not found")

@app.post("/api/chat", response_model=schemas.ChatResponse)
async def chat_with_transcript(data: schemas.ChatRequest):
    """
    Handles chat requests about a transcript.
    """
    try:
        logger.info(f"Received chat question: {data.question}")
        answer = await services.get_chat_response(data.transcript, data.question)
        return schemas.ChatResponse(answer=answer)
    except Exception as e:
        logger.exception("An error occurred during chat processing.")
        raise HTTPException(status_code=500, detail=str(e))