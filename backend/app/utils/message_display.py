"""Форматирование текста/HTML сообщений для отдачи клиенту (вложения, графики)."""

from sqlalchemy.orm import Session

from backend.app.models.message import Message
from backend.app.models.file_attachment import FileAttachment


def _html_for_user_file_attachment(file_attachment: FileAttachment) -> str:
    filename = file_attachment.filename
    file_path = file_attachment.file_path
    file_type = file_attachment.file_type
    if file_type == 'image':
        analysis_html = ''
        if file_attachment.analysis_result:
            analysis_html = f'''
            <details class="uploaded-file-analysis" style="margin-top: 12px;">
                <summary style="cursor: pointer; color: inherit; font-weight: 500; user-select: none;">🔍 Показать анализ изображения</summary>
                <div style="margin-top: 8px; padding: 12px; background: var(--color-hover); border-radius: 8px; font-size: 14px; line-height: 1.6;">
                    {file_attachment.analysis_result}
                </div>
            </details>
            '''
        return f'''
        <div class="uploaded-file-container">
            <div class="uploaded-file-header" style="margin-bottom: 8px; font-weight: 500;">
                📎 {filename}
            </div>
            <div class="uploaded-file-image">
                <img src="/{file_path}" alt="{filename}" style="max-width: 100%; max-height: 500px; border-radius: 8px; object-fit: contain;" />
            </div>
            {analysis_html}
        </div>
        '''
    return f'''
    <div class="uploaded-file-container">
        <div class="uploaded-file-header" style="margin-bottom: 8px; font-weight: 500;">
            📎 <a href="/{file_path}" target="_blank" rel="noreferrer" style="color: inherit; font-weight: 600; text-decoration: underline; text-underline-offset: 2px;">{filename}</a>
        </div>
    </div>
    '''


def format_message_content_for_display(msg: Message, db: Session) -> str:
    """HTML/текст сообщения для клиента (файлы, графики)."""
    content = msg.content
    if msg.image_url:
        image_src = f"/{msg.image_url}"
        if msg.role == 'assistant':
            content = f'''
                <div class="graphic-container" style="
                    background: white;
                    border-radius: 10px;
                    padding: 15px;
                    margin: 15px 0;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                ">
                    <div class="graphic-header" style="
                        margin-bottom: 10px;
                        padding-bottom: 10px;
                        border-bottom: 1px solid #eee;
                    ">
                        <h4 style="margin: 0; color: #333;">📈 Сгенерированный график</h4>
                    </div>
                    <div class="graphic-image" style="text-align: center;">
                        <img src="{image_src}"
                             alt="Сгенерированный график"
                             style="
                                max-width: 100%;
                                height: auto;
                                border-radius: 5px;
                             ">
                    </div>
                    <div class="graphic-note" style="
                        margin-top: 10px;
                        font-size: 12px;
                        color: #666;
                        text-align: center;
                    ">
                        {msg.content}
                    </div>
                </div>
                '''
            return content
        if msg.role == 'user':
            if '<img' not in content and '<div class="uploaded-file' not in content and '<a href=' not in content:
                file_attachment = db.query(FileAttachment).filter(
                    FileAttachment.message_id == msg.id
                ).first()

                if file_attachment:
                    content = _html_for_user_file_attachment(file_attachment)
                else:
                    filename = msg.image_url.split('/')[-1] if '/' in msg.image_url else msg.image_url
                    content = f'''
                    <div class="uploaded-file-container">
                        <div class="uploaded-file-header" style="margin-bottom: 8px; font-weight: 500;">
                            📎 <a href="{image_src}" target="_blank" rel="noreferrer" style="color: inherit; font-weight: 600; text-decoration: underline; text-underline-offset: 2px;">{filename}</a>
                        </div>
                    </div>
                    '''
        return content

    if msg.role == 'user':
        if '<img' not in content and '<div class="uploaded-file' not in content and '<a href=' not in content:
            file_attachment = db.query(FileAttachment).filter(
                FileAttachment.message_id == msg.id
            ).first()
            if file_attachment:
                content = _html_for_user_file_attachment(file_attachment)
    return content
