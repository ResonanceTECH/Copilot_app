import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Icon } from '../../ui/Icon';
import { ICONS } from '../../../utils/icons';
import { ChatMessage } from '../../../types';
import logoIcon from '../../../assets/icons/logo.svg';
import { useLanguage } from '../../../contexts/LanguageContext';
import { getTranslation } from '../../../utils/i18n';
import { NotesPanel } from '../NotesPanel';
import { trackActivity } from '../../../utils/activityTracker';
import './ChatArea.css';

interface ChatAreaProps {
  userName?: string;
  messages?: ChatMessage[];
  activeTool?: string;
  onToolSelect?: (tool: string) => void;
  onSendMessage?: (message: string) => void;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  userName = '',
  messages = [],
  activeTool: externalActiveTool,
  onToolSelect,
  onSendMessage,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [internalActiveTool, setInternalActiveTool] = useState<string>('assistant');
  const [isNotesPanelVisible, setIsNotesPanelVisible] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { language } = useLanguage();

  const activeTool = externalActiveTool !== undefined ? externalActiveTool : internalActiveTool;
  const handleToolSelect = (tool: string) => {
    if (onToolSelect) {
      onToolSelect(tool);
    } else {
      setInternalActiveTool(tool);
    }
  };

  const handleSend = () => {
    if (inputValue.trim() && onSendMessage) {
      // Отслеживаем активность пользователя
      trackActivity();
      onSendMessage(inputValue.trim());
      setInputValue('');
      // Фокус на поле ввода после отправки
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Автоматическое изменение размера textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 200)}px`;
    }
  }, [inputValue]);

  // Автофокус на поле ввода при загрузке
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Автопрокрутка сообщений вниз
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);


  return (
    <div className="chat-area">
      {messages.length === 0 ? (
        <div className="chat-welcome-container">
          <div className="chat-welcome">
            <div className="chat-welcome-icon">
              <img src={logoIcon} alt="AI-ассистент" className="chat-welcome-logo" />
            </div>
            {userName ? (
              <>
                <h2 className="chat-welcome-title">
                  {getTranslation('greetingWithName', language, { name: userName }).split(',')[0]}
                </h2>
                <p className="chat-welcome-subtitle">
                  {getTranslation('greeting', language)}
                </p>
              </>
            ) : (
              <h2 className="chat-welcome-title">
                {getTranslation('greeting', language)}
              </h2>
            )}
          </div>
        </div>
      ) : (
        <div className="chat-messages">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`chat-message chat-message--${message.role} ${message.isLoading ? 'chat-message--loading' : ''}`}
            >
              <div className="chat-message-content">
                {message.role === 'assistant' && !message.isLoading ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {message.content}
                  </ReactMarkdown>
                ) : (
                  message.content
                )}
                {!message.isLoading && message.timestamp && (
                  <div className="chat-message-timestamp">
                    {message.timestamp instanceof Date
                      ? message.timestamp.toLocaleTimeString('ru-RU', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })
                      : new Date(message.timestamp).toLocaleTimeString('ru-RU', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })
                    }
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      )}

      <div className="chat-input-section">
        <div className="chat-input-wrapper">
          <div className="chat-input-container">
            <textarea
              ref={inputRef}
              className="chat-input"
              placeholder={getTranslation('startNewThread', language)}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
            />
            <div className="chat-input-actions">
              <button
                className="chat-input-icon-btn"
                type="button"
                onClick={() => setIsNotesPanelVisible(!isNotesPanelVisible)}
                title="Заметки"
              >
                <Icon src={ICONS.note} size="md" />
              </button>
              <button className="chat-input-icon-btn" type="button">
                <Icon src={ICONS.paperclip} size="md" />
              </button>
              <button className="chat-input-icon-btn" type="button">
                <Icon src={ICONS.microphone} size="md" />
              </button>
              <button
                className="chat-input-icon-btn chat-input-send-btn"
                type="button"
                onClick={handleSend}
              >
                <Icon src={ICONS.send} size="md" />
              </button>
            </div>
          </div>
        </div>
      </div>
      {isNotesPanelVisible && (
        <NotesPanel onClose={() => setIsNotesPanelVisible(false)} />
      )}
    </div>
  );
};
