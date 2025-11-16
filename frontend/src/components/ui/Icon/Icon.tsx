import React from 'react';
import { IconProps } from '../../../types';
import { HugeiconsIcon } from '@hugeicons/react';
import { ICON_COMPONENTS } from '../../../utils/icons';
import './Icon.css';

const sizeMap = {
  sm: 16,
  md: 24,
  lg: 32,
};

export const Icon: React.FC<IconProps> = ({ 
  src, 
  size = 'md', 
  color, 
  className = '' 
}) => {
  const iconSize = sizeMap[size];
  
  // Если src - это имя иконки из ICON_COMPONENTS
  const iconName = typeof src === 'string' && src in ICON_COMPONENTS ? src : null;
  const IconComponent = iconName ? ICON_COMPONENTS[iconName] : null;

  if (IconComponent) {
    return (
      <HugeiconsIcon
        icon={IconComponent}
        size={iconSize}
        color={color || 'currentColor'}
        className={`icon icon--${size} ${className}`}
      />
    );
  }

  // Fallback для других источников (локальные файлы и т.д.)
  const style: React.CSSProperties = {
    width: iconSize,
    height: iconSize,
  };

  return (
    <img
      src={src}
      alt="icon"
      className={`icon icon--${size} ${className}`}
      style={style}
    />
  );
};
