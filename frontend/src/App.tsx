import React from 'react';
import { useAuth } from './contexts/AuthContext';
import { AssistantPage } from './pages/AssistantPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { SpacesListPage } from './pages/SpacesListPage';
import { SpaceDetailPage } from './pages/SpaceDetailPage';

export const App: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const [currentPage, setCurrentPage] = React.useState<'login' | 'register' | 'assistant' | 'spaces' | 'space-detail'>('login');
  const [spaceId, setSpaceId] = React.useState<number | null>(null);

  // Определяем текущую страницу из URL
  React.useEffect(() => {
    const path = window.location.pathname;
    if (path === '/register') {
      setCurrentPage('register');
    } else if (path.startsWith('/spaces/')) {
      const match = path.match(/^\/spaces\/(\d+)$/);
      if (match) {
        setSpaceId(parseInt(match[1]));
        setCurrentPage('space-detail');
      } else {
        setCurrentPage('spaces');
      }
    } else if (path === '/spaces') {
      setCurrentPage('spaces');
    } else if (path === '/assistant' || path === '/') {
      setCurrentPage('assistant');
    } else {
      setCurrentPage('login');
    }
  }, []);

  // Обработка навигации
  const handleNavigation = (page: 'login' | 'register' | 'assistant' | 'spaces') => {
    setCurrentPage(page);
    window.history.pushState({}, '', `/${page === 'assistant' ? '' : page}`);
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

  // Роутинг для авторизованных пользователей
  if (currentPage === 'spaces') {
    return <SpacesListPage />;
  }

  if (currentPage === 'space-detail' && spaceId) {
    return <SpaceDetailPage spaceId={spaceId} />;
  }

  return <AssistantPage />;
};

