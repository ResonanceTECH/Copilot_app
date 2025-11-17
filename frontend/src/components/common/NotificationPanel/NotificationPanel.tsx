import React, { useState, useEffect, useRef } from 'react';
import { Icon } from '../../ui/Icon';
import { ICONS } from '../../../utils/icons';
import { spacesAPI } from '../../../utils/api';
import { NotificationSettings, Space } from '../../../types';
import { useLanguage } from '../../../contexts/LanguageContext';
import { getTranslation } from '../../../utils/i18n';
import './NotificationPanel.css';

interface NotificationPanelProps {
  onClose?: () => void;
}

export const NotificationPanel: React.FC<NotificationPanelProps> = ({ onClose }) => {
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
  const { language } = useLanguage();

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

  // Закрытие при клике вне панели
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
          <h3 className="notification-panel-title">Настройки уведомлений</h3>
          <button className="notification-panel-close" onClick={() => onClose?.()}>
            <Icon src={ICONS.close} size="md" />
          </button>
        </div>

        <div className="notification-panel-content">
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
        </div>
      </div>
    </div>
  );
};
