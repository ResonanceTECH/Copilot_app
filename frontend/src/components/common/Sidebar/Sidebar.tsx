import React, { useState, useEffect, useRef } from 'react';
import { Icon } from '../../ui/Icon';
import { ICONS } from '../../../utils/icons';
import { ChatThread, Space } from '../../../types';
import logoIcon from '../../../assets/icons/logo.svg';
import starIcon from '../../../assets/icons/star.svg';
import starFilledIcon from '../../../assets/icons/star-filled.svg';
import { ThreadContextMenu } from './ThreadContextMenu';
import { SpaceContextMenu } from './SpaceContextMenu';
import { SearchPanel } from '../SearchPanel';
import { useLanguage } from '../../../contexts/LanguageContext';
import { getTranslation } from '../../../utils/i18n';
import { spacesAPI } from '../../../utils/api';
import './Sidebar.css';

interface SidebarProps {
  threads?: ChatThread[];
  activeThreadId?: string | null;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onNewThread?: () => void;
  onThreadSelect?: (threadId: string) => void;
  onThreadDelete?: (threadId: string) => void;
  onThreadRename?: (threadId: string, newTitle: string) => void;
  onThreadPin?: (threadId: string) => void;
  onSettingsClick?: () => void;
  isMobileMenuOpen?: boolean;
  onMobileMenuClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  threads = [],
  activeThreadId,
  isCollapsed = false,
  onToggleCollapse,
  onNewThread,
  onThreadSelect,
  onThreadDelete,
  onThreadRename,
  onThreadPin,
  onSettingsClick,
  isMobileMenuOpen = false,
  onMobileMenuClose,
}) => {
  const [contextMenu, setContextMenu] = useState<{
    threadId: string;
    position: { x: number; y: number };
  } | null>(null);
  const [spaceContextMenu, setSpaceContextMenu] = useState<{
    spaceId: number;
    position: { x: number; y: number };
  } | null>(null);
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [editingSpaceId, setEditingSpaceId] = useState<number | null>(null);
  const [editingSpaceName, setEditingSpaceName] = useState('');
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [showSpaces, setShowSpaces] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [hoveredThreadId, setHoveredThreadId] = useState<string | null>(null);
  const [hoveredSpaceId, setHoveredSpaceId] = useState<number | null>(null);
  const [draggedSpaceId, setDraggedSpaceId] = useState<number | null>(null);
  const [dragOverPinnedArea, setDragOverPinnedArea] = useState(false);
  const [pinnedSpacesUpdate, setPinnedSpacesUpdate] = useState(0); // Для принудительного обновления
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const spaceContextMenuRef = useRef<HTMLDivElement>(null);
  const pinnedAreaRef = useRef<HTMLDivElement>(null);
  const { language } = useLanguage();

  // Загрузить закрепленные пространства из localStorage
  const loadPinnedSpaces = (): Set<number> => {
    try {
      const saved = localStorage.getItem('pinnedSpaces');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  };

  // Сохранить закрепленные пространства в localStorage
  const savePinnedSpaces = (pinnedSet: Set<number>) => {
    try {
      localStorage.setItem('pinnedSpaces', JSON.stringify(Array.from(pinnedSet)));
    } catch (error) {
      console.error('Ошибка сохранения закрепленных пространств:', error);
    }
  };

  // Загрузка пространств
  useEffect(() => {
    const loadSpaces = async () => {
      try {
        const response = await spacesAPI.getSpaces();
        setSpaces(response.spaces);
      } catch (error) {
        console.error('Ошибка загрузки пространств:', error);
      }
    };
    loadSpaces();
  }, []);

  const handleMenuClick = (e: React.MouseEvent, threadId: string) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setContextMenu({
      threadId,
      position: {
        x: rect.right - 180,
        y: rect.bottom + 4,
      },
    });
  };

  const handleRename = (threadId: string) => {
    const thread = threads.find(t => t.id === threadId);
    setEditingThreadId(threadId);
    setEditingTitle(thread?.title || '');
  };

  const handleRenameSubmit = (e: React.FormEvent, threadId: string) => {
    e.stopPropagation();
    if (editingTitle.trim() && onThreadRename) {
      onThreadRename(threadId, editingTitle.trim());
    }
    setEditingThreadId(null);
    setEditingTitle('');
  };

  const handleRenameCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingThreadId(null);
    setEditingTitle('');
  };

  const handleKeyDown = (e: React.KeyboardEvent, threadId: string) => {
    if (e.key === 'Enter') {
      handleRenameSubmit(e, threadId);
    } else if (e.key === 'Escape') {
      handleRenameCancel(e as any);
    }
  };

  // Закрытие контекстного меню при клике вне его
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
        setContextMenu(null);
      }
      if (spaceContextMenuRef.current && !spaceContextMenuRef.current.contains(event.target as Node)) {
        setSpaceContextMenu(null);
      }
    };

    if (contextMenu || spaceContextMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [contextMenu, spaceContextMenu]);

  // Горячие клавиши
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        onNewThread?.();
      }
      if (e.key === 'Escape') {
        if (contextMenu) {
          setContextMenu(null);
        }
        if (spaceContextMenu) {
          setSpaceContextMenu(null);
        }
        if (editingThreadId) {
          setEditingThreadId(null);
          setEditingTitle('');
        }
        if (editingSpaceId) {
          setEditingSpaceId(null);
          setEditingSpaceName('');
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [onNewThread, contextMenu, spaceContextMenu, editingThreadId, editingSpaceId]);

  // Обработчики для пространств
  const handleSpaceMenuClick = (e: React.MouseEvent, spaceId: number) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setSpaceContextMenu({
      spaceId,
      position: {
        x: rect.right - 180,
        y: rect.bottom + 4,
      },
    });
  };

  const handleSpaceRename = async (spaceId: number) => {
    const space = spaces.find(s => s.id === spaceId);
    if (space) {
      setEditingSpaceId(spaceId);
      setEditingSpaceName(space.name);
    }
  };

  const handleSpaceRenameSubmit = async (e: React.FormEvent, spaceId: number) => {
    e.stopPropagation();
    if (editingSpaceName.trim()) {
      try {
        await spacesAPI.updateSpace(spaceId, { name: editingSpaceName.trim() });
        // Обновляем список пространств
        const response = await spacesAPI.getSpaces();
        setSpaces(response.spaces);
        setEditingSpaceId(null);
        setEditingSpaceName('');
      } catch (error: any) {
        console.error('Ошибка переименования пространства:', error);
        alert(error.message || 'Ошибка при переименовании пространства');
      }
    } else {
      setEditingSpaceId(null);
      setEditingSpaceName('');
    }
  };

  const handleSpaceRenameCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSpaceId(null);
    setEditingSpaceName('');
  };

  const handleSpaceKeyDown = (e: React.KeyboardEvent, spaceId: number) => {
    if (e.key === 'Enter') {
      handleSpaceRenameSubmit(e, spaceId);
    } else if (e.key === 'Escape') {
      handleSpaceRenameCancel(e as any);
    }
  };

  const handleSpaceDelete = async (spaceId: number) => {
    const space = spaces.find(s => s.id === spaceId);
    if (!space) return;

    if (!confirm(`Вы уверены, что хотите удалить пространство "${space.name}"?`)) {
      return;
    }

    try {
      await spacesAPI.deleteSpace(spaceId);
      // Обновляем список пространств
      const response = await spacesAPI.getSpaces();
      setSpaces(response.spaces);
      // Удаляем из закрепленных, если было закреплено
      const pinnedSpaces = loadPinnedSpaces();
      pinnedSpaces.delete(spaceId);
      savePinnedSpaces(pinnedSpaces);
      setPinnedSpacesUpdate(prev => prev + 1);
    } catch (error: any) {
      console.error('Ошибка удаления пространства:', error);
      alert(error.message || 'Ошибка при удалении пространства');
    }
  };

  const handleSpaceUnpin = (spaceId: number) => {
    const pinnedSpaces = loadPinnedSpaces();
    pinnedSpaces.delete(spaceId);
    savePinnedSpaces(pinnedSpaces);
    setPinnedSpacesUpdate(prev => prev + 1);
  };

  const handleSpacePin = (spaceId: number) => {
    const pinnedSpaces = loadPinnedSpaces();
    pinnedSpaces.add(spaceId);
    savePinnedSpaces(pinnedSpaces);
    setPinnedSpacesUpdate(prev => prev + 1);
  };

  // Проверка, является ли устройство мобильным или планшетом
  const isMobileOrTablet = () => {
    return window.innerWidth <= 1024;
  };

  return (
    <aside className={`sidebar ${isCollapsed ? 'sidebar--collapsed' : ''} ${isMobileMenuOpen ? 'sidebar--mobile-open' : ''}`}>
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <img src={logoIcon} alt={getTranslation('aiAssistant', language)} className="sidebar-logo-icon" />
          {!isCollapsed && <span className="sidebar-logo-text">{getTranslation('aiAssistant', language)}</span>}
        </div>
        {!isCollapsed ? (
          <>
            <div className="sidebar-new-container">
              <button
                onClick={onNewThread}
                className="sidebar-new-btn"
              >
                {getTranslation('createNew', language)}
              </button>
            </div>
            <button
              className="sidebar-collapse-btn"
              onClick={() => {
                onToggleCollapse?.();
                onMobileMenuClose?.();
              }}
              title={getTranslation('settings', language)}
            >
              <Icon src={ICONS.menu} size="sm" />
            </button>
          </>
        ) : (
          <>
            <button
              className="sidebar-collapse-btn"
              onClick={() => {
                onToggleCollapse?.();
                onMobileMenuClose?.();
              }}
              title={getTranslation('settings', language)}
            >
              <Icon src={ICONS.menu} size="sm" />
            </button>
            <button
              onClick={onNewThread}
              className="sidebar-new-btn-collapsed"
              title={getTranslation('createNewChat', language)}
            >
              <Icon src={ICONS.plus} size="md" />
            </button>
          </>
        )}
      </div>

      <div className="sidebar-content">
        {/* Секция закрепленных пространств */}
        {!isCollapsed && (() => {
          // Используем pinnedSpacesUpdate для принудительного обновления
          const _ = pinnedSpacesUpdate;
          const pinnedSpaces = loadPinnedSpaces();
          const pinnedSpacesList = spaces.filter(space => pinnedSpaces.has(space.id));

          // Показываем секцию только если есть закрепленные пространства или идет перетаскивание
          if (pinnedSpacesList.length === 0 && !dragOverPinnedArea && draggedSpaceId === null) {
            return null;
          }

          return (
            <div
              ref={pinnedAreaRef}
              className={`sidebar-pinned-section ${dragOverPinnedArea ? 'sidebar-pinned-section--drag-over' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (draggedSpaceId !== null) {
                  setDragOverPinnedArea(true);
                }
              }}
              onDragEnter={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (draggedSpaceId !== null) {
                  setDragOverPinnedArea(true);
                }
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const rect = pinnedAreaRef.current?.getBoundingClientRect();
                if (rect) {
                  const x = e.clientX;
                  const y = e.clientY;
                  // Проверяем, что курсор действительно вышел за пределы области
                  if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
                    setDragOverPinnedArea(false);
                  }
                } else {
                  setDragOverPinnedArea(false);
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDragOverPinnedArea(false);
                if (draggedSpaceId !== null) {
                  const pinnedSpaces = loadPinnedSpaces();
                  pinnedSpaces.add(draggedSpaceId);
                  savePinnedSpaces(pinnedSpaces);
                  setDraggedSpaceId(null);
                  // Принудительно обновляем компонент
                  setPinnedSpacesUpdate(prev => prev + 1);
                }
              }}
            >
              {pinnedSpacesList.length > 0 && (
                <div className="sidebar-section">
                  <div className="sidebar-section-header">
                    <span className="sidebar-section-title">Закрепленные</span>
                  </div>
                  <div className="sidebar-pinned-spaces">
                    {pinnedSpacesList.map(space => (
                      <div
                        key={space.id}
                        className="sidebar-space-item sidebar-space-item--pinned"
                        onClick={() => {
                          if (!editingSpaceId || editingSpaceId !== space.id) {
                            window.location.href = `/spaces/${space.id}`;
                          }
                        }}
                        onMouseEnter={() => setHoveredSpaceId(space.id)}
                        onMouseLeave={() => setHoveredSpaceId(null)}
                        draggable
                        onDragStart={(e) => {
                          setDraggedSpaceId(space.id);
                          e.dataTransfer.effectAllowed = 'move';
                        }}
                        onDragEnd={() => {
                          setDraggedSpaceId(null);
                          setDragOverPinnedArea(false);
                        }}
                      >
                        {editingSpaceId === space.id ? (
                          <input
                            type="text"
                            className="sidebar-space-edit"
                            value={editingSpaceName}
                            onChange={(e) => setEditingSpaceName(e.target.value)}
                            onBlur={(e) => handleSpaceRenameSubmit(e, space.id)}
                            onKeyDown={(e) => handleSpaceKeyDown(e, space.id)}
                            onClick={(e) => e.stopPropagation()}
                            autoFocus
                          />
                        ) : (
                          <>
                            <button
                              className="sidebar-space-star-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isMobileOrTablet()) {
                                  handleSpaceUnpin(space.id);
                                }
                              }}
                              onMouseEnter={(e) => {
                                if (!isMobileOrTablet()) {
                                  e.currentTarget.style.opacity = '1';
                                }
                              }}
                              title="Открепить"
                            >
                              <Icon src={starFilledIcon} size="sm" className="sidebar-thread-pin-icon" />
                            </button>
                            <div className="sidebar-space-content">
                              <div className="sidebar-space-name">{space.name}</div>
                              <div className="sidebar-space-meta">
                                {space.chats_count} чатов • {space.notes_count} файлов
                              </div>
                            </div>
                            {hoveredSpaceId === space.id && (
                              <button
                                className="sidebar-space-menu"
                                onClick={(e) => handleSpaceMenuClick(e, space.id)}
                                title="Меню"
                              >
                                <Icon src={ICONS.more} size="sm" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {pinnedSpacesList.length === 0 && dragOverPinnedArea && (
                <div className="sidebar-pinned-drop-zone">
                  <span>Перетащите пространство сюда</span>
                </div>
              )}
            </div>
          );
        })()}

        <div className="sidebar-section">
          <div className="sidebar-section-header">
            <span className="sidebar-section-title">{getTranslation('chats', language)}</span>
            <button
              className="sidebar-search-btn"
              onClick={() => setShowSearch(true)}
              title="Поиск"
            >
              <Icon src={ICONS.search} size="sm" />
            </button>
          </div>
          <div className="sidebar-threads">
            {threads.length === 0 && !isCollapsed ? (
              <div className="sidebar-empty-state">
                <p className="sidebar-empty-text">{getTranslation('noChats', language)}</p>
              </div>
            ) : (
              threads.map((thread) => (
                <div
                  key={thread.id}
                  className={`sidebar-thread-item ${activeThreadId === thread.id ? 'sidebar-thread-item--active' : ''}`}
                  onClick={() => {
                    if (!editingThreadId) {
                      onThreadSelect?.(thread.id);
                      onMobileMenuClose?.();
                    }
                  }}
                  onMouseEnter={() => setHoveredThreadId(thread.id)}
                  onMouseLeave={() => setHoveredThreadId(null)}
                  title={thread.title}
                >
                  {editingThreadId === thread.id ? (
                    <input
                      type="text"
                      className="sidebar-thread-edit"
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onBlur={(e) => handleRenameSubmit(e, thread.id)}
                      onKeyDown={(e) => handleKeyDown(e, thread.id)}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                    />
                  ) : (
                    <>
                      {isCollapsed ? (
                        <Icon src={ICONS.rocket} size="md" />
                      ) : (
                        <>
                          {thread.is_pinned && (
                            <button
                              className="sidebar-thread-pin-icon-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isMobileOrTablet() && onThreadPin) {
                                  onThreadPin(thread.id);
                                }
                              }}
                              title={thread.is_pinned ? getTranslation('unpinThread', language) : getTranslation('pinThread', language)}
                            >
                              <Icon src={starFilledIcon} size="sm" className="sidebar-thread-pin-icon" />
                            </button>
                          )}
                          <span
                            className="sidebar-thread-title"
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              handleRename(thread.id);
                            }}
                            style={{ cursor: 'pointer' }}
                          >
                            {thread.title}
                          </span>
                          {hoveredThreadId === thread.id && onThreadPin && (
                            <button
                              className="sidebar-thread-star"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!isMobileOrTablet()) {
                                  onThreadPin(thread.id);
                                }
                              }}
                              title={thread.is_pinned ? getTranslation('unpinThread', language) : getTranslation('pinThread', language)}
                            >
                              <Icon src={thread.is_pinned ? starFilledIcon : starIcon} size="sm" className="sidebar-star-icon" />
                            </button>
                          )}
                          <button
                            className="sidebar-thread-menu"
                            onClick={(e) => handleMenuClick(e, thread.id)}
                          >
                            <Icon src={ICONS.more} size="sm" />
                          </button>
                        </>
                      )}
                    </>
                  )}
                </div>
              ))
            )}
          </div>
          {contextMenu && (
            <div ref={contextMenuRef}>
              <ThreadContextMenu
                threadId={contextMenu.threadId}
                position={contextMenu.position}
                onClose={() => setContextMenu(null)}
                onDelete={(threadId) => {
                  onThreadDelete?.(threadId);
                  setContextMenu(null);
                }}
                onRename={handleRename}
                onPin={onThreadPin}
                isPinned={threads.find(t => t.id === contextMenu.threadId)?.is_pinned || false}
              />
            </div>
          )}
        </div>
      </div>

      {!isCollapsed && (
        <div className="sidebar-footer">
          <div className="sidebar-navigation">
            <div className="sidebar-spaces-section">
              <div className="sidebar-nav-item">
                <button
                  className="sidebar-nav-item-main"
                  onClick={() => {
                    // Клик на кнопку - открываем /spaces
                    window.location.href = '/spaces';
                  }}
                >
                  <Icon src={ICONS.flame} size="md" />
                  <span>{getTranslation('explore', language)}</span>
                </button>
                <button
                  className="sidebar-chevron-btn"
                  onClick={() => {
                    setShowSpaces(!showSpaces);
                  }}
                >
                  <Icon
                    src={showSpaces ? ICONS.arrowLeft : ICONS.chevronDown}
                    size="sm"
                    className="sidebar-chevron-icon"
                  />
                </button>
              </div>
              {showSpaces && (
                <div className="sidebar-spaces-list">
                  {spaces.length > 0 ? (
                    spaces.map(space => {
                      // Используем pinnedSpacesUpdate для принудительного обновления
                      const _ = pinnedSpacesUpdate;
                      const isPinned = loadPinnedSpaces().has(space.id);
                      return (
                        <div
                          key={space.id}
                          className={`sidebar-space-item ${isPinned ? 'sidebar-space-item--has-pinned' : ''}`}
                          onClick={() => {
                            if (!editingSpaceId || editingSpaceId !== space.id) {
                              window.location.href = `/spaces/${space.id}`;
                            }
                          }}
                          onMouseEnter={() => setHoveredSpaceId(space.id)}
                          onMouseLeave={() => setHoveredSpaceId(null)}
                          draggable
                          onDragStart={(e) => {
                            setDraggedSpaceId(space.id);
                            e.dataTransfer.effectAllowed = 'move';
                          }}
                          onDragEnd={() => {
                            setDraggedSpaceId(null);
                            setDragOverPinnedArea(false);
                          }}
                        >
                          {editingSpaceId === space.id ? (
                            <input
                              type="text"
                              className="sidebar-space-edit"
                              value={editingSpaceName}
                              onChange={(e) => setEditingSpaceName(e.target.value)}
                              onBlur={(e) => handleSpaceRenameSubmit(e, space.id)}
                              onKeyDown={(e) => handleSpaceKeyDown(e, space.id)}
                              onClick={(e) => e.stopPropagation()}
                              autoFocus
                            />
                          ) : (
                            <>
                              <button
                                className="sidebar-space-star-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (isMobileOrTablet()) {
                                    if (isPinned) {
                                      handleSpaceUnpin(space.id);
                                    } else {
                                      handleSpacePin(space.id);
                                    }
                                  }
                                }}
                                onMouseEnter={(e) => {
                                  if (!isMobileOrTablet()) {
                                    e.currentTarget.style.opacity = '1';
                                  }
                                }}
                                title={isPinned ? 'Открепить' : 'Закрепить'}
                              >
                                <Icon src={isPinned ? starFilledIcon : starIcon} size="sm" className="sidebar-star-icon" />
                              </button>
                              <Icon src={ICONS.flame} size="sm" />
                              <div className="sidebar-space-content">
                                <div className="sidebar-space-name">{space.name}</div>
                                <div className="sidebar-space-meta">
                                  {space.chats_count} чатов • {space.notes_count} файлов
                                </div>
                              </div>
                              {hoveredSpaceId === space.id && (
                                <button
                                  className="sidebar-space-menu"
                                  onClick={(e) => handleSpaceMenuClick(e, space.id)}
                                  title="Меню"
                                >
                                  <Icon src={ICONS.more} size="sm" />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="sidebar-empty-spaces">
                      <p>Нет пространств</p>
                      <button
                        className="sidebar-create-space-btn"
                        onClick={() => {
                          window.location.href = '/spaces';
                        }}
                      >
                        Создать пространство
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            <button
              className="sidebar-nav-item"
              onClick={() => {
                onSettingsClick?.();
              }}
            >
              <Icon src={ICONS.support} size="md" />
              <span>{getTranslation('support', language)}</span>
            </button>
          </div>
        </div>
      )}
      {showSearch && (
        <SearchPanel
          onClose={() => setShowSearch(false)}
          onChatSelect={(chatId) => {
            const threadId = `chat-${chatId}`;
            onThreadSelect?.(threadId);
          }}
        />
      )}
      {spaceContextMenu && (
        <div ref={spaceContextMenuRef}>
          <SpaceContextMenu
            spaceId={spaceContextMenu.spaceId}
            position={spaceContextMenu.position}
            onClose={() => setSpaceContextMenu(null)}
            onDelete={handleSpaceDelete}
            onRename={handleSpaceRename}
            onUnpin={handleSpaceUnpin}
            isPinned={loadPinnedSpaces().has(spaceContextMenu.spaceId)}
          />
        </div>
      )}
    </aside>
  );
};
