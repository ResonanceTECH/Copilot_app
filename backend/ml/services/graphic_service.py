import base64
import tempfile
import os
from typing import Dict, Any


class GraphicService:
    def __init__(self, llm_service):
        self.llm_service = llm_service

    def process_graphic_request(self, user_query: str) -> Dict[str, Any]:
        """
        Обрабатывает запрос на график.
        LLM генерирует код, код выполняется, возвращается base64 изображение.
        """
        try:
            # 1. Создаем временный файл для графика
            with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp_file:
                output_path = tmp_file.name

            # 2. Простой промпт для LLM - только перевод запроса в код
            system_prompt = """Ты переводишь запросы пользователей на Python код для создания графиков.
Пользователь описывает, какой график ему нужен. Твоя задача - сгенерировать рабочий Python код.

Требования к коду:
1. Используй matplotlib и seaborn если нужно
2. Сохрани результат в файл 'output.png'
3. Не выводи график на экран, только сохраняй
4. Верни только чистый Python код без объяснений

Пример:
Запрос: "график синуса от 0 до 10"
Код:
```python
import matplotlib.pyplot as plt
import numpy as np
x = np.linspace(0, 10, 100)
y = np.sin(x)
plt.figure(figsize=(10, 6))
plt.plot(x, y)
plt.savefig('output.png')
plt.close()
```"""

            user_prompt = f"Создай Python код для графика по запросу: {user_query}"

            # 3. Получаем код от LLM
            response = self.llm_service.generate_response(
                system_prompt=system_prompt,
                user_question=user_prompt,
                conversation_history=[]
            )

            # 4. Извлекаем чистый код
            code = self._extract_code(response)
            if not code:
                return {"success": False, "error": "LLM не вернул код"}

            # 5. Заменяем имя файла в коде на наш путь
            code = code.replace("'output.png'", f"'{output_path}'").replace('"output.png"', f'"{output_path}"')

            # 6. Выполняем код
            from backend.ml.core.code_executor import SafeCodeExecutor
            executor = SafeCodeExecutor(timeout=30)
            result = executor.execute_python_code(code, output_path)

            if result["success"] and os.path.exists(output_path):
                # 7. Конвертируем в base64
                with open(output_path, 'rb') as f:
                    image_base64 = base64.b64encode(f.read()).decode('utf-8')

                # 8. Удаляем временный файл
                os.unlink(output_path)

                return {
                    "success": True,
                    "image_base64": image_base64,
                    "mime_type": "image/png"
                }
            else:
                if os.path.exists(output_path):
                    os.unlink(output_path)
                return {
                    "success": False,
                    "error": result.get("error", "Ошибка выполнения"),
                    "stderr": result.get("stderr", "")
                }

        except Exception as e:
            # Очистка в случае ошибки
            if 'output_path' in locals() and os.path.exists(output_path):
                os.unlink(output_path)
            return {"success": False, "error": str(e)}

    def _extract_code(self, text: str) -> str:
        """Извлекает Python код из ответа LLM"""
        if not text:
            return ""

        # Ищем блоки кода
        lines = text.split('\n')
        code_lines = []
        in_code = False

        for line in lines:
            if line.strip().startswith('```python'):
                in_code = True
                continue
            elif line.strip().startswith('```') and in_code:
                in_code = False
                continue
            elif in_code:
                code_lines.append(line)
            elif 'import ' in line or 'plt.' in line or 'sns.' in line or 'savefig' in line:
                # Возможно код без блоков
                code_lines.append(line)

        code = '\n'.join(code_lines).strip()

        # Если код пустой, пробуем взять весь текст
        if not code and ('import ' in text or 'plt.' in text):
            return text.strip()

        return code