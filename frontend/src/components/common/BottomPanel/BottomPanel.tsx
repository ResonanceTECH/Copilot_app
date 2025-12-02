import React, { useState, useEffect, useRef } from 'react';
import { Icon } from '../../ui/Icon';
import { ICONS } from '../../../utils/icons';
import { ChatThread } from '../../../types';
import { useLanguage } from '../../../contexts/LanguageContext';
import { getTranslation } from '../../../utils/i18n';
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
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Отмена удаления при клике вне области
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (deletingThreadId && wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setDeletingThreadId(null);
        setHoveredThreadId(null);
      }
    };

    if (deletingThreadId) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [deletingThreadId]);

  const handleDeleteClick = (e: React.MouseEvent, threadId: string) => {
    e.stopPropagation();
    if (deletingThreadId === threadId) {
      // Второй клик - удаляем чат
      onThreadDelete?.(threadId);
      setDeletingThreadId(null);
      setHoveredThreadId(null);
    } else {
      // Первый клик - заменяем иконку на крестик
      setDeletingThreadId(threadId);
    }
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
            {hoveredThreadId === thread.id && deletingThreadId !== thread.id && (
              <button
                className="bottom-panel-delete-btn"
                onClick={(e) => handleDeleteClick(e, thread.id)}
                title="Удалить чат"
              >
                <Icon src={ICONS.close} size="sm" />
              </button>
            )}
            <button
              className={`bottom-panel-tool ${activeThreadId === thread.id ? 'bottom-panel-tool--active' : ''} ${deletingThreadId === thread.id ? 'bottom-panel-tool--deleting' : ''}`}
              onClick={(e) => {
                if (deletingThreadId === thread.id) {
                  // Если в режиме удаления, удаляем чат
                  e.stopPropagation();
                  handleDeleteClick(e, thread.id);
                  return;
                }
                onThreadSelect?.(thread.id);
              }}
              title={thread.title}
            >
              <Icon src={deletingThreadId === thread.id ? ICONS.close : ICONS.rocket} size="md" />
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
    </div>
  );
};

