import React from 'react';
import { InputProps } from '../../../types';
import { Icon } from '../Icon';
import './Input.css';

export const Input: React.FC<InputProps> = ({
  placeholder,
  value,
  onChange,
  onKeyDown,
  icon,
  onIconClick,
  className = '',
}) => {
  return (
    <div className={`input-wrapper ${className}`}>
      <input
        type="text"
        className="input"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
      />
      {icon && (
        <button
          className="input-icon-btn"
          onClick={onIconClick}
          type="button"
        >
          <Icon src={icon} size="md" />
        </button>
      )}
    </div>
  );
};

