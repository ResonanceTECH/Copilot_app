import React, { useState, useEffect, useRef } from 'react';
import { Icon } from '../../ui/Icon';
import { ICONS } from '../../../utils/icons';

import { spacesAPI } from '../../../utils/api';
import { NotificationSettings, Space } from '../../../types';

import { useLanguage } from '../../../contexts/LanguageContext';
import { getTranslation } from '../../../utils/i18n';
import { notificationAPI } from '../../../utils/api';
import type { Notification } from '../../../types';
import './NotificationPanel.css';

interface NotificationPanelProps {
  onClose?: () => void;
}

export const NotificationPanel: React.FC<NotificationPanelProps> = ({ onClose }) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const { language } = useLanguage();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  // Загрузка уведомлений
  const loadNotifications = async () => {
    try {
      setLoading(true);
      const response = await notificationAPI.getNotifications({ limit: 50 });
      setNotifications(response.notifications);
      setUnreadCount(response.unread_count);
    } catch (error) {
      console.error('Ошибка загрузки уведомлений:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
    // Обновляем уведомления каждые 30 секунд
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  // Отметить как прочитанное
  const handleMarkAsRead = async (notificationId: number) => {
    try {
      await notificationAPI.markAsRead(notificationId);
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Ошибка отметки уведомления:', error);
    }
  };

  // Отметить все как прочитанные
  const handleMarkAllAsRead = async () => {
    try {
      await notificationAPI.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Ошибка отметки всех уведомлений:', error);
    }
  };

  // Удалить уведомление
  const handleDelete = async (notificationId: number) => {
    try {
      await notificationAPI.deleteNotification(notificationId);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      const deleted = notifications.find(n => n.id === notificationId);
      if (deleted && !deleted.is_read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Ошибка удаления уведомления:', error);
    }
  };

  // Форматирование даты
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Только что';
    if (minutes < 60) return `${minutes} мин. назад`;
    if (hours < 24) return `${hours} ч. назад`;
    if (days < 7) return `${days} дн. назад`;
    return date.toLocaleDateString('ru-RU');
  };

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
        <div className="notification-panel-header-left">
          <h3 className="notification-panel-title">Уведомления</h3>
          {unreadCount > 0 && (
            <span className="notification-panel-badge">{unreadCount}</span>
          )}
        </div>
        <div className="notification-panel-header-actions">
          {unreadCount > 0 && (
            <button
              className="notification-panel-mark-all-btn"
              onClick={handleMarkAllAsRead}
              title="Отметить все как прочитанные"
            >
              Прочитать все
            </button>
          )}
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
      </div>

      <div className="notification-panel-content">
        {loading ? (
          <div className="notification-panel-loading">
            <p>Загрузка...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="notification-panel-empty">
            <Icon src={ICONS.bell} size="lg" />
            <p>Нет уведомлений</p>
          </div>
        ) : (
          <div className="notification-panel-list">
            {notifications.map(notification => (
              <div
                key={notification.id}
                className={`notification-item ${!notification.is_read ? 'notification-item-unread' : ''}`}
                onClick={() => !notification.is_read && handleMarkAsRead(notification.id)}
              >
                <div className="notification-item-content">
                  <div className="notification-item-header">
                    <h4 className="notification-item-title">{notification.title}</h4>
                    {!notification.is_read && (
                      <span className="notification-item-dot"></span>
                    )}
                  </div>
                  {notification.message && (
                    <p className="notification-item-message">{notification.message}</p>
                  )}
                  <span className="notification-item-time">
                    {formatDate(notification.created_at)}
                  </span>
                </div>
                <button
                  className="notification-item-delete-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(notification.id);
                  }}
                  title="Удалить"
                >
                  <Icon src={ICONS.close} size="xs" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
