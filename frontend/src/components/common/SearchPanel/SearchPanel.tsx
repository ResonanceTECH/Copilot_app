import React, { useState, useEffect, useRef } from 'react';
import { Icon } from '../../ui/Icon';
import { ICONS } from '../../../utils/icons';
import { searchAPI } from '../../../utils/api';
import type { SearchResults, SearchChatItem, SearchNoteItem, SearchMessageItem } from '../../../types';
import { useLanguage } from '../../../contexts/LanguageContext';
import { getTranslation } from '../../../utils/i18n';
import './SearchPanel.css';

interface SearchPanelProps {
  onClose?: () => void;
  onChatSelect?: (chatId: number) => void;
}

export const SearchPanel: React.FC<SearchPanelProps> = ({ onClose, onChatSelect }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'chats' | 'notes' | 'messages'>('all');
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const { language } = useLanguage();

  // Фокус на поле ввода при открытии
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Закрытие панели при клике вне её
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose?.();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  // Поиск с задержкой
  useEffect(() => {
    if (!query.trim()) {
      setResults(null);
      return;
    }

    const timeoutId = setTimeout(() => {
      performSearch();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query, activeTab]);

  const performSearch = async () => {
    if (!query.trim()) return;

    setIsLoading(true);
    try {
      const searchResults = await searchAPI.search({
        q: query.trim(),
        type: activeTab === 'all' ? undefined : activeTab,
        limit: 20,
      });
      setResults(searchResults);
    } catch (error) {
      console.error('Ошибка поиска:', error);
      setResults(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChatClick = (chatId: number) => {
    onChatSelect?.(chatId);
    onClose?.();
  };

  const renderChatItem = (chat: SearchChatItem) => (
    <div
      key={chat.id}
      className="search-panel-item"
      onClick={() => handleChatClick(chat.id)}
    >
      <div className="search-panel-item-icon">
        <Icon src={ICONS.rocket} size="md" />
      </div>
      <div className="search-panel-item-content">
        <div className="search-panel-item-title">{chat.title}</div>
        {chat.snippet && (
          <div className="search-panel-item-snippet">{chat.snippet}</div>
        )}
        <div className="search-panel-item-meta">
          <span>{chat.space_name}</span>
          <span>{new Date(chat.updated_at).toLocaleDateString('ru-RU')}</span>
        </div>
      </div>
    </div>
  );

  const renderNoteItem = (note: SearchNoteItem) => (
    <div
      key={note.id}
      className="search-panel-item"
    >
      <div className="search-panel-item-icon">
        <Icon src={ICONS.note} size="md" />
      </div>
      <div className="search-panel-item-content">
        <div className="search-panel-item-title">{note.title}</div>
        {note.snippet && (
          <div className="search-panel-item-snippet">{note.snippet}</div>
        )}
        <div className="search-panel-item-meta">
          <span>{note.space_name}</span>
          <span>{new Date(note.updated_at).toLocaleDateString('ru-RU')}</span>
        </div>
      </div>
    </div>
  );

  const renderMessageItem = (message: SearchMessageItem) => (
    <div
      key={message.id}
      className="search-panel-item"
      onClick={() => handleChatClick(message.chat_id)}
    >
      <div className="search-panel-item-icon">
        <Icon src={ICONS.rocket} size="md" />
      </div>
      <div className="search-panel-item-content">
        <div className="search-panel-item-title">
          {message.chat_title || `Чат #${message.chat_id}`}
        </div>
        {message.snippet && (
          <div className="search-panel-item-snippet">{message.snippet}</div>
        )}
        <div className="search-panel-item-meta">
          <span>{message.space_name}</span>
          <span>{new Date(message.created_at).toLocaleDateString('ru-RU')}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="search-panel" ref={panelRef}>
      <div className="search-panel-header">
        <div className="search-panel-input-wrapper">
          <Icon src={ICONS.search} size="sm" className="search-panel-input-icon" />
          <input
            ref={inputRef}
            type="text"
            className="search-panel-input"
            placeholder="Поиск..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              className="search-panel-clear-btn"
              onClick={() => setQuery('')}
              title="Очистить"
            >
              <Icon src={ICONS.close} size="sm" />
            </button>
          )}
        </div>
        {onClose && (
          <button
            className="search-panel-close-btn"
            onClick={onClose}
            title="Закрыть"
          >
            <Icon src={ICONS.close} size="sm" />
          </button>
        )}
      </div>

      <div className="search-panel-tabs">
        <button
          className={`search-panel-tab ${activeTab === 'all' ? 'search-panel-tab--active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          Все
          {results && (
            <span className="search-panel-tab-count">{results.total}</span>
          )}
        </button>
        <button
          className={`search-panel-tab ${activeTab === 'chats' ? 'search-panel-tab--active' : ''}`}
          onClick={() => setActiveTab('chats')}
        >
          Чаты
          {results && (
            <span className="search-panel-tab-count">{results.results.chats_count}</span>
          )}
        </button>
        <button
          className={`search-panel-tab ${activeTab === 'notes' ? 'search-panel-tab--active' : ''}`}
          onClick={() => setActiveTab('notes')}
        >
          Заметки
          {results && (
            <span className="search-panel-tab-count">{results.results.notes_count}</span>
          )}
        </button>
        <button
          className={`search-panel-tab ${activeTab === 'messages' ? 'search-panel-tab--active' : ''}`}
          onClick={() => setActiveTab('messages')}
        >
          Сообщения
          {results && (
            <span className="search-panel-tab-count">{results.results.messages_count}</span>
          )}
        </button>
      </div>

      <div className="search-panel-content">
        {isLoading ? (
          <div className="search-panel-loading">Поиск...</div>
        ) : !query.trim() ? (
          <div className="search-panel-empty">
            <Icon src={ICONS.search} size="lg" />
            <p>Введите запрос для поиска</p>
          </div>
        ) : results && results.total === 0 ? (
          <div className="search-panel-empty">
            <Icon src={ICONS.search} size="lg" />
            <p>Ничего не найдено</p>
          </div>
        ) : results ? (
          <div className="search-panel-results">
            {activeTab === 'all' || activeTab === 'chats' ? (
              results.chats.length > 0 && (
                <div className="search-panel-section">
                  {activeTab === 'all' && (
                    <div className="search-panel-section-title">Чаты</div>
                  )}
                  {results.chats.map(renderChatItem)}
                </div>
              )
            ) : null}
            {activeTab === 'all' || activeTab === 'notes' ? (
              results.notes.length > 0 && (
                <div className="search-panel-section">
                  {activeTab === 'all' && (
                    <div className="search-panel-section-title">Заметки</div>
                  )}
                  {results.notes.map(renderNoteItem)}
                </div>
              )
            ) : null}
            {activeTab === 'all' || activeTab === 'messages' ? (
              results.messages.length > 0 && (
                <div className="search-panel-section">
                  {activeTab === 'all' && (
                    <div className="search-panel-section-title">Сообщения</div>
                  )}
                  {results.messages.map(renderMessageItem)}
                </div>
              )
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
};

