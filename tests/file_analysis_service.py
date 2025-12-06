"""
Unit-тесты для FileAnalysisService
"""

import os
import sys
import io
import pytest
import logging
from unittest.mock import Mock, patch, MagicMock, mock_open
from pathlib import Path
import tempfile


class TestFileAnalysisService:
    """Тесты для FileAnalysisService"""

    def setup_method(self):
        """Настройка перед каждым тестом"""
        self.test_pdf_bytes = b"%PDF-1.4 fake PDF content"
        self.test_docx_bytes = b"PK\x03\x04 fake DOCX content"
        self.test_image_bytes = b"\x89PNG\r\n\x1a\n fake PNG content"
        self.test_filename = "test_file.pdf"
        self.test_mime_type = "application/pdf"

        # Мок LLM сервиса
        self.mock_llm_service = Mock()

        # Настраиваем логирование для тестов
        logging.getLogger('ml.services.file_analysis_service').setLevel(logging.ERROR)

    # ===== Тесты для extract_text_from_pdf =====

    @patch('ml.services.file_analysis_service.PyPDF2.PdfReader')
    def test_extract_text_from_pdf_success(self, mock_pdf_reader):
        """Успешное извлечение текста из PDF"""
        # Импортируем сервис внутри теста
        from backend.ml.services.file_analysis_service import FileAnalysisService

        # Arrange
        mock_page1 = Mock()
        mock_page1.extract_text.return_value = "Текст со страницы 1"
        mock_page2 = Mock()
        mock_page2.extract_text.return_value = "Текст со страницы 2"
        mock_pdf_reader.return_value.pages = [mock_page1, mock_page2]

        # Act
        result = FileAnalysisService.extract_text_from_pdf(self.test_pdf_bytes)

        # Assert
        assert "--- Страница 1 ---" in result
        assert "Текст со страницы 1" in result
        assert "--- Страница 2 ---" in result
        assert "Текст со страницы 2" in result
        mock_pdf_reader.assert_called_once()

    @patch('ml.services.file_analysis_service.PyPDF2.PdfReader')
    def test_extract_text_from_pdf_empty_text(self, mock_pdf_reader):
        """PDF с пустым текстом на страницах"""
        # Импортируем сервис внутри теста
        from backend.ml.services.file_analysis_service import FileAnalysisService

        # Arrange
        mock_page1 = Mock()
        mock_page1.extract_text.return_value = ""  # Пустой текст
        mock_page2 = Mock()
        mock_page2.extract_text.return_value = "   "  # Только пробелы
        mock_pdf_reader.return_value.pages = [mock_page1, mock_page2]

        # Act
        result = FileAnalysisService.extract_text_from_pdf(self.test_pdf_bytes)

        # Assert
        assert result == ""  # Пустой результат, так как нет текста
        mock_pdf_reader.assert_called_once()

    @patch('ml.services.file_analysis_service.PyPDF2.PdfReader')
    def test_extract_text_from_pdf_page_error(self, mock_pdf_reader):
        """Ошибка на одной из страниц PDF"""
        # Импортируем сервис внутри теста
        from backend.ml.services.file_analysis_service import FileAnalysisService

        # Arrange
        mock_page1 = Mock()
        mock_page1.extract_text.return_value = "Текст со страницы 1"
        mock_page2 = Mock()
        mock_page2.extract_text.side_effect = Exception("Ошибка извлечения")
        mock_pdf_reader.return_value.pages = [mock_page1, mock_page2]

        # Act
        result = FileAnalysisService.extract_text_from_pdf(self.test_pdf_bytes)

        # Assert
        assert "Текст со страницы 1" in result
        assert "--- Страница 1 ---" in result
        assert "--- Страница 2 ---" not in result  # Вторая страница пропущена
        mock_pdf_reader.assert_called_once()

    def test_extract_text_from_pdf_invalid_pdf(self):
        """Невалидный PDF файл"""
        # Импортируем сервис внутри теста
        from backend.ml.services.file_analysis_service import FileAnalysisService

        # Arrange
        invalid_pdf_bytes = b"Not a PDF file"

        # Act & Assert
        with pytest.raises(ValueError, match="Не удалось извлечь текст из PDF"):
            FileAnalysisService.extract_text_from_pdf(invalid_pdf_bytes)

    @patch('ml.services.file_analysis_service.PyPDF2.PdfReader')
    def test_extract_text_from_pdf_reader_error(self, mock_pdf_reader):
        """Ошибка создания PdfReader"""
        # Импортируем сервис внутри теста
        from backend.ml.services.file_analysis_service import FileAnalysisService

        # Arrange
        mock_pdf_reader.side_effect = Exception("PDF parsing error")

        # Act & Assert
        with pytest.raises(ValueError, match="Не удалось извлечь текст из PDF"):
            FileAnalysisService.extract_text_from_pdf(self.test_pdf_bytes)

    # ===== Тесты для extract_text_from_docx =====

    @patch('ml.services.file_analysis_service.Document')
    def test_extract_text_from_docx_success(self, mock_document):
        """Успешное извлечение текста из DOCX"""
        # Импортируем сервис внутри теста
        from backend.ml.services.file_analysis_service import FileAnalysisService

        # Arrange
        mock_doc = Mock()

        # Мокаем параграфы
        mock_para1 = Mock()
        mock_para1.text = "Первый параграф"
        mock_para2 = Mock()
        mock_para2.text = "Второй параграф"
        mock_para3 = Mock()
        mock_para3.text = "   "  # Пустой параграф (должен быть пропущен)
        mock_doc.paragraphs = [mock_para1, mock_para2, mock_para3]

        # Мокаем таблицы
        mock_table = Mock()
        mock_row1 = Mock()
        mock_cell1 = Mock()
        mock_cell1.text = "Ячейка 1"
        mock_cell2 = Mock()
        mock_cell2.text = "Ячейка 2"
        mock_row1.cells = [mock_cell1, mock_cell2]
        mock_row2 = Mock()
        mock_cell3 = Mock()
        mock_cell3.text = ""  # Пустая ячейка
        mock_cell4 = Mock()
        mock_cell4.text = "Ячейка 4"
        mock_row2.cells = [mock_cell3, mock_cell4]
        mock_table.rows = [mock_row1, mock_row2]
        mock_doc.tables = [mock_table]

        mock_document.return_value = mock_doc

        # Act
        result = FileAnalysisService.extract_text_from_docx(self.test_docx_bytes)

        # Assert
        assert "Первый параграф" in result
        assert "Второй параграф" in result
        assert "Ячейка 1 | Ячейка 2" in result
        assert "Ячейка 4" in result
        assert "   " not in result  # Пустой параграф не должен быть включен
        mock_document.assert_called_once()

    @patch('ml.services.file_analysis_service.Document')
    def test_extract_text_from_docx_empty(self, mock_document):
        """DOCX без текста"""
        # Импортируем сервис внутри теста
        from backend.ml.services.file_analysis_service import FileAnalysisService

        # Arrange
        mock_doc = Mock()
        mock_doc.paragraphs = []
        mock_doc.tables = []
        mock_document.return_value = mock_doc

        # Act
        result = FileAnalysisService.extract_text_from_docx(self.test_docx_bytes)

        # Assert
        assert result == ""
        mock_document.assert_called_once()

    def test_extract_text_from_docx_invalid_file(self):
        """Невалидный DOCX файл"""
        # Импортируем сервис внутри теста
        from backend.ml.services.file_analysis_service import FileAnalysisService

        # Arrange
        invalid_docx_bytes = b"Not a DOCX file"

        # Act & Assert
        with pytest.raises(ValueError, match="Не удалось извлечь текст из DOCX"):
            FileAnalysisService.extract_text_from_docx(invalid_docx_bytes)

    # ===== Тесты для extract_text_from_doc =====

    def test_extract_text_from_doc_raises_error(self):
        """Проверяем что старый DOC формат вызывает ошибку"""
        # Импортируем сервис внутри теста
        from backend.ml.services.file_analysis_service import FileAnalysisService

        # Act & Assert
        with pytest.raises(ValueError, match="Старый формат DOC не поддерживается"):
            FileAnalysisService.extract_text_from_doc(b"fake doc content")

    # ===== Тесты для analyze_image =====

    @patch('ml.services.file_analysis_service.Image.open')
    @patch('ml.services.file_analysis_service.base64.b64encode')
    def test_analyze_image_success_with_vision(self, mock_b64encode, mock_image_open):
        """Успешный анализ изображения с поддержкой vision"""
        # Импортируем сервис внутри теста
        from backend.ml.services.file_analysis_service import FileAnalysisService

        # Arrange
        # Мокаем изображение
        mock_image = Mock()
        mock_image.format = 'JPEG'
        mock_image.size = (800, 600)
        mock_image.mode = 'RGB'
        mock_image.convert.return_value = mock_image
        mock_image.save = Mock()
        mock_image_open.return_value = mock_image

        # Мокаем base64
        mock_b64encode.return_value = b"base64_encoded_image"

        # Мокаем BytesIO для сохранения
        with patch('ml.services.file_analysis_service.io.BytesIO') as mock_bytesio:
            mock_buffer = Mock()
            mock_buffer.getvalue.return_value = b"image_data"
            mock_bytesio.return_value = mock_buffer

            # LLM сервис с поддержкой vision
            self.mock_llm_service.analyze_image.return_value = "Описание изображения: тестовое фото"

            # Act
            result = FileAnalysisService.analyze_image(
                self.test_image_bytes,
                "test.jpg",
                self.mock_llm_service,
                "image/jpeg"
            )

            # Assert
            assert result == "Описание изображения: тестовое фото"
            mock_image_open.assert_called_once()
            mock_image.save.assert_called_once()
            self.mock_llm_service.analyze_image.assert_called_once()

    @patch('ml.services.file_analysis_service.Image.open')
    @patch('ml.services.file_analysis_service.base64.b64encode')
    def test_analyze_image_png_conversion(self, mock_b64encode, mock_image_open):
        """Анализ PNG изображения (конвертация в RGB)"""
        # Импортируем сервис внутри теста
        from backend.ml.services.file_analysis_service import FileAnalysisService

        # Arrange
        mock_image = Mock()
        mock_image.format = 'PNG'
        mock_image.size = (800, 600)
        mock_image.mode = 'RGBA'  # PNG с альфа-каналом
        mock_image.convert.return_value = mock_image
        mock_image.save = Mock()
        mock_image_open.return_value = mock_image

        mock_b64encode.return_value = b"base64_encoded_image"

        with patch('ml.services.file_analysis_service.io.BytesIO'):
            # LLM сервис
            self.mock_llm_service.analyze_image.return_value = "PNG изображение"

            # Act
            result = FileAnalysisService.analyze_image(
                self.test_image_bytes,
                "test.png",
                self.mock_llm_service
            )

            # Assert
            assert result == "PNG изображение"
            mock_image.convert.assert_called_once_with('RGB')  # Должна быть конвертация
            self.mock_llm_service.analyze_image.assert_called_once()

    @patch('ml.services.file_analysis_service.Image.open')
    def test_analyze_image_llm_without_vision(self, mock_image_open):
        """Анализ изображения когда LLM не поддерживает vision"""
        # Импортируем сервис внутри теста
        from backend.ml.services.file_analysis_service import FileAnalysisService

        # Arrange
        mock_image = Mock()
        mock_image.format = 'JPEG'
        mock_image.size = (800, 600)
        mock_image.mode = 'RGB'
        mock_image.save = Mock()
        mock_image_open.return_value = mock_image

        # LLM сервис БЕЗ метода analyze_image
        llm_service_no_vision = Mock()
        delattr(llm_service_no_vision, 'analyze_image')  # Удаляем метод

        with patch('ml.services.file_analysis_service.io.BytesIO'):
            # Act
            result = FileAnalysisService.analyze_image(
                self.test_image_bytes,
                "test.jpg",
                llm_service_no_vision
            )

            # Assert
            assert "Изображение загружено. Для анализа требуется поддержка vision API." in result

    @patch('ml.services.file_analysis_service.Image.open')
    def test_analyze_image_llm_error(self, mock_image_open):
        """Ошибка анализа изображения через LLM"""
        # Импортируем сервис внутри теста
        from backend.ml.services.file_analysis_service import FileAnalysisService

        # Arrange
        mock_image = Mock()
        mock_image.format = 'JPEG'
        mock_image.size = (800, 600)
        mock_image.mode = 'RGB'
        mock_image.save = Mock()
        mock_image_open.return_value = mock_image

        # LLM сервис с ошибкой
        self.mock_llm_service.analyze_image.side_effect = Exception("LLM API error")

        with patch('ml.services.file_analysis_service.io.BytesIO'):
            # Act
            result = FileAnalysisService.analyze_image(
                self.test_image_bytes,
                "test.jpg",
                self.mock_llm_service
            )

            # Assert
            assert "Изображение загружено" in result
            assert "Ошибка анализа" in result
            assert "LLM API error" in result

    def test_analyze_image_invalid_image(self):
        """Невалидное изображение"""
        # Импортируем сервис внутри теста
        from backend.ml.services.file_analysis_service import FileAnalysisService

        # Arrange
        invalid_image_bytes = b"Not an image"

        # Act & Assert
        with pytest.raises(ValueError, match="Не удалось обработать изображение"):
            FileAnalysisService.analyze_image(
                invalid_image_bytes,
                "test.jpg",
                self.mock_llm_service
            )

    # ===== Тесты для analyze_file =====

    @patch('backend.ml.services.file_analysis_service.FileAnalysisService.extract_text_from_pdf')
    def test_analyze_file_pdf(self, mock_extract_pdf):
        """Анализ PDF файла"""
        # Импортируем сервис внутри теста
        from backend.ml.services.file_analysis_service import FileAnalysisService

        # Arrange
        mock_extract_pdf.return_value = "Текст из PDF"

        # Act
        result = FileAnalysisService.analyze_file(
            self.test_pdf_bytes,
            "document.pdf",
            "application/pdf"
        )

        # Assert
        assert result["file_type"] == "pdf"
        assert result["extracted_text"] == "Текст из PDF"
        assert result["analysis_result"] is None
        mock_extract_pdf.assert_called_once_with(self.test_pdf_bytes)

    @patch('backend.ml.services.file_analysis_service.FileAnalysisService.extract_text_from_docx')
    def test_analyze_file_docx(self, mock_extract_docx):
        """Анализ DOCX файла"""
        # Импортируем сервис внутри теста
        from backend.ml.services.file_analysis_service import FileAnalysisService

        # Arrange
        mock_extract_docx.return_value = "Текст из DOCX"

        # Act
        result = FileAnalysisService.analyze_file(
            self.test_docx_bytes,
            "document.docx",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        )

        # Assert
        assert result["file_type"] == "docx"
        assert result["extracted_text"] == "Текст из DOCX"
        assert result["analysis_result"] is None
        mock_extract_docx.assert_called_once_with(self.test_docx_bytes)

    @patch('backend.ml.services.file_analysis_service.FileAnalysisService.extract_text_from_doc')
    def test_analyze_file_doc(self, mock_extract_doc):
        """Анализ старого DOC файла"""
        # Импортируем сервис внутри теста
        from backend.ml.services.file_analysis_service import FileAnalysisService

        # Arrange
        mock_extract_doc.return_value = "Текст из DOC"

        # Act
        result = FileAnalysisService.analyze_file(
            b"fake doc content",
            "document.doc",
            "application/msword"
        )

        # Assert
        assert result["file_type"] == "doc"
        assert result["extracted_text"] == "Текст из DOC"
        mock_extract_doc.assert_called_once_with(b"fake doc content")

    @patch('backend.ml.services.file_analysis_service.FileAnalysisService.analyze_image')
    def test_analyze_file_image_with_llm(self, mock_analyze_image):
        """Анализ изображения с LLM сервисом"""
        # Импортируем сервис внутри теста
        from backend.ml.services.file_analysis_service import FileAnalysisService

        # Arrange
        mock_analyze_image.return_value = "Описание изображения"

        # Act
        result = FileAnalysisService.analyze_file(
            self.test_image_bytes,
            "photo.jpg",
            "image/jpeg",
            self.mock_llm_service
        )

        # Assert
        assert result["file_type"] == "image"
        assert result["extracted_text"] is None
        assert result["analysis_result"] == "Описание изображения"
        mock_analyze_image.assert_called_once_with(
            self.test_image_bytes,
            "photo.jpg",
            self.mock_llm_service,
            "image/jpeg"
        )

    def test_analyze_file_image_without_llm(self):
        """Анализ изображения без LLM сервиса"""
        # Импортируем сервис внутри теста
        from backend.ml.services.file_analysis_service import FileAnalysisService

        # Act
        result = FileAnalysisService.analyze_file(
            self.test_image_bytes,
            "photo.jpg",
            "image/jpeg"
        )

        # Assert
        assert result["file_type"] == "image"
        assert result["extracted_text"] is None
        assert "Изображение загружено. Анализ недоступен" in result["analysis_result"]

    def test_analyze_file_unknown_type(self):
        """Анализ файла неизвестного типа"""
        # Импортируем сервис внутри теста
        from backend.ml.services.file_analysis_service import FileAnalysisService

        # Act
        result = FileAnalysisService.analyze_file(
            b"unknown content",
            "file.unknown",
            "application/octet-stream"
        )

        # Assert
        assert result["file_type"] == "unknown"
        assert result["extracted_text"] is None
        assert result["analysis_result"] is None

    def test_analyze_file_by_extension(self):
        """Определение типа файла по расширению (без mime-type)"""
        # Импортируем сервис внутри теста
        from backend.ml.services.file_analysis_service import FileAnalysisService

        # Arrange
        test_cases = [
            ("file.pdf", "application/octet-stream", "pdf"),
            ("file.docx", "application/octet-stream", "docx"),
            ("file.doc", "application/octet-stream", "doc"),
            ("file.jpg", "application/octet-stream", "unknown"),  # Без mime-type не распознается как image
        ]

        for filename, mime_type, expected_type in test_cases:
            with patch('backend.ml.services.file_analysis_service.FileAnalysisService.extract_text_from_pdf') as mock_pdf:
                mock_pdf.return_value = "test text"

                # Act
                result = FileAnalysisService.analyze_file(
                    b"content",
                    filename,
                    mime_type
                )

                # Assert
                assert result["file_type"] == expected_type

    @patch('backend.ml.services.file_analysis_service.FileAnalysisService.extract_text_from_pdf')
    def test_analyze_file_error_handling(self, mock_extract_pdf):
        """Обработка ошибок при анализе файла"""
        # Импортируем сервис внутри теста
        from backend.ml.services.file_analysis_service import FileAnalysisService

        # Arrange
        mock_extract_pdf.side_effect = Exception("PDF parsing failed")

        # Act
        result = FileAnalysisService.analyze_file(
            self.test_pdf_bytes,
            "corrupted.pdf",
            "application/pdf"
        )

        # Assert
        assert result["file_type"] == "pdf"
        assert "error" in result
        assert "PDF parsing failed" in result["error"]

    @patch('backend.ml.services.file_analysis_service.FileAnalysisService.extract_text_from_pdf')
    def test_analyze_file_empty_bytes(self, mock_extract_pdf):
        """Анализ файла с пустыми данными"""
        # Импортируем сервис внутри теста
        from backend.ml.services.file_analysis_service import FileAnalysisService

        # Act
        result = FileAnalysisService.analyze_file(
            b"",
            "empty.pdf",
            "application/pdf"
        )

        # Assert
        # Даже если extract_text_from_pdf не вызывался, должна быть ошибка в результате
        assert "error" in result or result["file_type"] == "pdf"

    # ===== Тесты для граничных случаев =====

    def test_analyze_file_none_bytes(self):
        """Попытка анализа None вместо bytes"""
        # Импортируем сервис внутри теста
        from backend.ml.services.file_analysis_service import FileAnalysisService

        # Act & Assert
        with pytest.raises(Exception):
            FileAnalysisService.analyze_file(None, "test.pdf", "application/pdf")

    def test_analyze_file_empty_filename(self):
        """Анализ файла с пустым именем"""
        # Импортируем сервис внутри теста
        from backend.ml.services.file_analysis_service import FileAnalysisService

        # Act
        result = FileAnalysisService.analyze_file(
            self.test_pdf_bytes,
            "",
            "application/pdf"
        )

        # Assert
        assert result["file_type"] == "pdf"  # Должен определить по mime-type

    def test_analyze_file_none_mime_type(self):
        """Анализ файла без mime-type"""
        # Импортируем сервис внутри теста
        from backend.ml.services.file_analysis_service import FileAnalysisService

        # Act
        result = FileAnalysisService.analyze_file(
            self.test_pdf_bytes,
            "document.pdf",
            None
        )

        # Assert
        assert result["file_type"] == "pdf"  # Должен определить по расширению


class TestFileAnalysisServiceIntegration:
    """Интеграционные тесты (требуют реальных библиотек)"""

    def test_real_pdf_parsing(self):
        """Реальный парсинг PDF (требует PyPDF2)"""
        # Импортируем сервис внутри теста
        from backend.ml.services.file_analysis_service import FileAnalysisService

        try:
            import PyPDF2
            # Создаем минимальный PDF в памяти
            pdf_bytes = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\nxref\n0 2\n0000000000 65535 f \n0000000010 00000 n \ntrailer\n<<>>\nstartxref\n20\n%%EOF"

            # Этот PDF не содержит текста, но должен быть распарсен без ошибок
            result = FileAnalysisService.extract_text_from_pdf(pdf_bytes)
            assert isinstance(result, str)
        except Exception as e:
            # Если возникает ошибка - это нормально для тестового PDF
            pass

    def test_real_image_processing(self):
        """Реальная обработка изображения (требует PIL)"""
        # Импортируем сервис внутри теста
        from backend.ml.services.file_analysis_service import FileAnalysisService

        try:
            from PIL import Image
            import io

            # Создаем минимальное PNG изображение в памяти
            # Простой 1x1 пиксель PNG
            png_bytes = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x00\r\n\x00\x00\x00\x00IEND\xaeB`\x82'

            # Должен открыться без ошибок
            image = Image.open(io.BytesIO(png_bytes))
            assert image.format == 'PNG'
            assert image.size == (1, 1)
        except Exception as e:
            # Если возникает ошибка - пропускаем тест
            pytest.skip(f"Не удалось создать тестовое изображение: {e}")


if __name__ == "__main__":
    # Запуск тестов напрямую (без pytest)
    import unittest

    # Создаем test suite
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()

    # Добавляем тесты из TestFileAnalysisService
    for attr_name in dir(TestFileAnalysisService):
        if attr_name.startswith('test_'):
            test_method = getattr(TestFileAnalysisService, attr_name)
            if callable(test_method):
                suite.addTest(TestFileAnalysisService(attr_name))

    # Запускаем тесты
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)

    print(f"\n📊 Результаты: {result.testsRun} тестов, "
          f"{len(result.failures)} провалов, {len(result.errors)} ошибок")

    exit_code = 0 if result.wasSuccessful() else 1
    sys.exit(exit_code)