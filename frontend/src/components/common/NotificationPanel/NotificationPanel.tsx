import React, { useState, useEffect, useRef } from 'react';
import { Icon } from '../../ui/Icon';
import { ICONS } from '../../../utils/icons';
import { spacesAPI, notificationAPI } from '../../../utils/api';
import { NotificationSettings, Space, Notification } from '../../../types';
import { useLanguage } from '../../../contexts/LanguageContext';
import './NotificationPanel.css';

interface NotificationPanelProps {
  onClose?: () => void;
}

export const NotificationPanel: React.FC<NotificationPanelProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'notifications' | 'settings'>('notifications');
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [selectedSpaceId, setSelectedSpaceId] = useState<number | null>(null);
  const [settings, setSettings] = useState<NotificationSettings>({
    new_message: true,
    new_note: true,
    new_file: true,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const { language: _language } = useLanguage();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  // Загрузка пространств
  useEffect(() => {
    const loadSpaces = async () => {
      try {
        const response = await spacesAPI.getSpaces(false, 100, 0);
        setSpaces(response.spaces);
        if (response.spaces.length > 0) {
          setSelectedSpaceId(response.spaces[0].id);
        }
      } catch (error: any) {
        console.error('Ошибка загрузки пространств:', error);
        setError(error.message || 'Ошибка загрузки пространств');
      }
    };
    loadSpaces();
  }, []);

  // Загрузка настроек при выборе пространства
  useEffect(() => {
    if (selectedSpaceId) {
      loadSettings(selectedSpaceId);
    }
  }, [selectedSpaceId]);

  const loadSettings = async (spaceId: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await spacesAPI.getNotificationSettings(spaceId);
      setSettings(response.settings_json);
    } catch (error: any) {
      console.error('Ошибка загрузки настроек:', error);
      setError(error.message || 'Ошибка загрузки настроек');
      // Устанавливаем настройки по умолчанию
      setSettings({
        new_message: true,
        new_note: true,
        new_file: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedSpaceId) return;

    setIsSaving(true);
    setError(null);
    try {
      await spacesAPI.updateNotificationSettings(selectedSpaceId, {
        settings_json: settings,
      });
      onClose?.();
    } catch (error: any) {
      console.error('Ошибка сохранения настроек:', error);
      setError(error.message || 'Ошибка сохранения настроек');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggle = (key: keyof NotificationSettings) => {
    setSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Закрытие по Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

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
    <div className="notification-panel-overlay" onClick={() => onClose?.()}>
      <div className="notification-panel" ref={panelRef} onClick={(e) => e.stopPropagation()}>
        <div className="notification-panel-header">
          <div className="notification-panel-header-left">
            <button className="notification-panel-back" onClick={() => onClose?.()} title="Закрыть">
              <Icon src={ICONS.arrowLeft} size="md" />
            </button>
            <h3 className="notification-panel-title">Уведомления</h3>
          </div>
          <button className="notification-panel-close" onClick={() => onClose?.()} title="Закрыть">
            <Icon src={ICONS.close} size="md" />
          </button>
        </div>

        <div className="notification-panel-tabs">
          <button
            className={activeTab === 'notifications' ? 'active' : ''}
            onClick={() => setActiveTab('notifications')}
          >
            Уведомления
            {unreadCount > 0 && (
              <span className="notification-tab-badge">{unreadCount}</span>
            )}
          </button>
          <button
            className={activeTab === 'settings' ? 'active' : ''}
            onClick={() => setActiveTab('settings')}
          >
            Настройки
          </button>
        </div>

        <div className="notification-panel-content">
          {activeTab === 'notifications' ? (
            <>
              {loading ? (
                <div className="notification-panel-loading">
                  <p>Загрузка уведомлений...</p>
                </div>
              ) : notifications.length === 0 ? (
                <div className="notification-panel-empty">
                  <p>Нет уведомлений</p>
                </div>
              ) : (
                <>
                  {unreadCount > 0 && (
                    <div className="notification-panel-actions-top">
                      <button
                        className="notification-panel-btn notification-panel-btn--secondary"
                        onClick={handleMarkAllAsRead}
                      >
                        Отметить все как прочитанные
                      </button>
                    </div>
                  )}
                  <div className="notification-list">
                    {notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={`notification-item ${!notification.is_read ? 'unread' : ''}`}
                      >
                        <div className="notification-item-content">
                          <div className="notification-item-header">
                            <span className="notification-item-title">{notification.title}</span>
                            <span className="notification-item-date">{formatDate(notification.created_at)}</span>
                          </div>
                          {notification.message && (
                            <p className="notification-item-message">{notification.message}</p>
                          )}
                          <div className="notification-item-footer">
                            {notification.space_id && (
                              <span className="notification-item-space">Пространство: {notification.space_id}</span>
                            )}
                            <div className="notification-item-actions">
                              {!notification.is_read && (
                                <button
                                  className="notification-item-btn"
                                  onClick={() => handleMarkAsRead(notification.id)}
                                  title="Отметить как прочитанное"
                                >
                                  ✓
                                </button>
                              )}
                              <button
                                className="notification-item-btn"
                                onClick={() => handleDelete(notification.id)}
                                title="Удалить"
                              >
                                <Icon src={ICONS.trash} size="sm" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              {spaces.length === 0 ? (
                <div className="notification-panel-empty">
                  <p>Нет доступных пространств</p>
                </div>
              ) : (
                <>
                  <div className="notification-panel-space-selector">
                    <label className="notification-panel-label">Пространство:</label>
                    <select
                      className="notification-panel-select"
                      value={selectedSpaceId || ''}
                      onChange={(e) => setSelectedSpaceId(Number(e.target.value))}
                    >
                      {spaces.map((space) => (
                        <option key={space.id} value={space.id}>
                          {space.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {isLoading ? (
                    <div className="notification-panel-loading">
                      <p>Загрузка настроек...</p>
                    </div>
                  ) : (
                    <>
                      {error && (
                        <div className="notification-panel-error">
                          <p>{error}</p>
                        </div>
                      )}

                      <div className="notification-panel-settings">
                        <div className="notification-setting-item">
                          <div className="notification-setting-info">
                            <span className="notification-setting-label">Новые сообщения</span>
                            <span className="notification-setting-description">
                              Уведомления о новых сообщениях в чатах
                            </span>
                          </div>
                          <label className="notification-toggle">
                            <input
                              type="checkbox"
                              checked={settings.new_message}
                              onChange={() => handleToggle('new_message')}
                            />
                            <span className="notification-toggle-slider"></span>
                          </label>
                        </div>

                        <div className="notification-setting-item">
                          <div className="notification-setting-info">
                            <span className="notification-setting-label">Новые заметки</span>
                            <span className="notification-setting-description">
                              Уведомления о создании новых заметок
                            </span>
                          </div>
                          <label className="notification-toggle">
                            <input
                              type="checkbox"
                              checked={settings.new_note}
                              onChange={() => handleToggle('new_note')}
                            />
                            <span className="notification-toggle-slider"></span>
                          </label>
                        </div>

                        <div className="notification-setting-item">
                          <div className="notification-setting-info">
                            <span className="notification-setting-label">Новые файлы</span>
                            <span className="notification-setting-description">
                              Уведомления о загрузке новых файлов
                            </span>
                          </div>
                          <label className="notification-toggle">
                            <input
                              type="checkbox"
                              checked={settings.new_file}
                              onChange={() => handleToggle('new_file')}
                            />
                            <span className="notification-toggle-slider"></span>
                          </label>
                        </div>
                      </div>

                      <div className="notification-panel-actions">
                        <button
                          className="notification-panel-btn notification-panel-btn--secondary"
                          onClick={() => onClose?.()}
                        >
                          Отмена
                        </button>
                        <button
                          className="notification-panel-btn notification-panel-btn--primary"
                          onClick={handleSave}
                          disabled={isSaving}
                        >
                          {isSaving ? 'Сохранение...' : 'Сохранить'}
                        </button>
                      </div>
                    </>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
