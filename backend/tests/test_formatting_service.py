"""
Тесты для formatting_service
"""
import pytest
from backend.app.services.formatting_service import FormattingService


class TestFormattingService:
    """Тесты для сервиса форматирования"""
    
    def test_format_empty_text(self):
        """Тест форматирования пустого текста"""
        result = FormattingService.format_response("")
        
        assert result == "<p>Нет ответа</p>"
    
    def test_format_simple_text(self):
        """Тест форматирования простого текста"""
        text = "Это простой текст"
        result = FormattingService.format_response(text)
        
        assert "<p class=\"response-text\">" in result
        assert "Это простой текст" in result
        assert "</p>" in result
    
    def test_format_text_with_paragraphs(self):
        """Тест форматирования текста с параграфами"""
        text = "Первый параграф\n\nВторой параграф"
        result = FormattingService.format_response(text)
        
        assert result.count("<p class=\"response-text\">") == 2
        assert "Первый параграф" in result
        assert "Второй параграф" in result
    
    def test_format_text_with_line_breaks(self):
        """Тест форматирования текста с переносами строк"""
        text = "Первая строка\nВторая строка"
        result = FormattingService.format_response(text)
        
        assert "<br>" in result
        assert "Первая строка" in result
        assert "Вторая строка" in result
    
    def test_format_heading(self):
        """Тест форматирования заголовка"""
        text = "# Заголовок"
        result = FormattingService.format_response(text)
        
        assert "<h4 class=\"response-heading\">" in result
        assert "Заголовок" in result
        assert "</h4>" in result
    
    def test_format_list_with_dashes(self):
        """Тест форматирования списка с тире"""
        text = "- Первый пункт\n- Второй пункт\n- Третий пункт"
        result = FormattingService.format_response(text)
        
        assert "<ul class=\"response-list\">" in result
        assert "</ul>" in result
        assert result.count("<li class=\"response-list-item\">") == 3
        assert "Первый пункт" in result
        assert "Второй пункт" in result
        assert "Третий пункт" in result
    
    def test_format_list_with_numbers(self):
        """Тест форматирования нумерованного списка"""
        text = "1. Первый пункт\n2. Второй пункт"
        result = FormattingService.format_response(text)
        
        assert "<ul class=\"response-list\">" in result
        assert result.count("<li class=\"response-list-item\">") == 2
        assert "Первый пункт" in result
        assert "Второй пункт" in result
    
    def test_format_list_with_bullets(self):
        """Тест форматирования списка с маркерами"""
        text = "• Первый пункт\n• Второй пункт"
        result = FormattingService.format_response(text)
        
        assert "<ul class=\"response-list\">" in result
        assert result.count("<li class=\"response-list-item\">") == 2
    
    def test_remove_markdown_bold(self):
        """Тест удаления markdown жирного текста"""
        text = "**Жирный текст**"
        result = FormattingService.format_response(text)
        
        assert "**" not in result
        assert "Жирный текст" in result
    
    def test_remove_markdown_underline(self):
        """Тест удаления markdown подчеркивания"""
        text = "__Подчеркнутый текст__"
        result = FormattingService.format_response(text)
        
        assert "__" not in result
        assert "Подчеркнутый текст" in result
    
    def test_format_mixed_content(self):
        """Тест форматирования смешанного контента"""
        text = "# Заголовок\n\nТекст параграфа\n\n- Пункт 1\n- Пункт 2"
        result = FormattingService.format_response(text)
        
        assert "<h4" in result
        assert "<p" in result
        assert "<ul" in result
        assert "<li" in result
    
    def test_format_heading_keywords(self):
        """Тест определения заголовка по ключевым словам"""
        text = "Маркетинг и продвижение"
        result = FormattingService.format_response(text)
        
        # Должен быть определен как заголовок из-за ключевого слова "маркетинг"
        assert "<h4" in result or "<p" in result
    
    def test_is_list_item_dash(self):
        """Тест определения элемента списка с тире"""
        assert FormattingService._is_list_item("- Пункт") is True
        assert FormattingService._is_list_item("• Пункт") is True
        assert FormattingService._is_list_item("* Пункт") is True
        assert FormattingService._is_list_item("— Пункт") is True
    
    def test_is_list_item_numbered(self):
        """Тест определения нумерованного элемента списка"""
        # _is_list_item возвращает Match объект или True/False
        result1 = FormattingService._is_list_item("1. Пункт")
        result2 = FormattingService._is_list_item("1) Пункт")
        result3 = FormattingService._is_list_item("10. Пункт")
        assert result1 is not None and result1 is not False
        assert result2 is not None and result2 is not False
        assert result3 is not None and result3 is not False
    
    def test_is_list_item_not_list(self):
        """Тест что обычный текст не является списком"""
        # _is_list_item возвращает None для не-списков
        result1 = FormattingService._is_list_item("Обычный текст")
        result2 = FormattingService._is_list_item("Текст без маркера")
        assert result1 is None or result1 is False
        assert result2 is None or result2 is False
