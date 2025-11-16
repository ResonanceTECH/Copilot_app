import React, { useState } from 'react';
import { Icon } from '../../ui/Icon';
import { Button } from '../../ui/Button';
import { ICONS } from '../../../utils/icons';
import { ChatThread } from '../../../types';
import logoIcon from '../../../assets/icons/logo.svg';
import { ThreadContextMenu } from './ThreadContextMenu';
import './Sidebar.css';

interface SidebarProps {
  threads?: ChatThread[];
  onNewThread?: () => void;
  onThreadSelect?: (threadId: string) => void;
  onThreadDelete?: (threadId: string) => void;
  onThreadRename?: (threadId: string, newTitle: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  threads = [],
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
    const thread = threads.find((t) => t.id === threadId);
    if (thread) {
      setEditingThreadId(threadId);
      setEditingTitle(thread.title);
    }
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

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <img src={logoIcon} alt="AI-ассистент" className="sidebar-logo-icon" />
          <span className="sidebar-logo-text">AI-ассистент</span>
        </div>
        <div className="sidebar-new-container">
          <button
            onClick={onNewThread}
            className="sidebar-new-btn"
          >
+ Создать новый
          </button>
        </div>
      </div>

      <div className="sidebar-content">
        <div className="sidebar-section">
          <div className="sidebar-section-header">
            <span className="sidebar-section-title">Чаты</span>
            <button className="sidebar-search-btn">
              <Icon src={ICONS.search} size="sm" />
            </button>
          </div>
          <div className="sidebar-threads">
            {threads.map((thread) => (
              <div
                key={thread.id}
                className="sidebar-thread-item"
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
                    <span className="sidebar-thread-title">{thread.title}</span>
                    <button
                      className="sidebar-thread-menu"
                      onClick={(e) => handleMenuClick(e, thread.id)}
                    >
                      <Icon src={ICONS.more} size="sm" />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
          {contextMenu && (
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
          )}
        </div>

        <div className="sidebar-navigation">
          <button className="sidebar-nav-item">
            <Icon src={ICONS.flame} size="md" />
            <span>Исследовать</span>
          </button>
          <button className="sidebar-nav-item">
            <Icon src={ICONS.settings} size="md" />
            <span>Настройки</span>
          </button>
          <button className="sidebar-nav-item">
            <Icon src={ICONS.more} size="md" />
            <span>Еще</span>
          </button>
        </div>
      </div>

      <div className="sidebar-footer">
        <Button
          variant="primary"
          size="lg"
          onClick={() => {}}
          className="sidebar-upgrade-btn"
        >
          Обновить до Pro
        </Button>
        <div className="sidebar-trial-text">Бесплатная пробная версия на 7 дней</div>
      </div>
    </aside>
  );
};
