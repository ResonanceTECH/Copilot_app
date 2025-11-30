import React, { useState, useEffect, useRef } from 'react';
import { Icon } from '../../ui/Icon';
import { ICONS } from '../../../utils/icons';
import { searchAPI } from '../../../utils/api';
import type { SearchResults, SearchChatItem, SearchNoteItem, SearchMessageItem } from '../../../types';
import { useLanguage } from '../../../contexts/LanguageContext';
import { getTranslation } from '../../../utils/i18n';
import './SearchPanel.css';

interface SearchPanelProps {
  onClose: () => void;
  onChatSelect?: (chatId: number) => void;
  onNoteSelect?: (noteId: number) => void;
}

export const SearchPanel: React.FC<SearchPanelProps> = ({
  onClose,
  onChatSelect,
  onNoteSelect,
}) => {
  const [query, setQuery] = useState('');
  const [searchType, setSearchType] = useState<'all' | 'chats' | 'notes' | 'messages'>('all');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { language } = useLanguage();

  // Фокус на поле ввода при открытии
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Поиск с задержкой (debounce)
  useEffect(() => {
    if (!query.trim() || query.length < 1) {
      setResults(null);
      setError(null);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsLoading(true);
      setError(null);

      try {
        const searchResults = await searchAPI.search({
          q: query.trim(),
          type: searchType,
          limit: 20,
        });
        setResults(searchResults);
      } catch (err: any) {
        setError(err.message || 'Ошибка при выполнении поиска');
        setResults(null);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query, searchType]);

  // Закрытие по Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleChatClick = (chatId: number) => {
    onChatSelect?.(chatId);
    onClose?.();
  };

  const handleNoteClick = (noteId: number) => {
    onNoteSelect?.(noteId);
    onClose?.();
  };

  const handleMessageClick = (chatId: number) => {
    onChatSelect?.(chatId);
    onClose?.();
  };

  // Функция для безопасного рендеринга HTML с подсветкой
  const renderSnippet = (snippet: string | null) => {
    if (!snippet) return null;

    // Заменяем <mark> на span с классом для стилизации
    const html = snippet.replace(/<mark>/g, '<span class="search-highlight">').replace(/<\/mark>/g, '</span>');

    return <span dangerouslySetInnerHTML={{ __html: html }} />;
  };

  return (
    <div className="search-panel-overlay" onClick={() => onClose?.()}>
      <div className="search-panel" onClick={(e) => e.stopPropagation()}>
        <div className="search-panel-header">
          <div className="search-panel-input-container">
            <Icon src={ICONS.search} size="md" className="search-panel-icon" />
            <input
              ref={inputRef}
              type="text"
              className="search-panel-input"
              placeholder="Поиск по чатам, заметкам и сообщениям..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button
                className="search-panel-clear"
                onClick={() => setQuery('')}
                title="Очистить"
              >
                <Icon src={ICONS.close} size="sm" />
              </button>
            )}
          </div>
          <button className="search-panel-close" onClick={() => onClose?.()}>
            <Icon src={ICONS.close} size="md" />
          </button>
        </div>

        <div className="search-panel-filters">
          <button
            className={`search-panel-filter ${searchType === 'all' ? 'search-panel-filter--active' : ''}`}
            onClick={() => setSearchType('all')}
          >
            Все
          </button>
          <button
            className={`search-panel-filter ${searchType === 'chats' ? 'search-panel-filter--active' : ''}`}
            onClick={() => setSearchType('chats')}
          >
            Чаты
          </button>
          <button
            className={`search-panel-filter ${searchType === 'notes' ? 'search-panel-filter--active' : ''}`}
            onClick={() => setSearchType('notes')}
          >
            Заметки
          </button>
          <button
            className={`search-panel-filter ${searchType === 'messages' ? 'search-panel-filter--active' : ''}`}
            onClick={() => setSearchType('messages')}
          >
            Сообщения
          </button>
        </div>

        <div className="search-panel-content">
          {isLoading && (
            <div className="search-panel-loading">
              <p>Поиск...</p>
            </div>
          )}

          {error && (
            <div className="search-panel-error">
              <p>{error}</p>
            </div>
          )}

          {!isLoading && !error && results && (
            <>
              {results.total === 0 ? (
                <div className="search-panel-empty">
                  <p>Ничего не найдено</p>
                </div>
              ) : (
                <>
                  {(searchType === 'all' || searchType === 'chats') && results.chats.length > 0 && (
                    <div className="search-panel-section">
                      <h3 className="search-panel-section-title">
                        Чаты ({results.results.chats_count})
                      </h3>
                      <div className="search-panel-items">
                        {results.chats.map((chat: SearchChatItem) => (
                          <div
                            key={chat.id}
                            className="search-panel-item"
                            onClick={() => handleChatClick(chat.id)}
                          >
                            <div className="search-panel-item-header">
                              <span className="search-panel-item-title">
                                {chat.title || 'Без названия'}
                              </span>
                              <span className="search-panel-item-meta">
                                {chat.space_name}
                              </span>
                            </div>
                            {chat.snippet && (
                              <div className="search-panel-item-snippet">
                                {renderSnippet(chat.snippet)}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(searchType === 'all' || searchType === 'notes') && results.notes.length > 0 && (
                    <div className="search-panel-section">
                      <h3 className="search-panel-section-title">
                        Заметки ({results.results.notes_count})
                      </h3>
                      <div className="search-panel-items">
                        {results.notes.map((note: SearchNoteItem) => (
                          <div
                            key={note.id}
                            className="search-panel-item"
                            onClick={() => handleNoteClick(note.id)}
                          >
                            <div className="search-panel-item-header">
                              <span className="search-panel-item-title">
                                {note.title}
                              </span>
                              <span className="search-panel-item-meta">
                                {note.space_name}
                              </span>
                            </div>
                            {note.snippet && (
                              <div className="search-panel-item-snippet">
                                {renderSnippet(note.snippet)}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(searchType === 'all' || searchType === 'messages') && results.messages.length > 0 && (
                    <div className="search-panel-section">
                      <h3 className="search-panel-section-title">
                        Сообщения ({results.results.messages_count})
                      </h3>
                      <div className="search-panel-items">
                        {results.messages.map((message: SearchMessageItem) => (
                          <div
                            key={message.id}
                            className="search-panel-item"
                            onClick={() => handleMessageClick(message.chat_id)}
                          >
                            <div className="search-panel-item-header">
                              <span className="search-panel-item-title">
                                {message.chat_title || 'Без названия'}
                              </span>
                              <span className="search-panel-item-meta">
                                {message.space_name} • {message.role === 'user' ? 'Вы' : 'Ассистент'}
                              </span>
                            </div>
                            {message.snippet && (
                              <div className="search-panel-item-snippet">
                                {renderSnippet(message.snippet)}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {!isLoading && !error && !results && query.length < 1 && (
            <div className="search-panel-empty">
              <p>Введите запрос для поиска</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
