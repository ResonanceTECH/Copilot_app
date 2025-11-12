import os
from flask import Flask, request, jsonify, render_template
from openai import OpenAI
from dotenv import load_dotenv

# Загружаем переменные окружения из .env файла
load_dotenv()

# Создаем Flask приложение
app = Flask(__name__)

# Инициализируем клиент OpenAI для работы с OpenRouter
client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=os.getenv('OPENROUTER_API_KEY')  # Теперь ключ берется из .env
)

# Системный промпт, который задает "личность" нашему ассистенту
SYSTEM_PROMPT = """
Ты — полезный AI-ассистент для владельцев малого бизнеса.
Твоя задача — давать четкие, практичные и полезные советы по ключевым аспектам бизнеса:
- Юридические вопросы (регистрация, налоги, трудовое право)
- Маркетинг (SMM, email-рассылки, таргетированная реклама)
- Финансы (бюджетирование, учет расходов, поиск инвестиций)
- Управление персоналом
- Разработка бизнес-стратегии
- Продажи и обслуживание клиентов
Отвечай на русском языке. Будь краток, но информативен. Если вопрос выходит за рамки твоей компетенции, вежливо откажись отвечать.
"""

@app.route('/')
def index():
    """Отдает главную страницу с интерфейсом."""
    return render_template('index.html')


@app.route('/ask', methods=['POST'])
def ask_question():
    try:
        data = request.get_json()
        user_question = data.get('question', '')

        if not user_question:
            return jsonify({'error': 'Вопрос не может быть пустым.'}), 400

        completion = client.chat.completions.create(
            extra_headers={
                "HTTP-Referer": "http://localhost:5000",
                "X-Title": "Business Assistant",
            },
            extra_body={},
            model="tngtech/deepseek-r1t2-chimera:free",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_question}
            ],
            max_tokens=800,
            temperature=0.7
        )

        ai_response = completion.choices[0].message.content

        # Преобразуем текст в HTML с базовым форматированием
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
        print(f"Произошла ошибка: {e}")
        return jsonify({
            'success': False,
            'error': 'Произошла ошибка при получении ответа от AI.'
        }), 500


def format_response(text):
    """Преобразует простой текст в базовый HTML с форматированием"""
    if not text:
        return text

    # Заменяем переносы строк на HTML теги
    formatted = text.replace('\n\n', '</p><p>')
    formatted = formatted.replace('\n', '<br>')

    # Оборачиваем в параграфы если нужно
    if not formatted.startswith('<p>'):
        formatted = f'<p>{formatted}</p>'

    # Простое форматирование списков (можно улучшить)
    formatted = formatted.replace('• ', '<li>').replace('•', '<li>')
    formatted = formatted.replace(' - ', '<li>')

    return formatted

if __name__ == '__main__':
    app.run(debug=True)