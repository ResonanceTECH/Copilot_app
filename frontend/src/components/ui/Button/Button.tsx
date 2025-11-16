import React from 'react';
import { ButtonProps } from '../../../types';
import { Icon } from '../Icon';
import './Button.css';

export const Button: React.FC<ButtonProps> = ({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  icon,
  className = '',
  disabled = false,
}) => {
  return (
    <button
      className={`btn btn--${variant} btn--${size} ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      {icon && <Icon src={icon} size={size === 'lg' ? 'md' : 'sm'} />}
      {children}
    </button>
  );
};

