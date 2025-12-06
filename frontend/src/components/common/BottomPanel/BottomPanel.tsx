import React, { useState, useEffect, useRef } from 'react';
import { Icon } from '../../ui/Icon';
import { ICONS, IconName } from '../../../utils/icons';
import { ChatThread } from '../../../types';
import { useLanguage } from '../../../contexts/LanguageContext';
import { getTranslation } from '../../../utils/i18n';
import { IconSelector } from './IconSelector';
import './BottomPanel.css';

interface BottomPanelProps {
  threads?: ChatThread[];
  activeThreadId?: string | null;
  onThreadSelect?: (threadId: string) => void;
  onThreadDelete?: (threadId: string) => void;
  onNewThread?: () => void;
}

export const BottomPanel: React.FC<BottomPanelProps> = ({
  threads = [],
  activeThreadId,
  onThreadSelect,
  onThreadDelete,
  onNewThread,
}) => {
  const { language } = useLanguage();
  const [hoveredThreadId, setHoveredThreadId] = useState<string | null>(null);
  const [deletingThreadId, setDeletingThreadId] = useState<string | null>(null);
  const [editingIconThreadId, setEditingIconThreadId] = useState<string | null>(null);
  const [iconPosition, setIconPosition] = useState<{ x: number; y: number } | null>(null);
  const [threadIcons, setThreadIcons] = useState<Record<string, IconName>>({});
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const longPressTimerRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const doubleClickTimerRef = useRef<Record<string, number>>({});

  // Загрузка сохраненных иконок из localStorage
  useEffect(() => {
    const savedIcons = localStorage.getItem('bottomPanelThreadIcons');
    if (savedIcons) {
      try {
        setThreadIcons(JSON.parse(savedIcons));
      } catch (e) {
        console.error('Ошибка загрузки сохраненных иконок:', e);
      }
    }
  }, []);

  // Сохранение иконок в localStorage при изменении
  useEffect(() => {
    if (Object.keys(threadIcons).length > 0) {
      localStorage.setItem('bottomPanelThreadIcons', JSON.stringify(threadIcons));
    }
  }, [threadIcons]);

  // Отмена удаления и редактирования при клике вне области
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (deletingThreadId && wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setDeletingThreadId(null);
        setHoveredThreadId(null);
      }
      if (editingIconThreadId && wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setEditingIconThreadId(null);
        setIconPosition(null);
      }
    };

    if (deletingThreadId || editingIconThreadId) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [deletingThreadId, editingIconThreadId]);

  const handleDeleteClick = (e: React.MouseEvent, threadId: string) => {
    e.stopPropagation();
    if (deletingThreadId === threadId) {
      // Второй клик - удаляем чат
      onThreadDelete?.(threadId);
      setDeletingThreadId(null);
      setHoveredThreadId(null);
      // Удаляем сохраненную иконку
      const newIcons = { ...threadIcons };
      delete newIcons[threadId];
      setThreadIcons(newIcons);
    } else {
      // Первый клик - заменяем иконку на крестик
      setDeletingThreadId(threadId);
      setEditingIconThreadId(null);
      setIconPosition(null);
    }
  };

  const handleIconChange = (threadId: string, iconName: IconName) => {
    setThreadIcons((prev) => ({
      ...prev,
      [threadId]: iconName,
    }));
    setEditingIconThreadId(null);
    setIconPosition(null);
  };

  const getChatAreaCenter = (): number => {
    // Находим центр ChatArea для всех версий
    const chatArea = document.querySelector('.chat-area');
    if (chatArea) {
      const rect = chatArea.getBoundingClientRect();
      return rect.left + rect.width / 2;
    }
    // Fallback: ищем assistant-main
    const assistantMain = document.querySelector('.assistant-main');
    if (assistantMain) {
      const rect = assistantMain.getBoundingClientRect();
      return rect.left + rect.width / 2;
    }
    // Последний fallback: центр экрана
    return window.innerWidth / 2;
  };

  const handleDoubleClick = (e: React.MouseEvent, threadId: string): boolean => {
    e.stopPropagation();
    if (deletingThreadId === threadId) return false;

    const now = Date.now();
    const lastClick = doubleClickTimerRef.current[threadId] || 0;

    if (now - lastClick < 300) {
      // Двойной клик
      const buttonRef = buttonRefs.current[threadId];
      if (buttonRef) {
        const rect = buttonRef.getBoundingClientRect();
        // Всегда центрируем относительно ChatArea
        setIconPosition({
          x: getChatAreaCenter(),
          y: window.innerHeight - rect.top + 60,
        });
        setEditingIconThreadId(threadId);
        setDeletingThreadId(null);
      }
      delete doubleClickTimerRef.current[threadId];
      return true;
    } else {
      doubleClickTimerRef.current[threadId] = now;
      // Очищаем таймер через 300ms, если не было второго клика
      setTimeout(() => {
        if (doubleClickTimerRef.current[threadId] === now) {
          delete doubleClickTimerRef.current[threadId];
        }
      }, 300);
      return false;
    }
  };

  const handleLongPressStart = (threadId: string) => {
    if (deletingThreadId === threadId) return;

    longPressTimerRef.current[threadId] = setTimeout(() => {
      const buttonRef = buttonRefs.current[threadId];
      if (buttonRef) {
        const rect = buttonRef.getBoundingClientRect();
        // Всегда центрируем относительно ChatArea
        setIconPosition({
          x: getChatAreaCenter(),
          y: window.innerHeight - rect.top + 60,
        });
        setEditingIconThreadId(threadId);
        setDeletingThreadId(null);
      }
    }, 500); // 500ms для долгого нажатия
  };

  const handleLongPressEnd = (threadId: string) => {
    if (longPressTimerRef.current[threadId]) {
      clearTimeout(longPressTimerRef.current[threadId]);
      delete longPressTimerRef.current[threadId];
    }
  };

  const getThreadIcon = (threadId: string): IconName => {
    return threadIcons[threadId] || 'rocket';
  };

  return (
    <div className="bottom-panel" ref={wrapperRef}>
      <div className="bottom-panel-tools">
        <button
          className="bottom-panel-tool bottom-panel-tool--new"
          onClick={onNewThread}
          title={getTranslation('createNewChat', language)}
        >
          <Icon src={ICONS.plus} size="md" />
        </button>
        {threads.map((thread) => (
          <div
            key={thread.id}
            className="bottom-panel-tool-wrapper"
            onMouseEnter={() => {
              setHoveredThreadId(thread.id);
              // Сбрасываем режим удаления при наведении на другой чат
              if (deletingThreadId && deletingThreadId !== thread.id) {
                setDeletingThreadId(null);
              }
            }}
            onMouseLeave={() => {
              if (deletingThreadId !== thread.id) {
                setHoveredThreadId(null);
              }
            }}
          >
            {hoveredThreadId === thread.id && deletingThreadId !== thread.id && editingIconThreadId !== thread.id && (
              <button
                className="bottom-panel-delete-btn"
                onClick={(e) => handleDeleteClick(e, thread.id)}
                title="Удалить чат"
              >
                <Icon src={ICONS.close} size="sm" />
              </button>
            )}
            <button
              ref={(el) => {
                buttonRefs.current[thread.id] = el;
              }}
              className={`bottom-panel-tool ${activeThreadId === thread.id ? 'bottom-panel-tool--active' : ''} ${deletingThreadId === thread.id ? 'bottom-panel-tool--deleting' : ''}`}
              onClick={(e) => {
                if (deletingThreadId === thread.id) {
                  // Если в режиме удаления, удаляем чат
                  e.stopPropagation();
                  handleDeleteClick(e, thread.id);
                  return;
                }
                if (editingIconThreadId === thread.id) {
                  // Если в режиме редактирования, не переключаем чат
                  e.stopPropagation();
                  return;
                }
                const wasDoubleClick = handleDoubleClick(e, thread.id);
                // Обычный клик - переключаем чат (только если не был двойной клик)
                if (!wasDoubleClick) {
                  setTimeout(() => {
                    if (editingIconThreadId !== thread.id && doubleClickTimerRef.current[thread.id] === undefined) {
                      onThreadSelect?.(thread.id);
                    }
                  }, 300);
                }
              }}
              onTouchStart={() => handleLongPressStart(thread.id)}
              onTouchEnd={() => handleLongPressEnd(thread.id)}
              onMouseDown={() => handleLongPressStart(thread.id)}
              onMouseUp={() => handleLongPressEnd(thread.id)}
              onMouseLeave={() => handleLongPressEnd(thread.id)}
              title={thread.title}
            >
              <Icon src={deletingThreadId === thread.id ? ICONS.close : getThreadIcon(thread.id)} size="md" />
            </button>
          </div>
        ))}
        <button
          className="bottom-panel-tool"
          onClick={() => {
            window.location.href = '/spaces';
          }}
          title="Пространства"
        >
          <Icon src={ICONS.flame} size="md" />
        </button>
      </div>
      {editingIconThreadId && iconPosition && (
        <IconSelector
          position={iconPosition}
          onSelect={(iconName) => handleIconChange(editingIconThreadId, iconName)}
          onClose={() => {
            setEditingIconThreadId(null);
            setIconPosition(null);
          }}
          currentIcon={getThreadIcon(editingIconThreadId)}
        />
      )}
    </div>
  );
};

