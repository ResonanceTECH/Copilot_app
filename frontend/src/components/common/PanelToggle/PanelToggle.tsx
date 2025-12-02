import React, { useState, useRef, useEffect } from 'react';
import { Icon } from '../../ui/Icon';
import { ICONS } from '../../../utils/icons';
import bottomBarIcon from '../../../assets/icons/bottom-bar.svg';
import './PanelToggle.css';

interface PanelToggleProps {
  panelMode: 'sidebar' | 'bottom';
  onPanelModeChange: (mode: 'sidebar' | 'bottom') => void;
  position: { side: 'left' | 'right' | 'top' | 'bottom'; offset: number };
  onPositionChange: (position: { side: 'left' | 'right' | 'top' | 'bottom'; offset: number }) => void;
}

export const PanelToggle: React.FC<PanelToggleProps> = ({
  panelMode,
  onPanelModeChange,
  position,
  onPositionChange,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left mouse button
    setIsDragging(true);
    const rect = panelRef.current?.getBoundingClientRect();
    if (rect) {
      setDragStart({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
      setDragOffset({ x: 0, y: 0 });
    }
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = panelRef.current?.getBoundingClientRect();
      if (!rect) return;

      const newX = e.clientX - dragStart.x;
      const newY = e.clientY - dragStart.y;

      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;
      const panelWidth = rect.width;
      const panelHeight = rect.height;

      // Определяем, к какому краю ближе
      const distToLeft = newX;
      const distToRight = windowWidth - newX - panelWidth;
      const distToTop = newY;
      const distToBottom = windowHeight - newY - panelHeight;

      const minDist = Math.min(distToLeft, distToRight, distToTop, distToBottom);

      let newSide: 'left' | 'right' | 'top' | 'bottom';
      let newOffset: number;

      if (minDist === distToLeft) {
        newSide = 'left';
        newOffset = ((newY + panelHeight / 2) / windowHeight) * 100;
      } else if (minDist === distToRight) {
        newSide = 'right';
        newOffset = ((newY + panelHeight / 2) / windowHeight) * 100;
      } else if (minDist === distToTop) {
        newSide = 'top';
        newOffset = ((newX + panelWidth / 2) / windowWidth) * 100;
      } else {
        newSide = 'bottom';
        newOffset = ((newX + panelWidth / 2) / windowWidth) * 100;
      }

      // Ограничиваем offset от 5% до 95%
      newOffset = Math.max(5, Math.min(95, newOffset));

      setDragOffset({ x: newX, y: newY });
      onPositionChange({ side: newSide, offset: newOffset });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setDragOffset({ x: 0, y: 0 });
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStart, onPositionChange]);

  const getStyle = (): React.CSSProperties => {
    const baseStyle: React.CSSProperties = {
      position: 'fixed',
      zIndex: 200,
      display: 'flex',
      flexDirection: position.side === 'left' || position.side === 'right' ? 'column' : 'row',
      gap: '8px',
      background: 'var(--color-sidebar-bg)',
      padding: '8px 4px',
      boxShadow: 'var(--shadow-md)',
      cursor: isDragging ? 'grabbing' : 'grab',
      userSelect: 'none',
    };

    if (isDragging && dragOffset.x !== 0 && dragOffset.y !== 0) {
      return {
        ...baseStyle,
        left: `${dragOffset.x}px`,
        top: `${dragOffset.y}px`,
        transform: 'none',
      };
    }

    switch (position.side) {
      case 'left':
        return {
          ...baseStyle,
          left: 0,
          top: `${position.offset}%`,
          transform: 'translateY(-50%)',
          borderRight: '1px solid var(--color-border)',
          borderTopRightRadius: '12px',
          borderBottomRightRadius: '12px',
        };
      case 'right':
        return {
          ...baseStyle,
          right: 0,
          top: `${position.offset}%`,
          transform: 'translateY(-50%)',
          borderLeft: '1px solid var(--color-border)',
          borderTopLeftRadius: '12px',
          borderBottomLeftRadius: '12px',
        };
      case 'top':
        return {
          ...baseStyle,
          top: 0,
          left: `${position.offset}%`,
          transform: 'translateX(-50%)',
          borderBottom: '1px solid var(--color-border)',
          borderBottomLeftRadius: '12px',
          borderBottomRightRadius: '12px',
        };
      case 'bottom':
        return {
          ...baseStyle,
          bottom: 0,
          left: `${position.offset}%`,
          transform: 'translateX(-50%)',
          borderTop: '1px solid var(--color-border)',
          borderTopLeftRadius: '12px',
          borderTopRightRadius: '12px',
        };
    }
  };

  return (
    <div
      ref={panelRef}
      className="panel-toggle"
      style={getStyle()}
      onMouseDown={handleMouseDown}
    >
      <button
        className={`panel-toggle-btn ${panelMode === 'sidebar' ? 'panel-toggle-btn--active' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          onPanelModeChange('sidebar');
        }}
        title="Боковая панель"
      >
        <Icon src={ICONS.menu} size="sm" />
      </button>
      <button
        className={`panel-toggle-btn ${panelMode === 'bottom' ? 'panel-toggle-btn--active' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          onPanelModeChange('bottom');
        }}
        title="Нижняя панель"
      >
        <Icon src={bottomBarIcon} size="sm" />
      </button>
    </div>
  );
};

