import React, { useState, useEffect, useRef } from 'react';
import { Icon } from '../../ui/Icon';
import { ICONS } from '../../../utils/icons';
import { notesAPI } from '../../../utils/api';
import type { NotePreview, Note, NoteCreateRequest } from '../../../types';
import './NotesPanel.css';

interface NotesPanelProps {
  spaceId?: number;
  onClose?: () => void;
}

export const NotesPanel: React.FC<NotesPanelProps> = ({ spaceId, onClose }) => {
  const [notes, setNotes] = useState<NotePreview[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);

  // Загрузка заметок
  const loadNotes = async () => {
    setIsLoading(true);
    try {
      const response = await notesAPI.getNotes(spaceId, 50, 0);
      setNotes(response.notes);
    } catch (error) {
      console.error('Ошибка загрузки заметок:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadNotes();
  }, [spaceId]);

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

  // Загрузка полной заметки
  const handleNoteClick = async (noteId: number) => {
    try {
      const note = await notesAPI.getNote(noteId);
      setSelectedNote(note);
      setEditingNote(null);
    } catch (error) {
      console.error('Ошибка загрузки заметки:', error);
    }
  };

  // Создание заметки
  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteTitle.trim()) return;

    try {
      const data: NoteCreateRequest = {
        title: newNoteTitle.trim(),
        content: newNoteContent.trim() || undefined,
        space_id: spaceId,
      };
      await notesAPI.createNote(data);
      setNewNoteTitle('');
      setNewNoteContent('');
      setShowCreateModal(false);
      loadNotes();
    } catch (error) {
      console.error('Ошибка создания заметки:', error);
    }
  };

  // Начало редактирования
  const handleStartEdit = () => {
    if (selectedNote) {
      setEditingNote(selectedNote);
      setEditTitle(selectedNote.title);
      setEditContent(selectedNote.content);
    }
  };

  // Сохранение изменений
  const handleSaveEdit = async () => {
    if (!editingNote || !editTitle.trim()) return;

    try {
      await notesAPI.updateNote(editingNote.id, {
        title: editTitle.trim(),
        content: editContent.trim() || undefined,
      });
      setEditingNote(null);
      loadNotes();
      if (selectedNote) {
        const updated = await notesAPI.getNote(selectedNote.id);
        setSelectedNote(updated);
      }
    } catch (error) {
      console.error('Ошибка обновления заметки:', error);
    }
  };

  // Удаление заметки
  const handleDeleteNote = async (noteId: number) => {
    if (!confirm('Вы уверены, что хотите удалить эту заметку?')) return;

    try {
      await notesAPI.deleteNote(noteId);
      if (selectedNote?.id === noteId) {
        setSelectedNote(null);
      }
      loadNotes();
    } catch (error) {
      console.error('Ошибка удаления заметки:', error);
    }
  };

  return (
    <div className="notes-panel" ref={panelRef}>
      <div className="notes-panel-header">
        <h3 className="notes-panel-title">Заметки</h3>
        <div className="notes-panel-actions">
          <button
            className="notes-panel-btn"
            onClick={() => setShowCreateModal(true)}
            title="Создать заметку"
          >
            <Icon src={ICONS.plus} size="sm" />
          </button>
          {onClose && (
            <button
              className="notes-panel-btn"
              onClick={onClose}
              title="Закрыть"
            >
              <Icon src={ICONS.arrowLeft} size="sm" />
            </button>
          )}
        </div>
      </div>

      <div className="notes-panel-content">
        {selectedNote ? (
          <div className="notes-panel-detail">
            <div className="notes-panel-detail-header">
              <button
                className="notes-panel-back-btn"
                onClick={() => {
                  setSelectedNote(null);
                  setEditingNote(null);
                }}
              >
                <Icon src={ICONS.arrowLeft} size="sm" />
              </button>
              <div className="notes-panel-detail-actions">
                {!editingNote && (
                  <>
                    <button
                      className="notes-panel-action-btn"
                      onClick={handleStartEdit}
                      title="Редактировать"
                    >
                      <Icon src={ICONS.edit} size="sm" />
                    </button>
                    <button
                      className="notes-panel-action-btn"
                      onClick={() => handleDeleteNote(selectedNote.id)}
                      title="Удалить"
                    >
                      <Icon src={ICONS.trash} size="sm" />
                    </button>
                  </>
                )}
              </div>
            </div>
            {editingNote ? (
              <div className="notes-panel-edit">
                <input
                  type="text"
                  className="notes-panel-edit-title"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Название заметки"
                />
                <textarea
                  className="notes-panel-edit-content"
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  placeholder="Содержимое заметки"
                  rows={10}
                />
                <div className="notes-panel-edit-actions">
                  <button
                    className="notes-panel-save-btn"
                    onClick={handleSaveEdit}
                  >
                    Сохранить
                  </button>
                  <button
                    className="notes-panel-cancel-btn"
                    onClick={() => {
                      setEditingNote(null);
                      setEditTitle('');
                      setEditContent('');
                    }}
                  >
                    Отмена
                  </button>
                </div>
              </div>
            ) : (
              <div className="notes-panel-detail-content">
                <h2 className="notes-panel-detail-title">{selectedNote.title}</h2>
                <div className="notes-panel-detail-meta">
                  <span>{selectedNote.space_name}</span>
                  <span>{new Date(selectedNote.updated_at).toLocaleDateString('ru-RU')}</span>
                </div>
                <div className="notes-panel-detail-text">
                  {selectedNote.content || <em>Нет содержимого</em>}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="notes-panel-list">
            {isLoading ? (
              <div className="notes-panel-loading">Загрузка...</div>
            ) : notes.length === 0 ? (
              <div className="notes-panel-empty">
                <Icon src={ICONS.note} size="lg" />
                <p>Нет заметок</p>
                <button
                  className="notes-panel-create-btn"
                  onClick={() => setShowCreateModal(true)}
                >
                  Создать заметку
                </button>
              </div>
            ) : (
              notes.map((note) => (
                <div
                  key={note.id}
                  className="notes-panel-item"
                  onClick={() => handleNoteClick(note.id)}
                >
                  <div className="notes-panel-item-icon">
                    <Icon src={ICONS.note} size="md" />
                  </div>
                  <div className="notes-panel-item-content">
                    <div className="notes-panel-item-title">{note.title}</div>
                    <div className="notes-panel-item-preview">{note.content_preview}</div>
                    <div className="notes-panel-item-meta">
                      <span>{note.space_name}</span>
                      <span>{new Date(note.updated_at).toLocaleDateString('ru-RU')}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="notes-panel-modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="notes-panel-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Создать заметку</h3>
            <form onSubmit={handleCreateNote}>
              <input
                type="text"
                className="notes-panel-modal-input"
                placeholder="Название заметки"
                value={newNoteTitle}
                onChange={(e) => setNewNoteTitle(e.target.value)}
                required
                autoFocus
              />
              <textarea
                className="notes-panel-modal-textarea"
                placeholder="Содержимое заметки (необязательно)"
                value={newNoteContent}
                onChange={(e) => setNewNoteContent(e.target.value)}
                rows={6}
              />
              <div className="notes-panel-modal-actions">
                <button
                  type="button"
                  className="notes-panel-modal-cancel"
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewNoteTitle('');
                    setNewNoteContent('');
                  }}
                >
                  Отмена
                </button>
                <button type="submit" className="notes-panel-modal-submit">
                  Создать
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

