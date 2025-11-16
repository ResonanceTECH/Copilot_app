import React, { useEffect, useRef } from 'react';
import { Icon } from '../../ui/Icon';
import { ICONS } from '../../../utils/icons';
import './ThreadContextMenu.css';

interface ThreadContextMenuProps {
  threadId: string;
  position: { x: number; y: number };
  onClose: () => void;
  onDelete: (threadId: string) => void;
  onRename: (threadId: string) => void;
}

export const ThreadContextMenu: React.FC<ThreadContextMenuProps> = ({
  threadId,
  position,
  onClose,
  onDelete,
  onRename,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

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
      <button className="thread-context-menu-item" onClick={handleDelete}>
        <Icon src={ICONS.trash} size="sm" />
        <span>Удалить Thread</span>
      </button>
      <button className="thread-context-menu-item" onClick={handleRename}>
        <Icon src={ICONS.edit} size="sm" />
        <span>Переименовать</span>
      </button>
    </div>
  );
};

