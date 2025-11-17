import React, { useState, useEffect, useRef } from 'react';
import { Icon } from '../../ui/Icon';
import { ICONS } from '../../../utils/icons';
import { useLanguage } from '../../../contexts/LanguageContext';
import { getTranslation } from '../../../utils/i18n';
import './NotificationPanel.css';

interface NotificationPanelProps {
  onClose?: () => void;
}

export const NotificationPanel: React.FC<NotificationPanelProps> = ({ onClose }) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const { language } = useLanguage();

  // Закрытие панели при клике вне её
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose?.();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  return (
    <div className="notification-panel" ref={panelRef}>
      <div className="notification-panel-header">
        <h3 className="notification-panel-title">Уведомления</h3>
        {onClose && (
          <button
            className="notification-panel-close-btn"
            onClick={onClose}
            title="Закрыть"
          >
            <Icon src={ICONS.close} size="sm" />
          </button>
        )}
      </div>

      <div className="notification-panel-content">
        <div className="notification-panel-empty">
          <Icon src={ICONS.bell} size="lg" />
          <p>Нет уведомлений</p>
        </div>
      </div>
    </div>
  );
};

