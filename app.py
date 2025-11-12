import os
from flask import Flask, request, jsonify, render_template
from openai import OpenAI
from dotenv import load_dotenv
from datetime import datetime
load_dotenv()
app = Flask(__name__)

client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key='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'  # Явно передаем ключ
)

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


def format_response(text):
    """Преобразует простой текст в базовый HTML с форматированием"""
    if not text:
        return text

    formatted = text.replace('\n\n', '</p><p>')
    formatted = formatted.replace('\n', '<br>')

    if not formatted.startswith('<p>'):
        formatted = f'<p>{formatted}</p>'

    return formatted


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
            return jsonify({'error': 'Вопрос не может быть пустым.'}), 400

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