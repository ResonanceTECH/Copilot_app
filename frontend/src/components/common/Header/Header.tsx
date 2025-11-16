import React, { useState, useEffect, useRef } from 'react';
import { Icon } from '../../ui/Icon';
import { ICONS } from '../../../utils/icons';
import { useLanguage } from '../../../contexts/LanguageContext';
import { getTranslation, getLanguageName, Language } from '../../../utils/i18n';
import logoIcon from '../../../assets/icons/logo.svg';
import './Header.css';

interface HeaderProps {
  title?: string;
}

export const Header: React.FC<HeaderProps> = ({
  title,
}) => {
  const { language, setLanguage } = useLanguage();
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowLanguageDropdown(false);
      }
    };

    if (showLanguageDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showLanguageDropdown]);

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
    setShowLanguageDropdown(false);
  };

  const displayTitle = title || getTranslation('thread', language);

  return (
    <header className="header">
      <div className="header-left">
        <div className="header-logo-group">
          <img src={logoIcon} alt="AI Assistant" className="header-logo" />
          <button className="header-back-btn" title="Back">
            <Icon src={ICONS.arrowLeft} size="sm" />
          </button>
        </div>
        {title && (
          <button className="header-title-btn">
            <span className="header-title">{displayTitle}</span>
            <Icon src={ICONS.chevronDown} size="sm" />
          </button>
        )}
      </div>
      <div className="header-right">
        <button className="header-notification-btn" title="Notifications">
          <Icon src={ICONS.bell} size="md" />
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
        <button className="header-avatar-btn" title="User profile">
          <Icon src={ICONS.user} size="md" />
        </button>
      </div>
    </header>
  );
};
