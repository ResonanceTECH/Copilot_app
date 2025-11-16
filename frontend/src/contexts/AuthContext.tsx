import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI, setTokens, clearTokens, getAccessToken, getRefreshToken } from '../utils/api';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, companyName?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAccessToken: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Проверка токена при загрузке
  useEffect(() => {
    const checkAuth = async () => {
      const token = getAccessToken();
      if (token) {
        // Можно добавить проверку валидности токена через API
        setIsAuthenticated(true);
      }
      setIsLoading(false);
    };

    checkAuth();
  }, []);

  // Обновление access токена
  const refreshAccessToken = useCallback(async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      setIsAuthenticated(false);
      return;
    }

    try {
      const tokens = await authAPI.refresh(refreshToken);
      setTokens(tokens);
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Ошибка обновления токена:', error);
      clearTokens();
      setIsAuthenticated(false);
    }
  }, []);

  // Автоматическое обновление токена перед истечением
  useEffect(() => {
    if (!isAuthenticated) return;

    const interval = setInterval(() => {
      refreshAccessToken();
    }, 14 * 60 * 1000); // Обновляем каждые 14 минут (если токен живет 15 минут)

    return () => clearInterval(interval);
  }, [isAuthenticated, refreshAccessToken]);

  // Вход
  const login = useCallback(async (email: string, password: string) => {
    try {
      const tokens = await authAPI.login({ email, password });
      setTokens(tokens);
      setIsAuthenticated(true);
    } catch (error: any) {
      throw new Error(error.message || 'Ошибка входа');
    }
  }, []);

  // Регистрация
  const register = useCallback(async (
    email: string,
    password: string,
    name: string,
    companyName?: string
  ) => {
    try {
      const tokens = await authAPI.register({ email, password, name, company_name: companyName });
      setTokens(tokens);
      setIsAuthenticated(true);
    } catch (error: any) {
      throw new Error(error.message || 'Ошибка регистрации');
    }
  }, []);

  // Выход
  const logout = useCallback(async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error('Ошибка выхода:', error);
    } finally {
      clearTokens();
      setIsAuthenticated(false);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        login,
        register,
        logout,
        refreshAccessToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

