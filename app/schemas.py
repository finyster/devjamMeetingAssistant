# app/schemas.py (請使用此版本)
from pydantic import BaseModel, HttpUrl
from datetime import datetime
from typing import List

class AnalysisResponse(BaseModel):
    transcript: str
    transcript_id: int

class YouTubeRequest(BaseModel):
    url: HttpUrl
    title: str

class ChatRequest(BaseModel):
    transcripts: List[str]
    question: str

class ChatResponse(BaseModel):
    answer: str

class TranscriptInfo(BaseModel):
    """確保這個模型包含 content 欄位"""
    id: int
    title: str
    content: str  # <--- 確認這一行存在
    created_at: datetime

# --- ▼▼▼ 請加入以下兩個新模型 ▼▼▼ ---
class GitHubIssueRequest(BaseModel):
    github_token: str
    repo_name: str # 格式: "owner/repo"
    title: str
    body: str

class GitHubIssueResponse(BaseModel):
    issue_url: str