import React from 'react';
import { useAuth } from './contexts/AuthContext';
import { AssistantPage } from './pages/AssistantPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { SpacesListPage } from './pages/SpacesListPage';
import { SpaceDetailPage } from './pages/SpaceDetailPage';
import { SettingsPage } from './pages/SettingsPage';
import { UserProfilePage } from './pages/UserProfilePage/UserProfilePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { PublicSpacePage } from './pages/PublicSpacePage';

export const App: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const [currentPage, setCurrentPage] = React.useState<'login' | 'register' | 'assistant' | 'spaces' | 'space-detail' | 'settings' | 'profile' | 'public-space' | 'not-found'>('login');
  const [spaceId, setSpaceId] = React.useState<number | null>(null);
  const [publicToken, setPublicToken] = React.useState<string | null>(null);

  // Определяем текущую страницу из URL
  React.useEffect(() => {
    const path = window.location.pathname;
    if (path.startsWith('/public/spaces/')) {
      const match = path.match(/^\/public\/spaces\/(.+)$/);
      if (match) {
        setPublicToken(match[1]);
        setCurrentPage('public-space');
      } else {
        setCurrentPage('not-found');
      }
    } else if (path === '/register') {
      setCurrentPage('register');
    } else if (path === '/settings') {
      setCurrentPage('settings');
    } else if (path === '/profile') {
      setCurrentPage('profile');
    } else if (path.startsWith('/spaces/')) {
      const match = path.match(/^\/spaces\/(\d+)$/);
      if (match) {
        setSpaceId(parseInt(match[1]));
        setCurrentPage('space-detail');
      } else {
        setCurrentPage('not-found');
      }
    } else if (path === '/spaces') {
      setCurrentPage('spaces');
    } else if (path === '/assistant' || path === '/') {
      setCurrentPage('assistant');
    } else if (path === '/login') {
      setCurrentPage('login');
    } else {
      setCurrentPage('not-found');
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

  // Публичное пространство доступно без авторизации
  if (currentPage === 'public-space' && publicToken) {
    return <PublicSpacePage publicToken={publicToken} />;
  }

  // 404 страница показывается для всех пользователей
  if (currentPage === 'not-found') {
    return <NotFoundPage />;
  }

  if (!isAuthenticated) {
    if (currentPage === 'register') {
      return <RegisterPage onNavigateToLogin={() => handleNavigation('login')} />;
    }
    return <LoginPage onNavigateToRegister={() => handleNavigation('register')} />;
  }

  // Роутинг для авторизованных пользователей
  if (currentPage === 'settings') {
    return <SettingsPage />;
  }

  if (currentPage === 'profile') {
    return <UserProfilePage />;
  }

  if (currentPage === 'spaces') {
    return <SpacesListPage />;
  }

  if (currentPage === 'space-detail' && spaceId) {
    return <SpaceDetailPage spaceId={spaceId} />;
  }

  return <AssistantPage />;
};

