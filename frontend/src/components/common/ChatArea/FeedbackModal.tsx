import React, { useState } from 'react';
import { Icon } from '../../ui/Icon';
import { ICONS } from '../../../utils/icons';
import './FeedbackModal.css';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (selectedReasons: string[], feedback: string) => void;
}

type FeedbackReason =
  | 'inaccurate'
  | 'wrong_context'
  | 'too_short'
  | 'too_long'
  | 'harmful'
  | 'wrong_sources';

const feedbackReasons: Array<{ id: FeedbackReason; label: string; icon: string }> = [
  { id: 'inaccurate', label: 'Неточный', icon: ICONS.note },
  { id: 'wrong_context', label: 'Неверный контекст', icon: ICONS.edit },
  { id: 'too_short', label: 'Слишком коротко', icon: ICONS.note },
  { id: 'too_long', label: 'Слишком длинно', icon: ICONS.note },
  { id: 'harmful', label: 'Вредное или оскорбительное', icon: ICONS.trash },
  { id: 'wrong_sources', label: 'Неправильные источники', icon: ICONS.link },
];

export const FeedbackModal: React.FC<FeedbackModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [feedback, setFeedback] = useState('');

  if (!isOpen) return null;

  const handleReasonToggle = (reasonId: string) => {
    setSelectedReasons(prev =>
      prev.includes(reasonId)
        ? prev.filter(id => id !== reasonId)
        : [...prev, reasonId]
    );
  };

  const handleSubmit = () => {
    onSubmit(selectedReasons, feedback);
    setSelectedReasons([]);
    setFeedback('');
    onClose();
  };

  const handleCancel = () => {
    setSelectedReasons([]);
    setFeedback('');
    onClose();
  };

  return (
    <div className="feedback-modal-overlay" onClick={handleCancel}>
      <div className="feedback-modal" onClick={(e) => e.stopPropagation()}>
        <button className="feedback-modal-close" onClick={handleCancel}>
          <Icon src={ICONS.close} size="sm" />
        </button>

        <h2 className="feedback-modal-title">Помогите нам стать лучше</h2>
        <p className="feedback-modal-description">
          Предоставьте дополнительную обратную связь о данном answer. Выберите все подходящее.
        </p>

        <div className="feedback-modal-reasons">
          {feedbackReasons.map((reason) => (
            <button
              key={reason.id}
              className={`feedback-modal-reason-btn ${selectedReasons.includes(reason.id) ? 'selected' : ''}`}
              onClick={() => handleReasonToggle(reason.id)}
            >
              <Icon src={reason.icon} size="sm" />
              <span>{reason.label}</span>
            </button>
          ))}
        </div>

        <div className="feedback-modal-textarea-wrapper">
          <label className="feedback-modal-label">
            Как можно улучшить ответ? (optional)
          </label>
          <textarea
            className="feedback-modal-textarea"
            placeholder="Ваши отзывы..."
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={4}
          />
        </div>

        <div className="feedback-modal-actions">
          <button className="feedback-modal-cancel-btn" onClick={handleCancel}>
            Отмена
          </button>
          <button
            className="feedback-modal-submit-btn"
            onClick={handleSubmit}
            disabled={selectedReasons.length === 0 && !feedback.trim()}
          >
            Отправить
          </button>
        </div>
      </div>
    </div>
  );
};
