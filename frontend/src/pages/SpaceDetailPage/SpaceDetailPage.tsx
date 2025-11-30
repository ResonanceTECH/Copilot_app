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
  const [showTagModal, setShowTagModal] = useState(false);
  const [editingTag, setEditingTag] = useState<SpaceTag | null>(null);
  const [tagName, setTagName] = useState('');
  const [tagColor, setTagColor] = useState('#6366f1');
  const [tagType, setTagType] = useState('');
  // Состояния для добавления чатов
  const [showAddChatsModal, setShowAddChatsModal] = useState(false);
  const [allChats, setAllChats] = useState<ChatHistoryItem[]>([]);
  const [selectedChatIds, setSelectedChatIds] = useState<Set<number>>(new Set());
  const [isLoadingChats, setIsLoadingChats] = useState(false);
  const [isAddingChats, setIsAddingChats] = useState(false);
  // Состояния для создания заметки
  const [showCreateNoteModal, setShowCreateNoteModal] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');
  const [isCreatingNote, setIsCreatingNote] = useState(false);
  // Состояния для редактирования чата
  const [editingChatId, setEditingChatId] = useState<number | null>(null);
  const [editChatTitle, setEditChatTitle] = useState('');
  const [isUpdatingChat, setIsUpdatingChat] = useState(false);
  // Состояния для редактирования заметки
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [editNoteTitle, setEditNoteTitle] = useState('');
  const [isUpdatingNote, setIsUpdatingNote] = useState(false);

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
    } catch (error: any) {
      console.error('Ошибка загрузки пространства:', error);
      // Ошибка уже обработана в компоненте через проверку !space
      setSpace(null);
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

  const loadAllChats = async () => {
    setIsLoadingChats(true);
    try {
      // Загружаем все чаты без фильтра по пространству
      const allChatsResponse = await chatAPI.getHistory();
      // Загружаем чаты текущего пространства для фильтрации
      const spaceChatsResponse = await chatAPI.getHistory(spaceId);
      const chatsInSpace = new Set(spaceChatsResponse.chats.map(c => c.id));
      // Фильтруем чаты, которые еще не в этом пространстве
      const availableChats = allChatsResponse.chats.filter(chat => !chatsInSpace.has(chat.id));
      setAllChats(availableChats);
    } catch (error) {
      console.error('Ошибка загрузки чатов:', error);
    } finally {
      setIsLoadingChats(false);
    }
  };

  const handleOpenAddChatsModal = async () => {
    setShowAddChatsModal(true);
    setSelectedChatIds(new Set());
    await loadAllChats();
  };

  const handleToggleChatSelection = (chatId: number) => {
    setSelectedChatIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(chatId)) {
        newSet.delete(chatId);
      } else {
        newSet.add(chatId);
      }
      return newSet;
    });
  };

  const handleAddChatsToSpace = async () => {
    if (selectedChatIds.size === 0) return;

    setIsAddingChats(true);
    try {
      const promises = Array.from(selectedChatIds).map(chatId =>
        chatAPI.updateChat(chatId, { space_id: spaceId })
      );
      await Promise.all(promises);
      setShowAddChatsModal(false);
      setSelectedChatIds(new Set());
      loadData(); // Перезагружаем список чатов в пространстве
    } catch (error) {
      console.error('Ошибка добавления чатов:', error);
      alert('Ошибка при добавлении чатов. Попробуйте позже.');
    } finally {
      setIsAddingChats(false);
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
      await loadSpace();
    } catch (error: any) {
      console.error('Ошибка архивирования пространства:', error);
      alert(error.message || 'Ошибка при архивировании пространства. Попробуйте позже.');
    }
  };

  const handleUnarchiveSpace = async () => {
    if (!space) return;
    try {
      await spacesAPI.unarchiveSpace(space.id);
      await loadSpace();
    } catch (error: any) {
      console.error('Ошибка разархивирования пространства:', error);
      alert(error.message || 'Ошибка при разархивировании пространства. Попробуйте позже.');
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

  const handleDeleteChat = async (chatId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Вы уверены, что хотите удалить этот чат из пространства?')) return;

    try {
      await chatAPI.deleteChat(chatId);
      loadData(); // Перезагружаем список чатов
    } catch (error: any) {
      console.error('Ошибка удаления чата:', error);
      alert(error.message || 'Ошибка при удалении чата. Попробуйте позже.');
    }
  };

  const handleStartEditChat = (chat: ChatHistoryItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingChatId(chat.id);
    setEditChatTitle(chat.title || '');
  };

  const handleCancelEditChat = () => {
    setEditingChatId(null);
    setEditChatTitle('');
  };

  const handleSaveChatTitle = async (chatId: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    
    if (!editChatTitle.trim()) {
      alert('Название чата не может быть пустым');
      return;
    }

    setIsUpdatingChat(true);
    try {
      await chatAPI.updateChat(chatId, { title: editChatTitle.trim() });
      setEditingChatId(null);
      setEditChatTitle('');
      loadData(); // Перезагружаем список чатов
    } catch (error: any) {
      console.error('Ошибка обновления чата:', error);
      alert(error.message || 'Ошибка при обновлении названия чата. Попробуйте позже.');
    } finally {
      setIsUpdatingChat(false);
    }
  };

  const handleDeleteNote = async (noteId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Вы уверены, что хотите удалить эту заметку из пространства?')) return;

    try {
      await notesAPI.deleteNote(noteId);
      loadData(); // Перезагружаем список заметок
    } catch (error: any) {
      console.error('Ошибка удаления заметки:', error);
      alert(error.message || 'Ошибка при удалении заметки. Попробуйте позже.');
    }
  };

  const handleStartEditNote = (note: NotePreview, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingNoteId(note.id);
    setEditNoteTitle(note.title);
  };

  const handleCancelEditNote = () => {
    setEditingNoteId(null);
    setEditNoteTitle('');
  };

  const handleSaveNoteTitle = async (noteId: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    
    if (!editNoteTitle.trim()) {
      alert('Название заметки не может быть пустым');
      return;
    }

    setIsUpdatingNote(true);
    try {
      await notesAPI.updateNote(noteId, { title: editNoteTitle.trim() });
      setEditingNoteId(null);
      setEditNoteTitle('');
      loadData(); // Перезагружаем список заметок
    } catch (error: any) {
      console.error('Ошибка обновления заметки:', error);
      alert(error.message || 'Ошибка при обновлении названия заметки. Попробуйте позже.');
    } finally {
      setIsUpdatingNote(false);
    }
  };

  const handleExport = async () => {
    if (!space) return;

    try {
      const { blob, filename } = await spacesAPI.exportSpace(spaceId);

      // Создаем ссылку для скачивания
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;

      // Добавляем ссылку в DOM, кликаем и удаляем
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Освобождаем память
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Ошибка экспорта пространства:', error);
      alert(error.message || 'Ошибка при экспорте пространства. Попробуйте позже.');
    }
  };

  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteTitle.trim()) return;

    setIsCreatingNote(true);
    try {
      await notesAPI.createNote({
        title: newNoteTitle.trim(),
        content: newNoteContent.trim() || undefined,
        space_id: spaceId,
      });

      // Очищаем форму
      setNewNoteTitle('');
      setNewNoteContent('');
      setShowCreateNoteModal(false);

      // Обновляем список заметок
      const response = await notesAPI.getNotes(spaceId);
      setNotes(response.notes);

      // Обновляем информацию о пространстве
      await loadSpace();
    } catch (error: any) {
      console.error('Ошибка создания заметки:', error);
      alert(error.message || 'Ошибка при создании заметки. Попробуйте позже.');
    } finally {
      setIsCreatingNote(false);
    }
  };

  const handleCreateTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tagName.trim()) return;

    try {
      await spacesAPI.createSpaceTag(spaceId, {
        name: tagName.trim(),
        color: tagColor,
        tag_type: tagType || undefined,
      });
      setTagName('');
      setTagColor('#6366f1');
      setTagType('');
      setShowTagModal(false);
      loadData();
    } catch (error) {
      console.error('Ошибка создания тега:', error);
    }
  };

  const handleStartEditTag = (tag: SpaceTag) => {
    setEditingTag(tag);
    setTagName(tag.name);
    setTagColor(tag.color || '#6366f1');
    setTagType(tag.tag_type || '');
    setShowTagModal(true);
  };

  const handleUpdateTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTag || !tagName.trim()) return;

    try {
      await spacesAPI.updateSpaceTag(spaceId, editingTag.id, {
        name: tagName.trim(),
        color: tagColor,
        tag_type: tagType || undefined,
      });
      setEditingTag(null);
      setTagName('');
      setTagColor('#6366f1');
      setTagType('');
      setShowTagModal(false);
      loadData();
    } catch (error) {
      console.error('Ошибка обновления тега:', error);
    }
  };

  const handleDeleteTag = async (tagId: number) => {
    if (!confirm('Вы уверены, что хотите удалить этот тег?')) return;

    try {
      await spacesAPI.deleteSpaceTag(spaceId, tagId);
      loadData();
    } catch (error) {
      console.error('Ошибка удаления тега:', error);
    }
  };

  const handleCancelTagModal = () => {
    setShowTagModal(false);
    setEditingTag(null);
    setTagName('');
    setTagColor('#6366f1');
    setTagType('');
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
        onToolSelect={() => { }}
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
              <div className="space-detail-chats-header">
                <h3>Чаты в пространстве</h3>
                <button
                  className="space-detail-add-chats-btn"
                  onClick={handleOpenAddChatsModal}
                >
                  <Icon src={ICONS.plus} size="sm" />
                  Добавить чаты
                </button>
              </div>
              {chats.length === 0 ? (
                <div className="space-detail-empty">Нет чатов в этом пространстве</div>
              ) : (
                <div className="space-detail-chats-list">
                  {chats.map(chat => (
                    <div
                      key={chat.id}
                      className="space-detail-chat-item"
                      onClick={() => {
                        if (editingChatId !== chat.id) {
                          window.location.href = `/assistant?chat=${chat.id}`;
                        }
                      }}
                    >
                      <div className="space-detail-chat-icon">
                        <Icon src={ICONS.rocket} size="md" />
                      </div>
                      <div className="space-detail-chat-content">
                        {editingChatId === chat.id ? (
                          <input
                            type="text"
                            value={editChatTitle}
                            onChange={(e) => setEditChatTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleSaveChatTitle(chat.id);
                              } else if (e.key === 'Escape') {
                                handleCancelEditChat();
                              }
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="space-detail-chat-title-input"
                            autoFocus
                            disabled={isUpdatingChat}
                          />
                        ) : (
                          <div className="space-detail-chat-title">{chat.title || 'Без названия'}</div>
                        )}
                        <div className="space-detail-chat-preview">{chat.last_message || 'Нет сообщений'}</div>
                        <div className="space-detail-chat-date">
                          {chat.last_message_at ? new Date(chat.last_message_at).toLocaleDateString('ru-RU') : ''}
                        </div>
                      </div>
                      <div className="space-detail-chat-actions">
                        {editingChatId === chat.id ? (
                          <>
                            <button
                              className="space-detail-chat-action-btn"
                              onClick={(e) => handleSaveChatTitle(chat.id, e)}
                              disabled={isUpdatingChat}
                              title="Сохранить"
                            >
                              <Icon src={ICONS.send} size="sm" />
                            </button>
                            <button
                              className="space-detail-chat-action-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCancelEditChat();
                              }}
                              disabled={isUpdatingChat}
                              title="Отмена"
                            >
                              <Icon src={ICONS.close} size="sm" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              className="space-detail-chat-action-btn"
                              onClick={(e) => handleStartEditChat(chat, e)}
                              title="Переименовать чат"
                            >
                              <Icon src={ICONS.edit} size="sm" />
                            </button>
                            <button
                              className="space-detail-chat-action-btn danger"
                              onClick={(e) => handleDeleteChat(chat.id, e)}
                              title="Удалить чат"
                            >
                              <Icon src={ICONS.trash} size="sm" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'notes' && (
            <div className="space-detail-notes">
              <div className="space-detail-notes-header">
                <h3>Заметки в пространстве</h3>
                <button
                  className="space-detail-add-note-btn"
                  onClick={() => setShowCreateNoteModal(true)}
                >
                  <Icon src={ICONS.plus} size="sm" />
                  Добавить заметку
                </button>
              </div>
              {notes.length === 0 ? (
                <div className="space-detail-empty">Нет заметок в этом пространстве</div>
              ) : (
                <div className="space-detail-notes-list">
                  {notes.map(note => (
                    <div
                      key={note.id}
                      className="space-detail-note-item"
                      onClick={async () => {
                        if (editingNoteId !== note.id) {
                          try {
                            const fullNote = await notesAPI.getNote(note.id);
                            // TODO: Открыть модальное окно с заметкой
                            alert(`Заметка: ${fullNote.title}\n\n${fullNote.content}`);
                          } catch (error) {
                            console.error('Ошибка загрузки заметки:', error);
                          }
                        }
                      }}
                    >
                      <div className="space-detail-note-icon">
                        <Icon src={ICONS.note} size="md" />
                      </div>
                      <div className="space-detail-note-content">
                        {editingNoteId === note.id ? (
                          <input
                            type="text"
                            value={editNoteTitle}
                            onChange={(e) => setEditNoteTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleSaveNoteTitle(note.id);
                              } else if (e.key === 'Escape') {
                                handleCancelEditNote();
                              }
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="space-detail-note-title-input"
                            autoFocus
                            disabled={isUpdatingNote}
                          />
                        ) : (
                          <div className="space-detail-note-title">{note.title}</div>
                        )}
                        <div className="space-detail-note-preview">{note.content_preview}</div>
                        <div className="space-detail-note-date">
                          {new Date(note.updated_at).toLocaleDateString('ru-RU')}
                        </div>
                      </div>
                      <div className="space-detail-note-actions">
                        {editingNoteId === note.id ? (
                          <>
                            <button
                              className="space-detail-note-action-btn"
                              onClick={(e) => handleSaveNoteTitle(note.id, e)}
                              disabled={isUpdatingNote}
                              title="Сохранить"
                            >
                              <Icon src={ICONS.send} size="sm" />
                            </button>
                            <button
                              className="space-detail-note-action-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCancelEditNote();
                              }}
                              disabled={isUpdatingNote}
                              title="Отмена"
                            >
                              <Icon src={ICONS.close} size="sm" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              className="space-detail-note-action-btn"
                              onClick={(e) => handleStartEditNote(note, e)}
                              title="Переименовать заметку"
                            >
                              <Icon src={ICONS.edit} size="sm" />
                            </button>
                            <button
                              className="space-detail-note-action-btn danger"
                              onClick={(e) => handleDeleteNote(note.id, e)}
                              title="Удалить заметку"
                            >
                              <Icon src={ICONS.trash} size="sm" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'tags' && (
            <div className="space-detail-tags">
              <div className="space-detail-tags-header">
                <h3>Теги</h3>
                <button
                  className="space-detail-tags-add-btn"
                  onClick={() => {
                    setEditingTag(null);
                    setTagName('');
                    setTagColor('#6366f1');
                    setTagType('');
                    setShowTagModal(true);
                  }}
                >
                  <Icon src={ICONS.plus} size="sm" />
                  Добавить тег
                </button>
              </div>
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
                      <div className="space-detail-tag-actions">
                        <button
                          className="space-detail-tag-action-btn"
                          onClick={() => handleStartEditTag(tag)}
                          title="Редактировать"
                        >
                          <Icon src={ICONS.edit} size="sm" />
                        </button>
                        <button
                          className="space-detail-tag-action-btn danger"
                          onClick={() => handleDeleteTag(tag.id)}
                          title="Удалить"
                        >
                          <Icon src={ICONS.trash} size="sm" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-detail-settings">
              <div className="space-detail-settings-section">
                <h3>Настройки пространства</h3>
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
            </div>
          )}
        </div>
      </div>

      {showTagModal && (
        <div className="space-detail-tag-modal-overlay" onClick={handleCancelTagModal}>
          <div className="space-detail-tag-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editingTag ? 'Редактировать тег' : 'Создать тег'}</h3>
            <form onSubmit={editingTag ? handleUpdateTag : handleCreateTag}>
              <div className="space-detail-tag-modal-field">
                <label>Название тега</label>
                <input
                  type="text"
                  value={tagName}
                  onChange={(e) => setTagName(e.target.value)}
                  placeholder="Введите название тега"
                  required
                  autoFocus
                />
              </div>
              <div className="space-detail-tag-modal-field">
                <label>Цвет</label>
                <div className="space-detail-tag-color-input">
                  <input
                    type="color"
                    value={tagColor}
                    onChange={(e) => setTagColor(e.target.value)}
                  />
                  <input
                    type="text"
                    value={tagColor}
                    onChange={(e) => setTagColor(e.target.value)}
                    placeholder="#6366f1"
                    pattern="^#[0-9A-Fa-f]{6}$"
                  />
                </div>
              </div>
              <div className="space-detail-tag-modal-field">
                <label>Тип тега (необязательно)</label>
                <input
                  type="text"
                  value={tagType}
                  onChange={(e) => setTagType(e.target.value)}
                  placeholder="Например: urgent, important"
                />
              </div>
              <div className="space-detail-tag-modal-actions">
                <button type="button" onClick={handleCancelTagModal}>
                  Отмена
                </button>
                <button type="submit">
                  {editingTag ? 'Сохранить' : 'Создать'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAddChatsModal && (
        <div
          className="space-detail-add-chats-modal-overlay"
          onClick={() => setShowAddChatsModal(false)}
        >
          <div className="space-detail-add-chats-modal" onClick={(e) => e.stopPropagation()}>
            <div className="space-detail-add-chats-modal-header">
              <h3>Добавить чаты в пространство</h3>
              <div className="space-detail-add-chats-modal-header-actions">
                <button
                  className="space-detail-add-chats-cancel-btn"
                  onClick={() => setShowAddChatsModal(false)}
                >
                  Отмена
                </button>
                <button
                  className="space-detail-add-chats-add-btn"
                  onClick={handleAddChatsToSpace}
                  disabled={selectedChatIds.size === 0 || isAddingChats}
                >
                  {isAddingChats ? 'Добавление...' : `Добавить (${selectedChatIds.size})`}
                </button>
                <button
                  className="space-detail-add-chats-modal-close"
                  onClick={() => setShowAddChatsModal(false)}
                  title="Закрыть"
                >
                  <Icon src={ICONS.close} size="md" />
                </button>
              </div>
            </div>
            <div className="space-detail-add-chats-modal-content">
              {isLoadingChats ? (
                <div className="space-detail-add-chats-loading">Загрузка чатов...</div>
              ) : allChats.length === 0 ? (
                <div className="space-detail-add-chats-empty">
                  Нет доступных чатов для добавления
                </div>
              ) : (
                <>
                  <div className="space-detail-add-chats-list">
                    {allChats.map(chat => (
                      <div
                        key={chat.id}
                        className={`space-detail-add-chat-item ${selectedChatIds.has(chat.id) ? 'selected' : ''}`}
                        onClick={() => handleToggleChatSelection(chat.id)}
                      >
                        <div className="space-detail-add-chat-checkbox">
                          <input
                            type="checkbox"
                            checked={selectedChatIds.has(chat.id)}
                            onChange={() => handleToggleChatSelection(chat.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                        <div className="space-detail-add-chat-icon">
                          <Icon src={ICONS.rocket} size="md" />
                        </div>
                        <div className="space-detail-add-chat-content">
                          <div className="space-detail-add-chat-title">{chat.title || 'Без названия'}</div>
                          <div className="space-detail-add-chat-preview">{chat.last_message || 'Нет сообщений'}</div>
                          {chat.space_name && (
                            <div className="space-detail-add-chat-space">
                              Текущее пространство: {chat.space_name}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {showCreateNoteModal && (
        <div
          className="space-detail-create-note-modal-overlay"
          onClick={() => setShowCreateNoteModal(false)}
        >
          <div className="space-detail-create-note-modal" onClick={(e) => e.stopPropagation()}>
            <div className="space-detail-create-note-modal-header">
              <h3>Создать заметку</h3>
              <button
                className="space-detail-create-note-modal-close"
                onClick={() => setShowCreateNoteModal(false)}
                title="Закрыть"
              >
                <Icon src={ICONS.close} size="md" />
              </button>
            </div>
            <form onSubmit={handleCreateNote} className="space-detail-create-note-modal-content">
              <div className="space-detail-create-note-field">
                <label>Название заметки *</label>
                <input
                  type="text"
                  value={newNoteTitle}
                  onChange={(e) => setNewNoteTitle(e.target.value)}
                  placeholder="Введите название заметки"
                  required
                  autoFocus
                />
              </div>
              <div className="space-detail-create-note-field">
                <label>Содержимое (необязательно)</label>
                <textarea
                  value={newNoteContent}
                  onChange={(e) => setNewNoteContent(e.target.value)}
                  placeholder="Введите содержимое заметки"
                  rows={8}
                />
              </div>
              <div className="space-detail-create-note-modal-actions">
                <button
                  type="button"
                  className="space-detail-create-note-cancel-btn"
                  onClick={() => {
                    setShowCreateNoteModal(false);
                    setNewNoteTitle('');
                    setNewNoteContent('');
                  }}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="space-detail-create-note-submit-btn"
                  disabled={!newNoteTitle.trim() || isCreatingNote}
                >
                  {isCreatingNote ? 'Создание...' : 'Создать'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

