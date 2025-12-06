import React, { useState, useRef, useEffect } from 'react';
import { Icon } from '../../ui/Icon';
import { ICONS } from '../../../utils/icons';
import { spacesAPI } from '../../../utils/api';
import './CreateTagBlock.css';

interface CreateTagBlockProps {
  spaceId: number;
  onClose: () => void;
  onTagCreated: (tagId: number) => void;
}

export const CreateTagBlock: React.FC<CreateTagBlockProps> = ({
  spaceId,
  onClose,
  onTagCreated,
}) => {
  const [tagName, setTagName] = useState('');
  const [tagColor, setTagColor] = useState('#6366f1');
  const [tagType, setTagType] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const blockRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (blockRef.current && !blockRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tagName.trim()) return;

    setIsCreating(true);
    try {
      const newTag = await spacesAPI.createSpaceTag(spaceId, {
        name: tagName.trim(),
        color: tagColor,
        tag_type: tagType || undefined,
      });

      // Вызываем callback с ID созданного тега
      onTagCreated(newTag.id);

      // Сбрасываем форму
      setTagName('');
      setTagColor('#6366f1');
      setTagType('');
      onClose();
    } catch (error) {
      console.error('Ошибка создания тега:', error);
      alert('Ошибка при создании тега. Попробуйте позже.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleCancel = () => {
    setTagName('');
    setTagColor('#6366f1');
    setTagType('');
    onClose();
  };

  return (
    <>
      <div className="create-tag-block-overlay" onClick={handleCancel} />
      <div
        ref={blockRef}
        className="create-tag-block"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="create-tag-block-header">
          <h3 className="create-tag-block-title">Создать тег</h3>
          <button className="create-tag-block-close" onClick={handleCancel}>
            <Icon src={ICONS.close} size="sm" />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="create-tag-block-field">
            <label>Название тега</label>
            <input
              type="text"
              value={tagName}
              onChange={(e) => setTagName(e.target.value)}
              placeholder="Введите название тега"
              required
              autoFocus
            />
          </div>
          <div className="create-tag-block-field">
            <label>Цвет</label>
            <div className="create-tag-block-color-input">
              <input
                type="color"
                value={tagColor}
                onChange={(e) => setTagColor(e.target.value)}
              />
              <input
                type="text"
                value={tagColor}
                onChange={(e) => setTagColor(e.target.value)}
                placeholder="#6366f1"
                pattern="^#[0-9A-Fa-f]{6}$"
              />
            </div>
          </div>
          <div className="create-tag-block-field">
            <label>Тип тега (необязательно)</label>
            <input
              type="text"
              value={tagType}
              onChange={(e) => setTagType(e.target.value)}
              placeholder="Например: urgent, important"
            />
          </div>
          <div className="create-tag-block-actions">
            <button type="button" onClick={handleCancel} disabled={isCreating}>
              Отмена
            </button>
            <button type="submit" disabled={isCreating || !tagName.trim()}>
              Создать
            </button>
          </div>
        </form>
      </div>
    </>
  );
};
