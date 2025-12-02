import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { spacesAPI } from '../../utils/api';
import type { Space, SpaceTag } from '../../types';
import { Header } from '../../components/common/Header';
import { Icon } from '../../components/ui/Icon';
import { ICONS } from '../../utils/icons';
import './SpacesListPage.css';

export const SpacesListPage: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [editingSpace, setEditingSpace] = useState<Space | null>(null);
  const [newSpaceName, setNewSpaceName] = useState('');
  const [newSpaceDescription, setNewSpaceDescription] = useState('');
  const [editSpaceName, setEditSpaceName] = useState('');
  const [editSpaceDescription, setEditSpaceDescription] = useState('');
  const [spaceTags, setSpaceTags] = useState<Map<number, SpaceTag[]>>(new Map());
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const menuRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const itemsPerPage = 12;

  useEffect(() => {
    if (isAuthenticated) {
      loadSpaces();
    }
  }, [isAuthenticated, showArchived, currentPage]);

  // Закрытие меню при клике вне его
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openMenuId !== null) {
        const menuElement = menuRefs.current.get(openMenuId);
        if (menuElement && !menuElement.contains(event.target as Node)) {
          setOpenMenuId(null);
        }
      }
    };

    if (openMenuId !== null) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [openMenuId]);

  const loadSpaces = async () => {
    setIsLoading(true);
    try {
      const offset = (currentPage - 1) * itemsPerPage;
      const response = await spacesAPI.getSpaces(showArchived, itemsPerPage, offset);
      setSpaces(response.spaces);
      setTotal(response.total);

      // Загружаем теги для каждого пространства
      const tagsMap = new Map<number, SpaceTag[]>();
      await Promise.all(
        response.spaces.map(async (space) => {
          try {
            const tags = await spacesAPI.getSpaceTags(space.id);
            tagsMap.set(space.id, tags);
          } catch (error) {
            console.error(`Ошибка загрузки тегов для пространства ${space.id}:`, error);
            tagsMap.set(space.id, []);
          }
        })
      );
      setSpaceTags(tagsMap);
    } catch (error) {
      console.error('Ошибка загрузки пространств:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateSpace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSpaceName.trim()) return;

    try {
      await spacesAPI.createSpace({
        name: newSpaceName.trim(),
        description: newSpaceDescription.trim() || undefined,
      });
      setNewSpaceName('');
      setNewSpaceDescription('');
      setShowCreateModal(false);
      loadSpaces();
    } catch (error: any) {
      console.error('Ошибка создания пространства:', error);
      alert(error.message || 'Ошибка при создании пространства. Попробуйте позже.');
    }
  };

  const handleEditSpace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSpace || !editSpaceName.trim()) return;

    try {
      await spacesAPI.updateSpace(editingSpace.id, {
        name: editSpaceName,
        description: editSpaceDescription || undefined,
      });
      setEditingSpace(null);
      setEditSpaceName('');
      setEditSpaceDescription('');
      loadSpaces();
    } catch (error) {
      console.error('Ошибка обновления пространства:', error);
    }
  };

  const handleArchiveSpace = async (spaceId: number) => {
    try {
      await spacesAPI.archiveSpace(spaceId);
      loadSpaces();
    } catch (error) {
      console.error('Ошибка архивирования пространства:', error);
    }
  };

  const handleUnarchiveSpace = async (spaceId: number) => {
    try {
      await spacesAPI.unarchiveSpace(spaceId);
      loadSpaces();
    } catch (error) {
      console.error('Ошибка разархивирования пространства:', error);
    }
  };

  const handleDeleteSpace = async (spaceId: number) => {
    if (!confirm('Вы уверены, что хотите удалить это пространство?')) return;

    try {
      await spacesAPI.deleteSpace(spaceId);
      loadSpaces();
    } catch (error: any) {
      console.error('Ошибка удаления пространства:', error);
      alert(error.message || 'Ошибка при удалении пространства. Попробуйте позже.');
    }
  };

  const startEdit = (space: Space) => {
    setEditingSpace(space);
    setEditSpaceName(space.name);
    setEditSpaceDescription(space.description || '');
  };

  const totalPages = Math.ceil(total / itemsPerPage);

  if (!isAuthenticated) {
    return <div>Пожалуйста, войдите в систему</div>;
  }

  return (
    <div className="spaces-list-page">
      <Header
        title="Пространства"
        activeTool="assistant"
        onToolSelect={() => { }}
      />
      <div className="spaces-list-content">
        <div className="spaces-list-header">
          <h1>Пространства</h1>
          <div className="spaces-list-controls">
            <label className="spaces-list-toggle">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => {
                  setShowArchived(e.target.checked);
                  setCurrentPage(1);
                }}
              />
              <span>Показать архивированные</span>
            </label>
            <button
              className="spaces-list-create-btn"
              onClick={() => setShowCreateModal(true)}
            >
              <Icon src={ICONS.plus} size="sm" />
              Создать новое пространство
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="spaces-list-loading">Загрузка...</div>
        ) : spaces.length === 0 ? (
          <div className="spaces-list-empty">
            <Icon src={ICONS.flame} size="lg" />
            <p>Нет пространств</p>
            <button
              className="spaces-list-create-btn"
              onClick={() => setShowCreateModal(true)}
            >
              Создать первое пространство
            </button>
          </div>
        ) : (
          <>
            <div className="spaces-grid">
              {spaces.map(space => (
                <div
                  key={space.id}
                  className={`spaces-grid-card ${space.is_archived ? 'archived' : ''}`}
                  onClick={() => {
                    window.location.href = `/spaces/${space.id}`;
                  }}
                >
                  <div className="spaces-grid-card-header">
                    <h3 className="spaces-grid-card-title">{space.name}</h3>
                    <div
                      className="spaces-grid-card-menu"
                      ref={(el) => {
                        if (el) {
                          menuRefs.current.set(space.id, el);
                        } else {
                          menuRefs.current.delete(space.id);
                        }
                      }}
                    >
                      <button
                        className="spaces-grid-card-menu-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(openMenuId === space.id ? null : space.id);
                        }}
                      >
                        <Icon src={ICONS.more} size="sm" />
                      </button>
                      {openMenuId === space.id && (
                        <div className="spaces-grid-card-menu-dropdown">
                          <button onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(null);
                            window.location.href = `/spaces/${space.id}`;
                          }}>
                            <Icon src={ICONS.open} size="sm" />
                            Открыть
                          </button>
                          <button onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(null);
                            startEdit(space);
                          }}>
                            <Icon src={ICONS.edit} size="sm" />
                            Редактировать
                          </button>
                          {space.is_archived ? (
                            <button onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuId(null);
                              handleUnarchiveSpace(space.id);
                            }}>
                              <Icon src={ICONS.archive} size="sm" />
                              Разархивировать
                            </button>
                          ) : (
                            <button onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuId(null);
                              handleArchiveSpace(space.id);
                            }}>
                              <Icon src={ICONS.archive} size="sm" />
                              Архивировать
                            </button>
                          )}
                          <button
                            className="danger"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuId(null);
                              handleDeleteSpace(space.id);
                            }}
                          >
                            <Icon src={ICONS.trash} size="sm" />
                            Удалить
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="spaces-grid-card-description">
                    {space.description || 'Нет описания'}
                  </p>
                  <div className="spaces-grid-card-stats">
                    <div className="spaces-grid-card-stat">
                      <span className="spaces-grid-card-stat-value">{space.chats_count}</span>
                      <span className="spaces-grid-card-stat-label">чатов</span>
                    </div>
                    <div className="spaces-grid-card-stat">
                      <span className="spaces-grid-card-stat-value">{space.notes_count}</span>
                      <span className="spaces-grid-card-stat-label">заметок</span>
                    </div>
                    <div className="spaces-grid-card-stat">
                      <span className="spaces-grid-card-stat-value">{space.tags_count}</span>
                      <span className="spaces-grid-card-stat-label">тегов</span>
                    </div>
                  </div>
                  {spaceTags.get(space.id) && spaceTags.get(space.id)!.length > 0 && (
                    <div className="spaces-grid-card-tags">
                      {spaceTags.get(space.id)!.map(tag => (
                        <span
                          key={tag.id}
                          className="spaces-grid-card-tag"
                          style={{ backgroundColor: tag.color || '#6366f1' }}
                        >
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="spaces-grid-card-footer">
                    <span className="spaces-grid-card-date">
                      Обновлено: {new Date(space.updated_at).toLocaleDateString('ru-RU')}
                    </span>
                    <div className="spaces-grid-card-footer-right">
                      {space.is_archived && (
                        <span className="spaces-grid-card-status">Архивировано</span>
                      )}
                      {!space.is_archived && (
                        <div className="spaces-grid-card-actions">
                          <button
                            className="spaces-grid-card-action-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              startEdit(space);
                            }}
                          >
                            <Icon src={ICONS.edit} size="sm" />
                          </button>
                          <button
                            className="spaces-grid-card-action-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleArchiveSpace(space.id);
                            }}
                            title="Архивировать"
                          >
                            <Icon src={ICONS.archive} size="sm" />
                          </button>
                          <button
                            className="spaces-grid-card-action-btn danger"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteSpace(space.id);
                            }}
                          >
                            <Icon src={ICONS.trash} size="sm" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="spaces-list-pagination">
                <button
                  className="spaces-list-pagination-btn"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => prev - 1)}
                >
                  Назад
                </button>
                <span className="spaces-list-pagination-info">
                  Страница {currentPage} из {totalPages}
                </span>
                <button
                  className="spaces-list-pagination-btn"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => prev + 1)}
                >
                  Вперед
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {showCreateModal && (
        <div className="spaces-list-modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="spaces-list-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Создать пространство</h3>
            <form onSubmit={handleCreateSpace}>
              <input
                type="text"
                placeholder="Название пространства"
                value={newSpaceName}
                onChange={(e) => setNewSpaceName(e.target.value)}
                required
                autoFocus
              />
              <textarea
                placeholder="Описание (необязательно)"
                value={newSpaceDescription}
                onChange={(e) => setNewSpaceDescription(e.target.value)}
                rows={4}
              />
              <div className="spaces-list-modal-actions">
                <button type="button" onClick={() => setShowCreateModal(false)}>Отмена</button>
                <button type="submit">Создать</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingSpace && (
        <div className="spaces-list-modal-overlay" onClick={() => setEditingSpace(null)}>
          <div className="spaces-list-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Редактировать пространство</h3>
            <form onSubmit={handleEditSpace}>
              <input
                type="text"
                placeholder="Название пространства"
                value={editSpaceName}
                onChange={(e) => setEditSpaceName(e.target.value)}
                required
                autoFocus
              />
              <textarea
                placeholder="Описание (необязательно)"
                value={editSpaceDescription}
                onChange={(e) => setEditSpaceDescription(e.target.value)}
                rows={4}
              />
              <div className="spaces-list-modal-actions">
                <button type="button" onClick={() => setEditingSpace(null)}>Отмена</button>
                <button type="submit">Сохранить</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

