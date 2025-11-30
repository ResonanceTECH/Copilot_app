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
  
  // Форма редактирования
  const [formData, setFormData] = useState<UserProfileUpdate>({
    name: '',
    phone: '',
    company_name: '',
    avatar_url: null,
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
          <h1 className="user-profile-title">{getTranslation('profile', language)}</h1>
          
          <div className="user-profile-section">
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

            <div className="user-profile-info">
              <div className="user-profile-field">
                <label className="user-profile-label">
                  {getTranslation('email', language)}
                </label>
                <div className="user-profile-value user-profile-value-readonly">
                  {profile.email}
                </div>
              </div>

              <div className="user-profile-field">
                <label className="user-profile-label">
                  {getTranslation('name', language)}
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    className="user-profile-input"
                    value={formData.name || ''}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder={getTranslation('name', language)}
                  />
                ) : (
                  <div className="user-profile-value">
                    {profile.name}
                  </div>
                )}
              </div>

              <div className="user-profile-field">
                <label className="user-profile-label">
                  {getTranslation('phone', language)}
                </label>
                {isEditing ? (
                  <input
                    type="tel"
                    className="user-profile-input"
                    value={formData.phone || ''}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    placeholder={getTranslation('phone', language)}
                  />
                ) : (
                  <div className="user-profile-value">
                    {profile.phone || '-'}
                  </div>
                )}
              </div>

              <div className="user-profile-field">
                <label className="user-profile-label">
                  {getTranslation('company', language)}
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    className="user-profile-input"
                    value={formData.company_name || ''}
                    onChange={(e) => handleInputChange('company_name', e.target.value)}
                    placeholder={getTranslation('company', language)}
                  />
                ) : (
                  <div className="user-profile-value">
                    {profile.company_name || '-'}
                  </div>
                )}
              </div>

              <div className="user-profile-field">
                <label className="user-profile-label">
                  {getTranslation('registrationDate', language)}
                </label>
                <div className="user-profile-value user-profile-value-readonly">
                  {formatDate(profile.created_at)}
                </div>
              </div>
            </div>

            <div className="user-profile-actions">
              {isEditing ? (
                <>
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
                </>
              ) : (
                <button
                  className="user-profile-btn user-profile-btn-primary"
                  onClick={handleEdit}
                >
                  {getTranslation('editProfile', language)}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

