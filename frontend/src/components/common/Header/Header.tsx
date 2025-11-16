import React, { useState, useEffect, useRef } from 'react';
import { Icon } from '../../ui/Icon';
import { ICONS } from '../../../utils/icons';
import { useLanguage } from '../../../contexts/LanguageContext';
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
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingTitle, setEditingTitle] = useState('');
  const [isModelSelectorVisible, setIsModelSelectorVisible] = useState(false);
  const [showModelTooltip, setShowModelTooltip] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const modelSelectorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowLanguageDropdown(false);
      }
      if (modelSelectorRef.current && !modelSelectorRef.current.contains(event.target as Node)) {
        setIsModelSelectorVisible(false);
      }
    };

    if (showLanguageDropdown || isModelSelectorVisible) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showLanguageDropdown, isModelSelectorVisible]);

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

  const displayTitle = title || getTranslation('thread', language);
  const currentModelName = activeTool === 'assistant' 
    ? getTranslation('assistant', language) 
    : getTranslation('deepseekChimera', language);

  const handleModelSelect = (tool: string) => {
    onToolSelect?.(tool);
    setIsModelSelectorVisible(false);
  };

  return (
    <header className="header">
      <div className="header-left">
        <div className="header-logo-group">
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
