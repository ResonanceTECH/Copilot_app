import os
from flask import Flask, request, jsonify, render_template
from openai import OpenAI
from dotenv import load_dotenv
from datetime import datetime
import re
import joblib
load_dotenv()
app = Flask(__name__)

client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key='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'  # Явно передаем ключ
)

SYSTEM_PROMPT = """
Ты — полезный AI-ассистент для   владельцев малого бизнеса.
Твоя задача — давать четкие, практичные и полезные советы по ключевым аспектам бизнеса:
- Юридические вопросы (регистрация, налоги, трудовое право)
- Маркетинг (SMM, email-рассылки, таргетированная реклама)
- Финансы (бюджетирование, учет расходов, поиск инвестиций)
- Управление персоналом
- Разработка бизнес-стратегии
- Продажи и обслуживание клиентов
Отвечай на русском языке. Будь краток, но информативен. Если вопрос выходит за рамки твоей компетенции, вежливо откажись отвечать.
"""


def format_response(text):
    """Преобразует текст в красивый HTML с современным оформлением"""
    if not text:
        return "<p>Нет ответа</p>"

    # Очищаем текст от маркеров форматирования
    text = text.replace('**', '').replace('*', '').replace('__', '')

    # Разделяем на абзацы
    paragraphs = [p.strip() for p in text.split('\n\n') if p.strip()]

    formatted_paragraphs = []

    for paragraph in paragraphs:
        # Определяем тип контента
        if looks_like_heading(paragraph):
            formatted_paragraphs.append(f'<h4 class="response-heading">{paragraph}</h4>')
        elif looks_like_list(paragraph):
            formatted_list = format_list(paragraph)
            formatted_paragraphs.append(formatted_list)
        else:
            # Обычный текст с улучшенным форматированием
            paragraph = paragraph.replace('\n', '<br>')
            formatted_paragraphs.append(f'<p class="response-text">{paragraph}</p>')

    return ''.join(formatted_paragraphs)


def looks_like_heading(text):
    """Проверяет, похож ли текст на заголовок"""
    lines = text.split('\n')
    if len(lines) > 1:
        return False

    # Заголовки обычно короче и могут заканчиваться двоеточием
    return (len(text) < 80 and
            (text.endswith(':') or
             any(keyword in text.lower() for keyword in ['функционал', 'особенности', 'преимущества', 'рекомендации'])))


def looks_like_list(text):
    """Проверяет, похож ли текст на список"""
    lines = [line.strip() for line in text.split('\n') if line.strip()]
    if len(lines) <= 1:
        return False

    # Ищем маркеры списка
    list_indicators = ['•', '-', '*', '—', '1.', '2.', '3.', '4.', '5.', '6.', '7.', '8.', '9.']
    list_lines = 0

    for line in lines:
        if any(line.startswith(indicator) for indicator in list_indicators):
            list_lines += 1

    # Если больше половины строк - список, считаем что это список
    return list_lines >= len(lines) * 0.3


def format_list(text):
    """Форматирует текст как красивый HTML список"""
    lines = [line.strip() for line in text.split('\n') if line.strip()]

    list_html = '<ul class="response-list">'

    for line in lines:
        # Очищаем от маркеров
        cleaned_line = line
        for marker in ['•', '-', '*', '—']:
            if cleaned_line.startswith(marker):
                cleaned_line = cleaned_line[1:].strip()
                break

        # Очищаем нумерацию
        cleaned_line = re.sub(r'^[0-9]+\.\s*', '', cleaned_line)

        if cleaned_line:
            list_html += f'<li class="response-list-item">{cleaned_line}</li>'

    list_html += '</ul>'
    return list_html


@app.route('/')
def index():
    return render_template('test.html')


@app.route('/ask', methods=['POST'])
def ask_question():
    """
    Эндпоинт для обработки вопросов от пользователя.
    Получает JSON с вопросом, отправляет его в LLM через OpenRouter и возвращает ответ.
    """
    try:
        data = request.get_json()
        user_question = data.get('question', '')

        if not user_question:
            return jsonify({
                'success': False,
                'error': 'Вопрос не может быть пустым.'
            }), 400

        completion = client.chat.completions.create(
            extra_headers={
                "HTTP-Referer": "http://localhost:5000",
                "X-Title": "Business Assistant",
            },
            model="tngtech/deepseek-r1t2-chimera:free",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_question}
            ],
            temperature=0.7
        )

        ai_response = completion.choices[0].message.content

        formatted_response = format_response(ai_response)

        return jsonify({
            'success': True,
            'response': {
                'raw_text': ai_response,
                'formatted_html': formatted_response,
                'timestamp': datetime.now().isoformat()
            }
        })

    except Exception as e:
        print(f"Произошла ошибка при обращении к OpenRouter: {e}")
        return jsonify({
            'success': False,
            'error': f'Произошла ошибка при получении ответа от AI: {str(e)}'
        }), 500


if __name__ == '__main__':
    app.run(debug=True)