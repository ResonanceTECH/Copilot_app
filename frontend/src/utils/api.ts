// Mock API - работает без реальных запросов к бэкенду
// Все данные хранятся только в localStorage
// Без проверок БД - просто генерирует токены

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  company_name?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

// Генерация mock токенов
const generateMockToken = (): string => {
  return `mock_token_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
};

// Получить токен из localStorage
export const getAccessToken = (): string | null => {
  return localStorage.getItem('access_token');
};

export const getRefreshToken = (): string | null => {
  return localStorage.getItem('refresh_token');
};

// Сохранить токены
export const setTokens = (tokens: AuthResponse): void => {
  localStorage.setItem('access_token', tokens.access_token);
  localStorage.setItem('refresh_token', tokens.refresh_token);
};

// Удалить токены
export const clearTokens = (): void => {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
};

// Имитация задержки сети
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Mock API методы для аутентификации (без проверок БД)
export const authAPI = {
  // Регистрация - просто генерирует токены
  register: async (_data: RegisterRequest): Promise<AuthResponse> => {
    await delay(500); // Имитация задержки сети

    // Генерация токенов без проверок
    const tokens: AuthResponse = {
      access_token: generateMockToken(),
      refresh_token: generateMockToken(),
      token_type: 'bearer',
    };

    return tokens;
  },

  // Вход - просто генерирует токены
  login: async (_data: LoginRequest): Promise<AuthResponse> => {
    await delay(500); // Имитация задержки сети

    // Генерация токенов без проверок
    const tokens: AuthResponse = {
      access_token: generateMockToken(),
      refresh_token: generateMockToken(),
      token_type: 'bearer',
    };

    return tokens;
  },

  // Обновление токена
  refresh: async (refreshToken: string): Promise<AuthResponse> => {
    await delay(300); // Имитация задержки сети

    // Проверка refresh токена
    const storedRefreshToken = getRefreshToken();
    if (!storedRefreshToken || storedRefreshToken !== refreshToken) {
      throw new Error('Неверный или истекший refresh токен');
    }

    // Генерация новых токенов
    const tokens: AuthResponse = {
      access_token: generateMockToken(),
      refresh_token: generateMockToken(),
      token_type: 'bearer',
    };

    return tokens;
  },

  // Выход
  logout: async (): Promise<void> => {
    await delay(200); // Имитация задержки сети
    // В mock версии просто ничего не делаем, токены удаляются в clearTokens()
  },
};

