import React, { useEffect, useRef } from 'react';
import { Icon } from '../../ui/Icon';
import { ICONS } from '../../../utils/icons';
import { useLanguage } from '../../../contexts/LanguageContext';
import { getTranslation } from '../../../utils/i18n';
import starIcon from '../../../assets/icons/star.svg';
import starFilledIcon from '../../../assets/icons/star-filled.svg';
import './ThreadContextMenu.css';

interface ThreadContextMenuProps {
  threadId: string;
  position: { x: number; y: number };
  onClose: () => void;
  onDelete: (threadId: string) => void;
  onRename: (threadId: string) => void;
  onPin?: (threadId: string) => void;
  isPinned?: boolean;
}

export const ThreadContextMenu: React.FC<ThreadContextMenuProps> = ({
  threadId,
  position,
  onClose,
  onDelete,
  onRename,
  onPin,
  isPinned = false,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const { language } = useLanguage();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(threadId);
    onClose();
  };

  const handleRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRename(threadId);
    onClose();
  };

  const handlePin = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onPin) {
      onPin(threadId);
    }
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className="thread-context-menu"
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
    >
      {onPin && (
        <button className="thread-context-menu-item thread-context-menu-item--pin" onClick={handlePin}>
          <Icon src={isPinned ? starFilledIcon : starIcon} size="sm" className="thread-context-menu-star-icon" />
          <span>{getTranslation(isPinned ? 'unpinThread' : 'pinThread', language)}</span>
        </button>
      )}
      <button className="thread-context-menu-item" onClick={handleRename}>
        <Icon src={ICONS.edit} size="sm" />
        <span>{getTranslation('rename', language)}</span>
      </button>
      <button className="thread-context-menu-item" onClick={handleDelete}>
        <Icon src={ICONS.trash} size="sm" />
        <span>{getTranslation('deleteThread', language)}</span>
      </button>
    </div>
  );
};

