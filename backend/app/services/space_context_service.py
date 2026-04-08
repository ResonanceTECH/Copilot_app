"""
Контекст рабочего пространства для LLM: последние N сообщений по всем чатам space.
Данные уже в БД (messages + chats); отдельное хранилище не требуется.
"""
import re
from typing import List, Optional, Tuple

from sqlalchemy.orm import Session

from backend.app.models.chat import Chat
from backend.app.models.message import Message

# Последние сообщения по пространству (все чаты)
DEFAULT_SPACE_CONTEXT_MESSAGE_LIMIT = 30
# Чтобы один HTML/документ не съел всё окно контекста
DEFAULT_MAX_CHARS_PER_MESSAGE = 1500


def _strip_for_context(text: str, max_len: int) -> str:
    if not text:
        return ""
    t = re.sub(r"<[^>]+>", " ", text)
    t = " ".join(t.split())
    if len(t) > max_len:
        return t[: max_len - 1] + "…"
    return t


def get_space_recent_messages_rows(
    db: Session,
    space_id: int,
    *,
    limit: int = DEFAULT_SPACE_CONTEXT_MESSAGE_LIMIT,
) -> List[Tuple[Message, Optional[str]]]:
    """
    Последние `limit` сообщений по всем чатам пространства, от старых к новым.
    """
    rows = (
        db.query(Message, Chat.title)
        .join(Chat, Message.chat_id == Chat.id)
        .filter(Chat.space_id == space_id)
        .order_by(Message.created_at.desc())
        .limit(limit)
        .all()
    )
    return list(reversed(rows))


def build_space_context_prompt_block(
    db: Session,
    space_id: int,
    *,
    limit: int = DEFAULT_SPACE_CONTEXT_MESSAGE_LIMIT,
    max_chars_per_message: int = DEFAULT_MAX_CHARS_PER_MESSAGE,
) -> Optional[str]:
    """
    Текстовый блок для добавления к system prompt: тематика и недавняя активность в space.
    """
    rows = get_space_recent_messages_rows(db, space_id, limit=limit)
    if not rows:
        return None

    lines: List[str] = []
    for msg, chat_title in rows:
        title = (chat_title or "").strip() or "Без названия"
        role = "пользователь" if msg.role == "user" else "ассистент"
        body = _strip_for_context(msg.content or "", max_chars_per_message)
        if not body:
            continue
        lines.append(f"• [Чат «{title}» · {role}]: {body}")

    if not lines:
        return None

    n = len(lines)
    header = (
        "## Контекст рабочего пространства\n"
        f"Ниже — {n} последних сообщений по всем чатам этого пространства (хронологически). "
        "Используй это, чтобы понимать тематику работы и типичные вопросы в этом пространстве. "
        "Не приписывай пользователю факты из других чатов, но учитывай общий фокус и формулировки.\n"
    )
    return header + "\n" + "\n".join(lines)
