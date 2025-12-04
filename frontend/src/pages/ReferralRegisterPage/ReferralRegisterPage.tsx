import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { userAPI } from '../../utils/api';
import logoIcon from '../../assets/icons/logo.svg';
import './ReferralRegisterPage.css';

interface ReferralRegisterPageProps {
  onNavigateToLogin?: () => void;
}

export const ReferralRegisterPage: React.FC<ReferralRegisterPageProps> = ({ onNavigateToLogin }) => {
  const { register } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Реферальная система
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referrerName, setReferrerName] = useState<string | null>(null);
  const [isCheckingReferral, setIsCheckingReferral] = useState(false);
  const [referralError, setReferralError] = useState<string | null>(null);

  // Проверяем реферальный код из URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get('ref');
    
    if (refCode) {
      setReferralCode(refCode);
      checkReferralCode(refCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkReferralCode = async (code: string) => {
    setIsCheckingReferral(true);
    setReferralError(null);
    
    try {
      const referrerInfo = await userAPI.checkReferralCode(code);
      setReferrerName(referrerInfo.name);
      setReferralError(null);
    } catch (err: any) {
      setReferralError('Реферальный код не найден');
      setReferrerName(null);
    } finally {
      setIsCheckingReferral(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await register(email, password, name, companyName || undefined, referralCode || undefined);
    } catch (err: any) {
      setError(err.message || 'Ошибка регистрации. Проверьте введенные данные.');
    } finally {
      setIsLoading(false);
    }
  };

  const hasReferral = referralCode && referrerName;

  return (
    <div className="auth-page">
      <div className="auth-container">
        {hasReferral && (
          <div className="auth-referral-panel">
            <div className="auth-referral-content">
              <div className="auth-referral-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="#10b981" stroke="#10b981" strokeWidth="1.5" strokeLinejoin="round"/>
                </svg>
              </div>
              <div className="auth-referral-info">
                <div className="auth-referral-title">Вас пригласили!</div>
                <div className="auth-referral-text">
                  <span className="auth-referral-name">{referrerName}</span> пригласил вас присоединиться
                </div>
              </div>
              <div className="auth-referral-badge">
                <svg className="auth-referral-badge-icon" width="12" height="12" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M13.5 4L6 11.5L2.5 8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span>Подтверждено</span>
              </div>
            </div>
          </div>
        )}

        <div className="auth-form-wrapper">
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
    </div>
  );
};

