// API клиент для работы с бэкендом

// Базовый URL API (в dev режиме используется прокси из vite.config.ts)
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

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

// Обработка ошибок API
interface ApiError {
  detail?: string;
  message?: string;
}

const handleApiError = async (response: Response): Promise<never> => {
  let errorMessage = 'Произошла ошибка при выполнении запроса';
  
  try {
    const errorData: ApiError = await response.json();
    errorMessage = errorData.detail || errorData.message || errorMessage;
  } catch {
    errorMessage = response.statusText || errorMessage;
  }
  
  throw new Error(errorMessage);
};

// Флаг для предотвращения циклических refresh запросов
let isRefreshing = false;
let refreshPromise: Promise<AuthResponse | null> | null = null;

// Функция для обновления токена
const refreshTokenIfNeeded = async (): Promise<boolean> => {
  if (isRefreshing && refreshPromise) {
    await refreshPromise;
    return true;
  }

  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    return false;
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const tokens = await authAPI.refresh(refreshToken);
      setTokens(tokens);
      return tokens;
    } catch (error) {
      clearTokens();
      // Вызываем событие для разлогинивания
      window.dispatchEvent(new CustomEvent('auth:logout'));
      return null;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  const result = await refreshPromise;
  return result !== null;
};

// Базовый HTTP клиент
const apiRequest = async <T>(
  endpoint: string,
  options: RequestInit = {},
  retryOn401: boolean = true
): Promise<T> => {
  // Исключаем auth endpoints из автоматического refresh
  const isAuthEndpoint = endpoint.startsWith('/auth/');
  
  const token = getAccessToken();
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  // Отладочное логирование (можно убрать в продакшене)
  if (import.meta.env.DEV) {
    console.log(`[API] ${options.method || 'GET'} ${endpoint}`, {
      hasToken: !!token,
      tokenPreview: token ? `${token.substring(0, 20)}...` : null,
    });
  }
  
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });
  
  // Обработка 401 ошибки с автоматическим refresh
  if (response.status === 401 && !isAuthEndpoint && retryOn401) {
    const refreshed = await refreshTokenIfNeeded();
    if (refreshed) {
      // Повторяем запрос с новым токеном
      const newToken = getAccessToken();
      if (newToken) {
        headers['Authorization'] = `Bearer ${newToken}`;
        const retryResponse = await fetch(`${API_BASE_URL}${endpoint}`, {
          ...options,
          headers,
        });
        
        if (!retryResponse.ok) {
          await handleApiError(retryResponse);
        }
        
        if (retryResponse.status === 204 || retryResponse.headers.get('content-length') === '0') {
          return {} as T;
        }
        
        return retryResponse.json();
      }
    }
  }
  
  if (!response.ok) {
    await handleApiError(response);
  }
  
  // Если ответ пустой (например, для logout)
  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return {} as T;
  }
  
  return response.json();
};

// API методы для аутентификации
export const authAPI = {
  // Регистрация
  register: async (data: RegisterRequest): Promise<AuthResponse> => {
    // Для регистрации не передаем токен и не делаем автоматический refresh
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      await handleApiError(response);
    }
    
    return response.json();
  },

  // Вход
  login: async (data: LoginRequest): Promise<AuthResponse> => {
    // Для логина не передаем токен и не делаем автоматический refresh
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      await handleApiError(response);
    }
    
    return response.json();
  },

  // Обновление токена
  refresh: async (refreshToken: string): Promise<AuthResponse> => {
    return apiRequest<AuthResponse>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    }, false); // Не пытаемся refresh при refresh запросе
  },

  // Выход
  logout: async (): Promise<void> => {
    try {
      await apiRequest<void>('/auth/logout', {
        method: 'POST',
      });
    } catch (error) {
      // Игнорируем ошибки при выходе, токены все равно удаляются
      console.warn('Ошибка при выходе:', error);
    }
  },
};

// Экспорт базового клиента для использования в других сервисах
export { apiRequest };

// Интерфейсы для чата
export interface ChatSendRequest {
  message: string;
  chat_id?: number;
  space_id?: number;
}

export interface ChatSendResponse {
  success: boolean;
  chat_id: number;
  message_id: number;
  response?: {
    raw_text: string;
    formatted_html: string;
    timestamp: string;
    category: string;
    probabilities: Record<string, number>;
  };
  error?: string;
}

export interface ChatHistoryItem {
  id: number;
  title: string | null;
  space_id: number;
  space_name: string;
  last_message: string | null;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatHistoryResponse {
  chats: ChatHistoryItem[];
  total: number;
}

export interface MessageItem {
  id: number;
  role: string;
  content: string;
  created_at: string;
}

export interface ChatMessagesResponse {
  messages: MessageItem[];
  total: number;
  chat_id: number;
  chat_title: string | null;
}

// API методы для чата
export const chatAPI = {
  // Отправка сообщения
  sendMessage: async (data: ChatSendRequest): Promise<ChatSendResponse> => {
    return apiRequest<ChatSendResponse>('/chat/send', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Получение истории чатов
  getHistory: async (spaceId?: number): Promise<ChatHistoryResponse> => {
    const params = spaceId ? `?space_id=${spaceId}` : '';
    return apiRequest<ChatHistoryResponse>(`/chat/history${params}`, {
      method: 'GET',
    });
  },

  // Получение сообщений чата
  getMessages: async (chatId: number): Promise<ChatMessagesResponse> => {
    return apiRequest<ChatMessagesResponse>(`/chat/${chatId}/messages`, {
      method: 'GET',
    });
  },
};

