# app/database.py
import sqlite3
import logging
from pathlib import Path

# 資料庫檔案將會建立在您專案的根目錄下
DATABASE_FILE = Path(__file__).resolve().parent.parent / "meeting_notes.db"
logger = logging.getLogger(__name__)

def get_db_connection():
    """建立並返回一個資料庫連線"""
    conn = sqlite3.connect(DATABASE_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """初始化資料庫，如果 'transcripts' 資料表不存在，就建立它"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS transcripts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL,
                    content TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)
            conn.commit()
            logger.info("Database initialized successfully.")
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")
        raise

def add_transcript(title: str, content: str) -> int:
    """將一筆新的逐字稿存入資料庫，並返回其 ID"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("INSERT INTO transcripts (title, content) VALUES (?, ?)", (title, content))
        conn.commit()
        logger.info(f"Added new transcript with title: {title}")
        return cursor.lastrowid

def get_all_transcripts() -> list:
    """獲取所有已儲存的逐字稿紀錄"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        # 在 SELECT 查詢中加入 content 欄位
        cursor.execute("SELECT id, title, content, created_at FROM transcripts ORDER BY created_at DESC")
        transcripts = [dict(row) for row in cursor.fetchall()]
        return transcripts

def get_transcripts_by_ids(ids: list[int]) -> list:
    """根據 ID 列表獲取指定的逐字稿內容"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        # 建立 (?,?,?) 這樣的 placeholder
        placeholders = ','.join('?' for _ in ids)
        query = f"SELECT content FROM transcripts WHERE id IN ({placeholders})"
        cursor.execute(query, ids)
        transcripts_content = [row['content'] for row in cursor.fetchall()]
        return transcripts_content
    
def delete_transcript_by_id(transcript_id: int) -> bool:
    """根據 ID 從資料庫中刪除一筆逐字稿"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM transcripts WHERE id = ?", (transcript_id,))
        conn.commit()
        # cursor.rowcount 會回傳被影響的行數，如果大於 0 表示刪除成功
        if cursor.rowcount > 0:
            logger.info(f"Deleted transcript with id: {transcript_id}")
            return True
        else:
            logger.warning(f"Attempted to delete non-existent transcript with id: {transcript_id}")
            return False