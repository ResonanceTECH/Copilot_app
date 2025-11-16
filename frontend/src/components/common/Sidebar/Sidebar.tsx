import React, { useState, useEffect, useRef } from 'react';
import { Icon } from '../../ui/Icon';
import { ICONS } from '../../../utils/icons';
import { ChatThread } from '../../../types';
import logoIcon from '../../../assets/icons/logo.svg';
import { ThreadContextMenu } from './ThreadContextMenu';
import { useLanguage } from '../../../contexts/LanguageContext';
import { getTranslation } from '../../../utils/i18n';
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
}) => {
  const [contextMenu, setContextMenu] = useState<{
    threadId: string;
    position: { x: number; y: number };
  } | null>(null);
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const { language } = useLanguage();

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
    setEditingThreadId(threadId);
    setEditingTitle('');
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
        <div className="sidebar-section">
          <div className="sidebar-section-header">
            <span className="sidebar-section-title">{getTranslation('chats', language)}</span>
            <button className="sidebar-search-btn">
              <Icon src={ICONS.search} size="sm" />
            </button>
          </div>
          <div className="sidebar-threads">
            {threads.length === 0 && !isCollapsed ? (
              <>
                <div className="sidebar-thread-placeholder"></div>
                <div className="sidebar-thread-placeholder"></div>
                <div className="sidebar-thread-placeholder"></div>
                <div className="sidebar-signup-section">
                  <p className="sidebar-signup-text">{getTranslation('signUpForFree', language)}</p>
                  <button className="sidebar-signup-btn">
                    {getTranslation('signUp', language)}
                  </button>
                </div>
              </>
            ) : (
              threads.map((thread) => (
                <div
                  key={thread.id}
                  className={`sidebar-thread-item ${activeThreadId === thread.id ? 'sidebar-thread-item--active' : ''}`}
                  onClick={() => !editingThreadId && onThreadSelect?.(thread.id)}
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
                        <span className="sidebar-thread-title">{thread.title}</span>
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
              />
            </div>
          )}
        </div>
      </div>

      {!isCollapsed && (
        <div className="sidebar-footer">
          <div className="sidebar-navigation">
            <button className="sidebar-nav-item">
              <Icon src={ICONS.flame} size="md" />
              <span>{getTranslation('explore', language)}</span>
            </button>
            <button className="sidebar-nav-item">
              <Icon src={ICONS.settings} size="md" />
              <span>{getTranslation('settings', language)}</span>
            </button>
            <button className="sidebar-nav-item">
              <Icon src={ICONS.more} size="md" />
              <span>{getTranslation('more', language)}</span>
            </button>
          </div>
        </div>
      )}
    </aside>
  );
};
