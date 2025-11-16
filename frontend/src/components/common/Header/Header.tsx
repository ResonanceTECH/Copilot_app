import React, { useState } from 'react';
import { Icon } from '../../ui/Icon';
import { ICONS } from '../../../utils/icons';
import './Header.css';

interface HeaderProps {
  title?: string;
}

export const Header: React.FC<HeaderProps> = ({
  title = 'Тред',
}) => {
  const [language, setLanguage] = useState('Русский');
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);

  return (
    <header className="header">
      <div className="header-left">
        <button className="header-title-btn">
          <span className="header-title">{title}</span>
          <Icon src={ICONS.chevronDown} size="sm" />
        </button>
      </div>
      <div className="header-right">
        <div className="header-language-selector">
          <button
            className="header-language-btn"
            onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
          >
            <span>{language}</span>
            <Icon src={ICONS.chevronDown} size="sm" />
          </button>
          {showLanguageDropdown && (
            <div className="header-language-dropdown">
              <button onClick={() => { setLanguage('English'); setShowLanguageDropdown(false); }}>
                English
              </button>
              <button onClick={() => { setLanguage('Русский'); setShowLanguageDropdown(false); }}>
                Русский
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
