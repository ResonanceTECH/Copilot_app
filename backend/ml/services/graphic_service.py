import base64
import tempfile
import os
from typing import Dict, Any
import re


class GraphicService:
    def __init__(self, llm_service):
        self.llm_service = llm_service

    def process_graphic_request(self, user_query: str) -> Dict[str, Any]:
        """
        Обрабатывает запрос на график.
        LLM генерирует код, код выполняется, возвращается base64 изображение.
        """
        try:
            print(f"\n" + "=" * 80)
            print(f"🔄 НАЧАЛО ОБРАБОТКИ ГРАФИЧЕСКОГО ЗАПРОСА")
            print(f"📝 Запрос пользователя: '{user_query}'")
            print("=" * 80)

            # 1. Промпт с фиксированным именем файла
            system_prompt = """Ты переводишь запросы пользователей на Python код для создания графиков.
Пользователь описывает, какой график ему нужен. Твоя задача - сгенерировать рабочий Python код.

Требования к коду:
1. Используй matplotlib и seaborn если нужно
2. Сохрани результат в файл 'graph_output.png'
3. Не выводи график на экран, только сохраняй
4. Верни только чистый Python код без объяснений
5. Код должен быть полным и готовым к выполнению

Пример:
import matplotlib.pyplot as plt
import numpy as np
x = np.linspace(0, 10, 100)
y = np.sin(x)
plt.figure(figsize=(10, 6))
plt.plot(x, y)
plt.title('График синуса')
plt.grid(True)
plt.savefig('graph_output.png', dpi=100, bbox_inches='tight')
plt.close()
"""

            user_prompt = f"Создай Python код для графика по запросу: {user_query}"

            print(f"📤 Отправляем запрос в LLM...")

            # 2. Получаем код от LLM
            response = self.llm_service.generate_response(
                system_prompt=system_prompt,
                user_question=user_prompt,
                conversation_history=[]
            )

            print(f"📥 Получен ответ от LLM")
            print(f"📄 Длина ответа: {len(response)} символов")
            print(f"📄 Первые 500 символов ответа:")
            print("-" * 50)
            print(response[:500])
            if len(response) > 500:
                print(f"... (ещё {len(response) - 500} символов)")
            print("-" * 50)

            # 3. Извлекаем чистый код
            print(f"\n🔍 Извлекаем код из ответа...")
            code = self._extract_code(response)

            if not code:
                print("❌ КОД ПУСТОЙ!")
                return {"success": False, "error": "LLM не вернул код"}

            print(f"✅ Извлечен код длиной {len(code)} символов")
            print(f"📝 КОД ДЛЯ ВЫПОЛНЕНИЯ:")
            print("=" * 80)
            print(code)
            print("=" * 80)

            # 4. Выполняем код через SafeCodeExecutor
            print(f"\n⚙️  Выполняем код через SafeCodeExecutor...")
            from backend.ml.core.code_executor import SafeCodeExecutor
            executor = SafeCodeExecutor(timeout=30)

            print(f"⏳ Запускаем выполнение...")
            result = executor.execute_python_code(code)

            print(f"\n📊 РЕЗУЛЬТАТ ВЫПОЛНЕНИЯ КОДА:")
            print(f"✅ Успешно: {result.get('success')}")
            print(f"❌ Ошибка: {result.get('error')}")
            print(f"📤 stdout: {result.get('stdout', '')}")
            print(f"📥 stderr: {result.get('stderr', '')}")
            print(f"🖼  Есть изображение: {result.get('has_image')}")
            print(f"📏 Размер base64: {len(result.get('image_base64', '')) if result.get('image_base64') else 0}")

            # 5. Возвращаем результат
            if result["success"] and result.get("image_base64"):
                print(f"\n🎉 ГРАФИК УСПЕШНО СОЗДАН!")
                return {
                    "success": True,
                    "image_base64": result["image_base64"],
                    "mime_type": result.get("mime_type", "image/png")
                }
            else:
                print(f"\n❌ ОШИБКА ПРИ СОЗДАНИИ ГРАФИКА")
                error_msg = result.get("error", "Ошибка выполнения")
                stderr = result.get("stderr", "")
                stdout = result.get("stdout", "")

                if stderr:
                    print(f"🔴 stderr: {stderr}")
                if stdout:
                    print(f"🔵 stdout: {stdout}")

                return {
                    "success": False,
                    "error": error_msg,
                    "stderr": stderr,
                    "stdout": stdout
                }

        except Exception as e:
            print(f"\n💥 КРИТИЧЕСКАЯ ОШИБКА: {str(e)}")
            import traceback
            traceback.print_exc()
            return {"success": False, "error": str(e)}

    def _extract_code(self, text: str) -> str:
        """Извлекает Python код из ответа LLM"""
        if not text:
            print("⚠️  Текст для извлечения кода пустой")
            return ""

        print(f"🔍 Анализ текста для извлечения кода ({len(text)} символов)")

        # Способ 1: Ищем блоки кода ```
        code_blocks = re.findall(r'```python\s*(.*?)\s*```', text, re.DOTALL)
        if code_blocks:
            print(f"✅ Найден блок кода в ```python ```")
            code = code_blocks[0].strip()
            return self._clean_and_validate_code(code)

        # Способ 2: Ищем блоки без указания языка
        code_blocks = re.findall(r'```\s*(.*?)\s*```', text, re.DOTALL)
        if code_blocks:
            print(f"✅ Найден блок кода в ``` ```")
            code = code_blocks[0].strip()
            # Проверяем, выглядит ли как Python код
            if 'import ' in code or 'plt.' in code or 'def ' in code:
                return self._clean_and_validate_code(code)

        # Способ 3: Ищем строки с импортами и plt
        print(f"🔍 Ищем строки с импортами...")
        lines = text.split('\n')
        python_lines = []

        for line in lines:
            line = line.strip()
            if (line.startswith('import ') or
                    line.startswith('from ') or
                    'plt.' in line or
                    'sns.' in line or
                    'np.' in line or
                    'pd.' in line or
                    'ax.' in line or
                    'figure(' in line or
                    'plot(' in line or
                    'scatter(' in line or
                    'bar(' in line or
                    'hist(' in line or
                    'savefig(' in line or
                    'title(' in line or
                    'xlabel(' in line or
                    'ylabel(' in line):
                python_lines.append(line)

        if python_lines:
            print(f"✅ Найдено {len(python_lines)} строк, похожих на Python код")
            code = '\n'.join(python_lines)
            return self._clean_and_validate_code(code)

        # Способ 4: Весь текст
        print(f"⚠️  Не найдено явного кода, пробуем весь текст")
        if 'import ' in text or 'plt.' in text:
            return self._clean_and_validate_code(text.strip())

        print(f"❌ Не удалось извлечь код")
        return ""

    def _clean_and_validate_code(self, code: str) -> str:
        """Очистка и валидация кода"""
        if not code:
            return ""

        print(f"🧹 Очищаем и валидируем код ({len(code)} символов)")

        # Удаляем лишние пробелы и пустые строки в начале/конце
        code = code.strip()

        # Проверяем и добавляем необходимые импорты
        lines = code.split('\n')
        final_lines = []

        has_matplotlib = False
        has_numpy = False

        for line in lines:
            if 'import matplotlib' in line or 'import matplotlib.pyplot' in line:
                has_matplotlib = True
            if 'import numpy' in line:
                has_numpy = True
            final_lines.append(line)

        # Добавляем недостающие импорты в начало
        if not has_matplotlib and ('plt.' in code or 'figure(' in code or 'plot(' in code):
            print(f"➕ Добавляем импорт matplotlib")
            final_lines.insert(0, "import matplotlib.pyplot as plt")
            has_matplotlib = True

        if not has_numpy and ('np.' in code or 'numpy.' in code or 'linspace' in code):
            print(f"➕ Добавляем импорт numpy")
            final_lines.insert(0, "import numpy as np")
            has_numpy = True

        # Проверяем наличие savefig
        has_savefig = any('savefig' in line for line in final_lines)
        if not has_savefig and has_matplotlib:
            print(f"➕ Добавляем сохранение графика")
            final_lines.append("\n# Сохранение графика")
            final_lines.append("plt.savefig('graph_output.png', dpi=100, bbox_inches='tight')")
            final_lines.append("plt.close()")

        final_code = '\n'.join(final_lines)

        print(f"✅ Финальный код ({len(final_code)} символов)")
        return final_code