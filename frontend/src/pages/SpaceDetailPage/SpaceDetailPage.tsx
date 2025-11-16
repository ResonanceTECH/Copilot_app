import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { spacesAPI, chatAPI, notesAPI, type ChatHistoryItem } from '../../utils/api';
import type { Space, NotePreview, SpaceTag } from '../../types';
import { Header } from '../../components/common/Header';
import { Icon } from '../../components/ui/Icon';
import { ICONS } from '../../utils/icons';
import './SpaceDetailPage.css';

interface SpaceDetailPageProps {
  spaceId: number;
}

export const SpaceDetailPage: React.FC<SpaceDetailPageProps> = ({ spaceId }) => {
  const { isAuthenticated } = useAuth();
  const [space, setSpace] = useState<Space | null>(null);
  const [activeTab, setActiveTab] = useState<'chats' | 'notes' | 'tags' | 'settings'>('chats');
  const [isLoading, setIsLoading] = useState(false);
  const [chats, setChats] = useState<ChatHistoryItem[]>([]);
  const [notes, setNotes] = useState<NotePreview[]>([]);
  const [tags, setTags] = useState<SpaceTag[]>([]);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');

  useEffect(() => {
    if (isAuthenticated) {
      loadSpace();
      loadData();
    }
  }, [isAuthenticated, spaceId, activeTab]);

  const loadSpace = async () => {
    setIsLoading(true);
    try {
      const spaceData = await spacesAPI.getSpace(spaceId);
      setSpace(spaceData);
      setEditName(spaceData.name);
      setEditDescription(spaceData.description || '');
    } catch (error) {
      console.error('Ошибка загрузки пространства:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadData = async () => {
    try {
      if (activeTab === 'chats') {
        const response = await chatAPI.getHistory(spaceId);
        setChats(response.chats);
      } else if (activeTab === 'notes') {
        const response = await notesAPI.getNotes(spaceId);
        setNotes(response.notes);
      } else if (activeTab === 'tags') {
        const tagsData = await spacesAPI.getSpaceTags(spaceId);
        setTags(tagsData);
      }
    } catch (error) {
      console.error('Ошибка загрузки данных:', error);
    }
  };

  const handleUpdateSpace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!space || !editName.trim()) return;

    try {
      await spacesAPI.updateSpace(space.id, {
        name: editName,
        description: editDescription || undefined,
      });
      loadSpace();
    } catch (error) {
      console.error('Ошибка обновления пространства:', error);
    }
  };

  const handleArchiveSpace = async () => {
    if (!space) return;
    try {
      await spacesAPI.archiveSpace(space.id);
      loadSpace();
    } catch (error) {
      console.error('Ошибка архивирования пространства:', error);
    }
  };

  const handleUnarchiveSpace = async () => {
    if (!space) return;
    try {
      await spacesAPI.unarchiveSpace(space.id);
      loadSpace();
    } catch (error) {
      console.error('Ошибка разархивирования пространства:', error);
    }
  };

  const handleDeleteSpace = async () => {
    if (!space) return;
    if (!confirm('Вы уверены, что хотите удалить это пространство?')) return;

    try {
      await spacesAPI.deleteSpace(space.id);
      window.location.href = '/spaces';
    } catch (error) {
      console.error('Ошибка удаления пространства:', error);
    }
  };

  const handleExport = () => {
    // TODO: Реализовать экспорт данных пространства
    alert('Экспорт будет реализован позже');
  };

  if (!isAuthenticated) {
    return <div>Пожалуйста, войдите в систему</div>;
  }

  if (isLoading && !space) {
    return <div className="space-detail-loading">Загрузка...</div>;
  }

  if (!space) {
    return <div className="space-detail-error">Пространство не найдено</div>;
  }

  return (
    <div className="space-detail-page">
      <Header 
        title={space.name}
        activeTool="assistant"
        onToolSelect={() => {}}
      />
      <div className="space-detail-content">
        <div className="space-detail-header">
          <button
            className="space-detail-back-btn"
            onClick={() => {
              window.location.href = '/spaces';
            }}
          >
            <Icon src={ICONS.arrowLeft} size="sm" />
            Назад к пространствам
          </button>
          <div className="space-detail-header-main">
            <div>
              <h1>{space.name}</h1>
              <p className="space-detail-description">
                {space.description || 'Описание отсутствует'}
              </p>
            </div>
            <div className="space-detail-header-actions">
              <button
                className="space-detail-action-btn"
                onClick={handleExport}
                title="Экспорт"
              >
                <Icon src={ICONS.paperclip} size="sm" />
                Экспорт
              </button>
              {space.is_archived ? (
                <button
                  className="space-detail-action-btn"
                  onClick={handleUnarchiveSpace}
                  title="Разархивировать"
                >
                  <Icon src={ICONS.archive} size="sm" />
                  Разархивировать
                </button>
              ) : (
                <button
                  className="space-detail-action-btn"
                  onClick={handleArchiveSpace}
                  title="Архивировать"
                >
                  <Icon src={ICONS.archive} size="sm" />
                  Архивировать
                </button>
              )}
              <button
                className="space-detail-action-btn danger"
                onClick={handleDeleteSpace}
                title="Удалить"
              >
                <Icon src={ICONS.trash} size="sm" />
                Удалить
              </button>
            </div>
          </div>
        </div>

        <div className="space-detail-tabs">
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
            className={activeTab === 'settings' ? 'active' : ''}
            onClick={() => setActiveTab('settings')}
          >
            Настройки
          </button>
        </div>

        <div className="space-detail-tab-content">
          {activeTab === 'chats' && (
            <div className="space-detail-chats">
              {chats.length === 0 ? (
                <div className="space-detail-empty">Нет чатов в этом пространстве</div>
              ) : (
                <div className="space-detail-chats-list">
                  {chats.map(chat => (
                    <div
                      key={chat.id}
                      className="space-detail-chat-item"
                      onClick={() => {
                        window.location.href = `/assistant?chat=${chat.id}`;
                      }}
                    >
                      <div className="space-detail-chat-icon">
                        <Icon src={ICONS.rocket} size="md" />
                      </div>
                      <div className="space-detail-chat-content">
                        <div className="space-detail-chat-title">{chat.title || 'Без названия'}</div>
                        <div className="space-detail-chat-preview">{chat.last_message || 'Нет сообщений'}</div>
                        <div className="space-detail-chat-date">
                          {chat.last_message_at ? new Date(chat.last_message_at).toLocaleDateString('ru-RU') : ''}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'notes' && (
            <div className="space-detail-notes">
              {notes.length === 0 ? (
                <div className="space-detail-empty">Нет заметок в этом пространстве</div>
              ) : (
                <div className="space-detail-notes-list">
                  {notes.map(note => (
                    <div
                      key={note.id}
                      className="space-detail-note-item"
                      onClick={async () => {
                        try {
                          const fullNote = await notesAPI.getNote(note.id);
                          // TODO: Открыть модальное окно с заметкой
                          alert(`Заметка: ${fullNote.title}\n\n${fullNote.content}`);
                        } catch (error) {
                          console.error('Ошибка загрузки заметки:', error);
                        }
                      }}
                    >
                      <div className="space-detail-note-icon">
                        <Icon src={ICONS.note} size="md" />
                      </div>
                      <div className="space-detail-note-content">
                        <div className="space-detail-note-title">{note.title}</div>
                        <div className="space-detail-note-preview">{note.content_preview}</div>
                        <div className="space-detail-note-date">
                          {new Date(note.updated_at).toLocaleDateString('ru-RU')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'tags' && (
            <div className="space-detail-tags">
              {tags.length === 0 ? (
                <div className="space-detail-empty">Нет тегов в этом пространстве</div>
              ) : (
                <div className="space-detail-tags-list">
                  {tags.map(tag => (
                    <div key={tag.id} className="space-detail-tag-item">
                      <span
                        className="space-detail-tag-badge"
                        style={{ backgroundColor: tag.color || '#6366f1' }}
                      >
                        {tag.name}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-detail-settings">
              <form onSubmit={handleUpdateSpace}>
                <div className="space-detail-settings-field">
                  <label>Название пространства</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-detail-settings-field">
                  <label>Описание</label>
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    rows={4}
                  />
                </div>
                <div className="space-detail-settings-actions">
                  <button type="submit" className="space-detail-settings-save-btn">
                    Сохранить изменения
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

