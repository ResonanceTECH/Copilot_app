import os
import re
import hashlib
import time
from flask import Flask, request, jsonify, render_template
from openai import OpenAI
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()
app = Flask(__name__)

# Прямое использование вашего API ключа
client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key="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"
)

# Оптимизированный промпт для быстрых ответов
SYSTEM_PROMPT = """
Ты — бизнес-консультант для малого бизнеса. Отвечай кратко и по делу.
Используй списки по 2-4 пункта. Будь конкретен и практичен.
Темы: маркетинг, финансы, юриспруденция, управление, продажи.
Не используй длинные вступления, переходи сразу к сути.
"""

# Кэш ответов для ускорения
response_cache = {}

# Быстрые ответы для частых вопросов
QUICK_RESPONSES = {
    'привет': 'Здравствуйте! Я ваш бизнес-помощник. Задавайте вопросы по маркетингу, финансам, юриспруденции или управлению бизнесом.',
    'спасибо': 'Пожалуйста! Обращайтесь, если понадобится ещё помощь.',
    'помощь': 'Я консультирую по вопросам бизнеса: маркетинг, финансы, юридические аспекты, управление. Задайте конкретный вопрос!',
    'start': 'Готов помочь вашему бизнесу! Спрашивайте о маркетинге, финансах, юридических вопросах или управлении.',
    'как дела': 'Всё хорошо, готов помочь вашему бизнесу! Задавайте вопросы.',
    'что ты умеешь': 'Консультирую по бизнесу: маркетинг, финансы, юриспруденция, управление. Задайте конкретный вопрос!'
}


def get_cache_key(question):
    """Генерирует ключ для кэша на основе вопроса"""
    return hashlib.md5(question.lower().encode()).hexdigest()


def format_response(text):
    """Форматирует текст ответа в HTML - исправленная версия"""
    if not text:
        return "<p>Нет ответа</p>"

    # Сохраняем оригинальный текст
    original_text = text

    # Мягкая очистка
    text = text.replace('**', '').replace('__', '')

    # Разделяем на абзацы
    paragraphs = [p.strip() for p in text.split('\n\n') if p.strip()]

    if not paragraphs:
        return '<p class="response-text">Пустой ответ</p>'

    formatted_paragraphs = []
    i = 0
    processed_indices = set()  # Следим за обработанными индексами

    while i < len(paragraphs):
        if i in processed_indices:
            i += 1
            continue

        paragraph = paragraphs[i]
        lines = [line.strip() for line in paragraph.split('\n') if line.strip()]

        if not lines:
            i += 1
            continue

        # Проверяем, начинается ли здесь структурированный блок
        if has_structured_content(paragraphs, i):
            formatted, next_index = format_structured_block(paragraphs, i)
            formatted_paragraphs.append(formatted)
            # Помечаем все обработанные индексы как обработанные
            for j in range(i, next_index):
                processed_indices.add(j)
            i = next_index
        else:
            # Обрабатываем одиночный параграф
            formatted = format_single_paragraph(paragraph, lines)
            formatted_paragraphs.append(formatted)
            processed_indices.add(i)
            i += 1

    result = ''.join(formatted_paragraphs)
    return result if result else f'<p class="response-text">{original_text}</p>'


def has_structured_content(paragraphs, start_index):
    """Проверяет, есть ли структурированный контент начиная с индекса"""
    if start_index >= len(paragraphs):
        return False

    current_para = paragraphs[start_index]
    lines = [line.strip() for line in current_para.split('\n') if line.strip()]

    # Проверяем признаки структурированного контента
    has_sections = any(line.endswith(':') for line in lines)
    has_lists = any(is_list_item(line) for line in lines)
    has_headings = is_heading(current_para)

    return has_sections or (has_lists and len(lines) > 1) or has_headings


def format_structured_block(paragraphs, start_index):
    """Форматирует структурированный блок без дублирования"""
    html_parts = []
    i = start_index
    current_section = None

    while i < len(paragraphs):
        paragraph = paragraphs[i]
        lines = [line.strip() for line in paragraph.split('\n') if line.strip()]

        if not lines:
            i += 1
            continue

        # Проверяем на заголовок верхнего уровня
        if is_heading(paragraph) and len(paragraph) < 100:
            # Закрываем предыдущий раздел если он был открыт
            if current_section:
                html_parts.append('</ul></div>')
                current_section = None

            clean_heading = re.sub(r'^#+\s*', '', paragraph)
            html_parts.append(f'<h4 class="response-heading">{clean_heading}</h4>')
            i += 1
            continue

        # Ищем заголовок раздела (строка с двоеточием)
        section_header = None
        for line in lines:
            if (line.endswith(':') and
                    len(line) < 100 and
                    not is_list_item(line) and
                    not line.startswith('#')):
                section_header = line[:-1]  # Убираем двоеточие
                break

        if section_header:
            # Закрываем предыдущий раздел если он был открыт
            if current_section:
                html_parts.append('</ul></div>')

            # Начинаем новый раздел
            current_section = section_header
            html_parts.append(f'''
                <div class="list-section">
                    <div class="list-section-title">{section_header}:</div>
                    <ul class="response-list">
            ''')

            # Добавляем элементы этого раздела из текущего параграфа
            for line in lines:
                if line.strip() != section_header + ':':  # Пропускаем заголовок
                    if line.strip() and not line.endswith(':'):  # Пропускаем другие заголовки
                        clean_item = re.sub(r'^[•\-*—\s]+', '', line.strip())
                        if clean_item:  # Добавляем только непустые элементы
                            html_parts.append(f'<li class="response-list-item">{clean_item}</li>')

        elif current_section:
            # Добавляем элементы к текущему разделу
            for line in lines:
                if line.strip() and not line.endswith(':'):  # Пропускаем заголовки
                    clean_item = re.sub(r'^[•\-*—\s]+', '', line.strip())
                    if clean_item:
                        html_parts.append(f'<li class="response-list-item">{clean_item}</li>')

        else:
            # Нет активного раздела, но есть элементы списка
            if any(is_list_item(line) for line in lines):
                html_parts.append(format_simple_list(lines))
            else:
                # Обычный текст
                formatted_para = paragraph.replace('\n', '<br>')
                html_parts.append(f'<p class="response-text">{formatted_para}</p>')

        i += 1

        # Прерываем блок если нашли следующий основной заголовок
        if i < len(paragraphs) and is_heading(paragraphs[i]) and len(paragraphs[i]) < 100:
            break

    # Закрываем последний раздел если он открыт
    if current_section:
        html_parts.append('</ul></div>')

    return ''.join(html_parts), i


def format_single_paragraph(paragraph, lines):
    """Форматирует одиночный параграф"""
    # Если это заголовок
    if is_heading(paragraph):
        clean_heading = re.sub(r'^#+\s*', '', paragraph)
        return f'<h4 class="response-heading">{clean_heading}</h4>'

    # Если это список
    if is_list(lines):
        return format_simple_list(lines)

    # Обычный текст
    formatted_para = paragraph.replace('\n', '<br>')
    return f'<p class="response-text">{formatted_para}</p>'


def is_list_item(line):
    """Проверяет, является ли строка элементом списка"""
    line = line.strip()
    return (line.startswith(('-', '•', '*', '—')) or
            re.match(r'^\d+\.', line) or
            re.match(r'^\d+\)', line))


def is_list(lines):
    """Проверяет, является ли текст списком"""
    if not lines:
        return False
    list_items = sum(1 for line in lines if is_list_item(line))
    return list_items > 0


def is_heading(text):
    """Проверяет, является ли текст заголовком"""
    lines = text.split('\n')
    if len(lines) > 1:
        return False
    return (text.startswith('#') or
            (len(text) < 100 and
             any(keyword in text.lower() for keyword in [
                 'маркетинг', 'финансы', 'юридич', 'управлен', 'риск',
                 'преимуществ', 'рекомендац', 'функционал', 'особенност',
                 'рынок', 'спрос', 'формат', 'затраты', 'прибыль', 'стратегия',
                 'риски', 'hr', 'аудит', 'инвестиц', 'обучен'
             ])))


def has_colon_sections(lines):
    """Проверяет разделы с двоеточиями"""
    return any(line.strip().endswith(':') for line in lines)


def format_business_content(all_paragraphs, start_index):
    """Форматирует бизнес-контент с разделами"""
    html_parts = []
    i = start_index

    while i < len(all_paragraphs):
        current_para = all_paragraphs[i].strip()
        lines = [line.strip() for line in current_para.split('\n') if line.strip()]

        if not lines:
            i += 1
            continue

        # Ищем заголовок раздела (строка с двоеточием)
        section_header = None
        for line in lines:
            if line.strip().endswith(':') and len(line) < 100:
                section_header = line.strip()[:-1]  # Убираем двоеточие
                break

        if section_header:
            # Начинаем новый раздел
            html_parts.append(f'''
                <div class="list-section">
                    <div class="list-section-title">{section_header}</div>
                    <ul class="response-list">
            ''')

            # Добавляем содержимое раздела
            for line in lines:
                if line.strip() != section_header + ':':  # Пропускаем сам заголовок
                    if is_list_item(line) or line.strip():
                        clean_item = re.sub(r'^[•\-*\s]+', '', line.strip())
                        html_parts.append(f'<li class="response-list-item">{clean_item}</li>')

            html_parts.append('</ul></div>')
        else:
            # Если нет явного заголовка, но есть список - форматируем как простой список
            if is_list(lines):
                html_parts.append(format_simple_list(lines))
            else:
                # Обычный текст
                formatted_para = current_para.replace('\n', '<br>')
                html_parts.append(f'<p class="response-text">{formatted_para}</p>')

        i += 1
        # Прерываемся если нашли следующий основной заголовок
        if i < len(all_paragraphs) and is_heading(all_paragraphs[i]):
            break

    return ''.join(html_parts)


def has_structured_sections(lines):
    """Проверяет, есть ли структурированные разделы с двоеточиями"""
    return any(
        line.strip().endswith(':') and not is_list_item(line.strip())
        for line in lines
    )


def format_structured_list(lines):
    """Форматирует структурированный список с разделами"""
    html = ''
    current_section = None

    for line in lines:
        trimmed = line.strip()
        if not trimmed:
            continue

        # Если строка заканчивается на : - это заголовок раздела
        if trimmed.endswith(':') and not is_list_item(trimmed):
            if current_section:
                html += '</ul></div>'
            current_section = trimmed[:-1]  # Убираем двоеточие
            html += f'''
                <div class="list-section">
                    <div class="list-section-title">{current_section}:</div>
                    <ul class="response-list">
            '''
        # Если это элемент списка и есть активный раздел
        elif current_section and (is_list_item(trimmed) or trimmed):
            # Очищаем от маркеров списка
            clean_item = re.sub(r'^[•\-*\s]+', '', trimmed)
            html += f'<li class="response-list-item">{clean_item}</li>'
        # Если нет активного раздела
        elif not current_section and trimmed:
            html += f'<p class="response-text">{trimmed}</p>'

    # Закрываем последний раздел
    if current_section:
        html += '</ul></div>'

    return html


def format_simple_list(lines):
    """Форматирует простой список"""
    html = '<ul class="response-list">'
    for line in lines:
        trimmed = line.strip()
        if trimmed and is_list_item(trimmed):
            clean_item = re.sub(r'^[•\-*\d.\s]+', '', trimmed)
            html += f'<li class="response-list-item">{clean_item}</li>'
    html += '</ul>'
    return html


@app.route('/')
def index():
    """Главная страница"""
    return render_template('test.html')


@app.route('/ask', methods=['POST'])
def ask_question():
    """Обработка вопросов пользователя"""
    try:
        data = request.get_json()
        user_question = data.get('question', '').strip()

        if not user_question:
            return jsonify({
                'success': False,
                'error': 'Вопрос не может быть пустым.'
            }), 400

        # Проверяем быстрые ответы
        quick_response = QUICK_RESPONSES.get(user_question.lower())
        if quick_response:
            return jsonify({
                'success': True,
                'response': {
                    'raw_text': quick_response,
                    'formatted_html': f'<p class="response-text">{quick_response}</p>',
                    'timestamp': datetime.now().isoformat()
                }
            })

        # Проверяем кэш
        cache_key = get_cache_key(user_question)
        if cache_key in response_cache:
            print(f"✅ Используем кэшированный ответ для: {user_question[:50]}...")
            return jsonify(response_cache[cache_key])

        print(f"📨 Отправляем запрос в LLM: {user_question}")

        # Оптимизированный запрос к API
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
            temperature=0.5,
        )

        ai_response = completion.choices[0].message.content
        print(f"✅ Получен ответ: {ai_response[:100]}...")

        # Форматируем ответ
        formatted_response = format_response(ai_response)

        # Подготавливаем данные для ответа
        response_data = {
            'success': True,
            'response': {
                'raw_text': ai_response,
                'formatted_html': formatted_response,
                'timestamp': datetime.now().isoformat()
            }
        }

        # Сохраняем в кэш (ограничиваем размер)
        response_cache[cache_key] = response_data
        if len(response_cache) > 100:
            # Удаляем самый старый элемент
            response_cache.pop(next(iter(response_cache)))

        return jsonify(response_data)

    except Exception as e:
        print(f"❌ Ошибка: {e}")
        return jsonify({
            'success': False,
            'error': 'Временная ошибка сервера. Пожалуйста, попробуйте ещё раз.'
        }), 500


if __name__ == '__main__':
    app.run(debug=True)
