import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import logoIcon from '../../assets/icons/logo.svg';
import './RegisterPage.css';

interface RegisterPageProps {
  onNavigateToLogin?: () => void;
}

export const RegisterPage: React.FC<RegisterPageProps> = ({ onNavigateToLogin }) => {
  const { register } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await register(email, password, name, companyName || undefined);
    } catch (err: any) {
      setError(err.message || 'Ошибка регистрации. Проверьте введенные данные.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-header">
          <img src={logoIcon} alt="AI-ассистент" className="auth-logo" />
          <h1 className="auth-title">Регистрация</h1>
          <p className="auth-subtitle">Создайте новый аккаунт</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && <div className="auth-error">{error}</div>}

          <div className="auth-form-grid">
            <div className="auth-field">
              <label htmlFor="name" className="auth-label">Имя</label>
              <input
                id="name"
                type="text"
                className="auth-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Иван Иванов"
                required
                disabled={isLoading}
              />
            </div>

            <div className="auth-field">
              <label htmlFor="email" className="auth-label">Email</label>
              <input
                id="email"
                type="email"
                className="auth-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                required
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="auth-form-grid">
            <div className="auth-field">
              <label htmlFor="password" className="auth-label">Пароль</label>
              <input
                id="password"
                type="password"
                className="auth-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Введите пароль"
                required
                disabled={isLoading}
              />
            </div>

            <div className="auth-field">
              <label htmlFor="companyName" className="auth-label">
                Компания <span className="auth-optional">(необязательно)</span>
              </label>
              <input
                id="companyName"
                type="text"
                className="auth-input"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="ООО Компания"
                disabled={isLoading}
              />
            </div>
          </div>

          <button
            type="submit"
            className="auth-submit-btn"
            disabled={isLoading}
          >
            {isLoading ? 'Регистрация...' : 'Зарегистрироваться'}
          </button>
        </form>

        <div className="auth-footer">
          <p className="auth-footer-text">
            Уже есть аккаунт?{' '}
            <button
              type="button"
              onClick={onNavigateToLogin}
              className="auth-link-btn"
            >
              Войти
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

