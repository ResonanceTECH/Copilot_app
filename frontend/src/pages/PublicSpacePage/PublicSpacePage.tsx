import React, { useState, useEffect } from 'react';
import { spacesAPI, chatAPI } from '../../utils/api';
import { Header } from '../../components/common/Header';
import { Icon } from '../../components/ui/Icon';
import { ICONS } from '../../utils/icons';
import './PublicSpacePage.css';

interface PublicSpacePageProps {
  publicToken: string;
}

interface PublicSpace {
  id: number;
  name: string;
  description: string | null;
  chats_count: number;
  notes_count: number;
}

interface PublicChat {
  id: number;
  title: string | null;
  created_at: string;
  updated_at: string;
  messages_count: number;
}

interface PublicMessage {
  id: number;
  role: string;
  content: string;
  created_at: string;
}

interface PublicNote {
  id: number;
  title: string;
  content: string | null;
  created_at: string;
  updated_at: string;
  tags: Array<{ id: number; name: string; color: string | null }>;
}

interface PublicTag {
  id: number;
  name: string;
  color: string | null;
  tag_type: string | null;
  created_at: string;
}

export const PublicSpacePage: React.FC<PublicSpacePageProps> = ({ publicToken }) => {
  const [space, setSpace] = useState<PublicSpace | null>(null);
  const [activeTab, setActiveTab] = useState<'chats' | 'notes' | 'tags'>('chats');
  const [chats, setChats] = useState<PublicChat[]>([]);
  const [notes, setNotes] = useState<PublicNote[]>([]);
  const [tags, setTags] = useState<PublicTag[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<number | null>(null);
  const [messages, setMessages] = useState<PublicMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSpace();
  }, [publicToken]);

  useEffect(() => {
    if (activeTab === 'chats') {
      loadChats();
    } else if (activeTab === 'notes') {
      loadNotes();
    } else if (activeTab === 'tags') {
      loadTags();
    }
  }, [activeTab, publicToken]);

  useEffect(() => {
    if (selectedChatId && activeTab === 'chats') {
      loadMessages(selectedChatId);
    }
  }, [selectedChatId, publicToken, activeTab]);

  const loadSpace = async () => {
    try {
      const response = await fetch(`/api/public/spaces/${publicToken}`);
      if (!response.ok) {
        throw new Error('Пространство не найдено');
      }
      const data = await response.json();
      setSpace(data);
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки пространства');
    } finally {
      setIsLoading(false);
    }
  };

  const loadChats = async () => {
    try {
      const response = await fetch(`/api/public/spaces/${publicToken}/chats`);
      if (!response.ok) {
        throw new Error('Ошибка загрузки чатов');
      }
      const data = await response.json();
      setChats(data.chats || []);
    } catch (err: any) {
      console.error('Ошибка загрузки чатов:', err);
    }
  };

  const loadMessages = async (chatId: number) => {
    try {
      const response = await fetch(`/api/public/spaces/${publicToken}/chats/${chatId}/messages`);
      if (!response.ok) {
        throw new Error('Ошибка загрузки сообщений');
      }
      const data = await response.json();
      setMessages(data.messages || []);
    } catch (err: any) {
      console.error('Ошибка загрузки сообщений:', err);
    }
  };

  const loadNotes = async () => {
    try {
      const response = await fetch(`/api/public/spaces/${publicToken}/notes`);
      if (!response.ok) {
        throw new Error('Ошибка загрузки заметок');
      }
      const data = await response.json();
      setNotes(data.notes || []);
    } catch (err: any) {
      console.error('Ошибка загрузки заметок:', err);
    }
  };

  const loadTags = async () => {
    try {
      const response = await fetch(`/api/public/spaces/${publicToken}/tags`);
      if (!response.ok) {
        throw new Error('Ошибка загрузки тегов');
      }
      const data = await response.json();
      setTags(data.tags || []);
    } catch (err: any) {
      console.error('Ошибка загрузки тегов:', err);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || isSending) return;

    setIsSending(true);
    try {
      const response = await fetch(`/api/public/spaces/${publicToken}/chat/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: newMessage.trim(),
          chat_id: selectedChatId || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Ошибка отправки сообщения');
      }

      const data = await response.json();
      
      if (data.success) {
        setNewMessage('');
        
        // Если был создан новый чат, обновляем список чатов
        if (!selectedChatId) {
          setSelectedChatId(data.chat_id);
          await loadChats();
        }
        
        // Обновляем сообщения
        await loadMessages(data.chat_id);
        
        // Прокручиваем вниз
        setTimeout(() => {
          const messagesContainer = document.querySelector('.public-messages-container');
          if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
          }
        }, 100);
      }
    } catch (err: any) {
      alert(err.message || 'Ошибка при отправке сообщения');
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (isLoading) {
    return (
      <div className="public-space-loading">
        <div>Загрузка...</div>
      </div>
    );
  }

  if (error || !space) {
    return (
      <div className="public-space-error">
        <div>
          <h2>Пространство не найдено</h2>
          <p>{error || 'Публичное пространство недоступно'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="public-space-page">
      <Header
        title={space.name}
        activeTool="assistant"
        onToolSelect={() => {}}
      />
      
      <div className="public-space-content">
        <div className="public-space-sidebar">
          <div className="public-space-info">
            <h3>{space.name}</h3>
            {space.description && <p className="public-space-description">{space.description}</p>}
            <div className="public-space-stats">
              <span>{space.chats_count} чатов</span>
              <span>{space.notes_count} заметок</span>
            </div>
          </div>

          <div className="public-tabs">
            <button
              className={activeTab === 'chats' ? 'active' : ''}
              onClick={() => setActiveTab('chats')}
            >
              Чаты
            </button>
            <button
              className={activeTab === 'notes' ? 'active' : ''}
              onClick={() => setActiveTab('notes')}
            >
              Заметки
            </button>
            <button
              className={activeTab === 'tags' ? 'active' : ''}
              onClick={() => setActiveTab('tags')}
            >
              Теги
            </button>
          </div>

          {activeTab === 'chats' && (
            <div className="public-chats-list">
              <h4>Чаты</h4>
              {chats.length === 0 ? (
                <p className="no-items">Пока нет чатов</p>
              ) : (
                <ul>
                  {chats.map((chat) => (
                    <li
                      key={chat.id}
                      className={selectedChatId === chat.id ? 'active' : ''}
                      onClick={() => setSelectedChatId(chat.id)}
                    >
                      <div className="chat-title">{chat.title || 'Без названия'}</div>
                      <div className="chat-meta">{chat.messages_count} сообщений</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {activeTab === 'notes' && (
            <div className="public-notes-list">
              <h4>Заметки</h4>
              {notes.length === 0 ? (
                <p className="no-items">Пока нет заметок</p>
              ) : (
                <ul>
                  {notes.map((note) => (
                    <li key={note.id}>
                      <div className="note-title">{note.title}</div>
                      {note.content && (
                        <div className="note-preview">
                          {note.content.length > 100
                            ? note.content.substring(0, 100) + '...'
                            : note.content}
                        </div>
                      )}
                      {note.tags.length > 0 && (
                        <div className="note-tags">
                          {note.tags.map((tag) => (
                            <span
                              key={tag.id}
                              className="tag-badge"
                              style={{ backgroundColor: tag.color || '#6366f1' }}
                            >
                              {tag.name}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="note-meta">
                        {new Date(note.updated_at).toLocaleDateString('ru-RU')}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {activeTab === 'tags' && (
            <div className="public-tags-list">
              <h4>Теги</h4>
              {tags.length === 0 ? (
                <p className="no-items">Пока нет тегов</p>
              ) : (
                <ul>
                  {tags.map((tag) => (
                    <li key={tag.id}>
                      <span
                        className="tag-badge"
                        style={{ backgroundColor: tag.color || '#6366f1' }}
                      >
                        {tag.name}
                      </span>
                      {tag.tag_type && (
                        <span className="tag-type">{tag.tag_type}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="public-space-main">
          {activeTab === 'chats' && (
            selectedChatId ? (
              <>
                <div className="public-messages-container">
                  {messages.map((msg) => (
                    <div key={msg.id} className={`public-message ${msg.role}`}>
                      <div className="message-role">
                        {msg.role === 'user' ? 'Вы' : 'Ассистент'}
                      </div>
                      <div className="message-content">{msg.content}</div>
                      <div className="message-time">
                        {new Date(msg.created_at).toLocaleString('ru-RU')}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="public-message-input">
                  <textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Введите сообщение..."
                    rows={3}
                    disabled={isSending}
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim() || isSending}
                    className="send-button"
                  >
                    {isSending ? 'Отправка...' : 'Отправить'}
                  </button>
                </div>
              </>
            ) : (
              <div className="public-space-welcome">
                <h2>Добро пожаловать в публичное пространство</h2>
                <p>Выберите чат из списка слева или начните новый, отправив сообщение ниже.</p>
                
                <div className="public-message-input">
                  <textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Введите сообщение, чтобы начать новый чат..."
                    rows={3}
                    disabled={isSending}
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim() || isSending}
                    className="send-button"
                  >
                    {isSending ? 'Отправка...' : 'Начать чат'}
                  </button>
                </div>
              </div>
            )
          )}

          {activeTab === 'notes' && (
            <div className="public-notes-view">
              {notes.length === 0 ? (
                <div className="public-empty-state">
                  <h3>Нет заметок</h3>
                  <p>В этом пространстве пока нет заметок</p>
                </div>
              ) : (
                <div className="public-notes-container">
                  {notes.map((note) => (
                    <div key={note.id} className="public-note-card">
                      <h3>{note.title}</h3>
                      {note.content && (
                        <div className="note-content">
                          {note.content.split('\n').map((line, i) => (
                            <p key={i}>{line}</p>
                          ))}
                        </div>
                      )}
                      {note.tags.length > 0 && (
                        <div className="note-tags">
                          {note.tags.map((tag) => (
                            <span
                              key={tag.id}
                              className="tag-badge"
                              style={{ backgroundColor: tag.color || '#6366f1' }}
                            >
                              {tag.name}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="note-meta">
                        Создано: {new Date(note.created_at).toLocaleString('ru-RU')}
                        {note.updated_at !== note.created_at && (
                          <> | Обновлено: {new Date(note.updated_at).toLocaleString('ru-RU')}</>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'tags' && (
            <div className="public-tags-view">
              {tags.length === 0 ? (
                <div className="public-empty-state">
                  <h3>Нет тегов</h3>
                  <p>В этом пространстве пока нет тегов</p>
                </div>
              ) : (
                <div className="public-tags-container">
                  {tags.map((tag) => (
                    <div key={tag.id} className="public-tag-card">
                      <span
                        className="tag-badge large"
                        style={{ backgroundColor: tag.color || '#6366f1' }}
                      >
                        {tag.name}
                      </span>
                      {tag.tag_type && (
                        <div className="tag-type">{tag.tag_type}</div>
                      )}
                      <div className="tag-meta">
                        Создан: {new Date(tag.created_at).toLocaleDateString('ru-RU')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};


