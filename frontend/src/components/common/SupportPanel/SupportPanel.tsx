import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { supportAPI } from '../../../utils/api';
import type { SupportArticle } from '../../../types';
import { Icon } from '../../ui/Icon';
import { ICONS } from '../../../utils/icons';
import './SupportPanel.css';

export const SupportPanel: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const [supportArticles, setSupportArticles] = useState<SupportArticle[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<SupportArticle | null>(null);
  const [feedbackSubject, setFeedbackSubject] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackType, setFeedbackType] = useState<'bug' | 'feature' | 'question' | 'other'>('question');
  const [feedbackEmail, setFeedbackEmail] = useState('');
  const [feedbackName, setFeedbackName] = useState('');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);

  useEffect(() => {
    loadSupportArticles();
  }, []);

  const loadSupportArticles = async () => {
    try {
      const response = await supportAPI.getArticles({ limit: 100 });
      setSupportArticles(response.articles);
    } catch (error) {
      console.error('Ошибка загрузки справочных статей:', error);
    }
  };

  const handleViewArticle = async (articleId: number) => {
    try {
      const article = await supportAPI.getArticle(articleId);
      setSelectedArticle(article);
    } catch (error) {
      console.error('Ошибка загрузки статьи:', error);
    }
  };

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackSubject.trim() || !feedbackMessage.trim()) return;
    if (!isAuthenticated && (!feedbackEmail.trim() || !feedbackName.trim())) {
      alert('Для неавторизованных пользователей обязательны email и имя');
      return;
    }

    setIsSubmittingFeedback(true);
    setFeedbackSuccess(false);

    try {
      await supportAPI.sendFeedback({
        subject: feedbackSubject.trim(),
        message: feedbackMessage.trim(),
        feedback_type: feedbackType,
        email: isAuthenticated ? undefined : feedbackEmail.trim(),
        name: isAuthenticated ? undefined : feedbackName.trim(),
      });
      setFeedbackSuccess(true);
      setFeedbackSubject('');
      setFeedbackMessage('');
      setFeedbackType('question');
      setFeedbackEmail('');
      setFeedbackName('');
      setTimeout(() => setFeedbackSuccess(false), 5000);
    } catch (error) {
      console.error('Ошибка отправки обратной связи:', error);
      alert('Ошибка отправки обратной связи. Попробуйте позже.');
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  return (
    <div className="support-panel">
      <div className="support-panel-content">
        <div className="support-section">
          <h2>Поддержка</h2>
          <form onSubmit={handleSubmitFeedback} className="support-form">
            {feedbackSuccess && (
              <div className="support-feedback-success">
                Спасибо за ваш отзыв! Мы свяжемся с вами в ближайшее время.
              </div>
            )}
            {!isAuthenticated && (
              <>
                <div className="support-field">
                  <label>Имя *</label>
                  <input
                    type="text"
                    value={feedbackName}
                    onChange={(e) => setFeedbackName(e.target.value)}
                    required
                    placeholder="Введите ваше имя"
                  />
                </div>
                <div className="support-field">
                  <label>Email *</label>
                  <input
                    type="email"
                    value={feedbackEmail}
                    onChange={(e) => setFeedbackEmail(e.target.value)}
                    required
                    placeholder="your@email.com"
                  />
                </div>
              </>
            )}
            <div className="support-field">
              <label>Тип обращения</label>
              <select
                value={feedbackType}
                onChange={(e) => setFeedbackType(e.target.value as 'bug' | 'feature' | 'question' | 'other')}
              >
                <option value="question">Вопрос</option>
                <option value="bug">Ошибка</option>
                <option value="feature">Предложение</option>
                <option value="other">Другое</option>
              </select>
            </div>
            <div className="support-field">
              <label>Тема *</label>
              <input
                type="text"
                value={feedbackSubject}
                onChange={(e) => setFeedbackSubject(e.target.value)}
                required
                placeholder="Краткое описание проблемы или вопроса"
              />
            </div>
            <div className="support-field">
              <label>Сообщение *</label>
              <textarea
                value={feedbackMessage}
                onChange={(e) => setFeedbackMessage(e.target.value)}
                required
                rows={6}
                placeholder="Опишите вашу проблему или вопрос подробнее"
              />
            </div>
            <div className="support-actions">
              <button
                type="submit"
                className="support-submit-btn"
                disabled={isSubmittingFeedback}
              >
                {isSubmittingFeedback ? 'Отправка...' : 'Отправить'}
              </button>
            </div>
          </form>
        </div>

        <div className="support-section">
          <h2>Справочные статьи</h2>
          {supportArticles.length === 0 ? (
            <div className="support-empty">Нет доступных статей</div>
          ) : (
            <div className="support-articles-list">
              {supportArticles.map(article => (
                <div
                  key={article.id}
                  className="support-article-item"
                  onClick={() => handleViewArticle(article.id)}
                >
                  <div className="support-article-content">
                    <div className="support-article-title">{article.title}</div>
                    <div className="support-article-category">{article.category}</div>
                  </div>
                  <Icon src={ICONS.arrowLeft} size="sm" className="support-article-arrow" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedArticle && (
        <div
          className="support-article-modal-overlay"
          onClick={() => setSelectedArticle(null)}
        >
          <div className="support-article-modal" onClick={(e) => e.stopPropagation()}>
            <div className="support-article-modal-header">
              <div>
                <h3>{selectedArticle.title}</h3>
                <div className="support-article-modal-category">{selectedArticle.category}</div>
              </div>
              <button
                className="support-article-modal-close"
                onClick={() => setSelectedArticle(null)}
                title="Закрыть"
              >
                ×
              </button>
            </div>
            <div className="support-article-modal-content">{selectedArticle.content}</div>
          </div>
        </div>
      )}
    </div>
  );
};

