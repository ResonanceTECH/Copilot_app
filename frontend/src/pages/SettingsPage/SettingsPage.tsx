import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supportAPI } from '../../utils/api';
import type { SupportArticle } from '../../types';
import { Header } from '../../components/common/Header';
import { Icon } from '../../components/ui/Icon';
import { ICONS } from '../../utils/icons';
import './SettingsPage.css';

export const SettingsPage: React.FC = () => {
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
    <div className="settings-page">
      <Header 
        title="Настройки"
        activeTool="assistant"
        onToolSelect={() => {}}
      />
      <div className="settings-content">
        <div className="settings-section">
          <h2>Поддержка</h2>
          <form onSubmit={handleSubmitFeedback} className="settings-support-form">
            {feedbackSuccess && (
              <div className="settings-feedback-success">
                Спасибо за ваш отзыв! Мы свяжемся с вами в ближайшее время.
              </div>
            )}
            {!isAuthenticated && (
              <>
                <div className="settings-field">
                  <label>Имя *</label>
                  <input
                    type="text"
                    value={feedbackName}
                    onChange={(e) => setFeedbackName(e.target.value)}
                    required
                    placeholder="Введите ваше имя"
                  />
                </div>
                <div className="settings-field">
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
            <div className="settings-field">
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
            <div className="settings-field">
              <label>Тема *</label>
              <input
                type="text"
                value={feedbackSubject}
                onChange={(e) => setFeedbackSubject(e.target.value)}
                required
                placeholder="Краткое описание проблемы или вопроса"
              />
            </div>
            <div className="settings-field">
              <label>Сообщение *</label>
              <textarea
                value={feedbackMessage}
                onChange={(e) => setFeedbackMessage(e.target.value)}
                required
                rows={6}
                placeholder="Опишите вашу проблему или вопрос подробнее"
              />
            </div>
            <div className="settings-actions">
              <button
                type="submit"
                className="settings-submit-btn"
                disabled={isSubmittingFeedback}
              >
                {isSubmittingFeedback ? 'Отправка...' : 'Отправить'}
              </button>
            </div>
          </form>
        </div>

        <div className="settings-section">
          <h2>Справочные статьи</h2>
          {supportArticles.length === 0 ? (
            <div className="settings-empty">Нет доступных статей</div>
          ) : (
            <div className="settings-articles-list">
              {supportArticles.map(article => (
                <div
                  key={article.id}
                  className="settings-article-item"
                  onClick={() => handleViewArticle(article.id)}
                >
                  <div className="settings-article-content">
                    <div className="settings-article-title">{article.title}</div>
                    <div className="settings-article-category">{article.category}</div>
                  </div>
                  <Icon src={ICONS.arrowLeft} size="sm" className="settings-article-arrow" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedArticle && (
        <div
          className="settings-article-modal-overlay"
          onClick={() => setSelectedArticle(null)}
        >
          <div className="settings-article-modal" onClick={(e) => e.stopPropagation()}>
            <div className="settings-article-modal-header">
              <div>
                <h3>{selectedArticle.title}</h3>
                <div className="settings-article-modal-category">{selectedArticle.category}</div>
              </div>
              <button
                className="settings-article-modal-close"
                onClick={() => setSelectedArticle(null)}
                title="Закрыть"
              >
                ×
              </button>
            </div>
            <div className="settings-article-modal-content">{selectedArticle.content}</div>
          </div>
        </div>
      )}
    </div>
  );
};

