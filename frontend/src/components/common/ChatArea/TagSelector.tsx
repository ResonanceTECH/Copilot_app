import React, { useState, useEffect } from 'react';
import { Icon } from '../../ui/Icon';
import { ICONS } from '../../../utils/icons';
import { spacesAPI } from '../../../utils/api';
import type { SpaceTag } from '../../../types';
import './TagSelector.css';

interface TagSelectorProps {
  spaceId: number;
  selectedTagIds: number[];
  onSelect: (tagIds: number[]) => void;
  onClose: () => void;
}

export const TagSelector: React.FC<TagSelectorProps> = ({
  spaceId,
  selectedTagIds,
  onSelect,
  onClose,
}) => {
  const [tags, setTags] = useState<SpaceTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTags, setSelectedTags] = useState<number[]>(selectedTagIds);

  useEffect(() => {
    loadTags();
  }, [spaceId]);

  useEffect(() => {
    setSelectedTags(selectedTagIds);
  }, [selectedTagIds]);

  const loadTags = async () => {
    try {
      setLoading(true);
      const tagsData = await spacesAPI.getSpaceTags(spaceId);
      setTags(tagsData);
    } catch (error) {
      console.error('Ошибка загрузки тегов:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTagToggle = (tagId: number) => {
    setSelectedTags(prev => {
      if (prev.includes(tagId)) {
        return prev.filter(id => id !== tagId);
      } else {
        return [...prev, tagId];
      }
    });
  };

  const handleApply = () => {
    onSelect(selectedTags);
    onClose();
  };

  return (
    <>
      <div className="tag-selector-overlay" onClick={onClose} />
      <div className="tag-selector">
        <div className="tag-selector-header">
          <h3 className="tag-selector-title">Выберите теги</h3>
          <button className="tag-selector-close" onClick={onClose}>
            <Icon src={ICONS.close} size="sm" />
          </button>
        </div>
        <div className="tag-selector-content">
          {loading ? (
            <div className="tag-selector-loading">Загрузка тегов...</div>
          ) : tags.length === 0 ? (
            <div className="tag-selector-empty">Нет доступных тегов в этом пространстве</div>
          ) : (
            <div className="tag-selector-list">
              {tags.map(tag => (
                <button
                  key={tag.id}
                  className={`tag-selector-item ${selectedTags.includes(tag.id) ? 'tag-selector-item--selected' : ''}`}
                  onClick={() => handleTagToggle(tag.id)}
                  style={{
                    backgroundColor: selectedTags.includes(tag.id) ? (tag.color || '#6366f1') : 'transparent',
                    borderColor: tag.color || '#6366f1',
                  }}
                >
                  <span className="tag-selector-item-name">{tag.name}</span>
                  {selectedTags.includes(tag.id) && (
                    <Icon src={ICONS.close} size="sm" className="tag-selector-item-remove" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="tag-selector-actions">
          <button className="tag-selector-cancel" onClick={onClose}>
            Отмена
          </button>
          <button className="tag-selector-apply" onClick={handleApply} disabled={loading}>
            Применить
          </button>
        </div>
      </div>
    </>
  );
};

