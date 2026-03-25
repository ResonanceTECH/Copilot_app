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

            # 1. Промпт: только matplotlib + numpy — seaborn даёт несуществующие вызовы (sns.legend)
            system_prompt = """Сгенерируй один блок ```python с рабочим кодом графика.

Обязательно:
- import numpy as np; import matplotlib.pyplot as plt
- НЕ import seaborn; НЕ sns.* — библиотека seaborn запрещена
- Данные: для y=f(x) используй x = np.linspace(...), y = f(x), числа в массивах, не dict и не один скаляр x
- figsize только в дюймах, напр. plt.figure(figsize=(8, 5)), не (800, 600)
- Легенда: только plt.legend() или plt.legend(loc='best') — со скобками, без опечаток
- Без plt.show(). В конце: plt.savefig('graph_output.png', dpi=120, bbox_inches='tight'); plt.close()
- Только код, без пояснений вне блока
"""

            user_prompt = f"Запрос: {user_query}\nПострой график по смыслу запроса."

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
                saved_image_path = result.get("saved_image_path")
                if saved_image_path:
                    print(f"📁 Картинка сохранена: {saved_image_path}")
                return {
                    "success": True,
                    "image_base64": result["image_base64"],
                    "mime_type": result.get("mime_type", "image/png"),
                    "saved_image_path": saved_image_path
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

        # Способ 3: Если текст начинается с import и нет блоков кода, берем все строки подряд
        print(f"🔍 Ищем строки с импортами...")
        lines = text.split('\n')
        python_lines = []
        code_started = False
        empty_lines_count = 0
        
        for line in lines:
            stripped = line.strip()
            
            # Пропускаем пустые строки до начала кода
            if not stripped and not code_started:
                continue
            
            # Начало кода - строка с import или from
            if stripped.startswith('import ') or stripped.startswith('from '):
                code_started = True
                empty_lines_count = 0
                python_lines.append(stripped)
                continue
            
            # Если код начался
            if code_started:
                if not stripped:
                    # Пустая строка - увеличиваем счетчик
                    empty_lines_count += 1
                    # Если две пустые строки подряд, возможно код закончился
                    if empty_lines_count >= 2:
                        break
                    continue
                
                # Сбрасываем счетчик пустых строк
                empty_lines_count = 0
                
                # Добавляем все непустые строки (они все должны быть кодом)
                python_lines.append(stripped)

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
        final_code = self._repair_matplotlib_code(final_code)

        print(f"✅ Финальный код ({len(final_code)} символов)")
        return final_code

    def _repair_matplotlib_code(self, code: str) -> str:
        """Убирает типичный мусор от слабых LLM: sns.legend, опечатки plt.legend, plt.show."""
        if not code:
            return code

        # plt.legend loc= / plt.legend "foo" — пропущена '('
        code = re.sub(r"plt\.legend\s+(?=[a-zA-Z_\"'])", "plt.legend(", code)

        lines_out = []
        for line in code.split("\n"):
            s = line.strip()
            if not s:
                lines_out.append(line)
                continue
            # sns.legend* в seaborn не как у plt — модели путают и ломают синтаксис
            if re.search(r"\bsns\.legend\b", s):
                continue
            if re.search(r"\bplt\.show\s*\(", s):
                continue
            lines_out.append(line)

        code = "\n".join(lines_out)

        if re.search(r"\bsns\.", code) is None:
            code = re.sub(r"^\s*import\s+seaborn\s+as\s+sns\s*\n?", "", code, flags=re.MULTILINE)
            code = re.sub(r"^\s*from\s+seaborn\s+import\s+.*\n?", "", code, flags=re.MULTILINE)

        return code