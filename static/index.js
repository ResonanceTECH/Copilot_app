// Элементы DOM
const chatBox = document.getElementById('chat-box');
const questionInput = document.getElementById('question-input');
const askButton = document.getElementById('ask-button');

// Функция для форматирования текстовых ответов
function formatTextResponse(text) {
    if (!text || typeof text !== 'string') {
        return '<p class="response-text">Нет ответа</p>';
    }

    let cleanedText = text
        .replace(/\*\*/g, '')
        .replace(/__/g, '')
        .trim();

    if (cleanedText.length < 200 || !cleanedText.includes('\n')) {
        const formattedParagraph = cleanedText.replace(/\n/g, '<br>');
        return `<p class="response-text">${formattedParagraph}</p>`;
    }

    const paragraphs = cleanedText.split('\n\n').filter(p => p.trim());

    let formattedContent = '';
    let i = 0;

    while (i < paragraphs.length) {
        const paragraph = paragraphs[i].trim();
        const lines = paragraph.split('\n').filter(line => line.trim());

        if (lines.length === 1 && !isStructuredLine(lines[0])) {
            formattedContent += `<p class="response-text">${lines[0]}</p>`;
            i++;
            continue;
        }

        if (isHeading(paragraph)) {
            const cleanHeading = paragraph.replace(/^#+\s*/, '');
            formattedContent += `<h4 class="response-heading">${cleanHeading}</h4>`;
            i++;
            continue;
        }

        formattedContent += formatComplexStructure(paragraphs.slice(i));
        break;
    }

    return formattedContent || `<p class="response-text">${cleanedText}</p>`;
}

function isStructuredLine(line) {
    return line.includes(':') ||
           /^[•\-*—]/.test(line.trim()) ||
           /^\d+[\.\)]/.test(line.trim());
}

function formatComplexStructure(paragraphs) {
    let html = '';

    for (let para of paragraphs) {
        const lines = para.split('\n').filter(line => line.trim());

        for (let line of lines) {
            if (line.trim().endsWith(':') && line.length < 100) {
                const title = line.trim().slice(0, -1);
                html += `
                    <div class="list-section">
                        <div class="list-section-title">${title}:</div>
                        <ul class="response-list">
                `;
            } else if (line.trim() && !line.trim().endsWith(':')) {
                const cleanItem = line.trim().replace(/^[•\-*—\s]+/, '');
                html += `<li class="response-list-item">${cleanItem}</li>`;
            }
        }
    }

    if (html.includes('<ul class="response-list">') && !html.includes('</ul></div>')) {
        html += '</ul></div>';
    }

    return html;
}

function isHeading(line) {
    return line.startsWith('#') ||
           (line.length < 100 && /^(риски|стратегия|маркетинг|финансы|юридич|управлен)/i.test(line));
}

// Функция для добавления сообщения в чат
function addMessage(content, isUser = false, isError = false) {
    if (isUser) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'user-message';
        const timestamp = new Date().toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit'
        });
        messageDiv.innerHTML = `
            ${content}
            <div class="timestamp">${timestamp}</div>
        `;
        chatBox.appendChild(messageDiv);
    } else {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'assistant-message';

        let displayContent = '';
        let rawText = '';

        if (typeof content === 'object') {
            if (content.formatted_html) {
                displayContent = content.formatted_html;
                rawText = content.raw_text || '';
            } else if (content.raw_text) {
                displayContent = formatTextResponse(content.raw_text);
                rawText = content.raw_text;
            } else {
                displayContent = 'Ошибка: неверный формат данных';
                isError = true;
            }
        } else if (typeof content === 'string') {
            displayContent = formatTextResponse(content);
            rawText = content;
        }

        const timestamp = new Date().toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit'
        });

        const messageId = 'msg-' + Date.now();
        messageDiv.innerHTML = `
            <div class="message-header">
                <span>🤖 Помощник</span>
                <button class="copy-btn" data-message-id="${messageId}">Копировать</button>
            </div>
            <div class="message-content" id="${messageId}">
                ${displayContent}
                <div class="timestamp">${timestamp}</div>
            </div>
        `;

        if (rawText) {
            const messageContent = messageDiv.querySelector('.message-content');
            messageContent.setAttribute('data-raw-text', rawText);
        }

        const copyBtn = messageDiv.querySelector('.copy-btn');
        copyBtn.addEventListener('click', function() {
            copyMessage(this, messageId);
        });

        if (isError) {
            messageDiv.style.borderLeft = '4px solid #f44336';
        }

        chatBox.appendChild(messageDiv);
    }

    chatBox.scrollTop = chatBox.scrollHeight;
}

// Функция для копирования сообщения
function copyMessage(button, messageId) {
    try {
        const messageElement = document.getElementById(messageId);
        if (!messageElement) {
            throw new Error('Элемент сообщения не найден');
        }

        const rawText = messageElement.getAttribute('data-raw-text');
        let textToCopy = '';

        if (rawText) {
            textToCopy = rawText;
        } else {
            const contentElement = messageElement.cloneNode(true);
            const timestamp = contentElement.querySelector('.timestamp');
            if (timestamp) {
                timestamp.remove();
            }
            textToCopy = contentElement.innerText || contentElement.textContent || '';

            textToCopy = textToCopy
                .replace(/\n\s*\n/g, '\n\n')
                .replace(/^\s+|\s+$/g, '')
                .replace(/\s+/g, ' ');
        }

        if (!textToCopy.trim()) {
            throw new Error('Текст для копирования пуст');
        }

        navigator.clipboard.writeText(textToCopy).then(() => {
            const originalText = button.textContent;
            button.textContent = 'Скопировано!';
            button.classList.add('copied');

            setTimeout(() => {
                button.textContent = originalText;
                button.classList.remove('copied');
            }, 2000);
        }).catch(err => {
            console.error('Ошибка clipboard API:', err);
            fallbackCopyText(textToCopy, button);
        });

    } catch (error) {
        console.error('Ошибка копирования:', error);
        button.textContent = 'Ошибка!';
        setTimeout(() => {
            button.textContent = 'Копировать';
        }, 2000);
    }
}

// Fallback метод для копирования
function fallbackCopyText(text, button) {
    try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);

        if (successful) {
            const originalText = button.textContent;
            button.textContent = 'Скопировано!';
            button.classList.add('copied');

            setTimeout(() => {
                button.textContent = originalText;
                button.classList.remove('copied');
            }, 2000);
        } else {
            throw new Error('execCommand не сработал');
        }
    } catch (err) {
        console.error('Fallback копирование не удалось:', err);
        button.textContent = 'Ошибка!';
        setTimeout(() => {
            button.textContent = 'Копировать';
        }, 2000);
    }
}

// Функция для показа индикатора загрузки
function showLoading() {
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'loading-message';
    loadingDiv.className = 'assistant-message loading';
    loadingDiv.innerHTML = `
        <div class="message-content">
            Ищу лучший ответ для вас<span class="loading-dots"></span>
        </div>
    `;
    chatBox.appendChild(loadingDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
}

// Функция для скрытия индикатора загрузки
function hideLoading() {
    const loadingDiv = document.getElementById('loading-message');
    if (loadingDiv) {
        loadingDiv.remove();
    }
}

// Функция для обработки и отправки вопроса
function handleQuestion() {
    const question = questionInput.value.trim();

    // Проверяем, не пустой ли вопрос
    if (!question) {
        showError('Пожалуйста, введите вопрос');
        return;
    }

    // Проверяем, не слишком ли длинный вопрос
    if (question.length > 1000) {
        showError('Вопрос слишком длинный. Пожалуйста, сократите его до 1000 символов');
        return;
    }

    // Отправляем вопрос
    sendQuestionToServer(question);
}

// Функция для показа ошибки
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;

    // Вставляем ошибку перед полем ввода
    const inputContainer = document.querySelector('.input-container');
    inputContainer.parentNode.insertBefore(errorDiv, inputContainer);

    // Удаляем ошибку через 5 секунд
    setTimeout(() => {
        errorDiv.remove();
    }, 5000);
}

// Функция для отправки вопроса на сервер
async function sendQuestionToServer(question) {
    // Блокируем интерфейс
    askButton.disabled = true;
    questionInput.disabled = true;
    askButton.textContent = 'Отправка...';

    // Добавляем сообщение пользователя в чат
    addMessage(question, true);
    questionInput.value = '';

    // Показываем индикатор загрузки
    showLoading();

    try {
        console.log('📤 Отправка вопроса:', question);

        const response = await fetch('/api/ask', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ question: question })
        });

        console.log('📥 Получен ответ:', response.status);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('📊 Данные ответа:', data);

        if (data.success && data.response) {
            // Успешный ответ
            addMessage(data.response, false, false);

            // Добавляем бейдж категории если есть
            if (data.response.category && data.response.category !== 'quick_response') {
                addCategoryBadge(data.response.category);
            }

            console.log('✅ Ответ успешно обработан');
        } else {
            // Ошибка от сервера
            const errorMessage = data.error || 'Неизвестная ошибка сервера';
            console.error('❌ Ошибка от сервера:', errorMessage);
            addMessage(`Ошибка: ${errorMessage}`, false, true);
        }

    } catch (error) {
        console.error('❌ Ошибка сети:', error);

        let errorMessage = 'Ошибка соединения с сервером';
        if (error.message.includes('Failed to fetch')) {
            errorMessage = 'Не удалось подключиться к серверу. Проверьте интернет-соединение';
        } else if (error.message.includes('HTTP error')) {
            errorMessage = 'Ошибка сервера. Попробуйте позже';
        }

        addMessage(errorMessage, false, true);
    } finally {
        // Разблокируем интерфейс
        askButton.disabled = false;
        questionInput.disabled = false;
        askButton.textContent = 'Отправить';
        questionInput.focus();
        hideLoading();
    }
}

// Функция для добавления бейджа категории
function addCategoryBadge(category) {
    const categoryNames = {
        'marketing': '📊 Маркетинг',
        'finance': '💰 Финансы',
        'legal': '⚖️ Юриспруденция',
        'management': '👥 Управление',
        'sales': '🛍️ Продажи',
        'general': '💼 Общие вопросы'
    };

    const lastMessage = chatBox.lastChild;
    if (lastMessage && lastMessage.classList.contains('assistant-message')) {
        const categoryBadge = document.createElement('div');
        categoryBadge.className = 'category-badge';
        categoryBadge.textContent = categoryNames[category] || `Категория: ${category}`;

        const messageContent = lastMessage.querySelector('.message-content');
        if (messageContent) {
            messageContent.appendChild(categoryBadge);
        }
    }
}

// Функция для очистки чата
function clearChat() {
    if (chatBox.children.length <= 1) {
        return; // Не очищаем, если только приветственное сообщение
    }

    if (confirm('Вы уверены, что хотите очистить всю историю чата?')) {
        chatBox.innerHTML = `
            <div class="assistant-message">
                <div class="message-content">
                    <div class="welcome-message">
                        Здравствуйте! Я ваш AI-помощник для бизнеса. Задавайте вопросы по любым аспектам вашего бизнеса, и я постараюсь помочь!
                    </div>
                </div>
            </div>
        `;
    }
}

// Функция для проверки соединения с сервером
async function checkServerConnection() {
    try {
        const response = await fetch('/api/health');
        const data = await response.json();
        console.log('✅ Сервер доступен:', data);
        return true;
    } catch (error) {
        console.error('❌ Сервер недоступен:', error);
        return false;
    }
}

// Функция для быстрых команд
function handleQuickCommands(question) {
    const lowerQuestion = question.toLowerCase().trim();

    const quickCommands = {
        'очистить': clearChat,
        'сбросить': clearChat,
        'clear': clearChat,
        'reset': clearChat,
        'помощь': showHelp,
        'help': showHelp,
        'команды': showHelp
    };

    if (quickCommands[lowerQuestion]) {
        quickCommands[lowerQuestion]();
        return true;
    }

    return false;
}

// Функция для показа справки
function showHelp() {
    const helpMessage = `
Доступные команды:
• "очистить" или "сбросить" - очистить историю чата
• "помощь" или "команды" - показать эту справку

Вы можете задавать вопросы по:
• Маркетингу и продвижению
• Финансам и бухгалтерии
• Юридическим вопросам
• Управлению бизнесом
• Продажам и клиентскому сервису
    `.trim();

    addMessage(helpMessage, false, false);
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Инициализация Бизнес-помощника...');

    // Назначаем обработчик кнопки отправки
    askButton.addEventListener('click', handleQuestion);

    // Обработка нажатия Enter
    questionInput.addEventListener('keypress', function(event) {
        if (event.key === 'Enter' && !askButton.disabled) {
            handleQuestion();
        }
    });

    // Автофокус на поле ввода
    questionInput.focus();

    // Плавная прокрутка к новым сообщениям
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.addedNodes.length) {
                chatBox.scrollTop = chatBox.scrollHeight;
            }
        });
    });

    observer.observe(chatBox, { childList: true });

    // Проверяем соединение с сервером
    checkServerConnection().then(isConnected => {
        if (!isConnected) {
            console.warn('⚠️ Сервер недоступен');
        }
    });

    console.log('✅ Бизнес-помощник инициализирован');

    // Добавляем кнопку очистки чата
    const clearButton = document.createElement('button');
    clearButton.textContent = 'Очистить чат';
    clearButton.id = 'clear-button';
    clearButton.style.cssText = `
        background: #dc3545;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 20px;
        cursor: pointer;
        font-size: 14px;
        margin-left: 10px;
        transition: background 0.3s ease;
    `;

    clearButton.addEventListener('mouseenter', function() {
        this.style.background = '#c82333';
    });

    clearButton.addEventListener('mouseleave', function() {
        this.style.background = '#dc3545';
    });

    clearButton.addEventListener('click', clearChat);

    const inputContainer = document.querySelector('.input-container');
    inputContainer.appendChild(clearButton);

    // Добавляем обработчик для быстрых команд
    questionInput.addEventListener('input', function() {
        const question = this.value.trim();
        if (handleQuickCommands(question)) {
            this.value = '';
        }
    });
});

// Глобальные функции для использования в HTML
window.handleQuestion = handleQuestion;
window.clearChat = clearChat;
window.askQuestion = handleQuestion; // Совместимость со старым кодом