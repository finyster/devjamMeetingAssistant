from pydantic import BaseModel, HttpUrl

class AnalysisResponse(BaseModel):
    """
    API 分析結果的回應模型。
    """
    transcript: str

class YouTubeRequest(BaseModel):
    """
    從 YouTube 下載的請求模型。
    """
    url: HttpUrl # Pydantic 會自動驗證這是否為有效的 URL


class ChatRequest(BaseModel):
    transcript: str
    question: str

class ChatResponse(BaseModel):
    answer: str