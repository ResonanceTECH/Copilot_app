import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { userAPI } from '../../utils/api';
import type { UserProfile, UserProfileUpdate } from '../../types';
import { Icon } from '../../components/ui/Icon';
import { ICONS } from '../../utils/icons';
import { useLanguage } from '../../contexts/LanguageContext';
import { getTranslation } from '../../utils/i18n';
import { applyTheme, getTheme, watchSystemTheme, type Theme } from '../../utils/theme';
import { EfficiencyAnalytics } from './EfficiencyAnalytics';
import './UserProfilePage.css';

type ProfileSection =
  | 'account'
  | 'preferences'
  | 'efficiency'
  | 'assistant'
  | 'tasks'
  | 'notifications'
  | 'connectors'
  | 'api'
  | 'corporation';

export const UserProfilePage: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const { language, setLanguage } = useLanguage();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<ProfileSection>('account');

  // Форма редактирования
  const [formData, setFormData] = useState<UserProfileUpdate>({
    name: '',
    phone: '',
    company_name: '',
    avatar_url: null,
  });

  // Настройки
  const [settings, setSettings] = useState({
    notifications: true,
    emailNotifications: true,
    language: language,
    theme: getTheme(),
  });
  const [isThemeDropdownOpen, setIsThemeDropdownOpen] = useState(false);
  const [isLanguageDropdownOpen, setIsLanguageDropdownOpen] = useState(false);
  const [referralLink, setReferralLink] = useState<string>('');
  const [referralsCount, setReferralsCount] = useState<number>(0);
  const [isLinkCopied, setIsLinkCopied] = useState(false);
  const [isLoadingReferral, setIsLoadingReferral] = useState(false);
  const [referralError, setReferralError] = useState<string | null>(null);

  const loadProfile = async () => {
    setIsLoading(true);
    try {
      const profileData = await userAPI.getProfile();
      setProfile(profileData);
      setFormData({
        name: profileData.name,
        phone: profileData.phone || '',
        company_name: profileData.company_name || '',
        avatar_url: profileData.avatar_url,
      });
    } catch (error: any) {
      console.error('Ошибка загрузки профиля:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadProfile();
      // Автоматически загружаем реферальную информацию при загрузке профиля
      loadReferralInfo();
    }
  }, [isAuthenticated]);

  // Загружаем реферальную информацию с бэкенда
  const loadReferralInfo = async () => {
    setIsLoadingReferral(true);
    setReferralError(null);
    try {
      console.log('Начинаем загрузку реферальной информации...');
      console.log('Токен авторизации:', localStorage.getItem('access_token') ? 'Есть' : 'Отсутствует');
      console.log('API Base URL:', import.meta.env.VITE_API_BASE_URL || '/api');
      console.log('Полный URL запроса:', `${import.meta.env.VITE_API_BASE_URL || '/api'}/user/referral`);

      // Проверяем доступность бэкенда
      try {
        const healthCheck = await fetch(`${import.meta.env.VITE_API_BASE_URL || '/api'}/health`);
        console.log('Health check статус:', healthCheck.status);
      } catch (e) {
        console.error('Бэкенд недоступен!', e);
        throw new Error('Бэкенд не запущен или недоступен. Убедитесь, что сервер работает на http://localhost:8000');
      }

      const referralInfo = await userAPI.getReferralInfo();
      console.log('Ответ от API:', referralInfo);

      if (!referralInfo) {
        throw new Error('Пустой ответ от сервера');
      }

      // Используем код из ответа, но формируем ссылку на клиенте для надежности
      const baseUrl = window.location.origin;
      const code = referralInfo.referral_code || '';
      const link = referralInfo.referral_link || (code ? `${baseUrl}/register?ref=${code}` : '');

      if (!code) {
        throw new Error('Реферальный код не был сгенерирован');
      }

      setReferralLink(link);
      setReferralsCount(referralInfo.referrals_count || 0);
      setReferralError(null); // Очищаем ошибку при успехе

      console.log('Реферальная информация успешно загружена:', {
        code,
        link,
        count: referralInfo.referrals_count
      });
    } catch (error: any) {
      console.error('Ошибка загрузки реферальной информации:', error);

      // Для ошибки 404 не показываем ошибку пользователю, просто не загружаем данные
      if (error?.status === 404) {
        console.warn('Эндпоинт /api/user/referral не найден. Реферальная система может быть недоступна.');
        setReferralError(null); // Не показываем ошибку
        // Не очищаем поля - если код уже был, он останется
        return; // Просто выходим, не показывая ошибку
      }

      // Для других ошибок показываем сообщение
      let errorMessage = 'Не удалось загрузить реферальную информацию';

      if (error?.status === 401) {
        errorMessage = 'Требуется авторизация. Пожалуйста, войдите в систему заново.';
      } else if (error?.status === 500) {
        errorMessage = 'Ошибка сервера. Проверьте логи бэкенда.';
      } else if (error?.message) {
        errorMessage = error.message;
      } else if (error?.detail) {
        errorMessage = error.detail;
      }

      setReferralError(errorMessage);
      // НЕ очищаем поля при ошибке - если код уже был сгенерирован, он должен остаться
    } finally {
      setIsLoadingReferral(false);
    }
  };

  // Отслеживаем изменения системной темы, если выбрана системная тема
  useEffect(() => {
    if (settings.theme === 'system') {
      const unwatch = watchSystemTheme(() => {
        applyTheme('system');
      });
      return unwatch;
    }
  }, [settings.theme]);

  const handleThemeChange = (theme: Theme) => {
    setSettings(prev => ({ ...prev, theme }));
    applyTheme(theme);
    setIsThemeDropdownOpen(false);
  };

  const getThemeIcon = (theme: Theme) => {
    if (theme === 'light') {
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="8" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
          <path d="M8 2V1M8 15V14M2 8H1M15 8H14M3.343 3.343L2.636 2.636M13.364 13.364L12.657 12.657M3.343 12.657L2.636 13.364M13.364 2.636L12.657 3.343" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    } else if (theme === 'dark') {
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M8 3C8 3 3 3 3 8C3 13 8 13 8 13C10.761 13 13 10.761 13 8C13 5.239 10.761 3 8 3Z" fill="currentColor" />
        </svg>
      );
    } else {
      // Система - иконка монитора
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="2" y="3" width="12" height="9" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none" />
          <path d="M5 3V2C5 1.448 5.448 1 6 1H10C10.552 1 11 1.448 11 2V3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="8" cy="7.5" r="1.5" fill="currentColor" />
        </svg>
      );
    }
  };

  const getThemeLabel = (theme: Theme) => {
    if (theme === 'light') return 'Светлая';
    if (theme === 'dark') return 'Темный';
    return 'Система';
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancel = () => {
    if (profile) {
      setFormData({
        name: profile.name,
        phone: profile.phone || '',
        company_name: profile.company_name || '',
        avatar_url: profile.avatar_url,
      });
    }
    setIsEditing(false);
  };

  const handleSave = async () => {
    // Валидация
    if (!formData.name || formData.name.trim() === '') {
      alert(`${getTranslation('name', language)} ${getTranslation('fieldRequired', language)}`);
      return;
    }

    setIsSaving(true);
    try {
      const updatedProfile = await userAPI.updateProfile({
        name: formData.name?.trim(),
        phone: formData.phone?.trim() || null,
        company_name: formData.company_name?.trim() || null,
        avatar_url: formData.avatar_url,
      });
      setProfile(updatedProfile);
      setIsEditing(false);
      alert(getTranslation('profileUpdated', language));
    } catch (error: any) {
      console.error('Ошибка обновления профиля:', error);
      alert(error.message || getTranslation('profileUpdateError', language));
    } finally {
      setIsSaving(false);
    }
  };

  const handleInputChange = (field: keyof UserProfileUpdate, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString(language === 'ru' ? 'ru-RU' : 'en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  const handleCopyReferralLink = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setIsLinkCopied(true);
      setTimeout(() => setIsLinkCopied(false), 2000);
    } catch (error) {
      console.error('Ошибка копирования ссылки:', error);
      // Fallback для старых браузеров
      const textArea = document.createElement('textarea');
      textArea.value = referralLink;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setIsLinkCopied(true);
        setTimeout(() => setIsLinkCopied(false), 2000);
      } catch (err) {
        console.error('Ошибка копирования:', err);
      }
      document.body.removeChild(textArea);
    }
  };

  // Закрываем dropdown при клике вне его
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.user-profile-theme-dropdown-wrapper')) {
        setIsThemeDropdownOpen(false);
        setIsLanguageDropdownOpen(false);
      }
    };

    if (isThemeDropdownOpen || isLanguageDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isThemeDropdownOpen, isLanguageDropdownOpen]);

  if (isLoading) {
    return (
      <div className="user-profile-page">
        <div className="user-profile-loading">
          {getTranslation('loading', language)}
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="user-profile-page">
        <div className="user-profile-error">
          {getTranslation('profileNotFound', language)}
        </div>
      </div>
    );
  }

  const navigationSections = [
    {
      title: 'Аккаунт',
      items: [
        { id: 'account' as ProfileSection, label: 'Аккаунт', icon: ICONS.user },
        { id: 'preferences' as ProfileSection, label: 'Предпочтения', icon: ICONS.settings },
        { id: 'efficiency' as ProfileSection, label: 'Эффективность', icon: ICONS.user },
        { id: 'assistant' as ProfileSection, label: 'Ассистент', icon: ICONS.brain },
        { id: 'tasks' as ProfileSection, label: 'Задачи', icon: ICONS.note },
        { id: 'notifications' as ProfileSection, label: 'Уведомления', icon: ICONS.bell },
        { id: 'connectors' as ProfileSection, label: 'Реферальная система', icon: ICONS.link },
      ],
    },
    {
      title: 'Рабочее пространство',
      items: [
        { id: 'api' as ProfileSection, label: 'API', icon: ICONS.settings },
        { id: 'corporation' as ProfileSection, label: 'Корпорация', icon: ICONS.settings },
      ],
    },
  ];

  return (
    <div className="user-profile-page">
      <div className="user-profile-layout">
        <div className="user-profile-sidebar">
          <button
            className="user-profile-back-btn"
            onClick={() => {
              window.location.href = '/';
            }}
          >
            <Icon src={ICONS.arrowLeft} size="sm" />
            Назад
          </button>

          {navigationSections.map((section, sectionIndex) => (
            <div key={sectionIndex} className="user-profile-nav-section">
              <div className="user-profile-nav-section-title">{section.title}</div>
              {section.items.map((item) => (
                <button
                  key={item.id}
                  className={`user-profile-nav-item ${activeSection === item.id ? 'active' : ''}`}
                  onClick={() => setActiveSection(item.id)}
                >
                  <Icon src={item.icon} size="sm" />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          ))}
        </div>

        <div className="user-profile-content">
          <div className="user-profile-container">

            {activeSection === 'account' && (
              <div className="user-profile-section">
                <h2 className="user-profile-section-title">Аккаунт</h2>

                <div className="user-profile-account-header">
                  <div className="user-profile-avatar-section">
                    {profile.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt={profile.name}
                        className="user-profile-avatar"
                      />
                    ) : (
                      <div className="user-profile-avatar-placeholder">
                        <Icon src={ICONS.user} size="lg" />
                      </div>
                    )}
                  </div>
                  <div className="user-profile-account-info">
                    <div className="user-profile-account-name">{profile.name}</div>
                    <div className="user-profile-account-email">{profile.email}</div>
                  </div>
                </div>

                <div className="user-profile-account-details">
                  <div className="user-profile-account-item">
                    <div className="user-profile-account-item-label">Полное имя</div>
                    <div className="user-profile-account-item-value">
                      {isEditing ? (
                        <input
                          type="text"
                          className="user-profile-inline-input"
                          value={formData.name || ''}
                          onChange={(e) => handleInputChange('name', e.target.value)}
                          placeholder={getTranslation('name', language)}
                        />
                      ) : (
                        <span>{profile.name}</span>
                      )}
                    </div>
                    {!isEditing && (
                      <button
                        className="user-profile-account-item-btn"
                        onClick={handleEdit}
                      >
                        Изменить полное имя
                      </button>
                    )}
                  </div>

                  <div className="user-profile-account-item">
                    <div className="user-profile-account-item-label">Имя пользователя</div>
                    <div className="user-profile-account-item-value">
                      <span>{profile.email.split('@')[0]}</span>
                    </div>
                    <button
                      className="user-profile-account-item-btn"
                      disabled
                      title="Изменение имени пользователя недоступно"
                    >
                      Изменить имя пользователя
                    </button>
                  </div>

                  <div className="user-profile-account-item">
                    <div className="user-profile-account-item-label">Электронная почта</div>
                    <div className="user-profile-account-item-value">
                      <span>{profile.email}</span>
                    </div>
                  </div>

                  <div className="user-profile-account-item">
                    <div className="user-profile-account-item-label">Дата регистрации</div>
                    <div className="user-profile-account-item-value">
                      <span>{formatDate(profile.created_at)}</span>
                    </div>
                  </div>

                  {isEditing && (
                    <>
                      <div className="user-profile-account-item">
                        <div className="user-profile-account-item-label">
                          {getTranslation('phone', language)}
                        </div>
                        <div className="user-profile-account-item-value">
                          <input
                            type="tel"
                            className="user-profile-inline-input"
                            value={formData.phone || ''}
                            onChange={(e) => handleInputChange('phone', e.target.value)}
                            placeholder={getTranslation('phone', language)}
                          />
                        </div>
                      </div>

                      <div className="user-profile-account-item">
                        <div className="user-profile-account-item-label">
                          {getTranslation('company', language)}
                        </div>
                        <div className="user-profile-account-item-value">
                          <input
                            type="text"
                            className="user-profile-inline-input"
                            value={formData.company_name || ''}
                            onChange={(e) => handleInputChange('company_name', e.target.value)}
                            placeholder={getTranslation('company', language)}
                          />
                        </div>
                      </div>

                      <div className="user-profile-account-actions">
                        <button
                          className="user-profile-btn user-profile-btn-secondary"
                          onClick={handleCancel}
                          disabled={isSaving}
                        >
                          {getTranslation('cancel', language)}
                        </button>
                        <button
                          className="user-profile-btn user-profile-btn-primary"
                          onClick={handleSave}
                          disabled={isSaving}
                        >
                          {isSaving ? getTranslation('saving', language) : getTranslation('save', language)}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {activeSection === 'preferences' && (
              <div className="user-profile-section">
                <h2 className="user-profile-section-title">Предпочтения</h2>
                <div className="user-profile-preferences-list">
                  <div className="user-profile-preference-group">
                    <div className="user-profile-preference-left">
                      <div className="user-profile-preference-label">Внешний вид</div>
                      <div className="user-profile-preference-description">
                        Как тема выглядит на вашем устройстве
                      </div>
                    </div>
                    <div className="user-profile-preference-control">
                      <div className="user-profile-theme-dropdown-wrapper">
                        <button
                          className="user-profile-preference-button"
                          onClick={() => setIsThemeDropdownOpen(!isThemeDropdownOpen)}
                        >
                          {getThemeIcon(settings.theme)}
                          <span>{getThemeLabel(settings.theme)}</span>
                          <Icon src={ICONS.chevronDown} size="sm" />
                        </button>
                        {isThemeDropdownOpen && (
                          <div className="user-profile-theme-dropdown">
                            <button
                              className={`user-profile-theme-option ${settings.theme === 'light' ? 'active' : ''}`}
                              onClick={() => handleThemeChange('light')}
                            >
                              {getThemeIcon('light')}
                              <span>Светлая</span>
                            </button>
                            <button
                              className={`user-profile-theme-option ${settings.theme === 'dark' ? 'active' : ''}`}
                              onClick={() => handleThemeChange('dark')}
                            >
                              {getThemeIcon('dark')}
                              <span>Темный</span>
                            </button>
                            <button
                              className={`user-profile-theme-option ${settings.theme === 'system' ? 'active' : ''}`}
                              onClick={() => handleThemeChange('system')}
                            >
                              {getThemeIcon('system')}
                              <span>Система</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="user-profile-preference-group">
                    <div className="user-profile-preference-left">
                      <div className="user-profile-preference-label">Язык</div>
                      <div className="user-profile-preference-description">
                        Язык, используемый в пользовательском интерфейсе
                      </div>
                    </div>
                    <div className="user-profile-preference-control">
                      <div className="user-profile-theme-dropdown-wrapper">
                        <button
                          className="user-profile-preference-button"
                          onClick={() => setIsLanguageDropdownOpen(!isLanguageDropdownOpen)}
                        >
                          <span>{language === 'ru' ? 'Русский' : 'English'}</span>
                          <Icon src={ICONS.chevronDown} size="sm" />
                        </button>
                        {isLanguageDropdownOpen && (
                          <div className="user-profile-theme-dropdown">
                            <button
                              className={`user-profile-theme-option ${language === 'ru' ? 'active' : ''}`}
                              onClick={() => {
                                setLanguage('ru');
                                setIsLanguageDropdownOpen(false);
                              }}
                            >
                              <span>Русский</span>
                            </button>
                            <button
                              className={`user-profile-theme-option ${language === 'en' ? 'active' : ''}`}
                              onClick={() => {
                                setLanguage('en');
                                setIsLanguageDropdownOpen(false);
                              }}
                            >
                              <span>English</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="user-profile-preference-group">
                    <div className="user-profile-preference-left">
                      <div className="user-profile-preference-label">Предпочтительный язык ответа</div>
                      <div className="user-profile-preference-description">
                        Язык, используемый для ответов ИИ
                      </div>
                    </div>
                    <div className="user-profile-preference-control">
                      <button className="user-profile-preference-button">
                        <span>Автоматический (обнаружение ввода)</span>
                        <Icon src={ICONS.chevronDown} size="sm" />
                      </button>
                    </div>
                  </div>

                  <div className="user-profile-preference-group">
                    <div className="user-profile-preference-left">
                      <div className="user-profile-preference-label">Автоподсказка</div>
                      <div className="user-profile-preference-description">
                        Включите раскрывающееся меню и автоматические подсказки во время ввода запроса
                      </div>
                    </div>
                    <div className="user-profile-preference-control">
                      <label className="user-profile-setting-toggle">
                        <input
                          type="checkbox"
                          checked={settings.notifications}
                          onChange={(e) => setSettings(prev => ({ ...prev, notifications: e.target.checked }))}
                        />
                        <span className="user-profile-setting-toggle-slider"></span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'efficiency' && (
              <div className="user-profile-section">
                <h2 className="user-profile-section-title">Эффективность</h2>
                <EfficiencyAnalytics />
              </div>
            )}

            {activeSection === 'assistant' && (
              <div className="user-profile-section">
                <h2 className="user-profile-section-title">Ассистент</h2>
                <div className="user-profile-empty">Раздел в разработке</div>
              </div>
            )}

            {activeSection === 'tasks' && (
              <div className="user-profile-section">
                <h2 className="user-profile-section-title">Задачи</h2>
                <div className="user-profile-empty">Раздел в разработке</div>
              </div>
            )}

            {activeSection === 'notifications' && (
              <div className="user-profile-section">
                <h2 className="user-profile-section-title">Уведомления</h2>
                <div className="user-profile-settings-list">
                  <div className="user-profile-setting-item">
                    <div className="user-profile-setting-info">
                      <div className="user-profile-setting-label">Уведомления</div>
                      <div className="user-profile-setting-description">
                        Получать уведомления о новых сообщениях и событиях
                      </div>
                    </div>
                    <label className="user-profile-setting-toggle">
                      <input
                        type="checkbox"
                        checked={settings.notifications}
                        onChange={(e) => setSettings(prev => ({ ...prev, notifications: e.target.checked }))}
                      />
                      <span className="user-profile-setting-toggle-slider"></span>
                    </label>
                  </div>

                  <div className="user-profile-setting-item">
                    <div className="user-profile-setting-info">
                      <div className="user-profile-setting-label">Email уведомления</div>
                      <div className="user-profile-setting-description">
                        Получать уведомления на электронную почту
                      </div>
                    </div>
                    <label className="user-profile-setting-toggle">
                      <input
                        type="checkbox"
                        checked={settings.emailNotifications}
                        onChange={(e) => setSettings(prev => ({ ...prev, emailNotifications: e.target.checked }))}
                        disabled={!settings.notifications}
                      />
                      <span className="user-profile-setting-toggle-slider"></span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'connectors' && (
              <div className="user-profile-section">
                <h2 className="user-profile-section-title">Реферальная система</h2>

                {/* Реферальная ссылка */}
                <div className="user-profile-referral-link-section">
                  <div className="user-profile-referral-link-label">Ваша реферальная ссылка</div>
                  {isLoadingReferral && !referralLink && (
                    <div className="user-profile-referral-loading">Загрузка...</div>
                  )}
                  {referralLink && (
                    <>
                      <div className="user-profile-referral-link-container">
                        <input
                          type="text"
                          readOnly
                          value={referralLink}
                          className="user-profile-referral-link-input"
                        />
                        <button
                          className={`user-profile-referral-copy-btn ${isLinkCopied ? 'copied' : ''}`}
                          onClick={handleCopyReferralLink}
                          title={isLinkCopied ? 'Скопировано!' : 'Копировать ссылку'}
                        >
                          {isLinkCopied ? (
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M13.5 4L6 11.5L2.5 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          ) : (
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M5.5 3.5H3.5C2.67 3.5 2 4.17 2 5V12.5C2 13.33 2.67 14 3.5 14H11C11.83 14 12.5 13.33 12.5 12.5V10.5M10.5 2.5H13.5C14.33 2.5 15 3.17 15 4V6.5M10.5 2.5L15 6.5M10.5 2.5V6.5H15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                          <span>{isLinkCopied ? 'Скопировано' : 'Копировать'}</span>
                        </button>
                      </div>
                      <div className="user-profile-referral-link-hint">
                        Поделитесь этой ссылкой с друзьями, чтобы получить бонусы
                      </div>
                    </>
                  )}
                  {!referralLink && !isLoadingReferral && referralError && (
                    <div className="user-profile-referral-error">
                      <span>{referralError}</span>
                    </div>
                  )}
                </div>

                {/* Блок Акции */}
                <div className="user-profile-referral-section">
                  <h3 className="user-profile-referral-title">Акции</h3>
                  <div className="user-profile-referral-divider"></div>

                  <div className="user-profile-referral-content">
                    <div className="user-profile-referral-text">
                      <div className="user-profile-referral-main-text">
                        Получите до 6 месяцев премиум-функций бесплатно, приглашая друзей
                      </div>
                      <div className="user-profile-referral-sub-text">
                        Заработайте 1 месяц премиум-доступа за каждого друга, которого порекомендуете
                      </div>
                    </div>

                    <div className="user-profile-referral-actions">
                      <div className="user-profile-referral-button-wrapper">
                        <button className="user-profile-referral-button">
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M4 12L12 4M12 4H6M12 4V10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          Просмотреть предложение
                        </button>
                        <div className="user-profile-referral-button-overlay">
                          В разработке
                        </div>
                      </div>
                      <div className="user-profile-referral-stats">
                        Успешные рекомендации: {referralsCount}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'api' && (
              <div className="user-profile-section">
                <h2 className="user-profile-section-title">API</h2>
                <div className="user-profile-empty">Раздел в разработке</div>
              </div>
            )}

            {activeSection === 'corporation' && (
              <div className="user-profile-section">
                <h2 className="user-profile-section-title">Корпорация</h2>
                <div className="user-profile-empty">Раздел в разработке</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

