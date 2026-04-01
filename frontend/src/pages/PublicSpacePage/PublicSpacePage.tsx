import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Header } from '../../components/common/Header';
import { Icon } from '../../components/ui/Icon';
import { ICONS } from '../../utils/icons';
import type { SpaceAttachmentItem } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import { getTranslation } from '../../utils/i18n';
import './PublicSpacePage.css';

// Анимация "печатается..." (в стиле обычных чатов)
const TypingAnimation: React.FC<{ text: string }> = ({ text }) => {
  const [dots, setDots] = useState('');

  useEffect(() => {
    const interval = window.setInterval(() => {
      setDots(prev => {
        if (prev === '') return '.';
        if (prev === '.') return '..';
        if (prev === '..') return '...';
        return '';
      });
    }, 500);

    return () => window.clearInterval(interval);
  }, []);

  return <span>{text}{dots}</span>;
};

const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes)) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  const precision = i === 0 ? 0 : i === 1 ? 0 : 1;
  return `${v.toFixed(precision)} ${units[i]}`;
};

const isImageAttachment = (f: SpaceAttachmentItem): boolean => {
  if (f.mime_type?.startsWith('image/')) return true;
  if (f.file_type === 'image') return true;
  const name = (f.filename || '').toLowerCase();
  return ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'].some((ext) => name.endsWith(ext));
};

const messageBodyUsesRichHtml = (role: string, content: string, isLoading?: boolean): boolean => {
  if (role === 'assistant' && !isLoading) {
    return (
      content.includes('<div') ||
      content.includes('<img') ||
      content.includes('<p') ||
      content.includes('<a ') ||
      content.includes('<table') ||
      content.includes('<figure')
    );
  }
  if (role === 'user') {
    return (
      content.includes('<img') ||
      content.includes('<div class="uploaded-file') ||
      (content.includes('<div') && content.includes('</div>'))
    );
  }
  return false;
};

function splitUserMessageForEdit(content: string): { prefix: string; suffix: string } {
  const markers = ['<div class="message-file-card"', '<div class="uploaded-file'];
  let cut = -1;
  for (const m of markers) {
    const i = content.indexOf(m);
    if (i !== -1 && (cut === -1 || i < cut)) cut = i;
  }
  if (cut === -1) return { prefix: content, suffix: '' };
  return { prefix: content.slice(0, cut).trimEnd(), suffix: content.slice(cut) };
}

interface PublicSpacePageProps {
  publicToken: string;
}

interface PublicSpace {
  id: number;
  name: string;
  description: string | null;
  chats_count: number;
  notes_count: number;
  files_count: number;
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
  // Временное поле для оптимистичного UI (не приходит с сервера)
  isLoading?: boolean;
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
  const { language } = useLanguage();
  const [space, setSpace] = useState<PublicSpace | null>(null);
  const [activeTab, setActiveTab] = useState<'chats' | 'notes' | 'tags' | 'files'>('chats');
  const [chats, setChats] = useState<PublicChat[]>([]);
  const [notes, setNotes] = useState<PublicNote[]>([]);
  const [tags, setTags] = useState<PublicTag[]>([]);
  const [spaceFiles, setSpaceFiles] = useState<SpaceAttachmentItem[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<number | null>(null);
  const [messages, setMessages] = useState<PublicMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [editSuffix, setEditSuffix] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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
    } else if (activeTab === 'files') {
      loadSpaceFiles();
    }
  }, [activeTab, publicToken]);

  useEffect(() => {
    if (selectedChatId && activeTab === 'chats') {
      loadMessages(selectedChatId);
    }
  }, [selectedChatId, publicToken, activeTab]);

  useEffect(() => {
    setEditingMessageId(null);
    setEditDraft('');
    setEditSuffix('');
    setSavingEdit(false);
  }, [selectedChatId, publicToken]);

  const loadSpace = async () => {
    try {
      const response = await fetch(`/api/public/spaces/${publicToken}`);
      if (!response.ok) {
        throw new Error('Пространство не найдено');
      }
      const data = await response.json();
      setSpace({
        ...data,
        files_count: typeof data.files_count === 'number' ? data.files_count : 0,
      });
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

  const loadSpaceFiles = async () => {
    try {
      const response = await fetch(`/api/public/spaces/${publicToken}/files?limit=200&offset=0`);
      if (!response.ok) {
        throw new Error('Ошибка загрузки файлов');
      }
      const data = await response.json();
      setSpaceFiles(data.files || []);
    } catch (err: any) {
      console.error('Ошибка загрузки файлов:', err);
      setSpaceFiles([]);
    }
  };

  const cancelPublicEdit = () => {
    setEditingMessageId(null);
    setEditDraft('');
    setEditSuffix('');
    setSavingEdit(false);
  };

  const startPublicEdit = (msg: PublicMessage) => {
    const { prefix, suffix } = splitUserMessageForEdit(msg.content);
    setEditingMessageId(msg.id);
    setEditDraft(prefix);
    setEditSuffix(suffix);
  };

  const savePublicEdit = async () => {
    if (!selectedChatId || editingMessageId == null) return;
    const full = editDraft.trimEnd() + editSuffix;
    if (!full.trim()) return;
    setSavingEdit(true);
    try {
      const response = await fetch(
        `/api/public/spaces/${publicToken}/chats/${selectedChatId}/messages/${editingMessageId}/regenerate`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: full }),
        },
      );
      let data: Record<string, unknown> = {};
      try {
        data = (await response.json()) as Record<string, unknown>;
      } catch {
        /* empty */
      }
      if (!response.ok) {
        const detail = data.detail;
        const errMsg =
          typeof detail === 'string'
            ? detail
            : Array.isArray(detail) && detail[0] && typeof (detail[0] as { msg?: string }).msg === 'string'
              ? (detail[0] as { msg: string }).msg
              : typeof data.error === 'string'
                ? data.error
                : 'Ошибка сохранения';
        throw new Error(errMsg);
      }
      if (data.success === false) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Ошибка сохранения');
      }
      cancelPublicEdit();
      await loadMessages(selectedChatId);
      setTimeout(() => {
        const messagesContainer = document.querySelector('.public-messages-container');
        if (messagesContainer) {
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
      }, 100);
    } catch (e: unknown) {
      setSavingEdit(false);
      alert(e instanceof Error ? e.message : 'Ошибка');
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || isSending) return;
    if (!selectedChatId) {
      alert('Нужно выбрать существующий чат слева. Создание нового чата недоступно.');
      return;
    }

    const outgoingText = newMessage.trim();
    const tempUserId = -1 * Date.now();
    const tempAssistantId = -2 * Date.now();

    // Оптимистично рисуем сообщение пользователя сразу
    setMessages((prev) => [
      ...prev,
      {
        id: tempUserId,
        role: 'user',
        content: outgoingText,
        created_at: new Date().toISOString(),
      } as PublicMessage,
      {
        id: tempAssistantId,
        role: 'assistant',
        content: 'Поиск и формирование ответа',
        created_at: new Date().toISOString(),
        isLoading: true,
      } as PublicMessage,
    ]);
    // Очищаем поле ввода сразу после отправки
    setNewMessage('');

    setIsSending(true);
    try {
      const response = await fetch(`/api/public/spaces/${publicToken}/chat/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: outgoingText,
          chat_id: selectedChatId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Ошибка отправки сообщения');
      }

      const data = await response.json();

      if (data.success) {
        setNewMessage('');

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
      // Убираем оптимистичные сообщения при ошибке
      setMessages((prev) => prev.filter((m) => m.id !== tempUserId && m.id !== tempAssistantId));
      alert(err.message || 'Ошибка при отправке сообщения');
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Автоматическое изменение размера textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 200)}px`;
    }
  }, [newMessage]);

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
        onToolSelect={() => { }}
      />

      <div className="public-space-content">
        <div className="public-space-sidebar">
          <div className="public-space-info">
            <h3>{space.name}</h3>
            {space.description && <p className="public-space-description">{space.description}</p>}
            <div className="public-space-stats">
              <div className="public-space-stat-item">
                <span className="public-space-stat-number">{space.chats_count}</span>
                <span className="public-space-stat-label">чатов</span>
              </div>
              <div className="public-space-stat-item">
                <span className="public-space-stat-number">{space.notes_count}</span>
                <span className="public-space-stat-label">заметок</span>
              </div>
              <div className="public-space-stat-item">
                <span className="public-space-stat-number">{space.files_count ?? 0}</span>
                <span className="public-space-stat-label">файлов</span>
              </div>
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
            <button
              className={activeTab === 'files' ? 'active' : ''}
              onClick={() => setActiveTab('files')}
            >
              Файлы
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

          {activeTab === 'files' && (
            <div className="public-files-list">
              <h4>Файлы</h4>
              {spaceFiles.length === 0 ? (
                <p className="no-items">Пока нет файлов</p>
              ) : (
                <ul>
                  {spaceFiles.map((f) => {
                    const url = `/${f.file_path}`;
                    return (
                      <li key={f.id}>
                        <a href={url} target="_blank" rel="noreferrer" className="public-file-sidebar-link">
                          <div className="public-file-sidebar-name">{f.filename}</div>
                          <div className="public-file-sidebar-meta">
                            {formatBytes(f.file_size)}
                            {f.chat_title ? ` · ${f.chat_title}` : ''}
                          </div>
                        </a>
                      </li>
                    );
                  })}
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
                  {messages.map((msg) => {
                    const rich = messageBodyUsesRichHtml(msg.role, msg.content, msg.isLoading);
                    const isEditing = msg.role === 'user' && editingMessageId === msg.id;
                    return (
                      <div key={msg.id} className={`public-message ${msg.role}`}>
                        <div
                          className={
                            rich && !isEditing
                              ? 'public-message-content public-message-content--rich'
                              : 'public-message-content'
                          }
                        >
                          {msg.role === 'assistant' ? (
                            msg.isLoading ? (
                              <TypingAnimation text={msg.content} />
                            ) : rich ? (
                              <div dangerouslySetInnerHTML={{ __html: msg.content }} />
                            ) : (
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                            )
                          ) : isEditing ? (
                            <div className="public-message-user-edit">
                              <textarea
                                className="public-message-user-edit-input"
                                value={editDraft}
                                onChange={(e) => setEditDraft(e.target.value)}
                                rows={4}
                                disabled={savingEdit}
                                aria-label={getTranslation('editUserMessage', language)}
                              />
                              {editSuffix ? (
                                <div className="public-message-user-edit-hint">
                                  {getTranslation('editKeepAttachmentsHint', language)}
                                </div>
                              ) : null}
                              <div className="public-message-user-edit-actions">
                                <button
                                  type="button"
                                  className="public-message-user-edit-submit"
                                  onClick={() => void savePublicEdit()}
                                  disabled={
                                    savingEdit || !(editDraft.trimEnd() + editSuffix).trim()
                                  }
                                >
                                  {savingEdit
                                    ? getTranslation('saving', language)
                                    : getTranslation('editRegenerateSubmit', language)}
                                </button>
                                <button
                                  type="button"
                                  className="public-message-user-edit-cancel"
                                  onClick={cancelPublicEdit}
                                  disabled={savingEdit}
                                >
                                  {getTranslation('cancel', language)}
                                </button>
                              </div>
                            </div>
                          ) : (
                            (() => {
                              let cleanedContent = msg.content;
                              const fileCardRegex =
                                /<div class="message-file-card"[^>]*>[\s\S]*?<div class="message-file-icon">([^<]+)<\/div>[\s\S]*?<div class="message-file-name">([^<]+)<\/div>[\s\S]*?<\/div>/g;
                              const matches: string[] = [];
                              let match: RegExpExecArray | null;
                              while ((match = fileCardRegex.exec(msg.content)) !== null) {
                                matches.push(match[0]);
                              }
                              matches.forEach((cardHtml) => {
                                cleanedContent = cleanedContent.replace(cardHtml, '');
                              });
                              cleanedContent = cleanedContent.trim();
                              const hideAttachmentLine =
                                cleanedContent.toLowerCase().includes('прикреплен') ||
                                !!cleanedContent.match(/[📎🖼️📄📝]\s+.*прикреплен/i);
                              const hasHtml =
                                cleanedContent.includes('<img') ||
                                cleanedContent.includes('<div class="uploaded-file') ||
                                cleanedContent.includes('<div');
                              return (
                                <>
                                  {cleanedContent && !hideAttachmentLine && (
                                    <div>
                                      {hasHtml ? (
                                        <div dangerouslySetInnerHTML={{ __html: cleanedContent }} />
                                      ) : (
                                        cleanedContent
                                      )}
                                    </div>
                                  )}
                                </>
                              );
                            })()
                          )}
                          {msg.created_at && !isEditing && (
                            <div className="public-message-timestamp">
                              {new Date(msg.created_at).toLocaleTimeString('ru-RU', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                          )}
                          {msg.role === 'user' &&
                            msg.id > 0 &&
                            !msg.isLoading &&
                            !isEditing && (
                              <div className="public-message-user-actions">
                                <button
                                  type="button"
                                  className="public-message-edit-btn"
                                  onClick={() => startPublicEdit(msg)}
                                  title={getTranslation('editUserMessage', language)}
                                  aria-label={getTranslation('editUserMessage', language)}
                                >
                                  <Icon src={ICONS.edit} size="sm" />
                                </button>
                              </div>
                            )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="chat-input-section">
                  <div className="chat-input-wrapper">
                    <div className="chat-input-container">
                      <textarea
                        ref={inputRef}
                        className="chat-input"
                        placeholder="Введите сообщение..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={handleKeyDown}
                        rows={1}
                        disabled={isSending}
                      />
                      <div className="chat-input-actions">
                        <button className="chat-input-icon-btn" type="button">
                          <Icon src={ICONS.paperclip} size="md" />
                        </button>
                        <button className="chat-input-icon-btn" type="button">
                          <Icon src={ICONS.microphone} size="md" />
                        </button>
                        <button
                          className="chat-input-icon-btn chat-input-send-btn"
                          type="button"
                          onClick={handleSendMessage}
                          disabled={!newMessage.trim() || isSending}
                        >
                          <Icon src={ICONS.send} size="md" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="public-space-welcome">
                <h2>Добро пожаловать в публичное пространство</h2>
                <p>Выберите существующий чат из списка слева. Создание новых чатов недоступно.</p>
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

          {activeTab === 'files' && (
            <div className="public-files-view">
              {spaceFiles.length === 0 ? (
                <div className="public-empty-state">
                  <h3>Нет файлов</h3>
                  <p>В этом пространстве пока нет прикреплённых файлов</p>
                </div>
              ) : (
                <div className="public-files-container">
                  {spaceFiles.map((f) => {
                    const url = `/${f.file_path}`;
                    const img = isImageAttachment(f);
                    return (
                      <div key={f.id} className="public-file-card">
                        <div className="public-file-card-preview">
                          {img ? (
                            <a href={url} target="_blank" rel="noreferrer">
                              <img src={url} alt="" />
                            </a>
                          ) : (
                            <a href={url} target="_blank" rel="noreferrer" className="public-file-doc-link">
                              <Icon src={ICONS.paperclip} size="md" />
                              <span>Открыть</span>
                            </a>
                          )}
                        </div>
                        <div className="public-file-card-meta">
                          <a href={url} target="_blank" rel="noreferrer" className="public-file-card-name">
                            {f.filename}
                          </a>
                          <div className="public-file-card-sub">
                            {formatBytes(f.file_size)}
                            {f.chat_title ? ` · ${f.chat_title}` : ''}
                            {' · '}
                            {new Date(f.created_at).toLocaleString('ru-RU')}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};


