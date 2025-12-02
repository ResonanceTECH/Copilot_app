import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { userAPI } from '../../utils/api';
import type { UserProfile, UserProfileUpdate } from '../../types';
import { Header } from '../../components/common/Header';
import { Icon } from '../../components/ui/Icon';
import { ICONS } from '../../utils/icons';
import { useLanguage } from '../../contexts/LanguageContext';
import { getTranslation } from '../../utils/i18n';
import './UserProfilePage.css';

export const UserProfilePage: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const { language } = useLanguage();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<'account' | 'settings'>('account');
  
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
    theme: 'dark',
  });

  useEffect(() => {
    if (isAuthenticated) {
      loadProfile();
    }
  }, [isAuthenticated]);

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
      alert(error.message || getTranslation('profileUpdateError', language));
    } finally {
      setIsLoading(false);
    }
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

  if (isLoading) {
    return (
      <div className="user-profile-page">
        <Header />
        <div className="user-profile-loading">
          {getTranslation('loading', language)}
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="user-profile-page">
        <Header />
        <div className="user-profile-error">
          {getTranslation('profileNotFound', language)}
        </div>
      </div>
    );
  }

  return (
    <div className="user-profile-page">
      <Header />
      <div className="user-profile-content">
        <div className="user-profile-container">
          <button
            className="user-profile-back-btn"
            onClick={() => {
              window.location.href = '/';
            }}
          >
            <Icon src={ICONS.arrowLeft} size="sm" />
            {getTranslation('backToChat', language)}
          </button>
          
          <div className="user-profile-tabs">
            <button
              className={`user-profile-tab ${activeSection === 'account' ? 'active' : ''}`}
              onClick={() => setActiveSection('account')}
            >
              Аккаунт
            </button>
            <button
              className={`user-profile-tab ${activeSection === 'settings' ? 'active' : ''}`}
              onClick={() => setActiveSection('settings')}
            >
              Настройки
            </button>
          </div>

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

          {activeSection === 'settings' && (
            <div className="user-profile-section">
              <h2 className="user-profile-section-title">Настройки</h2>
              
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

                <div className="user-profile-setting-item">
                  <div className="user-profile-setting-info">
                    <div className="user-profile-setting-label">Язык интерфейса</div>
                    <div className="user-profile-setting-description">
                      Выберите язык интерфейса приложения
                    </div>
                  </div>
                  <select
                    className="user-profile-setting-select"
                    value={settings.language}
                    onChange={(e) => setSettings(prev => ({ ...prev, language: e.target.value }))}
                  >
                    <option value="ru">Русский</option>
                    <option value="en">English</option>
                  </select>
                </div>

                <div className="user-profile-setting-item">
                  <div className="user-profile-setting-info">
                    <div className="user-profile-setting-label">Тема оформления</div>
                    <div className="user-profile-setting-description">
                      Выберите тему оформления интерфейса
                    </div>
                  </div>
                  <select
                    className="user-profile-setting-select"
                    value={settings.theme}
                    onChange={(e) => setSettings(prev => ({ ...prev, theme: e.target.value }))}
                  >
                    <option value="dark">Темная</option>
                    <option value="light">Светлая</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

