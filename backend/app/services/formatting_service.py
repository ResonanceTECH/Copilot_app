import re


class FormattingService:
    @staticmethod
    def format_response(text: str):
        """Форматирование текстового ответа в HTML"""
        if not text:
            return "<p>Нет ответа</p>"

        original_text = text
        text = text.replace('**', '').replace('__', '')
        paragraphs = [p.strip() for p in text.split('\n\n') if p.strip()]

        if not paragraphs:
            return '<p class="response-text">Пустой ответ</p>'

        formatted_paragraphs = []

        for paragraph in paragraphs:
            lines = [line.strip() for line in paragraph.split('\n') if line.strip()]

            if not lines:
                continue

            if FormattingService._is_heading(paragraph):
                clean_heading = re.sub(r'^#+\s*', '', paragraph)
                formatted_paragraphs.append(f'<h4 class="response-heading">{clean_heading}</h4>')
            elif FormattingService._is_list(lines):
                formatted_paragraphs.append(FormattingService._format_simple_list(lines))
            else:
                formatted_para = paragraph.replace('\n', '<br>')
                formatted_paragraphs.append(f'<p class="response-text">{formatted_para}</p>')

        result = ''.join(formatted_paragraphs)
        return result if result else f'<p class="response-text">{original_text}</p>'

    @staticmethod
    def _is_heading(text: str):
        lines = text.split('\n')
        if len(lines) > 1:
            return False
        return (text.startswith('#') or
                (len(text) < 100 and
                 any(keyword in text.lower() for keyword in [
                     'маркетинг', 'финансы', 'юридич', 'управлен', 'риск',
                     'преимуществ', 'рекомендац', 'функционал', 'особенност'
                 ])))

    @staticmethod
    def _is_list(lines: list):
        if not lines:
            return False
        list_items = sum(1 for line in lines if FormattingService._is_list_item(line))
        return list_items > 0

    @staticmethod
    def _is_list_item(line: str):
        line = line.strip()
        return (line.startswith(('-', '•', '*', '—')) or
                re.match(r'^\d+\.', line) or
                re.match(r'^\d+\)', line))

    @staticmethod
    def _format_simple_list(lines: list):
        html = '<ul class="response-list">'
        for line in lines:
            trimmed = line.strip()
            if trimmed and FormattingService._is_list_item(trimmed):
                clean_item = re.sub(r'^[•\-*\d\.\s]+', '', trimmed)
                html += f'<li class="response-list-item">{clean_item}</li>'
        html += '</ul>'
        return html