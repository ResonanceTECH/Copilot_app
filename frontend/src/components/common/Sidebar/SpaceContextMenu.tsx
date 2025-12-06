import React, { useEffect, useRef } from 'react';
import { Icon } from '../../ui/Icon';
import { ICONS } from '../../../utils/icons';
import starFilledIcon from '../../../assets/icons/star-filled.svg';
import './ThreadContextMenu.css';

interface SpaceContextMenuProps {
  spaceId: number;
  position: { x: number; y: number };
  onClose: () => void;
  onDelete: (spaceId: number) => void;
  onRename: (spaceId: number) => void;
  onUnpin: (spaceId: number) => void;
  isPinned?: boolean;
}

export const SpaceContextMenu: React.FC<SpaceContextMenuProps> = ({
  spaceId,
  position,
  onClose,
  onDelete,
  onRename,
  onUnpin,
  isPinned = false,
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
    onDelete(spaceId);
    onClose();
  };

  const handleRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRename(spaceId);
    onClose();
  };

  const handleUnpin = (e: React.MouseEvent) => {
    e.stopPropagation();
    onUnpin(spaceId);
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
      {isPinned && (
        <button className="thread-context-menu-item thread-context-menu-item--pin" onClick={handleUnpin}>
          <Icon src={starFilledIcon} size="sm" className="thread-context-menu-star-icon" />
          <span>Открепить</span>
        </button>
      )}
      <button className="thread-context-menu-item" onClick={handleRename}>
        <Icon src={ICONS.edit} size="sm" />
        <span>Переименовать</span>
      </button>
      <button className="thread-context-menu-item" onClick={handleDelete}>
        <Icon src={ICONS.trash} size="sm" />
        <span>Удалить</span>
      </button>
    </div>
  );
};
