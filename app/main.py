# app/main.py
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path
import logging
from typing import List

# 引用 database 和 schemas
from . import services, schemas, database

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Gemini AI 音訊分析工具",
    description="一個使用 FastAPI 和 Google Gemini 1.5 Flash 模型的音訊分析 API",
    version="2.0.0"
)

BASE_DIR = Path(__file__).resolve().parent.parent
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")

@app.on_event("startup")
def on_startup():
    """應用程式啟動時，初始化資料庫"""
    database.init_db()

@app.get("/", response_class=HTMLResponse, include_in_schema=False)
async def read_root():
    # ... (此部分不變) ...
    with open(BASE_DIR / "static" / "index.html", "r", encoding="utf-8") as f:
        return HTMLResponse(content=f.read())

# --- 修改分析 API ---
@app.post("/api/analyze-audio", response_model=schemas.AnalysisResponse)
async def analyze_audio(file: UploadFile = File(...)):
    """
    分析上傳的音訊檔案，並將結果存入資料庫。
    """
    if not file.content_type.startswith("audio/"):
        raise HTTPException(status_code=400, detail="不支援的檔案類型，請上傳音訊檔。")
    try:
        title = file.filename or "Uploaded Audio"
        contents = await file.read()
        result_text = await services.analyze_audio_file(contents, file.content_type)
        
        # 存入資料庫
        transcript_id = database.add_transcript(title=title, content=result_text)
        
        return schemas.AnalysisResponse(transcript=result_text, transcript_id=transcript_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"分析過程中發生錯誤: {str(e)}")

@app.post("/api/download-from-youtube", response_model=schemas.AnalysisResponse)
async def download_and_analyze(data: schemas.YouTubeRequest):
    """
    從 YouTube 下載音訊，分析後將結果存入資料庫。
    """
    audio_path = None
    try:
        audio_path = await services.download_youtube_audio(data.url)
        with open(audio_path, "rb") as f:
            contents = f.read()
        
        result_text = await services.analyze_audio_file(contents, "audio/mpeg")
        
        # 存入資料庫
        title = data.title or f"YouTube Video: {data.url}"
        transcript_id = database.add_transcript(title=title, content=result_text)
        
        return schemas.AnalysisResponse(transcript=result_text, transcript_id=transcript_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"處理 YouTube 音訊時發生錯誤: {str(e)}")
    finally:
        if audio_path and Path(audio_path).exists():
            services.cleanup_file(audio_path)

# --- 新增 API 來獲取列表 ---
@app.get("/api/transcripts", response_model=List[schemas.TranscriptInfo])
async def get_transcripts_list():
    """獲取所有會議紀錄的列表（ID、標題、時間）"""
    return database.get_all_transcripts()


@app.get("/llm", response_class=HTMLResponse, include_in_schema=False)
async def read_llm_page():
    # ... (此部分不變) ...
    with open(BASE_DIR / "static" / "llm.html", "r", encoding="utf-8") as f:
        return HTMLResponse(content=f.read())

# --- ▼▼▼ 在此處加入新的刪除 API 端點 ▼▼▼ ---
@app.delete("/api/transcripts/{transcript_id}", status_code=200)
async def delete_transcript(transcript_id: int):
    """
    根據提供的 ID 刪除一筆會議紀錄
    """
    try:
        success = database.delete_transcript_by_id(transcript_id)
        if not success:
            raise HTTPException(status_code=404, detail="Transcript not found")
        return {"message": "Transcript deleted successfully"}
    except Exception as e:
        logger.error(f"Error deleting transcript {transcript_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# --- ▲▲▲ 新的 API 端點結束 ▲▲▲ ---

# --- 修改聊天 API ---
@app.post("/api/chat", response_model=schemas.ChatResponse)
async def chat_with_transcript(data: schemas.ChatRequest):
    """
    根據使用者選擇的一或多份逐字稿內容進行聊天。
    """
    try:
        answer = await services.get_chat_response(data.transcripts, data.question)
        return schemas.ChatResponse(answer=answer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
