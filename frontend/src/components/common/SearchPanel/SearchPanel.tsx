import React, { useState, useEffect, useRef } from 'react';
import { Icon } from '../../ui/Icon';
import { ICONS } from '../../../utils/icons';
import { searchAPI } from '../../../utils/api';
<<<<<<< HEAD
import { SearchResults, SearchChatItem, SearchNoteItem, SearchMessageItem } from '../../../types';
=======
import type { SearchResults, SearchChatItem, SearchNoteItem, SearchMessageItem } from '../../../types';
>>>>>>> 4347a6bfb039ecdd21b3103ee6191940f80e76f6
import { useLanguage } from '../../../contexts/LanguageContext';
import { getTranslation } from '../../../utils/i18n';
import './SearchPanel.css';

interface SearchPanelProps {
<<<<<<< HEAD
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
=======
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
>>>>>>> 4347a6bfb039ecdd21b3103ee6191940f80e76f6
  const { language } = useLanguage();

  // Фокус на поле ввода при открытии
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

<<<<<<< HEAD
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
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleChatClick = (chatId: number) => {
    onChatSelect?.(chatId);
    onClose();
  };

  const handleNoteClick = (noteId: number) => {
    onNoteSelect?.(noteId);
    onClose();
  };

  const handleMessageClick = (chatId: number) => {
    onChatSelect?.(chatId);
    onClose();
  };

  // Функция для безопасного рендеринга HTML с подсветкой
  const renderSnippet = (snippet: string | null) => {
    if (!snippet) return null;
    
    // Заменяем <mark> на span с классом для стилизации
    const html = snippet.replace(/<mark>/g, '<span class="search-highlight">').replace(/<\/mark>/g, '</span>');
    
    return <span dangerouslySetInnerHTML={{ __html: html }} />;
  };

  return (
    <div className="search-panel-overlay" onClick={onClose}>
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
          <button className="search-panel-close" onClick={onClose}>
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
                  {results.chats.length > 0 && (
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

                  {results.notes.length > 0 && (
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

                  {results.messages.length > 0 && (
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
=======
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
>>>>>>> 4347a6bfb039ecdd21b3103ee6191940f80e76f6
      </div>
    </div>
  );
};

