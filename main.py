import os
import json
import uuid
import yaml
from fastapi import FastAPI, HTTPException, Depends, Request, UploadFile, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse, StreamingResponse, FileResponse
from pydantic import BaseModel
from typing import List, Optional
import pymysql
from pymysql.cursors import DictCursor
from contextlib import contextmanager
from datetime import datetime
import httpx
import feedparser
import logging
import time as _time
import re
from html import unescape as _html_unescape
from qcloud_cos import CosConfig, CosS3Client

app = FastAPI(title="OKR Management System")

# CORS配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 为静态文件添加 no-cache headers，避免浏览器缓存旧版本
@app.middleware("http")
async def add_no_cache_headers(request: Request, call_next):
    response = await call_next(request)
    if request.url.path.startswith("/static/"):
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# 加载配置文件（仅使用config.yml）
prompts = {}

# 默认配置
DEFAULT_CONFIG = {
    "system": {
        "leader": "josephpan"
    },
}

# 先加载数据库配置（从config.yml或环境变量）
yaml_config = None
try:
    with open("config.yml", "r", encoding="utf-8") as f:
        yaml_config = yaml.safe_load(f)
        db_config = yaml_config.get("database", {})
except:
    db_config = {}

# 数据库配置（仅从config.yml或环境变量读取）
DB_CONFIG = {
    "host": os.getenv("DB_HOST", db_config.get("host")),
    "port": int(os.getenv("DB_PORT", db_config.get("port"))),
    "user": os.getenv("DB_USER", db_config.get("user")),
    "password": os.getenv("DB_PASSWORD", db_config.get("password")),
    "database": os.getenv("DB_NAME", db_config.get("database")),
    "charset": db_config.get("charset"),
    "cursorclass": DictCursor
}

# 系统配置（仅从config.yml读取，不从数据库读取）
if yaml_config:
    LEADER = yaml_config.get("system", {}).get("leader", DEFAULT_CONFIG["system"]["leader"])
else:
    LEADER = DEFAULT_CONFIG["system"]["leader"]

# 全局变量声明（用于AI配置）
AI_MODEL = None
AI_API_KEY = None
AI_API_BASE_URL = None
AI_TEMPERATURE = None
AI_TIMEOUT = None
COS_SECRET_ID = ""
COS_SECRET_KEY = ""
COS_REGION = ""
COS_BUCKET = ""
COS_DOMAIN = ""
QPILOT_API_URL = ""
QPILOT_CONFIGS = []  # 改为列表，支持多个QPilot配置
WEWORK_BOT_WEBHOOK = ""  # 企微机器人webhook地址

def reload_settings():
    """从数据库获取配置值"""
    try:
        logging.info(f"[get_config_from_db] 尝试获取配置: {key}")
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("SELECT config_value FROM config WHERE config_key = %s", (key,))
                result = cursor.fetchone()
                if result:
                    value = result['config_value']
                    logging.info(f"[get_config_from_db] 成功获取配置 {key}: {value[:100] if isinstance(value, str) and len(value) > 100 else value}")
                    return value
                else:
                    logging.warning(f"[get_config_from_db] 配置 {key} 在数据库中不存在，返回默认值: {default}")
                    return default
    except Exception as e:
        logging.error(f"[get_config_from_db] 从数据库获取配置失败 {key}: {str(e)}")
    return default

def reload_settings():
    global AI_MODEL, AI_API_KEY, AI_API_BASE_URL, AI_TEMPERATURE, AI_TIMEOUT
    global COS_SECRET_ID, COS_SECRET_KEY, COS_REGION, COS_BUCKET, COS_DOMAIN
    global QPILOT_API_URL, QPILOT_CONFIGS, prompts, WEWORK_BOT_WEBHOOK
    
    try:
        # AI配置（从数据库读取）
        AI_MODEL = get_config_from_db("ai.model")
        AI_API_KEY = get_config_from_db("ai.api_key")
        AI_API_BASE_URL = get_config_from_db("ai.api_base_url")
        AI_TEMPERATURE = get_config_from_db("ai.temperature")
        AI_TIMEOUT = get_config_from_db("ai.timeout")
        
        # 确保类型正确
        AI_TEMPERATURE = float(AI_TEMPERATURE) if AI_TEMPERATURE else 0.7
        AI_TIMEOUT = int(AI_TIMEOUT) if AI_TIMEOUT else 60
        
        # COS配置
        COS_SECRET_ID = get_config_from_db("cos.secret_id")
        COS_SECRET_KEY = get_config_from_db("cos.secret_key")
        COS_REGION = get_config_from_db("cos.region")
        COS_BUCKET = get_config_from_db("cos.bucket")
        COS_DOMAIN = get_config_from_db("cos.domain")
        
        # 企微机器人配置（从数据库读取）
        WEWORK_BOT_WEBHOOK = get_config_from_db("wework_bot.webhook_url", "")
        
        # QPilot配置
        # API URL hard code
        QPILOT_API_URL = "https://api-qpilot.woa.com/qpilothub/chat/completions"
        
        # 从数据库读取QPilot配置（支持多个QPilot）
        # 新格式：qpilot.pilot_1.id, qpilot.pilot_1.version_query_tool_description 等
        QPILOT_CONFIGS = []
        
        # 查询所有以 qpilot.pilot_ 开头的配置
        try:
            with get_db_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute("SELECT config_key, config_value FROM config WHERE config_key LIKE 'qpilot.pilot_%'")
                    qpilot_rows = cursor.fetchall()
                    
                    # 按 pilot_id 分组
                    pilot_groups = {}
                    for row in qpilot_rows:
                        key = row['config_key']
                        value = row['config_value']
                        
                        # 解析 key: qpilot.pilot_1.id -> pilot_id=1, field=id
                        import re
                        match = re.match(r'qpilot\.pilot_(\d+)\.(.+)', key)
                        if match:
                            pilot_num = match.group(1)
                            field = match.group(2)
                            
                            if pilot_num not in pilot_groups:
                                pilot_groups[pilot_num] = {}
                            pilot_groups[pilot_num][field] = value
                    
                    # 转换为列表格式
                    for pilot_num in sorted(pilot_groups.keys()):
                        config = pilot_groups[pilot_num]
                        if 'id' in config and config['id']:  # 只有当 pilot_id 存在且不为空时才添加
                            QPILOT_CONFIGS.append({
                                "pilot_id": config.get('id', ''),
                                "tool_name": config.get('tool_name', ''),
                                "tool_purpose": config.get('tool_purpose', ''),
                                "tool_description": config.get('tool_description', ''),
                                "tool_param_description": config.get('tool_param_description', '用户的具体查询问题，请直接传入用户的原始问题，不要改写')
                            })
                    
                    logging.info(f"成功加载 {len(QPILOT_CONFIGS)} 个QPilot配置")
                    
        except Exception as e:
            logging.error(f"加载QPilot配置失败: {e}")
            QPILOT_CONFIGS = []
        
        
        # Prompts配置
        # 清空 prompts 字典，重新填充
        prompts.clear()
        
        # 从数据库加载
        db_prompts = {}
        db_prompts["ai_assistant_system"] = get_config_from_db("prompts.ai_assistant_system")
        # ai_assistant_context hard code
        db_prompts["ai_assistant_context"] = "当前页面上下文信息：\n{context}\n\n请根据上述上下文信息回答用户的问题。"
        db_prompts["version_query_tool_description"] = get_config_from_db("prompts.version_query_tool_description")
        db_prompts["version_query_tool_param_description"] = get_config_from_db("prompts.version_query_tool_param_description")
        db_prompts["suggested_questions"] = get_config_from_db("prompts.suggested_questions")
        db_prompts["generate_overall_progress"] = get_config_from_db("prompts.generate_overall_progress")
        db_prompts["generate_team_report"] = get_config_from_db("prompts.generate_team_report")
        db_prompts["sql_query_tool_description"] = get_config_from_db("prompts.sql_query_tool_description")
        # SQL查询工具参数描述直接hardcode
        db_prompts["sql_query_tool_param_description"] = "要执行的SQL查询语句，必须是SELECT语句"
        
        for k, v in db_prompts.items():
            if v is not None:  # 修改：只检查是否为None，而不是检查是否为真值
                # 特殊处理 suggested_questions，如果是字符串则分割为列表
                if k == "suggested_questions" and isinstance(v, str):
                    prompts[k] = [q.strip() for q in v.split(',') if q.strip()]
                else:
                    prompts[k] = v
        
        logging.info("配置加载完成")
            
    except Exception as e:
        logging.error(f"加载配置时出错: {str(e)}")

# 配置是否已加载
_config_loaded = False

def ensure_config_loaded():
    """确保配置已加载（延迟加载）"""
    global _config_loaded
    if not _config_loaded:
        logging.info("首次访问，开始加载配置...")
        reload_settings()
        _config_loaded = True
        logging.info("配置加载完成")

@app.post("/api/admin/reload")
async def reload_config_endpoint(request: Request):
    """重新加载配置（仅Leader）"""
    # 从请求头获取用户信息
    user_eng_name = request.headers.get("X-User-Eng-Name", "")
    if user_eng_name != LEADER:
        raise HTTPException(status_code=403, detail="无权限重新加载配置")
    
    try:
        reload_settings()
        return {"message": "配置重新加载成功"}
    except Exception as e:
        logging.error(f"重新加载配置失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"重新加载配置失败: {str(e)}")

@app.get("/api/debug/config")
async def debug_config():
    """调试接口：返回当前配置状态（仅用于调试，生产环境应删除）"""
    return {
        "AI_MODEL": AI_MODEL,
        "AI_API_KEY_SET": bool(AI_API_KEY) and AI_API_KEY != "" and AI_API_KEY != "your-api-key-here",
        "AI_API_KEY_LENGTH": len(AI_API_KEY) if AI_API_KEY else 0,
        "AI_API_BASE_URL": AI_API_BASE_URL,
        "AI_TEMPERATURE": AI_TEMPERATURE,
        "AI_TIMEOUT": AI_TIMEOUT,
        "PROMPTS": {
            "ai_assistant_system": prompts.get("ai_assistant_system", ""),
            "ai_assistant_context": prompts.get("ai_assistant_context", ""),
            "suggested_questions": prompts.get("suggested_questions", []),
            "version_query_tool_description": prompts.get("version_query_tool_description", ""),
        }
    }

# 数据库连接管理
@contextmanager
def get_db_connection():
    """数据库连接上下文管理器"""
    connection = None
    try:
        connection = pymysql.connect(**DB_CONFIG)
        yield connection
        connection.commit()
    except pymysql.Error as e:
        logging.error(f"[get_db_connection] MySQL错误: {str(e)}")
        if connection:
            connection.rollback()
        raise HTTPException(status_code=500, detail=f"数据库错误: {str(e)}")
    except Exception as e:
        logging.error(f"[get_db_connection] 连接错误: {str(e)}")
        if connection:
            connection.rollback()
        raise HTTPException(status_code=500, detail=f"数据库连接失败: {str(e)}")
    finally:
        if connection:
            connection.close()

# 从数据库加载其他配置的辅助函数
def get_config_from_db(key, default=None):
    """从数据库获取配置值"""
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("SELECT config_value FROM config WHERE config_key = %s", (key,))
                result = cursor.fetchone()
                if result:
                    return result['config_value']
                else:
                    # 只在配置不存在且没有默认值时记录警告
                    if default is None:
                        logging.warning(f"[get_config_from_db] 配置 {key} 在数据库中不存在且无默认值")
                    return default
    except Exception as e:
        logging.error(f"[get_config_from_db] 从数据库获取配置失败 {key}: {str(e)}")
    return default

async def send_wework_notification(title: str, assignee_eng_name: str, assignee_chn_name: str, description: str = ""):
    """发送企微机器人通知"""
    if not WEWORK_BOT_WEBHOOK:
        logging.warning("企微机器人webhook未配置，跳过通知")
        return False
    
    try:
        # 构建消息内容
        content = f"📋 **新待办提醒**\n\n"
        if description:
            content += f"**描述：** {description}\n"
        content += f"\n请 <@{assignee_eng_name}> 及时处理"
        
        # 企微机器人消息格式
        message = {
            "msgtype": "markdown",
            "markdown": {
                "content": content,
                "mentioned_list": [assignee_eng_name]  # @成员
            }
        }
        
        # 发送请求
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(WEWORK_BOT_WEBHOOK, json=message)
            
            if response.status_code == 200:
                result = response.json()
                if result.get("errcode") == 0:
                    logging.info(f"企微通知发送成功: {title} -> {assignee_chn_name}({assignee_eng_name})")
                    return True
                else:
                    logging.error(f"企微通知发送失败: {result.get('errmsg', '未知错误')}")
                    return False
            else:
                logging.error(f"企微通知请求失败: HTTP {response.status_code}")
                return False
                
    except Exception as e:
        logging.error(f"发送企微通知时出错: {str(e)}")
        return False

async def send_wework_completion_notification(title: str, assignee_eng_name: str, assignee_chn_name: str, description: str = ""):
    """发送待办完成通知"""
    if not WEWORK_BOT_WEBHOOK:
        logging.warning("企微机器人webhook未配置，跳过通知")
        return False
    
    try:
        # 构建消息内容
        content = f"✅ **待办完成通知**\n\n"
        if description:
            content += f"**描述：** {description}\n"
        content += f"\n<@{assignee_eng_name}> 已完成该待办"
        
        # 企微机器人消息格式
        message = {
            "msgtype": "markdown",
            "markdown": {
                "content": content,
                "mentioned_list": [assignee_eng_name]  # @成员
            }
        }
        
        # 发送请求
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(WEWORK_BOT_WEBHOOK, json=message)
            
            if response.status_code == 200:
                result = response.json()
                if result.get("errcode") == 0:
                    logging.info(f"企微完成通知发送成功: {title} -> {assignee_chn_name}({assignee_eng_name})")
                    return True
                else:
                    logging.error(f"企微完成通知发送失败: {result.get('errmsg', '未知错误')}")
                    return False
            else:
                logging.error(f"企微完成通知请求失败: HTTP {response.status_code}")
                return False
                
    except Exception as e:
        logging.error(f"发送企微完成通知时出错: {str(e)}")
        return False

def fix_sql_syntax(sql: str) -> str:
    """
    修复常见的SQL语法错误
    
    主要修复：
    1. 字段名映射（如 weekly_progress.kr_id -> user_kr_id）
    2. 日期函数调用语法错误（如 DATE_SUB() 参数错误）
    3. 引号不匹配
    4. 多余的逗号
    5. 不完整的函数调用
    """
    if not sql:
        return sql
    
    fixed_sql = sql.strip()
    import re
    
    # 0. 修复字段名映射（针对进展表）
    # weekly_progress、overall_progress、next_week_plan表使用user_kr_id而不是kr_id
    # 在FROM/JOIN子句后的进展表中，将kr_id替换为user_kr_id
    fixed_sql = re.sub(
        r'\b(weekly_progress|overall_progress|next_week_plan)\.kr_id\b',
        lambda m: f'{m.group(1)}.user_kr_id',
        fixed_sql,
        flags=re.IGNORECASE
    )
    
    # 1. 修复不完整的DATE_SUB调用（如 DATE_SUB(, '-7 days')）
    # 这种格式通常缺少第一个参数
    fixed_sql = re.sub(
        r'DATE_SUB\s*\(\s*,\s*([\'"]?)(-?\d+)\s*\1\s+(day|days|week|weeks|month|months|year|years)\s*\)',
        r'DATE_SUB(CURDATE(), INTERVAL \2 \3)',
        fixed_sql,
        flags=re.IGNORECASE
    )
    
    # 2. 修复标准的DATE_SUB格式错误
    # 错误示例: DATE_SUB(CURDATE(), '-7 days') -> 正确: DATE_SUB(CURDATE(), INTERVAL 7 DAY)
    fixed_sql = re.sub(
        r'DATE_SUB\s*\(\s*([^,]+?)\s*,\s*[\'"]?(-?\d+)\s*(day|days|week|weeks|month|months|year|years)[\'"]?\s*\)',
        lambda m: f"DATE_SUB({m.group(1).strip()}, INTERVAL {m.group(2)} {m.group(3).rstrip('s')})",
        fixed_sql,
        flags=re.IGNORECASE
    )
    
    # 3. 修复DATE_ADD中的INTERVAL语法
    fixed_sql = re.sub(
        r'DATE_ADD\s*\(\s*([^,]+?)\s*,\s*[\'"]?(-?\d+)\s*(day|days|week|weeks|month|months|year|years)[\'"]?\s*\)',
        lambda m: f"DATE_ADD({m.group(1).strip()}, INTERVAL {m.group(2)} {m.group(3).rstrip('s')})",
        fixed_sql,
        flags=re.IGNORECASE
    )
    
    # 4. 修复INTERVAL单位为复数（MySQL要求单数）
    fixed_sql = re.sub(
        r'\bINTERVAL\s+(\d+)\s+(days|weeks|months|years)\b', 
        lambda m: f"INTERVAL {m.group(1)} {m.group(2)[:-1]}", 
        fixed_sql,
        flags=re.IGNORECASE
    )
    
    # 5. 修复DATE_SUB/DATE_ADD中缺少INTERVAL关键字的情况
    # 错误示例: DATE_SUB(CURDATE(), -7) -> 正确: DATE_SUB(CURDATE(), INTERVAL 7 DAY)
    fixed_sql = re.sub(
        r'DATE_(SUB|ADD)\s*\(\s*([^,]+?)\s*,\s*(-?\d+)\s*\)',
        lambda m: f"DATE_{m.group(1)}({m.group(2).strip()}, INTERVAL {abs(int(m.group(3)))} DAY)",
        fixed_sql,
        flags=re.IGNORECASE
    )
    
    # 6. 修复WHERE子句中的多余逗号
    fixed_sql = re.sub(r'WHERE\s*,', 'WHERE ', fixed_sql)
    fixed_sql = re.sub(r',\s*,', ',', fixed_sql)
    
    # 7. 移除多余的逗号（如逗号后直接是右括号或关键字）
    fixed_sql = re.sub(r',\s*\)', ')', fixed_sql)
    fixed_sql = re.sub(r',\s*(FROM|WHERE|GROUP|ORDER|LIMIT|HAVING)', r' \1', fixed_sql)
    
    # 8. 确保语句以分号结尾（但不要添加多个）
    fixed_sql = fixed_sql.rstrip()
    if not fixed_sql.endswith(';'):
        fixed_sql += ';'
    
    logging.info(f"[fix_sql_syntax] 修复SQL语法: {len(sql)} -> {len(fixed_sql)} 字符")
    
    return fixed_sql

# Pydantic模型定义
class ObjectiveCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    obj_type: Optional[str] = "业务"
    weight: Optional[int] = 0

class ObjectiveUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    obj_type: Optional[str] = None
    weight: Optional[int] = None

class KeyResultCreate(BaseModel):
    objective_id: int
    title: str
    description: Optional[str] = ""

class KeyResultUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None

class ClaimRequest(BaseModel):
    kr_id: int
    objective_id: int
    user_eng_name: str
    user_chn_name: str

class ObjectiveSortRequest(BaseModel):
    objective_ids: List[int]

class KeyResultSortRequest(BaseModel):
    kr_ids: List[int]

class UserObjectiveUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None

class UserKeyResultUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    risks_issues: Optional[str] = None

class WeeklyProgressCreate(BaseModel):
    user_kr_id: int
    content: str
    user_eng_name: str
    user_chn_name: str

class WeeklyProgressUpdate(BaseModel):
    content: str

class OverallProgressUpsert(BaseModel):
    user_kr_id: int
    content: str
    user_eng_name: str
    user_chn_name: str

class NextWeekPlanUpsert(BaseModel):
    user_kr_id: int
    content: str
    user_eng_name: str
    user_chn_name: str
    estimated_man_days: float = 0.0

class AIGenerateRequest(BaseModel):
    user_kr_id: int

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    context: Optional[str] = ""
    user_eng_name: Optional[str] = ""

class VersionQueryRequest(BaseModel):
    query: str
    user_eng_name: str

class SQLQueryRequest(BaseModel):
    sql: str

class TodoCreate(BaseModel):
    description: str
    assignee_eng_name: str
    assignee_chn_name: str
    created_by: str
    status: Optional[str] = "pending"

class TodoUpdate(BaseModel):
    description: Optional[str] = None
    status: Optional[str] = None
    assignee_eng_name: Optional[str] = None
    assignee_chn_name: Optional[str] = None

class TodoProgressCreate(BaseModel):
    todo_id: int
    content: str
    created_by: str

class PlatformCreate(BaseModel):
    name: str
    category: str
    url: str
    description: Optional[str] = ""
    thumbnail: str
    tags: Optional[List[str]] = []
    added_by_eng_name: Optional[str] = ""
    added_by_chn_name: Optional[str] = ""

class PlatformUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    url: Optional[str] = None
    description: Optional[str] = None
    thumbnail: Optional[str] = None
    tags: Optional[List[str]] = None

# 根路径重定向到静态页面
@app.get("/")
async def root():
    """根路径重定向到前端页面"""
    return RedirectResponse(url="/team")

# 返回index.html并禁止缓存
def _index_response():
    resp = FileResponse("static/index.html")
    resp.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    resp.headers["Pragma"] = "no-cache"
    resp.headers["Expires"] = "0"
    return resp

# 各个tab页面路由（都返回同一个index.html，由前端根据路径初始化）
@app.get("/team")
async def team_page():
    """团队OKR页面"""
    return _index_response()

@app.get("/personal")
async def personal_page():
    """个人OKR页面"""
    return _index_response()

@app.get("/reports")
async def reports_page():
    """团队周报页面"""
    return _index_response()

@app.get("/todos")
async def todos_page():
    """待办事项页面"""
    return _index_response()

@app.get("/next-week")
async def next_week_page():
    """下周计划页面"""
    return _index_response()

@app.get("/ideas")
async def ideas_page():
    """想法收集页面"""
    return _index_response()

@app.get("/platforms")
async def platforms_page():
    """百宝箱页面"""
    return _index_response()

@app.get("/continuous-improvement")
async def continuous_improvement_page():
    """不断更新页面"""
    return _index_response()

# ==================== 游戏新闻 API ====================
_game_news_cache = {"data": [], "ts": 0}

def _strip_html(text):
    """去除HTML标签"""
    text = re.sub(r'<[^>]+>', '', text)
    return _html_unescape(text).strip()

@app.get("/api/game-news")
async def get_game_news():
    """获取游戏新闻（RSS抓取 + 缓存10分钟）"""
    now = _time.time()
    if _game_news_cache["data"] and now - _game_news_cache["ts"] < 600:
        return {"status": "success", "data": _game_news_cache["data"]}

    feeds = [
        {"url": "https://www.yystv.cn/rss/feed", "source": "游研社"},
        {"url": "https://feeds.feedburner.com/ign/games-all", "source": "IGN"},
    ]

    all_news = []
    async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
        for feed_info in feeds:
            try:
                resp = await client.get(feed_info["url"], headers={
                    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
                })
                if resp.status_code != 200:
                    continue
                d = feedparser.parse(resp.text)
                for entry in d.entries[:10]:
                    summary = _strip_html(entry.get("summary", entry.get("description", "")))
                    if len(summary) > 150:
                        summary = summary[:150] + "..."

                    # 提取图片
                    image = ""
                    if hasattr(entry, "media_content") and entry.media_content:
                        image = entry.media_content[0].get("url", "")
                    if not image and hasattr(entry, "enclosures") and entry.enclosures:
                        image = entry.enclosures[0].get("href", "")
                    if not image:
                        raw = entry.get("summary", entry.get("description", ""))
                        img_match = re.search(r'<img[^>]+src=["\']([^"\']+)["\']', raw)
                        if img_match:
                            image = img_match.group(1)

                    pub_date = ""
                    if hasattr(entry, "published_parsed") and entry.published_parsed:
                        pub_date = _time.strftime("%Y-%m-%d %H:%M", entry.published_parsed)
                    elif hasattr(entry, "updated_parsed") and entry.updated_parsed:
                        pub_date = _time.strftime("%Y-%m-%d %H:%M", entry.updated_parsed)

                    all_news.append({
                        "title": entry.get("title", "无标题"),
                        "summary": summary,
                        "link": entry.get("link", ""),
                        "image": image,
                        "source": feed_info["source"],
                        "pub_date": pub_date,
                    })
            except Exception as e:
                logging.warning(f"抓取 {feed_info['source']} RSS 失败: {e}")

    # 按日期排序
    all_news.sort(key=lambda x: x.get("pub_date", ""), reverse=True)
    _game_news_cache["data"] = all_news
    _game_news_cache["ts"] = now
    return {"status": "success", "data": all_news}


# ==================== 游戏新闻AI总结 ====================
@app.post("/api/game-news/summarize")
async def summarize_game_news(request: Request):
    """用AI总结游戏新闻文章（流式输出）"""
    body = await request.json()
    title = body.get("title", "")
    summary = body.get("summary", "")
    link = body.get("link", "")
    source = body.get("source", "")

    if not title:
        return JSONResponse({"status": "error", "message": "缺少文章标题"}, status_code=400)

    # 尝试抓取文章全文
    article_content = ""
    if link:
        try:
            async with httpx.AsyncClient(timeout=8, follow_redirects=True) as client:
                resp = await client.get(link, headers={
                    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
                })
                if resp.status_code == 200:
                    # 提取正文文本（去除HTML标签）
                    text = re.sub(r'<script[^>]*>.*?</script>', '', resp.text, flags=re.DOTALL)
                    text = re.sub(r'<style[^>]*>.*?</style>', '', text, flags=re.DOTALL)
                    text = re.sub(r'<[^>]+>', ' ', text)
                    text = re.sub(r'\s+', ' ', text).strip()
                    # 截取前3000字符避免超长
                    if len(text) > 3000:
                        text = text[:3000] + "..."
                    article_content = text
        except Exception as e:
            logging.warning(f"抓取文章内容失败: {e}")

    # 构建prompt
    content_for_summary = article_content if article_content else (summary or "无详细内容")
    prompt_text = f"""请对以下游戏行业新闻文章进行简洁总结，用中文回答。要求：
1. 用3-5个要点概括文章核心内容
2. 每个要点一行，用"•"开头
3. 最后用一句话给出简短评价或展望

文章标题：{title}
来源：{source}
文章内容：
{content_for_summary}"""

    async def generate():
        if not AI_API_KEY:
            import asyncio
            mock = f"• 这是一篇来自{source}的游戏新闻\n• 标题：{title}\n• {summary or '暂无摘要'}\n\n（AI未配置，以上为模拟总结）"
            for ch in mock:
                yield ch
                await asyncio.sleep(0.02)
            return

        try:
            headers = {
                "Authorization": f"Bearer {AI_API_KEY}",
                "Content-Type": "application/json"
            }
            payload = {
                "model": AI_MODEL,
                "messages": [
                    {"role": "system", "content": "你是一个专业的游戏行业分析师，擅长快速总结游戏新闻的关键信息。"},
                    {"role": "user", "content": prompt_text}
                ],
                "temperature": float(AI_TEMPERATURE) if AI_TEMPERATURE else 0.5,
                "stream": True
            }
            timeout = float(AI_TIMEOUT) if AI_TIMEOUT else 30.0
            async with httpx.AsyncClient(timeout=timeout) as client:
                async with client.stream("POST", f"{AI_API_BASE_URL}/chat/completions", json=payload, headers=headers) as response:
                    if response.status_code != 200:
                        yield f"AI服务请求失败 (HTTP {response.status_code})"
                        return
                    async for line in response.aiter_lines():
                        if line.startswith("data: "):
                            data_str = line[6:]
                            if data_str.strip() == "[DONE]":
                                break
                            try:
                                data = json.loads(data_str)
                                delta = data.get("choices", [{}])[0].get("delta", {})
                                content = delta.get("content", "")
                                if content:
                                    yield content
                            except json.JSONDecodeError:
                                continue
        except Exception as e:
            logging.error(f"AI总结失败: {e}", exc_info=True)
            yield f"总结生成失败: {str(e)}"

    return StreamingResponse(generate(), media_type="text/plain; charset=utf-8")


# ==================== 图片上传到COS ====================
def init_cos_client():
    """初始化COS客户端"""
    try:
        if not all([COS_SECRET_ID, COS_SECRET_KEY, COS_REGION, COS_BUCKET]):
            logging.error("COS配置不完整")
            return None, None
        
        # 根据COS_DOMAIN配置决定使用的域名
        if COS_DOMAIN:
            # 使用配置的域名
            domain = COS_DOMAIN
            logging.info(f"使用配置的域名: {domain}")
        else:
            # 默认使用内网域名
            domain = f'{COS_BUCKET}.cos-internal.{COS_REGION}.tencentcos.cn'
            logging.info(f"使用默认内网域名: {domain}")
        
        # 配置 COS 客户端
        cos_config = CosConfig(
            Region=COS_REGION, 
            SecretId=COS_SECRET_ID, 
            SecretKey=COS_SECRET_KEY,
            Token=None,  # 如果使用临时密钥，这里传入 token
            Scheme='https',  # 使用 https 协议
            Timeout=60,  # 设置超时时间
            Anonymous=False,  # 不使用匿名访问
            Domain=domain  # 使用配置的域名
        )
        client = CosS3Client(cos_config)
        
        logging.info(f"COS客户端初始化成功 - Bucket: {COS_BUCKET}, Region: {COS_REGION}")
        return client, COS_BUCKET
    except Exception as e:
        logging.error(f"初始化COS客户端失败: {str(e)}")
        import traceback
        traceback.print_exc()
        return None, None

async def upload_to_cos(filename: str, file_content: bytes, file_type: str = "") -> str:
    """上传文件到腾讯云COS并返回绝对路径URL"""
    # 初始化COS客户端
    client, bucket = init_cos_client()
    if not client or not bucket:
        logging.warning("COS客户端初始化失败，使用本地存储")
        # 回退到本地存储
        return await upload_to_local(filename, file_content)
    
    try:
        # 生成唯一文件名 - 使用固定前缀以便管理
        file_ext = os.path.splitext(filename)[1]
        date_path = datetime.now().strftime('%Y/%m/%d')
        unique_filename = f"image-bed/{date_path}/{uuid.uuid4().hex}{file_ext}"
        
        # 上传到COS
        response = client.put_object(
            Bucket=bucket,
            Body=file_content,
            Key=unique_filename,
            ContentType=file_type,
            EnableMD5=False  # 禁用 MD5 校验以提高性能
        )
        
        # 构建图片URL - 根据COS_DOMAIN配置或使用默认域名
        if COS_DOMAIN:
            # 使用配置的域名
            # 移除默认域名中的bucket名称部分，使用配置的完整域名
            image_url = f"{COS_DOMAIN}/{unique_filename}"
        else:
            # 使用默认的file.myqcloud.com域名
            image_url = f"https://{bucket}.file.myqcloud.com/{unique_filename}"
        
        logging.info(f"文件已上传到COS: {unique_filename}")
        return image_url
        
    except Exception as e:
        logging.error(f"COS上传失败: {str(e)}")
        # 回退到本地存储
        return await upload_to_local(filename, file_content)

async def upload_to_local(filename: str, file_content: bytes) -> str:
    """上传文件到本地存储并返回绝对路径URL（备用方案）"""
    try:
        # 使用本地存储
        UPLOAD_DIR = "static/uploads"
        os.makedirs(UPLOAD_DIR, exist_ok=True)
        
        file_path = os.path.join(UPLOAD_DIR, filename)
        
        # 写入文件
        with open(file_path, "wb") as f:
            f.write(file_content)
        
        # 验证文件是否成功写入
        if not os.path.exists(file_path):
            raise Exception(f"文件写入失败: {file_path}")
        
        # 返回相对路径
        file_url = f"/static/uploads/{filename}"
        
        logging.info(f"文件已保存到本地: {file_path}, URL: {file_url}")
        return file_url
    except Exception as e:
        logging.error(f"本地存储失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"文件保存失败: {str(e)}")

# ==================== 用户认证相关 ====================
@app.get("/ts:auth/tauth/info.ashx")
async def mock_auth_info_direct():
    """模拟企微认证接口（直接访问路径）"""
    return {
        "Timestamp": datetime.now().isoformat(),
        "EngName": "mikesjzhou",
        "ChnName": "周世杰",
        "DeptNameString": "社交平台架构中心/智能平台组",
        "WorkPlaceID": 1,
        "PositionName": "高级产品经理"
    }

@app.get("/api/auth/info")
async def proxy_auth_info(request: Request):
    """代理企微认证接口"""
    try:
        # 获取原始请求的headers
        headers = dict(request.headers)
        
        # 转发请求到企微认证接口
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "/ts:auth/tauth/info.ashx",
                headers=headers,
                follow_redirects=True,
                timeout=10.0
            )
            
            # 返回原始响应
            return response.json() if response.headers.get("content-type", "").startswith("application/json") else response.text
    except Exception as e:
        # 如果企微环境不可用，返回模拟数据（用于开发和测试）
        logging.warning(f"企微认证接口不可用: {str(e)}，返回模拟数据")
        return {
            "Timestamp": datetime.now().isoformat(),
            "EngName": "josephpan",
            "ChnName": "测试用户",
            "DeptNameString": "测试部门",
            "WorkPlaceID": 1,
            "PositionName": "测试职位"
        }

# ==================== 团队OKR管理 ====================
# 健康检查端点
@app.get("/api/health")
async def health_check():
    """健康检查端点"""
    try:
        # 测试数据库连接
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("SELECT 1")
                result = cursor.fetchone()
                db_status = "OK" if result and result.get('1') == 1 else "FAILED"
    except Exception as e:
        db_status = f"FAILED: {str(e)}"
        logging.error(f"[health_check] 数据库健康检查失败: {str(e)}")
    
    return {
        "status": "OK",
        "timestamp": datetime.now().isoformat(),
        "database": {
            "host": DB_CONFIG['host'],
            "port": DB_CONFIG['port'],
            "database": DB_CONFIG['database'],
            "status": db_status
        }
    }

# 获取前端配置
@app.get("/api/config")
async def get_config():
    """获取前端所需的配置信息"""
    # 确保配置已加载（延迟加载）
    ensure_config_loaded()
    
    # 从数据库读取white_list和okr_white_list
    white_list_str = get_config_from_db("system.white_list", "")
    okr_white_list_str = get_config_from_db("system.okr_white_list", "")
    
    # 将逗号分隔的字符串转换为列表
    white_list = [item.strip() for item in white_list_str.split(',') if item.strip()] if white_list_str else []
    okr_white_list = [item.strip() for item in okr_white_list_str.split(',') if item.strip()] if okr_white_list_str else []
    
    # 从数据库读取site_title
    site_title = get_config_from_db("system.site_title", "算法一组 AI 组织平台")
    
    # 从数据库读取AI配置（用于前端验证）
    ai_model = get_config_from_db("ai.model", "")
    ai_api_key = get_config_from_db("ai.api_key", "")
    
    # 获取建议问题（从全局prompts字典中获取，已经在reload_settings中正确处理）
    suggested_questions = prompts.get("suggested_questions", [])

    print("suggested_questions: ", suggested_questions)
    
    # 确保suggested_questions是列表格式（reload_settings中已经处理，这里是额外保险）
    if isinstance(suggested_questions, str):
        suggested_questions = [q.strip() for q in suggested_questions.split(',') if q.strip()]
    elif not isinstance(suggested_questions, list):
        suggested_questions = []

    print("suggested_questions: ", suggested_questions)
      
    return {
        "LEADER": LEADER,
        "SITE_TITLE": site_title,
        "WHITE_LIST": white_list,
        "OKR_WHITE_LIST": okr_white_list,
        "AI_MODEL": ai_model,
        "AI_API_KEY": ai_api_key,  # 用于前端判断是否配置了API Key
        "SUGGESTED_QUESTIONS": suggested_questions,
        "WEWORK_BOT_WEBHOOK": WEWORK_BOT_WEBHOOK  # 企微机器人webhook（从数据库读取）
    }

# 获取系统版本信息
@app.get("/api/version")
async def get_version():
    """获取系统版本信息"""
    try:
        # 读取VERSION文件
        version_file = os.path.join(os.path.dirname(__file__), 'VERSION')
        if os.path.exists(version_file):
            with open(version_file, 'r', encoding='utf-8') as f:
                version = f.read().strip()
        else:
            version = "未知"
        
        return {
            "version": version
        }
    except Exception as e:
        print(f"读取版本信息失败: {e}")
        return {
            "version": "未知"
        }

# 测试端点 - 返回静态数据，不查询数据库
@app.get("/api/team/objectives/test")
async def get_team_objectives_test():
    """测试端点，返回静态数据"""
    logging.info("[get_team_objectives_test] 返回测试数据")
    
    test_data = {
        "objectives": [
            {
                "id": 999,
                "title": "测试目标1",
                "description": "这是一个测试目标",
                "obj_type": "业务",
                "weight": 50,
                "created_by": "test",
                "created_at": "2024-01-01 00:00:00",
                "updated_at": "2024-01-01 00:00:00",
                "key_results": [
                    {
                        "id": 9991,
                        "title": "测试KR1",
                        "description": "这是一个测试KR",
                        "created_at": "2024-01-01 00:00:00",
                        "updated_at": "2024-01-01 00:00:00",
                        "user_eng_name": "testuser",
                        "user_chn_name": "测试用户",
                        "claimed_at": "2024-01-01 00:00:00"
                    }
                ]
            }
        ]
    }
    
    return test_data

@app.get("/api/team/objectives")
async def get_team_objectives():
    """获取所有团队Objectives及其KRs"""
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                # 获取所有objectives（按sort_order排序，然后按创建时间）
                cursor.execute("""
                    SELECT id, title, description, obj_type, weight, created_by, created_at, updated_at
                    FROM objectives
                    ORDER BY sort_order ASC, created_at ASC
                """)
                objectives = cursor.fetchall()
                
                # 为每个objective获取其KRs和认领信息
                for obj in objectives:
                    # 先获取所有KR
                    cursor.execute("""
                        SELECT id, title, description, created_at, updated_at
                        FROM key_results
                        WHERE objective_id = %s
                        ORDER BY sort_order ASC, created_at ASC
                    """, (obj['id'],))
                    krs = cursor.fetchall()
                    
                    # 为每个KR获取所有认领人
                    for kr in krs:
                        cursor.execute("""
                            SELECT user_eng_name, user_chn_name, claimed_at
                            FROM kr_claims
                            WHERE kr_id = %s
                            ORDER BY claimed_at ASC
                        """, (kr['id'],))
                        claimers = cursor.fetchall()
                        
                        # 将认领人列表添加到KR中
                        kr['claimers'] = claimers
                        
                        # 为了兼容旧的前端代码，保留第一个认领人的信息
                        if claimers:
                            kr['user_eng_name'] = claimers[0]['user_eng_name']
                            kr['user_chn_name'] = claimers[0]['user_chn_name']
                            kr['claimed_at'] = claimers[0]['claimed_at']
                        else:
                            kr['user_eng_name'] = None
                            kr['user_chn_name'] = None
                            kr['claimed_at'] = None
                    
                    obj['key_results'] = krs
                
                return {"objectives": objectives}
    
    except pymysql.Error as e:
        logging.error(f"[get_team_objectives] MySQL错误: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"数据库错误: {str(e)}")
    
    except Exception as e:
        logging.error(f"[get_team_objectives] 未预期的错误: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"服务器错误: {str(e)}")

@app.get("/api/team/objectives-with-progress")
async def get_team_objectives_with_progress():
    """批量获取团队OKR及所有进展数据（优化版本，减少请求次数）"""
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                # 1. 获取所有objectives
                cursor.execute("""
                    SELECT id, title, description, obj_type, weight, created_by, created_at, updated_at
                    FROM objectives
                    ORDER BY sort_order ASC, created_at ASC
                """)
                objectives = cursor.fetchall()
                
                if not objectives:
                    return {"objectives": [], "progress_data": {}}
                
                # 2. 获取所有KRs
                obj_ids = [obj['id'] for obj in objectives]
                obj_placeholders = ','.join(['%s'] * len(obj_ids))
                cursor.execute(f"""
                    SELECT id, objective_id, title, description, created_at, updated_at
                    FROM key_results
                    WHERE objective_id IN ({obj_placeholders})
                    ORDER BY objective_id, sort_order ASC, created_at ASC
                """, obj_ids)
                all_krs = cursor.fetchall()
                
                # 3. 获取所有KR的认领信息
                if all_krs:
                    kr_ids = [kr['id'] for kr in all_krs]
                    kr_placeholders = ','.join(['%s'] * len(kr_ids))
                    cursor.execute(f"""
                        SELECT kr_id, user_eng_name, user_chn_name, claimed_at
                        FROM kr_claims
                        WHERE kr_id IN ({kr_placeholders})
                        ORDER BY kr_id, claimed_at ASC
                    """, kr_ids)
                    all_claims = cursor.fetchall()
                    
                    # 4. 获取所有认领人的用户KR ID映射
                    # 构建 (source_kr_id, user_eng_name) 的映射
                    cursor.execute(f"""
                        SELECT ukr.id as user_kr_id, ukr.source_kr_id, ukr.user_eng_name, ukr.title, ukr.risks_issues
                        FROM user_key_results ukr
                        WHERE ukr.source_kr_id IN ({kr_placeholders})
                    """, kr_ids)
                    user_kr_mappings = cursor.fetchall()
                    
                    # 5. 获取所有用户KR的进展数据
                    if user_kr_mappings:
                        user_kr_ids = [mapping['user_kr_id'] for mapping in user_kr_mappings]
                        user_kr_placeholders = ','.join(['%s'] * len(user_kr_ids))
                        
                        # 获取周进展
                        cursor.execute(f"""
                            SELECT wp.*
                            FROM weekly_progress wp
                            WHERE wp.user_kr_id IN ({user_kr_placeholders})
                            ORDER BY wp.user_kr_id, wp.created_at DESC
                        """, user_kr_ids)
                        all_weekly_progress = cursor.fetchall()
                        
                        # 获取整体进展
                        cursor.execute(f"""
                            SELECT op.*
                            FROM overall_progress op
                            WHERE op.user_kr_id IN ({user_kr_placeholders})
                        """, user_kr_ids)
                        all_overall_progress = cursor.fetchall()
                        
                        # 获取下周计划
                        cursor.execute(f"""
                            SELECT nwp.*
                            FROM next_week_plan nwp
                            WHERE nwp.user_kr_id IN ({user_kr_placeholders})
                        """, user_kr_ids)
                        all_next_week_plans = cursor.fetchall()
                    else:
                        all_weekly_progress = []
                        all_overall_progress = []
                        all_next_week_plans = []
                else:
                    all_claims = []
                    user_kr_mappings = []
                    all_weekly_progress = []
                    all_overall_progress = []
                    all_next_week_plans = []
                
                # 6. 组织数据结构
                # 按objective_id分组KRs
                krs_by_obj = {}
                for kr in all_krs:
                    obj_id = kr['objective_id']
                    if obj_id not in krs_by_obj:
                        krs_by_obj[obj_id] = []
                    krs_by_obj[obj_id].append(kr)
                
                # 按kr_id分组认领信息
                claims_by_kr = {}
                for claim in all_claims:
                    kr_id = claim['kr_id']
                    if kr_id not in claims_by_kr:
                        claims_by_kr[kr_id] = []
                    claims_by_kr[kr_id].append(claim)
                
                # 构建进展数据映射 {source_kr_id: {user_eng_name: {...}}}
                progress_data = {}
                for mapping in user_kr_mappings:
                    source_kr_id = mapping['source_kr_id']
                    user_eng_name = mapping['user_eng_name']
                    user_kr_id = mapping['user_kr_id']
                    
                    if source_kr_id not in progress_data:
                        progress_data[source_kr_id] = {}
                    
                    # 获取该用户KR的进展
                    weekly = [wp for wp in all_weekly_progress if wp['user_kr_id'] == user_kr_id]
                    overall = next((op for op in all_overall_progress if op['user_kr_id'] == user_kr_id), None)
                    next_week = next((nwp for nwp in all_next_week_plans if nwp['user_kr_id'] == user_kr_id), None)
                    
                    progress_data[source_kr_id][user_eng_name] = {
                        'user_kr_id': user_kr_id,
                        'kr_title': mapping['title'],
                        'risks_issues': mapping['risks_issues'],
                        'weekly_progress': weekly,
                        'overall_progress': overall,
                        'next_week_plan': next_week
                    }
                
                # 7. 组装最终数据
                for obj in objectives:
                    obj_id = obj['id']
                    krs = krs_by_obj.get(obj_id, [])
                    
                    for kr in krs:
                        kr_id = kr['id']
                        claimers = claims_by_kr.get(kr_id, [])
                        kr['claimers'] = claimers
                        
                        # 兼容旧代码
                        if claimers:
                            kr['user_eng_name'] = claimers[0]['user_eng_name']
                            kr['user_chn_name'] = claimers[0]['user_chn_name']
                            kr['claimed_at'] = claimers[0]['claimed_at']
                        else:
                            kr['user_eng_name'] = None
                            kr['user_chn_name'] = None
                            kr['claimed_at'] = None
                    
                    obj['key_results'] = krs
                
                return {
                    "objectives": objectives,
                    "progress_data": progress_data
                }
    
    except pymysql.Error as e:
        logging.error(f"[get_team_objectives_with_progress] MySQL错误: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"数据库错误: {str(e)}")
    
    except Exception as e:
        logging.error(f"[get_team_objectives_with_progress] 未预期的错误: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"服务器错误: {str(e)}")

@app.post("/api/team/objectives")
async def create_team_objective(obj: ObjectiveCreate, user_eng_name: str):
    """创建团队Objective（仅LEADER）"""
    if user_eng_name != LEADER:
        raise HTTPException(status_code=403, detail="无权限")
    
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute("""
                INSERT INTO objectives (title, description, obj_type, weight, created_by)
                VALUES (%s, %s, %s, %s, %s)
            """, (obj.title, obj.description, obj.obj_type, obj.weight, user_eng_name))
            return {"id": cursor.lastrowid, "message": "创建成功"}

# 排序接口必须在带路径参数的接口之前定义，避免路由冲突
@app.put("/api/team/objectives/sort")
async def sort_team_objectives(request: ObjectiveSortRequest, user_eng_name: str):
    """更新团队Objectives排序（仅LEADER）"""
    if user_eng_name != LEADER:
        raise HTTPException(status_code=403, detail="无权限")
    
    if not request.objective_ids:
        raise HTTPException(status_code=400, detail="缺少objective_ids参数")
    
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            # 更新每个objective的sort_order
            for index, obj_id in enumerate(request.objective_ids):
                cursor.execute("""
                    UPDATE objectives SET sort_order = %s WHERE id = %s
                """, (index, obj_id))
            
            return {"message": "排序已保存"}

@app.put("/api/team/objectives/{obj_id}")
async def update_team_objective(obj_id: int, obj: ObjectiveUpdate, user_eng_name: str):
    """更新团队Objective（仅LEADER）"""
    if user_eng_name != LEADER:
        raise HTTPException(status_code=403, detail="无权限")
    
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            updates = []
            params = []
            if obj.title is not None:
                updates.append("title = %s")
                params.append(obj.title)
            if obj.description is not None:
                updates.append("description = %s")
                params.append(obj.description)
            if obj.obj_type is not None:
                updates.append("obj_type = %s")
                params.append(obj.obj_type)
            if obj.weight is not None:
                updates.append("weight = %s")
                params.append(obj.weight)
            
            if updates:
                params.append(obj_id)
                cursor.execute(f"""
                    UPDATE objectives SET {', '.join(updates)}
                    WHERE id = %s
                """, params)
            
            return {"message": "更新成功"}

@app.delete("/api/team/objectives/{obj_id}")
async def delete_team_objective(obj_id: int, user_eng_name: str):
    """删除团队Objective（仅LEADER）"""
    if user_eng_name != LEADER:
        raise HTTPException(status_code=403, detail="无权限")
    
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute("DELETE FROM objectives WHERE id = %s", (obj_id,))
            return {"message": "删除成功"}

@app.post("/api/team/key-results")
async def create_team_key_result(kr: KeyResultCreate, user_eng_name: str):
    """创建团队Key Result（仅LEADER）"""
    if user_eng_name != LEADER:
        raise HTTPException(status_code=403, detail="无权限")
    
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute("""
                INSERT INTO key_results (objective_id, title, description)
                VALUES (%s, %s, %s)
            """, (kr.objective_id, kr.title, kr.description))
            return {"id": cursor.lastrowid, "message": "创建成功"}

@app.put("/api/team/key-results/sort")
async def sort_team_key_results(request: KeyResultSortRequest, user_eng_name: str):
    """更新团队Key Results排序（仅Leader）"""
    if user_eng_name != LEADER:
        raise HTTPException(status_code=403, detail="无权限")
    
    if not request.kr_ids:
        raise HTTPException(status_code=400, detail="缺少kr_ids参数")
    
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            # 更新每个KR的sort_order
            for index, kr_id in enumerate(request.kr_ids):
                cursor.execute("""
                    UPDATE key_results SET sort_order = %s WHERE id = %s
                """, (index, kr_id))
            
            return {"message": "排序已保存"}

@app.put("/api/team/key-results/{kr_id}")
async def update_team_key_result(kr_id: int, kr: KeyResultUpdate, user_eng_name: str):
    """更新团队Key Result（仅Leader）"""
    if user_eng_name != LEADER:
        raise HTTPException(status_code=403, detail="无权限")
    
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            updates = []
            params = []
            if kr.title is not None:
                updates.append("title = %s")
                params.append(kr.title)
            if kr.description is not None:
                updates.append("description = %s")
                params.append(kr.description)
            
            if updates:
                params.append(kr_id)
                cursor.execute(f"""
                    UPDATE key_results SET {', '.join(updates)}
                    WHERE id = %s
                """, params)
            
            return {"message": "更新成功"}

@app.delete("/api/team/key-results/{kr_id}")
async def delete_team_key_result(kr_id: int, user_eng_name: str):
    """删除团队Key Result（仅Leader）"""
    if user_eng_name != LEADER:
        raise HTTPException(status_code=403, detail="无权限")
    
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute("DELETE FROM key_results WHERE id = %s", (kr_id,))
            return {"message": "删除成功"}

@app.post("/api/team/claim")
async def claim_key_result(claim: ClaimRequest):
    """认领团队KR"""
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            # 检查是否已认领该KR
            cursor.execute("""
                SELECT id FROM kr_claims
                WHERE kr_id = %s AND user_eng_name = %s
            """, (claim.kr_id, claim.user_eng_name))
            
            existing_claim = cursor.fetchone()
            if existing_claim:
                raise HTTPException(status_code=400, detail="您已认领过该KR")
            
            # 检查是否已经有个人KR来自该团队KR
            cursor.execute("""
                SELECT ukr.id, uo.title as obj_title
                FROM user_key_results ukr
                JOIN user_objectives uo ON ukr.user_objective_id = uo.id
                WHERE ukr.source_type = 'team' 
                  AND ukr.source_kr_id = %s 
                  AND ukr.user_eng_name = %s
            """, (claim.kr_id, claim.user_eng_name))
            
            existing_user_kr = cursor.fetchone()
            if existing_user_kr:
                raise HTTPException(status_code=400, detail="您已认领过该KR")
            
            # 记录认领
            cursor.execute("""
                INSERT INTO kr_claims (kr_id, objective_id, user_eng_name, user_chn_name)
                VALUES (%s, %s, %s, %s)
            """, (claim.kr_id, claim.objective_id, claim.user_eng_name, claim.user_chn_name))
            
            # 获取团队O和KR信息
            cursor.execute("""
                SELECT o.id as obj_id, o.title as obj_title, o.description as obj_desc,
                       kr.id as kr_id, kr.title as kr_title, kr.description as kr_desc
                FROM objectives o
                JOIN key_results kr ON o.id = kr.objective_id
                WHERE o.id = %s AND kr.id = %s
            """, (claim.objective_id, claim.kr_id))
            
            data = cursor.fetchone()
            if not data:
                raise HTTPException(status_code=404, detail="未找到对应的O或KR")
            
            # 检查个人O是否已存在
            cursor.execute("""
                SELECT id FROM user_objectives
                WHERE user_eng_name = %s AND source_type = 'team' AND source_id = %s
            """, (claim.user_eng_name, data['obj_id']))
            
            user_obj = cursor.fetchone()
            
            if not user_obj:
                # 创建个人O
                cursor.execute("""
                    INSERT INTO user_objectives (user_eng_name, title, description, source_type, source_id)
                    VALUES (%s, %s, %s, 'team', %s)
                """, (claim.user_eng_name, data['obj_title'], data['obj_desc'], data['obj_id']))
                user_obj_id = cursor.lastrowid
            else:
                user_obj_id = user_obj['id']
            
            # 创建个人KR
            cursor.execute("""
                INSERT INTO user_key_results (user_objective_id, user_eng_name, title, description, source_type, source_kr_id)
                VALUES (%s, %s, %s, %s, 'team', %s)
            """, (user_obj_id, claim.user_eng_name, data['kr_title'], data['kr_desc'], data['kr_id']))
            
            return {"message": "认领成功"}

@app.get("/api/team/kr-claims")
async def get_all_kr_claims():
    """获取所有KR认领记录"""
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT kc.id, kc.kr_id, kr.objective_id, kc.user_eng_name, kc.user_chn_name, kc.claimed_at,
                       o.title as objective_title,
                       kr.title as kr_title
                FROM kr_claims kc
                JOIN key_results kr ON kc.kr_id = kr.id
                JOIN objectives o ON kr.objective_id = o.id
                ORDER BY kc.user_eng_name ASC, kc.claimed_at DESC
            """)
            claims = cursor.fetchall()
            return {"claims": claims}

@app.get("/api/members/okr-claimers")
async def get_okr_claimers():
    """获取所有认领过OKR的成员列表（去重）"""
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            # 从 kr_claims 表获取所有认领过的用户（去重）
            cursor.execute("""
                SELECT DISTINCT user_eng_name, user_chn_name
                FROM kr_claims
                ORDER BY user_eng_name ASC
            """)
            members = cursor.fetchall()
            return {"members": members}

# ==================== 个人OKR管理 ====================
@app.get("/api/user/objectives")
async def get_user_objectives(user_eng_name: str):
    """获取用户的所有Objectives及其KRs"""
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            # 获取用户的所有objectives（按sort_order排序，如果为空则按创建时间）
            cursor.execute("""
                SELECT id, title, description, source_type, source_id, obj_type, weight, created_at, updated_at
                FROM user_objectives
                WHERE user_eng_name = %s
                ORDER BY COALESCE(sort_order, 999999) ASC, created_at ASC
            """, (user_eng_name,))
            objectives = cursor.fetchall()
            
            # 为每个objective获取其KRs
            for obj in objectives:
                cursor.execute("""
                    SELECT id, title, description, source_type, source_kr_id, risks_issues, created_at, updated_at
                    FROM user_key_results
                    WHERE user_objective_id = %s
                    ORDER BY COALESCE(sort_order, 999999) ASC, created_at ASC
                """, (obj['id'],))
                obj['key_results'] = cursor.fetchall()
            
            return {"objectives": objectives}

@app.post("/api/user/objectives")
async def create_user_objective(obj: ObjectiveCreate, user_eng_name: str):
    """创建个人Objective"""
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute("""
                INSERT INTO user_objectives (user_eng_name, title, description, obj_type, weight, source_type, source_id)
                VALUES (%s, %s, %s, %s, %s, 'personal', NULL)
            """, (user_eng_name, obj.title, obj.description or '', obj.obj_type or '业务', obj.weight or 0))
            return {"id": cursor.lastrowid, "message": "创建成功"}

# 排序接口必须在带路径参数的接口之前定义，避免路由冲突
@app.put("/api/user/objectives/sort")
async def sort_user_objectives(request: ObjectiveSortRequest, user_eng_name: str):
    """更新个人Objectives排序"""
    if not request.objective_ids:
        raise HTTPException(status_code=400, detail="缺少objective_ids参数")
    
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            # 更新每个objective的sort_order
            for index, obj_id in enumerate(request.objective_ids):
                # 检查是否属于当前用户
                cursor.execute("""
                    SELECT id FROM user_objectives
                    WHERE id = %s AND user_eng_name = %s
                """, (obj_id, user_eng_name))
                
                if cursor.fetchone():
                    cursor.execute("""
                        UPDATE user_objectives SET sort_order = %s WHERE id = %s
                    """, (index, obj_id))
            
            return {"message": "排序已保存"}

@app.put("/api/user/objectives/{obj_id}")
async def update_user_objective(obj_id: int, obj: UserObjectiveUpdate, user_eng_name: str):
    """更新个人Objective"""
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            updates = []
            params = []
            if obj.title is not None:
                updates.append("title = %s")
                params.append(obj.title)
            if obj.description is not None:
                updates.append("description = %s")
                params.append(obj.description)
            
            if updates:
                params.extend([user_eng_name, obj_id])
                cursor.execute(f"""
                    UPDATE user_objectives SET {', '.join(updates)}
                    WHERE user_eng_name = %s AND id = %s
                """, params)
            
            return {"message": "更新成功"}

@app.put("/api/user/key-results/sort")
async def sort_user_key_results(request: KeyResultSortRequest, user_eng_name: str):
    """更新个人Key Results排序"""
    if not request.kr_ids:
        raise HTTPException(status_code=400, detail="缺少kr_ids参数")
    
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            # 更新每个KR的sort_order
            for index, kr_id in enumerate(request.kr_ids):
                # 检查是否属于当前用户
                cursor.execute("""
                    SELECT id FROM user_key_results
                    WHERE id = %s AND user_eng_name = %s
                """, (kr_id, user_eng_name))
                
                if cursor.fetchone():
                    cursor.execute("""
                        UPDATE user_key_results SET sort_order = %s WHERE id = %s
                    """, (index, kr_id))
            
            return {"message": "排序已保存"}

@app.put("/api/user/key-results/{kr_id}")
async def update_user_key_result(kr_id: int, kr: UserKeyResultUpdate, user_eng_name: str):
    """更新个人Key Result"""
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            updates = []
            params = []
            if kr.title is not None:
                updates.append("title = %s")
                params.append(kr.title)
            if kr.description is not None:
                updates.append("description = %s")
                params.append(kr.description)
            if kr.risks_issues is not None:
                updates.append("risks_issues = %s")
                params.append(kr.risks_issues)
            
            if updates:
                params.extend([user_eng_name, kr_id])
                cursor.execute(f"""
                    UPDATE user_key_results SET {', '.join(updates)}
                    WHERE user_eng_name = %s AND id = %s
                """, params)
            
            return {"message": "更新成功"}

@app.delete("/api/user/objectives/{obj_id}")
async def delete_user_objective(obj_id: int, user_eng_name: str):
    """删除个人Objective及其所有KRs"""
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            # 检查是否属于当前用户
            cursor.execute("""
                SELECT id FROM user_objectives
                WHERE id = %s AND user_eng_name = %s
            """, (obj_id, user_eng_name))
            
            if not cursor.fetchone():
                raise HTTPException(status_code=404, detail="未找到该Objective或无权限删除")
            
            # 查询该Objective下所有来自团队的KR，用于删除认领记录
            cursor.execute("""
                SELECT source_kr_id FROM user_key_results
                WHERE user_objective_id = %s AND user_eng_name = %s
                  AND source_type = 'team' AND source_kr_id IS NOT NULL
            """, (obj_id, user_eng_name))
            team_krs = cursor.fetchall()
            
            # 删除该Objective下的所有KRs（级联删除会自动处理进展记录）
            cursor.execute("""
                DELETE FROM user_key_results
                WHERE user_objective_id = %s AND user_eng_name = %s
            """, (obj_id, user_eng_name))
            
            # 删除对应的团队KR认领记录
            for team_kr in team_krs:
                cursor.execute("""
                    DELETE FROM kr_claims
                    WHERE kr_id = %s AND user_eng_name = %s
                """, (team_kr['source_kr_id'], user_eng_name))
            
            # 删除Objective
            cursor.execute("""
                DELETE FROM user_objectives
                WHERE id = %s AND user_eng_name = %s
            """, (obj_id, user_eng_name))
            
            return {"message": "删除成功"}

@app.delete("/api/user/key-results/{kr_id}")
async def delete_user_key_result(kr_id: int, user_eng_name: str):
    """删除个人Key Result"""
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            # 检查是否属于当前用户，并获取source_kr_id
            cursor.execute("""
                SELECT id, source_type, source_kr_id FROM user_key_results
                WHERE id = %s AND user_eng_name = %s
            """, (kr_id, user_eng_name))
            
            kr_info = cursor.fetchone()
            if not kr_info:
                raise HTTPException(status_code=404, detail="未找到该Key Result或无权限")
            
            source_kr_id = kr_info['source_kr_id']
            
            # 删除KR（级联删除会自动处理进展记录）
            cursor.execute("""
                DELETE FROM user_key_results
                WHERE id = %s AND user_eng_name = %s
            """, (kr_id, user_eng_name))
            
            # 如果该KR来自团队，则同时删除认领记录
            if kr_info['source_type'] == 'team' and source_kr_id:
                cursor.execute("""
                    DELETE FROM kr_claims
                    WHERE kr_id = %s AND user_eng_name = %s
                """, (source_kr_id, user_eng_name))
            
            return {"message": "删除成功"}

@app.post("/api/user/key-results")
async def create_user_key_result(kr: KeyResultCreate, user_eng_name: str):
    """创建个人Key Result"""
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            # 验证objective是否属于当前用户
            cursor.execute("""
                SELECT id FROM user_objectives
                WHERE id = %s AND user_eng_name = %s
            """, (kr.objective_id, user_eng_name))
            
            if not cursor.fetchone():
                raise HTTPException(status_code=404, detail="未找到对应的Objective或无权限")
            
            # 创建个人KR
            cursor.execute("""
                INSERT INTO user_key_results (user_objective_id, user_eng_name, title, description, source_type, source_kr_id)
                VALUES (%s, %s, %s, %s, 'personal', NULL)
            """, (kr.objective_id, user_eng_name, kr.title, kr.description or ''))
            return {"id": cursor.lastrowid, "message": "创建成功"}

# ==================== 进展跟踪 ====================
@app.post("/api/progress/weekly")
async def create_weekly_progress(progress: WeeklyProgressCreate):
    """创建周进展"""
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute("""
                INSERT INTO weekly_progress (user_kr_id, user_eng_name, user_chn_name, content)
                VALUES (%s, %s, %s, %s)
            """, (progress.user_kr_id, progress.user_eng_name, progress.user_chn_name, progress.content))
            return {"id": cursor.lastrowid, "message": "创建成功"}

@app.get("/api/progress/weekly/{user_kr_id}")
async def get_weekly_progress(user_kr_id: int):
    """获取某个KR的所有周进展"""
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT id, content, user_eng_name, user_chn_name, created_at
                FROM weekly_progress
                WHERE user_kr_id = %s
                ORDER BY created_at DESC
            """, (user_kr_id,))
            return {"progress": cursor.fetchall()}

@app.put("/api/progress/weekly/{progress_id}")
async def update_weekly_progress(progress_id: int, update_data: WeeklyProgressUpdate, user_eng_name: str = Query(...)):
    """更新周进展"""
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            # 验证该进展是否属于当前用户
            cursor.execute("""
                SELECT user_eng_name FROM weekly_progress
                WHERE id = %s
            """, (progress_id,))
            result = cursor.fetchone()
            if not result:
                raise HTTPException(status_code=404, detail="未找到该周进展")
            if result['user_eng_name'] != user_eng_name:
                raise HTTPException(status_code=403, detail="无权限修改该进展")
            
            # 更新进展
            cursor.execute("""
                UPDATE weekly_progress
                SET content = %s
                WHERE id = %s
            """, (update_data.content, progress_id))
            return {"message": "更新成功", "id": progress_id}

@app.delete("/api/progress/weekly/{progress_id}")
async def delete_weekly_progress(progress_id: int, user_eng_name: str):
    """删除周进展"""
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            # 验证该进展是否属于当前用户
            cursor.execute("""
                SELECT user_eng_name FROM weekly_progress
                WHERE id = %s
            """, (progress_id,))
            result = cursor.fetchone()
            if not result:
                raise HTTPException(status_code=404, detail="未找到该周进展")
            if result['user_eng_name'] != user_eng_name:
                raise HTTPException(status_code=403, detail="无权限删除该进展")
            
            # 删除进展
            cursor.execute("""
                DELETE FROM weekly_progress
                WHERE id = %s
            """, (progress_id,))
            return {"message": "删除成功"}

@app.post("/api/progress/overall")
async def upsert_overall_progress(progress: OverallProgressUpsert):
    """创建或更新整体进展"""
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute("""
                INSERT INTO overall_progress (user_kr_id, user_eng_name, user_chn_name, content)
                VALUES (%s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE content = VALUES(content), updated_at = CURRENT_TIMESTAMP
            """, (progress.user_kr_id, progress.user_eng_name, progress.user_chn_name, progress.content))
            return {"message": "保存成功"}

@app.get("/api/progress/overall/{user_kr_id}")
async def get_overall_progress(user_kr_id: int, user_eng_name: str):
    """获取某个KR的整体进展"""
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT id, content, user_eng_name, user_chn_name, updated_at
                FROM overall_progress
                WHERE user_kr_id = %s AND user_eng_name = %s
            """, (user_kr_id, user_eng_name))
            result = cursor.fetchone()
            return result if result else {"content": ""}

@app.get("/api/progress/team-summary")
async def get_team_progress_summary():
    """获取团队进展汇总"""
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT 
                    ukr.id as user_kr_id,
                    ukr.title as user_kr_title,
                    COALESCE(kr.title, ukr.title) as kr_title,
                    ukr.source_kr_id,
                    uo.title as obj_title,
                    ukr.user_eng_name,
                    COALESCE(wp.user_chn_name, op.user_chn_name, nwp.user_chn_name) as user_chn_name,
                    wp.content as weekly_content,
                    wp.created_at as weekly_time,
                    op.content as overall_content,
                    op.updated_at as overall_time,
                    nwp.content as next_week_content,
                    nwp.updated_at as next_week_time,
                    nwp.estimated_man_days
                FROM user_key_results ukr
                JOIN user_objectives uo ON ukr.user_objective_id = uo.id
                LEFT JOIN key_results kr ON ukr.source_kr_id = kr.id
                LEFT JOIN (
                    SELECT wp1.*
                    FROM weekly_progress wp1
                    INNER JOIN (
                        SELECT user_kr_id, MAX(created_at) as max_time
                        FROM weekly_progress
                        GROUP BY user_kr_id
                    ) wp2 ON wp1.user_kr_id = wp2.user_kr_id AND wp1.created_at = wp2.max_time
                ) wp ON ukr.id = wp.user_kr_id
                LEFT JOIN overall_progress op ON ukr.id = op.user_kr_id AND ukr.user_eng_name = op.user_eng_name
                LEFT JOIN next_week_plan nwp ON ukr.id = nwp.user_kr_id AND ukr.user_eng_name = nwp.user_eng_name
                WHERE wp.id IS NOT NULL OR op.id IS NOT NULL OR nwp.id IS NOT NULL
                ORDER BY GREATEST(COALESCE(wp.created_at, '1970-01-01'), COALESCE(op.updated_at, '1970-01-01'), COALESCE(nwp.updated_at, '1970-01-01')) DESC
            """)
            return {"summary": cursor.fetchall()}

@app.get("/api/progress/batch")
async def get_batch_progress(user_eng_names: str = Query(..., description="用户英文名，多个用逗号分隔")):
    """批量获取多个用户的进展数据（用于演讲者模式和个人OKR）"""
    user_list = [name.strip() for name in user_eng_names.split(',') if name.strip()]
    
    if not user_list:
        return {"data": []}
    
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            placeholders = ','.join(['%s'] * len(user_list))
            
            # 获取所有用户的OKR和KR（包括风险和问题）
            cursor.execute(f"""
                SELECT 
                    ukr.id as user_kr_id,
                    ukr.title as kr_title,
                    ukr.source_kr_id,
                    ukr.risks_issues,
                    uo.title as obj_title,
                    uo.user_eng_name,
                    uo.obj_type,
                    uo.weight,
                    ukr.source_type
                FROM user_key_results ukr
                JOIN user_objectives uo ON ukr.user_objective_id = uo.id
                WHERE uo.user_eng_name IN ({placeholders})
                ORDER BY uo.user_eng_name, uo.created_at, ukr.created_at
            """, user_list)
            
            user_krs = cursor.fetchall()
            
            if not user_krs:
                return {"data": []}
            
            # 获取所有KR的ID列表
            kr_ids = [kr['user_kr_id'] for kr in user_krs]
            kr_placeholders = ','.join(['%s'] * len(kr_ids))
            
            # 获取所有周进展
            cursor.execute(f"""
                SELECT wp.*
                FROM weekly_progress wp
                WHERE wp.user_kr_id IN ({kr_placeholders})
                ORDER BY wp.user_kr_id, wp.created_at DESC
            """, kr_ids)
            
            weekly_progress = cursor.fetchall()
            
            # 获取所有整体进展
            cursor.execute(f"""
                SELECT op.*
                FROM overall_progress op
                WHERE op.user_kr_id IN ({kr_placeholders})
            """, kr_ids)
            
            overall_progress = cursor.fetchall()
            
            # 获取所有下周计划
            cursor.execute(f"""
                SELECT nwp.*
                FROM next_week_plan nwp
                WHERE nwp.user_kr_id IN ({kr_placeholders})
            """, kr_ids)
            
            next_week_plans = cursor.fetchall()
            
            # 构建返回数据
            result = []
            for kr in user_krs:
                kr_data = {
                    'user_kr_id': kr['user_kr_id'],
                    'kr_title': kr['kr_title'],
                    'source_kr_id': kr['source_kr_id'],
                    'obj_title': kr['obj_title'],
                    'user_eng_name': kr['user_eng_name'],
                    'obj_type': kr['obj_type'],
                    'weight': kr['weight'],
                    'source_type': kr['source_type'],
                    'risks_issues': kr['risks_issues'],
                    'weekly_progress': [wp for wp in weekly_progress if wp['user_kr_id'] == kr['user_kr_id']],
                    'overall_progress': next((op for op in overall_progress if op['user_kr_id'] == kr['user_kr_id'] and op['user_eng_name'] == kr['user_eng_name']), None),
                    'next_week_plan': next((nwp for nwp in next_week_plans if nwp['user_kr_id'] == kr['user_kr_id'] and nwp['user_eng_name'] == kr['user_eng_name']), None)
                }
                result.append(kr_data)
            
            return {"data": result}

# ==================== 下周计划 ====================
@app.post("/api/progress/next-week-plan")
async def upsert_next_week_plan(plan: NextWeekPlanUpsert):
    """创建或更新下周计划"""
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute("""
                INSERT INTO next_week_plan (user_kr_id, user_eng_name, user_chn_name, content, estimated_man_days)
                VALUES (%s, %s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE content = VALUES(content), estimated_man_days = VALUES(estimated_man_days), updated_at = CURRENT_TIMESTAMP
            """, (plan.user_kr_id, plan.user_eng_name, plan.user_chn_name, plan.content, plan.estimated_man_days))
            return {"message": "保存成功"}

@app.get("/api/progress/next-week-plan/{user_kr_id}")
async def get_next_week_plan(user_kr_id: int, user_eng_name: str):
    """获取某个KR的下周计划"""
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT id, content, user_eng_name, user_chn_name, updated_at, estimated_man_days
                FROM next_week_plan
                WHERE user_kr_id = %s AND user_eng_name = %s
            """, (user_kr_id, user_eng_name))
            result = cursor.fetchone()
            return result if result else {"content": "", "estimated_man_days": 0.0}

# ==================== AI辅助填写 ====================
@app.post("/api/ai/generate-overall")
async def generate_overall_progress(req: AIGenerateRequest):
    """AI生成整体进展草稿"""
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            # 获取所有周进展
            cursor.execute("""
                SELECT content, created_at
                FROM weekly_progress
                WHERE user_kr_id = %s
                ORDER BY created_at DESC
                LIMIT 10
            """, (req.user_kr_id,))
            weekly = cursor.fetchall()
            
            # 获取当前整体进展
            cursor.execute("""
                SELECT content
                FROM overall_progress
                WHERE user_kr_id = %s
                LIMIT 1
            """, (req.user_kr_id,))
            overall = cursor.fetchone()
            
            # 简单的AI模拟：汇总周进展
            draft = "## 整体进展汇总\n\n"
            if overall and overall['content']:
                draft += "### 之前的进展\n" + overall['content'] + "\n\n"
            
            draft += "### 最近更新\n"
            for i, w in enumerate(weekly[:5], 1):
                draft += f"{i}. {w['content']}\n"
            
            return {"draft": draft}

# ==================== AI对话助手 ====================

# ReACT Agent Plan 生成接口
@app.post("/api/chat/plan")
async def generate_plan(request: ChatRequest):
    """生成执行计划（ReACT Agent 第一步：思维链推理）"""
    
    if not AI_API_KEY:
        return {
            "plan": {
                "thought": "由于未配置 AI_API_KEY，我目前处于模拟模式。",
                "steps": [
                    {"step": 1, "action": "模拟查询", "reason": "这是一个模拟的执行步骤"}
                ],
                "expected_result": "模拟结果"
            }
        }
    
    try:
        # 从配置文件获取 AI 助手系统提示词
        ai_assistant_system = prompts.get("ai_assistant_system", """你是一个智能助手，专门帮助用户管理 OKR 和待办事项。

你可以：
1. 回答关于OKR管理的问题
2. 帮助分析团队和个人的OKR进展
3. 查询版本信息（版本里程碑、进展、负责人、缺陷情况等）
4. 提供待办事项管理建议

请根据用户提供的上下文信息，给出准确、有帮助的回答。""")
        
        # 动态生成工具说明
        tool_descriptions = []
        
        # 固定保留 execute_sql_query 工具
        tool_descriptions.append("- `execute_sql_query`: 执行 SQL 查询来获取 OKR 系统的数据")
        
        # 根据 QPilot 配置动态添加工具
        if QPILOT_CONFIGS:
            for qpilot_config in QPILOT_CONFIGS:
                tool_name = qpilot_config.get("tool_name", "")
                tool_purpose = qpilot_config.get("tool_purpose", "")
                
                if tool_name and tool_purpose:
                    tool_descriptions.append(f"- `{tool_name}`: {tool_purpose}")
        
        tools_section = "\n".join(tool_descriptions)
        
        # 拼接工具说明到 AI 助手系统提示词
        ai_assistant_with_tools = f"""{ai_assistant_system}

你可以使用以下工具：
{tools_section}"""
        
        # 拼接 ReACT 指令
        system_prompt = f"""{ai_assistant_with_tools}

你的任务是：
1. **Thought（思考）**：分析用户的问题，理解用户的真实意图
2. **Plan（规划）**：制定详细的执行计划，列出需要执行的步骤
3. **Action（行动）**：说明每一步需要使用什么工具、传入什么参数

数据库表结构：
- objectives: 团队目标表 (id, title, description, sort_order, created_by, created_at, updated_at, obj_type, weight)
- key_results: 团队关键结果表 (id, objective_id, title, description, sort_order, created_at, updated_at)
- kr_claims: KR认领关系表 (id, kr_id, objective_id, user_eng_name, user_chn_name, claimed_at)
- user_objectives: 个人目标表 (id, user_eng_name, title, description, obj_type, weight, sort_order, source_type, source_id, created_at, updated_at)
- user_key_results: 个人关键结果表 (id, user_objective_id, user_eng_name, title, description, risks_issues, sort_order, source_type, source_kr_id, created_at, updated_at)
- weekly_progress: 周进展表 (id, user_kr_id, user_eng_name, user_chn_name, content, created_at)
- overall_progress: 整体进展表 (id, user_kr_id, user_eng_name, user_chn_name, content, updated_at)
- next_week_plan: 下周计划表 (id, user_kr_id, user_eng_name, user_chn_name, content, estimated_man_days, created_at, updated_at)
- todos: 待办事项表 (id, title, description, assignee_eng_name, assignee_chn_name, status, created_by, created_at, updated_at)
- todo_progress: 待办进展表 (id, todo_id, content, created_by, created_at)
- team_reports: 团队报告表 (id, permalink, title, content, created_by, created_at, updated_at)
- team_weekly_reports: 团队周报表 (id, title, content, created_by, created_at, updated_at)
- platforms: 平台工具表 (id, name, url, description, thumbnail, tags, created_at, updated_at, category, added_by_eng_name, added_by_chn_name)

请以 JSON 格式返回你的执行计划：
```json
{{
  "thought": "你的思考过程，分析用户问题的意图",
  "steps": [
    {{
      "step": 1,
      "action": "工具名称",
      "params": {{"参数名": "参数值"}},
      "reason": "为什么需要这一步"
    }}
  ],
  "expected_result": "预期能够回答用户什么问题"
}}
```

注意：
1. 只返回 JSON，不要有其他文字
2. 如果问题很简单，不需要工具调用，steps 可以为空数组
3. 合理规划步骤顺序，确保逻辑清晰"""

        if request.user_eng_name:
            system_prompt += f"\n\n当前登录的用户名：{request.user_eng_name}"
        
        if request.context:
            system_prompt += f"\n\n当前页面上下文：\n{request.context}"
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": request.messages[-1].content}
        ]
        
        headers = {
            "Authorization": f"Bearer {AI_API_KEY}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": AI_MODEL,
            "messages": messages,
            "temperature": 0.3,  # 降低温度，让规划更稳定
            "stream": False
        }
        
        async with httpx.AsyncClient(timeout=AI_TIMEOUT) as client:
            response = await client.post(
                f"{AI_API_BASE_URL}/chat/completions",
                json=payload,
                headers=headers
            )
            
            if response.status_code != 200:
                raise HTTPException(status_code=500, detail="AI 服务请求失败")
            
            result = response.json()
            content = result["choices"][0]["message"]["content"]
            
            # 提取 JSON（可能被包裹在 ```json ``` 中）
            import re
            json_match = re.search(r'```json\s*(.*?)\s*```', content, re.DOTALL)
            if json_match:
                content = json_match.group(1)
            
            plan = json.loads(content)
            return {"plan": plan}
            
    except Exception as e:
        logging.error(f"生成执行计划失败: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"生成执行计划失败: {str(e)}")


@app.post("/api/chat/check-completion")
async def check_task_completion(request: ChatRequest):
    """判断任务是否完成（ReACT Loop 的关键步骤）"""
    
    if not AI_API_KEY:
        # 未配置API Key时，默认认为任务已完成
        return {"is_complete": True}
    
    try:
        # 构建判断任务完成的系统提示词
        system_prompt = """你是一个任务完成度判断专家。

你的任务是：根据用户的原始问题和AI助手的回复历史，判断用户的问题是否已经被完整解决。

判断标准：
1. **已完成**：AI已经提供了完整、准确的答案，用户的问题得到了充分解答
2. **未完成**：
   - AI的回复不完整或不准确
   - 需要进一步查询或分析
   - 工具调用失败或返回了错误
   - 用户的问题只得到了部分解答

请以 JSON 格式返回判断结果：
```json
{
  "is_complete": true/false,
  "reason": "判断理由"
}
```

注意：
1. 只返回 JSON，不要有其他文字
2. 如果不确定，倾向于认为任务已完成，避免无限循环
3. 如果AI已经明确表示无法回答或需要更多信息，认为任务已完成"""

        if request.user_eng_name:
            system_prompt += f"\n\n当前登录的用户名：{request.user_eng_name}"
        
        if request.context:
            system_prompt += f"\n\n当前页面上下文：\n{request.context}"
        
        # 构建消息历史摘要
        conversation_summary = "\n\n".join([
            f"{'用户' if msg.role == 'user' else 'AI助手'}: {msg.content}"
            for msg in request.messages[-5:]  # 只取最近5条消息
        ])
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"对话历史：\n{conversation_summary}\n\n请判断用户的问题是否已经被完整解决。"}
        ]
        
        headers = {
            "Authorization": f"Bearer {AI_API_KEY}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": AI_MODEL,
            "messages": messages,
            "temperature": 0.1,  # 降低温度，让判断更稳定
            "stream": False
        }
        
        async with httpx.AsyncClient(timeout=AI_TIMEOUT) as client:
            response = await client.post(
                f"{AI_API_BASE_URL}/chat/completions",
                json=payload,
                headers=headers
            )
            
            if response.status_code != 200:
                logging.error(f"AI 服务请求失败: {response.status_code}")
                # 出错时默认认为任务已完成，避免无限循环
                return {"is_complete": True}
            
            result = response.json()
            content = result["choices"][0]["message"]["content"]
            
            # 提取JSON
            json_match = re.search(r'\{[\s\S]*\}', content)
            if json_match:
                completion_data = json.loads(json_match.group())
                is_complete = completion_data.get("is_complete", True)
                reason = completion_data.get("reason", "")
                
                logging.info(f"任务完成判断: is_complete={is_complete}, reason={reason}")
                
                return {
                    "is_complete": is_complete,
                    "reason": reason
                }
            else:
                logging.warning(f"无法解析任务完成判断结果: {content}")
                # 解析失败时默认认为任务已完成
                return {"is_complete": True}
    
    except Exception as e:
        logging.error(f"判断任务完成失败: {str(e)}", exc_info=True)
        # 出错时默认认为任务已完成，避免无限循环
        return {"is_complete": True}


@app.post("/api/chat")
async def chat_with_ai(request: ChatRequest):
    """与AI助手对话，支持流式输出和工具调用"""

    sql_tool_description = prompts.get("sql_query_tool_description", "执行SQL查询来获取OKR系统的数据")
    sql_param_description = prompts.get("sql_query_tool_param_description", "要执行的SQL查询语句，必须是SELECT语句")
    
    # 动态构建工具列表
    tools = [{
            "type": "function",
            "function": {
                "name": "execute_sql_query",
                "description": sql_tool_description,
                "parameters": {
                    "type": "object",
                    "properties": {
                        "sql": {
                            "type": "string",
                            "description": sql_param_description
                        }
                    },
                    "required": ["sql"]
                }
            }
        }]
    
    # 只有当存在 QPilot 配置时才添加工具
    if QPILOT_CONFIGS:
        # 为每个QPilot配置创建工具
        for idx, qpilot_config in enumerate(QPILOT_CONFIGS):
            pilot_id = qpilot_config.get("pilot_id", "")
            tool_name = qpilot_config.get("tool_name", "")
            tool_purpose = qpilot_config.get("tool_purpose", "")
            tool_desc = qpilot_config.get("tool_description", "")
            tool_param_desc = qpilot_config.get("tool_param_description", "用户的具体查询问题，请直接传入用户的原始问题，不要改写")
            
            # 优先使用 tool_purpose，如果没有则使用 tool_description
            final_tool_desc = tool_purpose if tool_purpose else tool_desc
            
            if pilot_id and tool_name and final_tool_desc:  # 只有当必要字段都存在时才添加
                tools.append({
                    "type": "function",
                    "function": {
                        "name": tool_name,
                        "description": final_tool_desc,
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "query": {
                                    "type": "string",
                                    "description": tool_param_desc
                                }
                            },
                            "required": ["query"]
                        }
                    }
                })
    
    async def generate_stream():
        # 如果没有配置API Key，返回模拟数据
        if not AI_API_KEY:
            import asyncio
            mock_responses = [
                "我已收到您的消息：",
                f"\"{request.messages[-1].content}\"",
                "\n\n由于未配置 `AI_API_KEY`，我目前处于**模拟模式**。",
                "\n\n我可以获取到的上下文信息包括：",
                f"\n- 上下文长度: {len(request.context or '')} 字符",
                "\n\n请在 `config.yml` 中配置有效的 API Key 以启用真实 AI 功能。"
            ]
            for chunk in mock_responses:
                yield chunk
                await asyncio.sleep(0.1)
            return

        try:
            # 从配置文件获取系统提示词
            system_prompt = prompts.get("ai_assistant_system", "你是一个智能助手，专门帮助用户管理OKR和待办事项。")
            
            # 动态追加当前登录用户名
            if request.user_eng_name:
                system_prompt += f"\n\n当前登录的用户名：{request.user_eng_name}"
            
            # 如果有上下文，添加上下文信息
            if request.context:
                context_template = prompts.get("ai_assistant_context", "当前页面上下文信息：\n{context}\n\n请根据上述上下文信息回答用户的问题。")
                system_prompt += "\n\n" + context_template.format(context=request.context)
            
            messages = [{"role": "system", "content": system_prompt}]
            for msg in request.messages:
                messages.append({"role": msg.role, "content": msg.content})
            
            headers = {
                "Authorization": f"Bearer {AI_API_KEY}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "model": AI_MODEL,
                "messages": messages,
                "tools": tools,
                "tool_choice": "auto",
                "stream": True,
                "temperature": AI_TEMPERATURE
            }
            
            logging.info(f"[AI Chat] 发送请求到 {AI_API_BASE_URL}, 模型: {AI_MODEL}")
            
            # 存储完整的工具调用信息
            tool_calls_buffer = []
            current_tool_call = None
            
            try:
                async with httpx.AsyncClient(timeout=AI_TIMEOUT) as client:
                    async with client.stream("POST", f"{AI_API_BASE_URL}/chat/completions", json=payload, headers=headers) as response:
                        if response.status_code != 200:
                            error_content = await response.aread()
                            error_msg = f"API请求失败 ({response.status_code}): {error_content.decode('utf-8', errors='ignore')}"
                            logging.error(f"[AI Chat] {error_msg}")
                            yield f"抱歉，AI服务暂时不可用。错误信息：{error_msg}"
                            return

                        async for line in response.aiter_lines():
                            if not line or not line.strip():
                                continue
                                
                            if line.startswith("data: "):
                                data = line[6:]
                                if data == "[DONE]":
                                    break
                                try:
                                    chunk = json.loads(data)
                                    
                                    # 检查是否有choices
                                    if "choices" not in chunk or len(chunk["choices"]) == 0:
                                        continue
                                    
                                    delta = chunk["choices"][0].get("delta", {})
                                    
                                    # 处理工具调用
                                    if "tool_calls" in delta:
                                        for tool_call in delta["tool_calls"]:
                                            if "index" not in tool_call:
                                                continue
                                            
                                            index = tool_call["index"]
                                            
                                            # 确保有足够的空间存储当前工具调用
                                            while len(tool_calls_buffer) <= index:
                                                tool_calls_buffer.append({
                                                    "id": "",
                                                    "type": "function",
                                                    "function": {
                                                        "name": "",
                                                        "arguments": ""
                                                    }
                                                })
                                            
                                            current_tool_call = tool_calls_buffer[index]
                                            
                                            if "id" in tool_call:
                                                current_tool_call["id"] = tool_call["id"]
                                            
                                            if "function" in tool_call:
                                                func = tool_call["function"]
                                                if "name" in func:
                                                    current_tool_call["function"]["name"] = func["name"]
                                                if "arguments" in func:
                                                    current_tool_call["function"]["arguments"] += func["arguments"]
                                    
                                    # 处理普通内容
                                    elif delta.get("content"):
                                        content = delta["content"]
                                        yield content
                                        
                                except json.JSONDecodeError as e:
                                    logging.warning(f"[AI Chat] JSON解析失败: {e}, 数据: {data[:100]}")
                                    continue
                                except KeyError as e:
                                    logging.warning(f"[AI Chat] 数据格式错误: {e}, chunk: {chunk}")
                                    continue
                                except Exception as e:
                                    logging.error(f"[AI Chat] 处理响应时出错: {e}", exc_info=True)
                                    continue
            
            except httpx.TimeoutException:
                error_msg = "AI服务响应超时，请稍后重试"
                logging.error(f"[AI Chat] {error_msg}")
                yield error_msg
                return
            except httpx.RequestError as e:
                error_msg = f"网络请求失败: {str(e)}"
                logging.error(f"[AI Chat] {error_msg}")
                yield f"抱歉，无法连接到AI服务。{error_msg}"
                return
            except Exception as e:
                error_msg = f"处理AI响应时出错: {str(e)}"
                logging.error(f"[AI Chat] {error_msg}", exc_info=True)
                yield f"抱歉，处理响应时出现问题。{error_msg}"
                return
            
            # 检查是否有工具调用需要处理
            if tool_calls_buffer:
                # 先发送工具调用信息给前端（以特殊格式）
                for tool_call in tool_calls_buffer:
                    tool_name = tool_call["function"]["name"]
                    tool_args = tool_call["function"]["arguments"]
                    
                    try:
                        args = json.loads(tool_args) if tool_args else {}
                        args_str = json.dumps(args, ensure_ascii=False)
                        
                        # 发送工具调用开始标记（JSON格式）
                        tool_start_event = {
                            "type": "tool_call_start",
                            "tool_name": tool_name,
                            "tool_args": args_str
                        }
                        yield f"\n\n[TOOL_CALL_START:{json.dumps(tool_start_event, ensure_ascii=False)}]\n\n"
                        
                    except Exception as e:
                        logging.error(f"发送工具调用信息失败: {str(e)}")
                
                # 执行工具调用
                tool_responses = []
                
                for tool_call in tool_calls_buffer:
                    tool_name = tool_call["function"]["name"]
                    tool_args = tool_call["function"]["arguments"]
                    
                    try:
                        # 解析工具参数
                        args = json.loads(tool_args) if tool_args else {}
                        
                        if tool_name.startswith("query_version_info") or (QPILOT_CONFIGS and any(config.get("tool_name") == tool_name for config in QPILOT_CONFIGS)):
                            # 调用QPilot工具
                            query = args.get("query", "")
                            user_eng_name = "unknown"
                            
                            # 从上下文或消息中提取用户信息
                            if request.context:
                                import re
                                match = re.search(r'当前用户：([a-zA-Z]+)\(', request.context)
                                if match:
                                    user_eng_name = match.group(1)
                            
                            # 根据工具名称找到对应的QPilot配置
                            qpilot_config = None
                            
                            # 优先通过 tool_name 精确匹配
                            for config in QPILOT_CONFIGS:
                                if config.get("tool_name") == tool_name:
                                    qpilot_config = config
                                    break
                            
                            # 兼容旧的 query_version_info 格式
                            if not qpilot_config:
                                if tool_name == "query_version_info" and QPILOT_CONFIGS:
                                    # 如果是单一工具名，使用第一个配置
                                    qpilot_config = QPILOT_CONFIGS[0]
                                else:
                                    # 如果是带编号的工具名（如query_version_info_1），提取编号
                                    import re
                                    match = re.match(r'query_version_info_(\d+)', tool_name)
                                    if match:
                                        tool_idx = int(match.group(1)) - 1
                                        if 0 <= tool_idx < len(QPILOT_CONFIGS):
                                            qpilot_config = QPILOT_CONFIGS[tool_idx]
                            
                            if not qpilot_config:
                                tool_response_content = "错误：未找到对应的QPilot配置"
                            else:
                                pilot_id = qpilot_config.get("pilot_id", "")
                                
                                # 构建QPilot请求
                                qpilot_headers = {
                                    "Content-Type": "application/json",
                                    "QPilot-ID": pilot_id,
                                    "Authorization": f"Bearer {AI_API_KEY}"
                                }
                                
                                qpilot_payload = {
                                    "user": user_eng_name,
                                    "stream": False,  # 工具调用使用非流式响应
                                    "messages": [
                                        {
                                            "role": "user",
                                            "content": query
                                        }
                                    ]
                                }
                                
                                async with httpx.AsyncClient(timeout=60.0) as qpilot_client:
                                    qpilot_response = await qpilot_client.post(
                                        "https://api-qpilot.woa.com/qpilothub/chat/completions",
                                        json=qpilot_payload,
                                        headers=qpilot_headers
                                    )
                                    
                                    if qpilot_response.status_code == 200:
                                        qpilot_data = qpilot_response.json()
                                        if qpilot_data.get("choices") and len(qpilot_data["choices"]) > 0:
                                            tool_response_content = qpilot_data["choices"][0]["message"]["content"]
                                        else:
                                            tool_response_content = "未能获取到信息"
                                    else:
                                        tool_response_content = f"查询失败: {qpilot_response.status_code}"
                        elif tool_name == "execute_sql_query":
                            # 执行SQL查询
                            sql = args.get("sql", "")
                            
                            # 安全检查：只允许SELECT语句
                            if not sql.strip().upper().startswith("SELECT"):
                                tool_response_content = "错误：只允许执行SELECT查询语句"
                            else:
                                try:
                                    # SQL验证和修复
                                    sql_fixed = fix_sql_syntax(sql)
                                    logging.info(f"[SQL Query] Original: {sql[:200]}...")
                                    logging.info(f"[SQL Query] Fixed: {sql_fixed[:200]}...")
                                    
                                    with get_db_connection() as conn:
                                        with conn.cursor() as cursor:
                                            # 限制查询结果数量，防止数据过大
                                            if "LIMIT" not in sql_fixed.upper():
                                                sql_with_limit = f"{sql_fixed.rstrip(';')} LIMIT 100"
                                            else:
                                                sql_with_limit = sql_fixed
                                            
                                            cursor.execute(sql_with_limit)
                                            result = cursor.fetchall()
                                            
                                            # 获取列名
                                            if result:
                                                columns = result[0].keys()
                                                # 转换不可JSON序列化的类型（如Decimal）
                                                formatted_result = []
                                                for row in result:
                                                    row_dict = dict(row)
                                                    for key, value in row_dict.items():
                                                        # 将Decimal转换为float
                                                        if hasattr(value, '__class__') and value.__class__.__name__ == 'Decimal':
                                                            row_dict[key] = float(value)
                                                        # 将datetime转换为字符串
                                                        elif hasattr(value, 'isoformat'):
                                                            row_dict[key] = value.isoformat()
                                                        # 将date转换为字符串
                                                        elif hasattr(value, 'strftime'):
                                                            row_dict[key] = value.strftime('%Y-%m-%d')
                                                    formatted_result.append(row_dict)
                                                
                                                tool_response_content = f"查询成功，返回 {len(formatted_result)} 条记录：\n{json.dumps(formatted_result, ensure_ascii=False, indent=2)}"
                                            else:
                                                tool_response_content = "查询成功，但没有返回任何数据"
                                            
                                            logging.info(f"[SQL Query] Executed: {sql_with_limit[:100]}... Returned {len(result) if result else 0} rows")
                                            
                                except Exception as e:
                                    tool_response_content = f"SQL查询执行失败: {str(e)}\n\n执行的SQL: {sql[:500]}"
                                    logging.error(f"[SQL Query Error] {str(e)}", exc_info=True)
                        else:
                            tool_response_content = f"未知工具: {tool_name}"
                        
                        tool_responses.append({
                            "tool_call_id": tool_call["id"],
                            "role": "tool",
                            "name": tool_name,
                            "content": tool_response_content
                        })
                        
                        # 发送工具调用结果（JSON格式）
                        tool_result_event = {
                            "type": "tool_call_result",
                            "tool_name": tool_name,
                            "result": tool_response_content
                        }
                        yield f"\n\n[TOOL_CALL_RESULT:{json.dumps(tool_result_event, ensure_ascii=False)}]\n\n"
                        
                    except Exception as e:
                        tool_responses.append({
                            "tool_call_id": tool_call["id"],
                            "role": "tool",
                            "name": tool_name,
                            "content": f"工具执行错误: {str(e)}"
                        })
                        
                        # 发送工具调用错误
                        tool_error_event = {
                            "type": "tool_call_error",
                            "tool_name": tool_name,
                            "error": str(e)
                        }
                        yield f"\n\n[TOOL_CALL_ERROR:{json.dumps(tool_error_event, ensure_ascii=False)}]\n\n"
                
                # 将工具响应发送给AI，获取最终回复
                if tool_responses:
                    # 添加工具调用消息到历史
                    messages.append({
                        "role": "assistant",
                        "tool_calls": tool_calls_buffer
                    })
                    
                    # 添加工具响应消息
                    messages.extend(tool_responses)
                    
                    # 添加一个引导性的用户消息，明确要求AI生成总结
                    messages.append({
                        "role": "user",
                        "content": "请根据上述工具调用的结果，生成一个清晰、完整的回复。不要再次调用工具，直接基于已有的数据进行总结和分析。"
                    })
                    
                    # 再次调用AI获取最终回复（不传tools参数，强制AI生成文本回复而不是再次调用工具）
                    final_payload = {
                        "model": AI_MODEL,
                        "messages": messages,
                        "stream": True,
                        "temperature": AI_TEMPERATURE
                    }
                    
                    logging.info(f"[AI Chat] 发送工具结果给AI，等待总结回复...")
                    logging.info(f"[AI Chat] 工具响应数量: {len(tool_responses)}")
                    logging.info(f"[AI Chat] 消息历史长度: {len(messages)}")
                    
                    try:
                        async with httpx.AsyncClient(timeout=AI_TIMEOUT) as final_client:
                            async with final_client.stream("POST", f"{AI_API_BASE_URL}/chat/completions", json=final_payload, headers=headers) as final_response:
                                if final_response.status_code != 200:
                                    error_content = await final_response.aread()
                                    error_msg = f"\n\n生成回复时出错: {final_response.status_code} - {error_content.decode('utf-8')}"
                                    logging.error(f"[AI Chat] {error_msg}")
                                    yield error_msg
                                    return

                                has_content = False
                                chunk_count = 0
                                empty_delta_count = 0
                                
                                async for line in final_response.aiter_lines():
                                    if not line or not line.strip():
                                        continue
                                        
                                    if line.startswith("data: "):
                                        data = line[6:]
                                        if data == "[DONE]":
                                            logging.info(f"[AI Chat] 收到[DONE]信号，总共处理了{chunk_count}个chunk")
                                            break
                                        try:
                                            chunk = json.loads(data)
                                            chunk_count += 1
                                            
                                            if "choices" not in chunk or len(chunk["choices"]) == 0:
                                                logging.debug(f"[AI Chat] Chunk {chunk_count}: 没有choices字段")
                                                continue
                                            
                                            choice = chunk["choices"][0]
                                            delta = choice.get("delta", {})
                                            finish_reason = choice.get("finish_reason")
                                            
                                            # 记录delta内容用于调试
                                            if not delta or (not delta.get("content") and not delta.get("role")):
                                                empty_delta_count += 1
                                                if empty_delta_count <= 3:  # 只记录前3个空delta
                                                    logging.debug(f"[AI Chat] Chunk {chunk_count}: 空delta, finish_reason={finish_reason}")
                                            
                                            # 提取content
                                            if delta.get("content"):
                                                content = delta["content"]
                                                has_content = True
                                                yield content
                                            
                                            # 如果finish_reason是stop但没有内容，记录警告
                                            if finish_reason == "stop" and not has_content:
                                                logging.warning(f"[AI Chat] AI返回finish_reason=stop但没有生成任何内容，可能是模型认为工具调用结果已经足够")
                                                
                                        except json.JSONDecodeError as e:
                                            logging.warning(f"[AI Chat] 解析最终回复失败: {e}, line={line[:100]}")
                                            continue
                                        except Exception as e:
                                            logging.error(f"[AI Chat] 处理最终回复时出错: {e}", exc_info=True)
                                            continue
                                
                                # 如果没有内容，提供更友好的提示
                                if not has_content:
                                    logging.warning(f"[AI Chat] 第二次调用没有返回任何内容 (处理了{chunk_count}个chunk, {empty_delta_count}个空delta)")
                                    # 不输出错误提示，让工具调用结果作为最终回复
                                    # yield "\n\n（AI未能生成回复内容）"
                                else:
                                    logging.info(f"[AI Chat] 成功生成总结回复 (处理了{chunk_count}个chunk)")
                    
                    except httpx.TimeoutException:
                        error_msg = "\n\nAI生成回复超时，请稍后重试"
                        logging.error(f"[AI Chat] {error_msg}")
                        yield error_msg
                    except Exception as e:
                        error_msg = f"\n\n生成回复时出错: {str(e)}"
                        logging.error(f"[AI Chat] {error_msg}", exc_info=True)
                        yield error_msg
                                        
        except Exception as e:
            yield f"Error: {str(e)}"

    return StreamingResponse(generate_stream(), media_type="text/event-stream")

# ==================== 版本查询接口 ====================
@app.post("/api/version-query")
async def query_version_info(request: VersionQueryRequest):
    """查询版本信息（版本里程碑、版本进展、版本owner、模块负责人、版本缺陷情况）"""
    
    async def generate_stream():
        # 如果没有配置API Key，返回提示信息
        if not AI_API_KEY:
            import asyncio
            yield "抱歉，未配置API Key，无法查询版本信息。"
            return

        try:
            # 构建请求QPilot的payload
            headers = {
                "Content-Type": "application/json",
                "QPilot-ID": "2851",
                "Authorization": f"Bearer {AI_API_KEY}"
            }
            
            payload = {
                "user": request.user_eng_name,
                "stream": True,
                "messages": [
                    {
                        "role": "user",
                        "content": request.query
                    }
                ]
            }
            
            logging.info(f"[version-query] 发送请求到QPilot: {request.query}")
            
            async with httpx.AsyncClient(timeout=60.0) as client:
                async with client.stream("POST", "https://api-qpilot.woa.com/qpilothub/chat/completions", json=payload, headers=headers) as response:
                    if response.status_code != 200:
                        error_content = await response.aread()
                        error_msg = f"Error: {response.status_code} - {error_content.decode('utf-8')}"
                        logging.error(f"[version-query] QPilot请求失败: {error_msg}")
                        yield error_msg
                        return

                    # 处理流式响应
                    async for line in response.aiter_lines():
                        if line.startswith("data: "):
                            data = line[6:]
                            if data == "[DONE]":
                                break
                            try:
                                chunk = json.loads(data)
                                if chunk["choices"][0]["delta"].get("content"):
                                    content = chunk["choices"][0]["delta"]["content"]
                                    yield content
                            except json.JSONDecodeError:
                                continue
        except Exception as e:
            error_msg = f"查询版本信息时出错: {str(e)}"
            logging.error(f"[version-query] {error_msg}", exc_info=True)
            yield error_msg

    return StreamingResponse(generate_stream(), media_type="text/event-stream")

# ==================== 图片上传 ====================
@app.post("/api/upload")
async def upload_image(file: UploadFile, request: Request):
    """上传图片到腾讯云COS或本地存储"""
    # 验证文件类型
    allowed_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'}
    file_ext = os.path.splitext(file.filename)[1].lower()
    
    if file_ext not in allowed_extensions:
        raise HTTPException(status_code=400, detail="不支持的图片格式")
    
    # 验证文件大小（最大5MB）
    max_size = 5 * 1024 * 1024  # 5MB
    contents = await file.read()
    if len(contents) > max_size:
        raise HTTPException(status_code=400, detail="图片大小不能超过5MB")
    
    # 生成文件名（使用时间戳和随机数）
    import time
    import random
    timestamp = int(time.time())
    random_num = random.randint(1000, 9999)
    filename = f"img_{timestamp}_{random_num}{file_ext}"
    
    # 上传到COS（如果配置了）或本地存储
    file_url = await upload_to_cos(filename, contents, file.content_type)
    
    return {"url": file_url, "filename": filename}

# ==================== 待办事项管理 ====================
@app.get("/api/todos")
async def get_todos(
    assignee: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    sort_by: str = "created_at",
    sort_order: str = "desc"
):
    """获取待办列表（支持过滤、搜索、排序）"""
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            query = "SELECT * FROM todos WHERE 1=1"
            params = []
            
            if assignee:
                query += " AND assignee_eng_name = %s"
                params.append(assignee)
            
            if status:
                query += " AND status = %s"
                params.append(status)
            
            if search:
                query += " AND description LIKE %s"
                search_pattern = f"%{search}%"
                params.append(search_pattern)
            
            # 排序
            allowed_sort = ['created_at', 'updated_at']
            if sort_by not in allowed_sort:
                sort_by = 'created_at'
            
            sort_order = 'DESC' if sort_order.lower() == 'desc' else 'ASC'
            query += f" ORDER BY {sort_by} {sort_order}"
            
            cursor.execute(query, params)
            todos = cursor.fetchall()
            
            # 为每个todo获取进展
            for todo in todos:
                cursor.execute("""
                    SELECT id, content, created_by, created_at
                    FROM todo_progress
                    WHERE todo_id = %s
                    ORDER BY created_at DESC
                """, (todo['id'],))
                todo['progress'] = cursor.fetchall()
            
            return {"todos": todos}

@app.post("/api/todos")
async def create_todo(todo: TodoCreate):
    """创建待办"""
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute("""
                INSERT INTO todos (title, description, assignee_eng_name, assignee_chn_name, created_by, status)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, ('', todo.description, todo.assignee_eng_name, todo.assignee_chn_name, todo.created_by, todo.status))
            todo_id = cursor.lastrowid
            
            # 只有status为pending时才发送企微通知（集思广益类型的待办不发送通知）
            if todo.status == 'pending':
                await send_wework_notification(
                    title='',
                    assignee_eng_name=todo.assignee_eng_name,
                    assignee_chn_name=todo.assignee_chn_name,
                    description=todo.description or ""
                )
            
            return {"id": todo_id, "message": "创建成功"}

@app.put("/api/todos/{todo_id}")
async def update_todo(todo_id: int, todo: TodoUpdate):
    """更新待办"""
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            # 先获取待办的原始信息
            cursor.execute("""
                SELECT title, description, assignee_eng_name, assignee_chn_name, status
                FROM todos
                WHERE id = %s
            """, (todo_id,))
            original_todo = cursor.fetchone()
            
            if not original_todo:
                raise HTTPException(status_code=404, detail="待办不存在")
            
            updates = []
            params = []
            
            if todo.description is not None:
                updates.append("description = %s")
                params.append(todo.description)
            if todo.status is not None:
                updates.append("status = %s")
                params.append(todo.status)
            if todo.assignee_eng_name is not None:
                updates.append("assignee_eng_name = %s")
                params.append(todo.assignee_eng_name)
            if todo.assignee_chn_name is not None:
                updates.append("assignee_chn_name = %s")
                params.append(todo.assignee_chn_name)
            
            if updates:
                params.append(todo_id)
                cursor.execute(f"""
                    UPDATE todos SET {', '.join(updates)}
                    WHERE id = %s
                """, params)
            
            # 使用更新后的信息或原始信息
            description = todo.description if todo.description is not None else original_todo['description']
            assignee_eng = todo.assignee_eng_name if todo.assignee_eng_name is not None else original_todo['assignee_eng_name']
            assignee_chn = todo.assignee_chn_name if todo.assignee_chn_name is not None else original_todo['assignee_chn_name']
            
            # 如果状态从非pending变为pending，发送新待办通知
            if (todo.status == 'pending' and 
                original_todo['status'] != 'pending'):
                await send_wework_notification(
                    title='',
                    assignee_eng_name=assignee_eng,
                    assignee_chn_name=assignee_chn,
                    description=description or ''
                )
            
            # 如果状态从非完成变为完成，且原状态不是idea，发送企微通知
            # 集思广益类型的待办（status为idea）不发送通知
            elif (todo.status == 'completed' and 
                original_todo['status'] != 'completed' and 
                original_todo['status'] != 'idea'):
                # 发送完成通知
                await send_wework_completion_notification(
                    title='',
                    assignee_eng_name=assignee_eng,
                    assignee_chn_name=assignee_chn,
                    description=description or ''
                )
            
            return {"message": "更新成功"}

@app.delete("/api/todos/{todo_id}")
async def delete_todo(todo_id: int):
    """删除待办"""
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            # 先删除相关的进展
            cursor.execute("DELETE FROM todo_progress WHERE todo_id = %s", (todo_id,))
            # 删除待办
            cursor.execute("DELETE FROM todos WHERE id = %s", (todo_id,))
            return {"message": "删除成功"}

@app.post("/api/todos/progress")
async def add_todo_progress(progress: TodoProgressCreate):
    """添加待办进展"""
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute("""
                INSERT INTO todo_progress (todo_id, content, created_by)
                VALUES (%s, %s, %s)
            """, (progress.todo_id, progress.content, progress.created_by))
            return {"id": cursor.lastrowid, "message": "添加成功"}

@app.put("/api/todos/progress/{progress_id}")
async def update_todo_progress(progress_id: int, update_data: WeeklyProgressUpdate, user_eng_name: str = Query(...)):
    """更新待办进展"""
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            # 验证该进展是否属于当前用户
            cursor.execute("""
                SELECT created_by FROM todo_progress
                WHERE id = %s
            """, (progress_id,))
            result = cursor.fetchone()
            if not result:
                raise HTTPException(status_code=404, detail="未找到该待办进展")
            
            # 更新进展
            cursor.execute("""
                UPDATE todo_progress
                SET content = %s
                WHERE id = %s
            """, (update_data.content, progress_id))
            return {"message": "更新成功", "id": progress_id}

@app.delete("/api/todos/progress/{progress_id}")
async def delete_todo_progress(progress_id: int, user_eng_name: str = Query(...)):
    """删除待办进展"""
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            # 验证该进展是否存在
            cursor.execute("""
                SELECT id FROM todo_progress
                WHERE id = %s
            """, (progress_id,))
            result = cursor.fetchone()
            if not result:
                raise HTTPException(status_code=404, detail="未找到该待办进展")
            
            # 删除进展
            cursor.execute("""
                DELETE FROM todo_progress
                WHERE id = %s
            """, (progress_id,))
            return {"message": "删除成功"}

# ==================== 平台管理 ====================
@app.get("/api/platforms")
async def get_platforms():
    """获取所有平台列表"""
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT id, name, category, url, description, thumbnail, tags, created_at, updated_at, added_by_eng_name, added_by_chn_name
                FROM platforms
                ORDER BY category ASC, created_at DESC
            """)
            platforms = cursor.fetchall()
            
            # 解析JSON格式的tags
            for platform in platforms:
                if platform['tags']:
                    try:
                        platform['tags'] = json.loads(platform['tags'])
                    except json.JSONDecodeError:
                        platform['tags'] = []
                else:
                    platform['tags'] = []
            
            return {"platforms": platforms}

@app.get("/api/platforms/{platform_id}")
async def get_platform(platform_id: int):
    """获取单个平台详情"""
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT id, name, category, url, description, thumbnail, tags, created_at, updated_at
                FROM platforms
                WHERE id = %s
            """, (platform_id,))
            platform = cursor.fetchone()
            
            if not platform:
                raise HTTPException(status_code=404, detail="平台不存在")
            
            # 解析JSON格式的tags
            if platform['tags']:
                try:
                    platform['tags'] = json.loads(platform['tags'])
                except json.JSONDecodeError:
                    platform['tags'] = []
            else:
                platform['tags'] = []
            
            return platform

@app.post("/api/platforms")
async def create_platform(platform: PlatformCreate):
    """创建新平台"""
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            # 将tags列表转换为JSON字符串
            tags_json = json.dumps(platform.tags) if platform.tags else '[]'
            
            cursor.execute("""
                INSERT INTO platforms (name, category, url, description, thumbnail, tags, added_by_eng_name, added_by_chn_name)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """, (platform.name, platform.category, platform.url, platform.description, platform.thumbnail, tags_json, platform.added_by_eng_name, platform.added_by_chn_name))
            
            return {"id": cursor.lastrowid, "message": "创建成功"}

@app.put("/api/platforms/{platform_id}")
async def update_platform(platform_id: int, platform: PlatformUpdate):
    """更新平台信息"""
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            # 验证平台是否存在
            cursor.execute("SELECT id FROM platforms WHERE id = %s", (platform_id,))
            if not cursor.fetchone():
                raise HTTPException(status_code=404, detail="平台不存在")
            
            updates = []
            params = []
            
            if platform.name is not None:
                updates.append("name = %s")
                params.append(platform.name)
            if platform.category is not None:
                updates.append("category = %s")
                params.append(platform.category)
            if platform.url is not None:
                updates.append("url = %s")
                params.append(platform.url)
            if platform.description is not None:
                updates.append("description = %s")
                params.append(platform.description)
            if platform.thumbnail is not None:
                updates.append("thumbnail = %s")
                params.append(platform.thumbnail)
            if platform.tags is not None:
                updates.append("tags = %s")
                tags_json = json.dumps(platform.tags)
                params.append(tags_json)
            
            if updates:
                params.append(platform_id)
                cursor.execute(f"""
                    UPDATE platforms SET {', '.join(updates)}
                    WHERE id = %s
                """, params)
            
            return {"message": "更新成功"}

@app.delete("/api/platforms/{platform_id}")
async def delete_platform(platform_id: int):
    """删除平台"""
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            # 验证平台是否存在
            cursor.execute("SELECT id FROM platforms WHERE id = %s", (platform_id,))
            if not cursor.fetchone():
                raise HTTPException(status_code=404, detail="平台不存在")
            
            # 删除平台
            cursor.execute("DELETE FROM platforms WHERE id = %s", (platform_id,))
            return {"message": "删除成功"}

# ==================== 团队周报相关接口 ====================

class TeamReportCreate(BaseModel):
    title: str
    content: str
    created_by: str

class TeamReportUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None

@app.get("/api/team-reports")
async def get_team_reports():
    """获取团队周报列表（按创建时间倒序）"""
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT id, title, content, created_by, created_at, updated_at
                FROM team_reports
                ORDER BY created_at DESC
            """)
            reports = cursor.fetchall()
            return {"reports": reports}

@app.get("/api/team-reports/{report_id}")
async def get_team_report(report_id: int):
    """获取单个周报详情"""
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT id, title, content, created_by, created_at, updated_at
                FROM team_reports
                WHERE id = %s
            """, (report_id,))
            report = cursor.fetchone()
            
            if not report:
                raise HTTPException(status_code=404, detail="周报不存在")
            
            return report

@app.post("/api/team-reports")
async def create_team_report(report: TeamReportCreate):
    """创建团队周报"""
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute("""
                INSERT INTO team_reports (title, content, created_by)
                VALUES (%s, %s, %s)
            """, (report.title, report.content, report.created_by))
            
            return {"id": cursor.lastrowid, "message": "创建成功"}

@app.put("/api/team-reports/{report_id}")
async def update_team_report(report_id: int, report: TeamReportUpdate):
    """更新团队周报"""
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            # 验证周报是否存在
            cursor.execute("SELECT id FROM team_reports WHERE id = %s", (report_id,))
            if not cursor.fetchone():
                raise HTTPException(status_code=404, detail="周报不存在")
            
            updates = []
            params = []
            
            if report.title is not None:
                updates.append("title = %s")
                params.append(report.title)
            if report.content is not None:
                updates.append("content = %s")
                params.append(report.content)
            
            if updates:
                params.append(report_id)
                cursor.execute(f"""
                    UPDATE team_reports SET {', '.join(updates)}
                    WHERE id = %s
                """, params)
            
            return {"message": "更新成功"}

@app.delete("/api/team-reports/{report_id}")
async def delete_team_report(report_id: int):
    """删除团队周报"""
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            # 验证周报是否存在
            cursor.execute("SELECT id FROM team_reports WHERE id = %s", (report_id,))
            if not cursor.fetchone():
                raise HTTPException(status_code=404, detail="周报不存在")
            
            # 删除周报
            cursor.execute("DELETE FROM team_reports WHERE id = %s", (report_id,))
            return {"message": "删除成功"}

@app.get("/api/ai/generate-team-report")
async def generate_team_report_stream():
    """AI生成团队周报（流式输出）"""
    
    async def generate():
        try:
            # 1. 获取团队OKR数据
            with get_db_connection() as conn:
                with conn.cursor() as cursor:
                    # 获取所有Objectives
                    cursor.execute("""
                        SELECT id, title, obj_type, weight, created_at
                        FROM objectives
                        ORDER BY id
                    """)
                    objectives = cursor.fetchall()
                    
                    # 为每个Objective获取KR和进展
                    for obj in objectives:
                        obj_id = obj['id']
                        
                        # 获取KR
                        cursor.execute("""
                            SELECT id, title, created_at
                            FROM key_results
                            WHERE objective_id = %s
                            ORDER BY id
                        """, (obj_id,))
                        krs = cursor.fetchall()
                        
                        # 为每个KR获取进展
                        for kr in krs:
                            kr_id = kr['id']
                            
                            # 获取周进展（需要通过个人KR查询，只获取最近7天内更新的）
                            cursor.execute("""
                                SELECT wp.user_eng_name, wp.user_chn_name, wp.content, wp.created_at
                                FROM weekly_progress wp
                                JOIN user_key_results ukr ON wp.user_kr_id = ukr.id
                                WHERE ukr.source_kr_id = %s
                                AND wp.created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
                                ORDER BY wp.created_at DESC
                                LIMIT 10
                            """, (kr_id,))
                            kr['weekly_progress'] = cursor.fetchall()
                            
                            # 获取整体进展（需要通过个人KR查询，只获取最近7天内更新的）
                            cursor.execute("""
                                SELECT op.user_eng_name, op.user_chn_name, op.content, op.updated_at
                                FROM overall_progress op
                                JOIN user_key_results ukr ON op.user_kr_id = ukr.id
                                WHERE ukr.source_kr_id = %s
                                AND op.updated_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
                            """, (kr_id,))
                            kr['overall_progress'] = cursor.fetchall()
                        
                        obj['key_results'] = krs
            
            # 2. 构建团队OKR数据文本
            team_okr_text = ""
            for obj in objectives:
                team_okr_text += f"\n## {obj['title']}\n"
                team_okr_text += f"类型: {obj.get('obj_type', '业务')} | 权重: {obj.get('weight', 0)}%\n\n"
                
                for kr in obj.get('key_results', []):
                    team_okr_text += f"### KR: {kr['title']}\n\n"
                    
                    # 添加周进展
                    if kr.get('weekly_progress'):
                        team_okr_text += "**本周进展：**\n\n"
                        for wp in kr['weekly_progress']:
                            team_okr_text += f"- {wp['user_eng_name']}({wp['user_chn_name']}): {wp['content']}\n"
                        team_okr_text += "\n"
                    
                    # 添加整体进展
                    if kr.get('overall_progress'):
                        team_okr_text += "**整体进展：**\n\n"
                        for op in kr['overall_progress']:
                            team_okr_text += f"- {op['user_eng_name']}({op['user_chn_name']}): {op['content']}\n"
                        team_okr_text += "\n"
            
            # 3. 获取上一篇周报作为参考
            last_report_text = ""
            with get_db_connection() as conn:
                with conn.cursor() as cursor:
                    # 获取最近的一篇周报
                    cursor.execute("""
                        SELECT title, content, created_at
                        FROM team_weekly_reports
                        ORDER BY created_at DESC
                        LIMIT 1
                    """)
                    last_report = cursor.fetchone()
                    
                    if last_report:
                        last_report_text = f"\n## 上一篇周报\n"
                        last_report_text += f"标题: {last_report['title']}\n"
                        last_report_text += f"创建时间: {last_report['created_at']}\n\n"
                        last_report_text += f"内容:\n{last_report['content']}\n"
            
            # 4. 构建AI请求
            from datetime import datetime
            today_date = datetime.now().strftime("%Y年%m月%d日")
            
            prompt_template = prompts.get("generate_team_report", "")
            user_prompt = prompt_template.replace("{team_okr_data}", team_okr_text)
            user_prompt = user_prompt.replace("{today_date}", today_date)
            
            # 如果有上一篇周报，添加到prompt中
            if last_report_text:
                user_prompt = user_prompt.replace("{last_week_report}", f"\n\n以下是上一篇周报内容作为参考：\n{last_report_text}")
            else:
                user_prompt = user_prompt.replace("{last_week_report}", "")
            
            messages = [
                {"role": "system", "content": f"你是一个专业的团队周报撰写助手。今天是{today_date}。"},
                {"role": "user", "content": user_prompt}
            ]
            
            # 4. 调用AI接口（流式）
            async with httpx.AsyncClient(timeout=AI_TIMEOUT) as client:
                async with client.stream(
                    "POST",
                    f"{AI_API_BASE_URL}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {AI_API_KEY}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": AI_MODEL,
                        "messages": messages,
                        "temperature": AI_TEMPERATURE,
                        "stream": True
                    }
                ) as response:
                    async for line in response.aiter_lines():
                        if line.startswith("data: "):
                            data = line[6:]
                            if data == "[DONE]":
                                break
                            try:
                                chunk = json.loads(data)
                                if "choices" in chunk and len(chunk["choices"]) > 0:
                                    delta = chunk["choices"][0].get("delta", {})
                                    if "content" in delta:
                                        yield delta["content"]
                            except json.JSONDecodeError:
                                continue
        
        except Exception as e:
            logging.error(f"生成团队周报失败: {str(e)}")
            yield f"\n\n[错误] 生成失败: {str(e)}"
    
    return StreamingResponse(generate(), media_type="text/plain")

class OptimizeReportRequest(BaseModel):
    content: str
    prompt: str

@app.post("/api/ai/optimize-team-report")
async def optimize_team_report(request: OptimizeReportRequest):
    """AI优化团队周报（流式输出）"""
    
    async def generate():
        try:
            # 构建优化请求
            messages = [
                {"role": "system", "content": "你是一个专业的团队周报撰写助手。"},
                {"role": "user", "content": f"请根据以下要求优化这份周报：\n\n优化要求：{request.prompt}\n\n原周报内容：\n{request.content}"}
            ]
            
            # 调用AI接口（流式）
            async with httpx.AsyncClient(timeout=AI_TIMEOUT) as client:
                async with client.stream(
                    "POST",
                    f"{AI_API_BASE_URL}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {AI_API_KEY}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": AI_MODEL,
                        "messages": messages,
                        "temperature": AI_TEMPERATURE,
                        "stream": True
                    }
                ) as response:
                    async for line in response.aiter_lines():
                        if line.startswith("data: "):
                            data = line[6:]
                            if data == "[DONE]":
                                break
                            try:
                                chunk = json.loads(data)
                                if "choices" in chunk and len(chunk["choices"]) > 0:
                                    delta = chunk["choices"][0].get("delta", {})
                                    if "content" in delta:
                                        yield delta["content"]
                            except json.JSONDecodeError:
                                continue
        
        except Exception as e:
            logging.error(f"优化团队周报失败: {str(e)}")
            yield f"\n\n[错误] 优化失败: {str(e)}"
    
    return StreamingResponse(generate(), media_type="text/plain")

# 根路径重定向到静态页面
@app.get("/")
async def root():
    return _index_response()

# ==================== 配置管理 ====================

class ConfigItem(BaseModel):
    config_key: str
    config_value: str
    description: Optional[str] = None

class ConfigUpdate(BaseModel):
    configs: List[ConfigItem]

def load_config_from_db():
    """从数据库加载配置"""
    db_config = {}
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("SELECT config_key, config_value FROM config")
                rows = cursor.fetchall()
                for row in rows:
                    db_config[row['config_key']] = row['config_value']
    except Exception as e:
        logging.error(f"从数据库加载配置失败: {str(e)}")
    return db_config

def get_db_config_value(config_key: str, default=None):
    """从数据库获取配置值，如果不存在则返回默认值"""
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("SELECT config_value FROM config WHERE config_key = %s", (config_key,))
                result = cursor.fetchone()
                if result:
                    return result['config_value']
    except Exception as e:
        logging.error(f"获取配置值失败 {config_key}: {str(e)}")
    return default

@app.get("/api/admin/config")
async def get_all_config(request: Request):
    """获取所有配置（仅Leader）"""
    # 从请求头获取用户信息
    user_eng_name = request.headers.get("X-User-Eng-Name", "")
    if user_eng_name != LEADER:
        raise HTTPException(status_code=403, detail="无权限访问配置")
    
    try:
        db_config = load_config_from_db()
        return {"configs": db_config}
    except Exception as e:
        logging.error(f"获取配置失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"获取配置失败: {str(e)}")

@app.post("/api/admin/config")
async def update_config(request: Request, update_data: ConfigUpdate):
    """更新配置（仅Leader）"""
    # 从请求头获取用户信息
    user_eng_name = request.headers.get("X-User-Eng-Name", "")
    if user_eng_name != LEADER:
        raise HTTPException(status_code=403, detail="无权限修改配置")
    
    try:
        # 所有配置都保存到数据库
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                # 先删除所有旧的 QPilot 配置（以 qpilot.pilot_ 开头的配置）
                cursor.execute("DELETE FROM config WHERE config_key LIKE 'qpilot.pilot_%'")
                logging.info(f"已删除旧的 QPilot 配置记录")
                
                # 然后更新或插入新配置
                for item in update_data.configs:
                    # 检查配置是否存在
                    cursor.execute("SELECT id FROM config WHERE config_key = %s", (item.config_key,))
                    existing = cursor.fetchone()
                    
                    if existing:
                        # 更新现有配置
                        cursor.execute("""
                            UPDATE config 
                            SET config_value = %s, description = %s, updated_at = CURRENT_TIMESTAMP
                            WHERE config_key = %s
                        """, (item.config_value, item.description, item.config_key))
                    else:
                        # 插入新配置
                        cursor.execute("""
                            INSERT INTO config (config_key, config_value, description)
                            VALUES (%s, %s, %s)
                        """, (item.config_key, item.config_value, item.description))
                
                # 如果更新了webhook配置，重新加载到全局变量
                for item in update_data.configs:
                    if item.config_key == 'wework_bot.webhook_url':
                        global WEWORK_BOT_WEBHOOK
                        WEWORK_BOT_WEBHOOK = item.config_value
                        logging.info(f"企微机器人webhook配置已更新: {'已配置' if item.config_value else '已清空'}")
                        break
        
        return {"message": "配置更新成功"}
    except Exception as e:
        logging.error(f"更新配置失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"更新配置失败: {str(e)}")

@app.get("/api/admin/config/group/{group_name}")
async def get_config_group(group_name: str, request: Request):
    """获取指定配置组的配置（仅Leader）"""
    # 从请求头获取用户信息
    user_eng_name = request.headers.get("X-User-Eng-Name", "")
    if user_eng_name != LEADER:
        raise HTTPException(status_code=403, detail="无权限访问配置")
    
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("""
                    SELECT config_key, config_value, description
                    FROM config
                    WHERE config_key LIKE %s
                    ORDER BY config_key
                """, (f"{group_name}.%",))
                configs = cursor.fetchall()
                return {"configs": configs}
    except Exception as e:
        logging.error(f"获取配置组失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"获取配置组失败: {str(e)}")

# 挂载静态文件（必须在最后）
app.mount("/static", StaticFiles(directory="static", html=True), name="static")