import React from 'react';
import { useAuth } from './contexts/AuthContext';
import { AssistantPage } from './pages/AssistantPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';

export const App: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const [currentPage, setCurrentPage] = React.useState<'login' | 'register'>('login');

  // Определяем текущую страницу из URL или используем состояние
  React.useEffect(() => {
    const path = window.location.pathname;
    if (path === '/register') {
      setCurrentPage('register');
    } else {
      setCurrentPage('login');
    }
  }, []);

  // Обработка навигации
  const handleNavigation = (page: 'login' | 'register') => {
    setCurrentPage(page);
    window.history.pushState({}, '', `/${page}`);
  };

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        color: 'var(--color-text)'
      }}>
        Загрузка...
      </div>
    );
  }

  if (!isAuthenticated) {
    if (currentPage === 'register') {
      return <RegisterPage onNavigateToLogin={() => handleNavigation('login')} />;
    }
    return <LoginPage onNavigateToRegister={() => handleNavigation('register')} />;
  }

  return <AssistantPage />;
};

