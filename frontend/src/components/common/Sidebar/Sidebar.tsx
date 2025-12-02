import React, { useState, useEffect, useRef } from 'react';
import { Icon } from '../../ui/Icon';
import { ICONS } from '../../../utils/icons';
import { ChatThread, Space } from '../../../types';
import logoIcon from '../../../assets/icons/logo.svg';
import pinIcon from '../../../assets/icons/pin.svg';
import starIcon from '../../../assets/icons/star.svg';
import starFilledIcon from '../../../assets/icons/star-filled.svg';
import { ThreadContextMenu } from './ThreadContextMenu';
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
}) => {
  const [contextMenu, setContextMenu] = useState<{
    threadId: string;
    position: { x: number; y: number };
  } | null>(null);
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [showSpaces, setShowSpaces] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [hoveredThreadId, setHoveredThreadId] = useState<string | null>(null);
  const [draggedSpaceId, setDraggedSpaceId] = useState<number | null>(null);
  const [dragOverPinnedArea, setDragOverPinnedArea] = useState(false);
  const [pinnedSpacesUpdate, setPinnedSpacesUpdate] = useState(0); // Для принудительного обновления
  const contextMenuRef = useRef<HTMLDivElement>(null);
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
    };

    if (contextMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [contextMenu]);

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
        if (editingThreadId) {
          setEditingThreadId(null);
          setEditingTitle('');
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [onNewThread, contextMenu, editingThreadId]);

  return (
    <aside className={`sidebar ${isCollapsed ? 'sidebar--collapsed' : ''}`}>
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
              onClick={onToggleCollapse}
              title={getTranslation('settings', language)}
            >
              <Icon src={ICONS.menu} size="sm" />
            </button>
          </>
        ) : (
          <>
            <button
              className="sidebar-collapse-btn"
              onClick={onToggleCollapse}
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
          if (pinnedSpacesList.length === 0 && !dragOverPinnedArea) {
            return null;
          }

          return (
            <div
              ref={pinnedAreaRef}
              className={`sidebar-pinned-section ${dragOverPinnedArea ? 'sidebar-pinned-section--drag-over' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverPinnedArea(true);
              }}
              onDragLeave={(e) => {
                if (!pinnedAreaRef.current?.contains(e.relatedTarget as Node)) {
                  setDragOverPinnedArea(false);
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
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
                      <button
                        key={space.id}
                        className="sidebar-space-item sidebar-space-item--pinned"
                        onClick={() => {
                          window.location.href = `/spaces/${space.id}`;
                        }}
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
                        <Icon src={ICONS.flame} size="sm" />
                        <div className="sidebar-space-content">
                          <div className="sidebar-space-name">{space.name}</div>
                          <div className="sidebar-space-meta">
                            {space.chats_count} чатов • {space.notes_count} файлов
                          </div>
                        </div>
                        <button
                          className="sidebar-space-unpin-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            const pinnedSpaces = loadPinnedSpaces();
                            pinnedSpaces.delete(space.id);
                            savePinnedSpaces(pinnedSpaces);
                            // Принудительно обновляем компонент
                            setPinnedSpacesUpdate(prev => prev + 1);
                          }}
                          title="Открепить"
                        >
                          <Icon src={starFilledIcon} size="sm" className="sidebar-star-icon" />
                        </button>
                      </button>
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
                  onClick={() => !editingThreadId && onThreadSelect?.(thread.id)}
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
                            <Icon src={starFilledIcon} size="sm" className="sidebar-thread-pin-icon" />
                          )}
                          <span
                            className="sidebar-thread-title"
                            onClick={(e) => {
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
                                onThreadPin(thread.id);
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
                        <button
                          key={space.id}
                          className={`sidebar-space-item ${isPinned ? 'sidebar-space-item--has-pinned' : ''}`}
                          onClick={() => {
                            window.location.href = `/spaces/${space.id}`;
                          }}
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
                          <Icon src={ICONS.flame} size="sm" />
                          <div className="sidebar-space-content">
                            <div className="sidebar-space-name">{space.name}</div>
                            <div className="sidebar-space-meta">
                              {space.chats_count} чатов • {space.notes_count} файлов
                            </div>
                          </div>
                          {isPinned && (
                            <Icon src={starFilledIcon} size="sm" className="sidebar-star-icon" />
                          )}
                        </button>
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
    </aside>
  );
};
