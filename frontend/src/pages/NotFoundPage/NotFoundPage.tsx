import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import logoIcon from '../../assets/icons/logo.svg';
import './NotFoundPage.css';

export const NotFoundPage: React.FC = () => {
  const { isAuthenticated } = useAuth();

  const handleGoHome = () => {
    window.location.href = isAuthenticated ? '/assistant' : '/login';
  };

  return (
    <div className="not-found-page">
      <div className="not-found-container">
        <div className="not-found-header">
          <img src={logoIcon} alt="AI-ассистент" className="not-found-logo" />
          <h1 className="not-found-code">404</h1>
          <h2 className="not-found-title">Страница не найдена</h2>
          <p className="not-found-subtitle">
            К сожалению, запрашиваемая страница не существует или была перемещена.
          </p>
        </div>

        <div className="not-found-actions">
          <button
            type="button"
            onClick={handleGoHome}
            className="not-found-btn"
          >
            Вернуться на главную
          </button>
        </div>
      </div>
    </div>
  );
};

