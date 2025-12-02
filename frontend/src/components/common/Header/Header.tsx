import React, { useState, useEffect, useRef } from 'react';
import { Icon } from '../../ui/Icon';
import { ICONS } from '../../../utils/icons';
import { NotificationPanel } from '../NotificationPanel';
import { notificationAPI } from '../../../utils/api';
import { useLanguage } from '../../../contexts/LanguageContext';
import { useAuth } from '../../../contexts/AuthContext';
import { getTranslation, getLanguageName, Language } from '../../../utils/i18n';
import './Header.css';

interface HeaderProps {
  title?: string;
  threadId?: string | null;
  onRename?: (threadId: string, newTitle: string) => void;
  activeTool?: string;
  onToolSelect?: (tool: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  threadId,
  onRename,
  activeTool = 'assistant',
  onToolSelect,
}) => {
  const { language, setLanguage } = useLanguage();
  const { logout } = useAuth();
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showNotificationPanel, setShowNotificationPanel] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Загрузка количества непрочитанных уведомлений
  useEffect(() => {
    const loadUnreadCount = async () => {
      try {
        const response = await notificationAPI.getUnreadCount();
        setUnreadCount(response.unread_count);
      } catch (error) {
        console.error('Ошибка загрузки количества уведомлений:', error);
      }
    };

    loadUnreadCount();
    // Обновляем каждые 30 секунд
    const interval = setInterval(loadUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);
  const [isEditing, setIsEditing] = useState(false);
  const [editingTitle, setEditingTitle] = useState('');
  const [isModelSelectorVisible, setIsModelSelectorVisible] = useState(false);
  const [showModelTooltip, setShowModelTooltip] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const profileDropdownRef = useRef<HTMLDivElement>(null);
  const modelSelectorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowLanguageDropdown(false);
      }
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target as Node)) {
        setShowProfileDropdown(false);
      }
      if (modelSelectorRef.current && !modelSelectorRef.current.contains(event.target as Node)) {
        setIsModelSelectorVisible(false);
      }
    };

    if (showLanguageDropdown || showProfileDropdown || isModelSelectorVisible) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showLanguageDropdown, showProfileDropdown, isModelSelectorVisible]);

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
    setShowLanguageDropdown(false);
  };

  const handleTitleClick = () => {
    if (threadId && onRename) {
      setIsEditing(true);
      setEditingTitle(title || '');
    }
  };

  const handleRenameSubmit = (e: React.FormEvent) => {
    e.stopPropagation();
    if (threadId && onRename && editingTitle.trim()) {
      onRename(threadId, editingTitle.trim());
    }
    setIsEditing(false);
    setEditingTitle('');
  };

  const handleRenameCancel = () => {
    setIsEditing(false);
    setEditingTitle('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleRenameSubmit(e);
    } else if (e.key === 'Escape') {
      handleRenameCancel();
    }
  };

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Скрываем селектор модели на страницах пространств и настроек
  const [currentPath, setCurrentPath] = useState(() => window.location.pathname);

  useEffect(() => {
    // Отслеживаем изменения пути
    const updatePath = () => {
      setCurrentPath(window.location.pathname);
    };

    // Обновляем сразу при монтировании
    updatePath();

    // Обновляем при изменении пути через popstate
    window.addEventListener('popstate', updatePath);

    // Проверяем путь периодически (на случай программной навигации)
    const interval = setInterval(updatePath, 100);

    return () => {
      window.removeEventListener('popstate', updatePath);
      clearInterval(interval);
    };
  }, []);

  // Проверяем путь напрямую для надежности
  const path = currentPath || window.location.pathname;
  const isSpacesPage = path === '/spaces' || path.startsWith('/spaces/');
  const isSettingsPage = path === '/settings' || path.startsWith('/settings');
  // Скрываем селектор модели на страницах пространств, настроек и в панели поддержки
  const isSupportPanel = title === 'Поддержка' || title === getTranslation('support', language);
  const shouldHideModelSelector = isSpacesPage || isSettingsPage || isSupportPanel;

  // Используем переданный title, если он есть, иначе fallback
  const displayTitle = title || (isSettingsPage ? getTranslation('support', language) : getTranslation('thread', language));
  const currentModelName = activeTool === 'assistant'
    ? getTranslation('assistant', language)
    : getTranslation('deepseekChimera', language);

  // Закрываем меню модели при переходе на страницы, где оно не нужно
  useEffect(() => {
    if (shouldHideModelSelector && isModelSelectorVisible) {
      setIsModelSelectorVisible(false);
    }
  }, [shouldHideModelSelector, isModelSelectorVisible]);

  const handleModelSelect = (tool: string) => {
    onToolSelect?.(tool);
    setIsModelSelectorVisible(false);
  };

  const handleProfileClick = () => {
    setShowProfileDropdown(false);
    window.location.href = '/profile';
  };

  const handleLogout = async () => {
    try {
      await logout();
      // Перенаправление на страницу входа произойдет автоматически через AuthContext
      window.location.href = '/login';
    } catch (error) {
      console.error('Ошибка при выходе:', error);
    }
  };

  return (
    <header className="header">
      <div className="header-left">
        <div className="header-logo-group">
          {path === '/spaces' && (
            <button
              className="header-back-btn"
              onClick={() => {
                window.location.href = '/';
              }}
              title="Назад к ассистенту"
            >
              <Icon src={ICONS.arrowLeft} size="sm" />
            </button>
          )}
          {!shouldHideModelSelector && (
            <div className="header-model-selector" ref={modelSelectorRef}>
              <button
                className="header-model-btn"
                onClick={() => setIsModelSelectorVisible(!isModelSelectorVisible)}
                onMouseEnter={() => setShowModelTooltip(true)}
                onMouseLeave={() => setShowModelTooltip(false)}
              >
                <Icon src={ICONS.brain} size="md" />
                {showModelTooltip && !isModelSelectorVisible && (
                  <div className="header-model-tooltip">{currentModelName}</div>
                )}
              </button>
              {isModelSelectorVisible && (
                <div className="header-model-dropdown">
                  <button
                    className={`header-model-option ${activeTool === 'assistant' ? 'header-model-option--active' : ''}`}
                    onClick={() => handleModelSelect('assistant')}
                  >
                    {getTranslation('assistant', language)}
                  </button>
                  <button
                    className={`header-model-option ${activeTool === 'deepseek-chimera' ? 'header-model-option--active' : ''}`}
                    onClick={() => handleModelSelect('deepseek-chimera')}
                  >
                    {getTranslation('deepseekChimera', language)}
                  </button>
                </div>
              )}
            </div>
          )}
          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              className="header-title-input"
              value={editingTitle}
              onChange={(e) => setEditingTitle(e.target.value)}
              onBlur={handleRenameSubmit}
              onKeyDown={handleKeyDown}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <button className="header-title-btn" onClick={handleTitleClick}>
              <span className="header-title">{displayTitle}</span>
              <Icon src={ICONS.chevronDown} size="sm" />
            </button>
          )}
        </div>
      </div>
      <div className="header-right">
        <button
          className="header-notification-btn"
          title={getTranslation('notifications', language)}
          onClick={() => setShowNotificationPanel(true)}
        >
          <Icon src={ICONS.bell} size="md" />
          {unreadCount > 0 && (
            <span className="header-notification-badge">{unreadCount}</span>
          )}
        </button>
        <div className="header-language-selector" ref={dropdownRef}>
          <button
            className="header-language-btn"
            onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
          >
            <span>{getLanguageName(language)}</span>
            <Icon src={ICONS.chevronDown} size="sm" />
          </button>
          {showLanguageDropdown && (
            <div className="header-language-dropdown">
              <button onClick={() => handleLanguageChange('en')}>
                {getTranslation('english', 'en')}
              </button>
              <button onClick={() => handleLanguageChange('ru')}>
                {getTranslation('russian', 'ru')}
              </button>
            </div>
          )}
        </div>
        <div className="header-profile-selector" ref={profileDropdownRef}>
          <button
            className="header-avatar-btn"
            onClick={() => setShowProfileDropdown(!showProfileDropdown)}
            title="User profile"
          >
            <Icon src={ICONS.user} size="md" />
          </button>
          {showProfileDropdown && (
            <div className="header-profile-dropdown">
              <button onClick={handleProfileClick}>
                {getTranslation('personalCabinet', language)}
              </button>
              <div className="header-profile-dropdown-divider"></div>
              <button onClick={handleLogout}>
                {getTranslation('logout', language)}
              </button>
            </div>
          )}
        </div>
      </div>
      {showNotificationPanel && (
        <NotificationPanel onClose={() => setShowNotificationPanel(false)} />
      )}
    </header>
  );
};
