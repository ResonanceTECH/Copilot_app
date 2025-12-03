import subprocess
import os
import sys
import tempfile
import base64
import uuid
from pathlib import Path


class SafeCodeExecutor:
    def __init__(self, timeout=30):
        self.timeout = timeout
        self.output_filename = "graph_output.png"  # фиксированное имя файла
        # Определяем путь к папке assets относительно корня проекта
        # code_executor.py находится в backend/ml/core/, поэтому идем на 2 уровня вверх
        self.assets_dir = Path(__file__).parent.parent.parent / "assets"
        self.assets_dir.mkdir(parents=True, exist_ok=True)

    def execute_python_code(self, code: str) -> dict:
        """Выполняет Python код для создания графика и возвращает base64 изображение"""
        # Безопасные ограничения (разрешаем matplotlib, но запрещаем опасные операции)
        dangerous_patterns = [
            'os.system', 'os.popen', 'subprocess.Popen', 'subprocess.call',
            'eval(', 'exec(', 'compile(', '__import__', '.pyc', '.so', '.dll',
            'import socket', 'import requests', 'import urllib',
            'while True:', 'for _ in range(1000000):',  # бесконечные циклы
            'import os', 'import sys', 'import subprocess'  # но разрешаем в безопасном контексте
        ]

        # Проверяем на опасные паттерны
        code_lower = code.lower()
        for pattern in dangerous_patterns:
            if pattern in code_lower:
                return {
                    "success": False,
                    "error": f"Обнаружен небезопасный код: {pattern}",
                    "stderr": "Код содержит запрещенные операции"
                }

        # Создаем временный Python файл
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False, encoding='utf-8') as f:
            # Добавляем безопасные импорты если их нет
            if 'import matplotlib' not in code:
                f.write("import matplotlib\nmatplotlib.use('Agg')\n")
            f.write(code)
            tmp_script = f.name

        try:
            # Создаем временную директорию для выполнения
            temp_dir = tempfile.mkdtemp()
            original_dir = os.getcwd()
            os.chdir(temp_dir)

            # Выполняем код
            result = subprocess.run(
                [sys.executable, tmp_script],
                capture_output=True,
                text=True,
                timeout=self.timeout,
                encoding='utf-8'
            )

            # Проверяем, создался ли файл графика
            output_path = os.path.join(temp_dir, self.output_filename)
            has_graph = os.path.exists(output_path) and os.path.getsize(output_path) > 0

            # Если график создан, сохраняем его в assets и читаем как base64
            image_base64 = None
            mime_type = None
            saved_image_path = None

            if has_graph:
                # Генерируем уникальное имя файла
                unique_filename = f"graph_{uuid.uuid4().hex[:12]}.png"
                saved_image_path = self.assets_dir / unique_filename
                
                # Копируем файл в assets
                import shutil
                shutil.copy2(output_path, saved_image_path)
                
                # Читаем как base64 для обратной совместимости
                with open(output_path, 'rb') as img_file:
                    image_base64 = base64.b64encode(img_file.read()).decode('utf-8')
                    mime_type = 'image/png'
                
                # Возвращаем относительный путь от корня backend
                saved_image_path = f"assets/{unique_filename}"

            # Возвращаем в исходную директорию
            os.chdir(original_dir)

            # Удаляем временные файлы
            if os.path.exists(tmp_script):
                os.unlink(tmp_script)

            # Удаляем временную директорию
            import shutil
            shutil.rmtree(temp_dir, ignore_errors=True)

            return {
                "success": result.returncode == 0 and has_graph,
                "returncode": result.returncode,
                "stdout": result.stdout,
                "stderr": result.stderr,
                "has_image": has_graph,
                "image_base64": image_base64,
                "mime_type": mime_type,
                "output_filename": self.output_filename if has_graph else None,
                "saved_image_path": saved_image_path
            }

        except subprocess.TimeoutExpired:
            return {
                "success": False,
                "error": "Таймаут выполнения кода",
                "stdout": "",
                "stderr": "Код выполнялся слишком долго"
            }
        except Exception as e:
            return {
                "success": False,
                "error": f"Ошибка выполнения: {str(e)}",
                "stdout": "",
                "stderr": str(e)
            }
        finally:
            # Гарантируем удаление временных файлов
            if 'tmp_script' in locals() and os.path.exists(tmp_script):
                try:
                    os.unlink(tmp_script)
                except:
                    pass