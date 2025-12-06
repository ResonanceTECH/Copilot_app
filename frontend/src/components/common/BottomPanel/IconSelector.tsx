import React, { useState, useEffect } from 'react';
import { Icon } from '../../ui/Icon';
import { ICONS, IconName } from '../../../utils/icons';
import './IconSelector.css';

interface IconSelectorProps {
  position: { x: number; y: number };
  onSelect: (iconName: IconName) => void;
  onClose: () => void;
  currentIcon?: IconName;
}

// Пакеты иконок (по 16 иконок на страницу)
const ICON_PACKS: IconName[][] = [
  // Пакет 1: Основные
  [
    'rocket',
    'flame',
    'brain',
    'cloud',
    'sparkle',
    'settings',
    'note',
    'bell',
    'user',
    'search',
    'archive',
    'support',
    'link',
    'copy',
    'thumbsUp',
    'thumbsDown',
  ],
  // Пакет 2: Иконки чата и дополнительные
  [
    'chat',
    'send',
    'paperclip',
    'microphone',
    'edit',
    'open',
    'menu',
    'arrowLeft',
    'plus',
    'more',
    'flag',
    'trash',
    'copy',
    'link',
    'support',
    'archive',
  ],
];

export const IconSelector: React.FC<IconSelectorProps> = ({
  position,
  onSelect,
  onClose,
  currentIcon,
}) => {
  const [currentPage, setCurrentPage] = useState(0);

  const currentIcons = ICON_PACKS[currentPage] || ICON_PACKS[0];
  const totalPages = ICON_PACKS.length;
  const canGoPrev = currentPage > 0;
  const canGoNext = currentPage < totalPages - 1;

  const handlePrevPage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (canGoPrev) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (canGoNext) {
      setCurrentPage(currentPage + 1);
    }
  };

  return (
    <>
      <div className="icon-selector-overlay" onClick={onClose} />
      <div
        className="icon-selector icon-selector--centered"
        style={{
          left: `${position.x}px`,
          bottom: `${position.y}px`,
        }}
      >
        <div className="icon-selector-grid">
          {currentIcons.map((iconName) => (
            <button
              key={iconName}
              className={`icon-selector-item ${currentIcon === iconName ? 'icon-selector-item--current' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(iconName);
                onClose();
              }}
              title={iconName}
            >
              <Icon src={iconName} size="md" />
            </button>
          ))}
        </div>
        {totalPages > 1 && (
          <div className="icon-selector-navigation">
            <button
              className={`icon-selector-nav-btn ${!canGoPrev ? 'icon-selector-nav-btn--disabled' : ''}`}
              onClick={handlePrevPage}
              disabled={!canGoPrev}
              title="Предыдущий пакет"
            >
              <Icon src={ICONS.arrowUp} size="sm" />
            </button>
            <span className="icon-selector-page-indicator">
              {currentPage + 1} / {totalPages}
            </span>
            <button
              className={`icon-selector-nav-btn ${!canGoNext ? 'icon-selector-nav-btn--disabled' : ''}`}
              onClick={handleNextPage}
              disabled={!canGoNext}
              title="Следующий пакет"
            >
              <Icon src={ICONS.chevronDown} size="sm" />
            </button>
          </div>
        )}
      </div>
    </>
  );
};
