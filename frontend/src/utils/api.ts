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

export class ApiErrorWithStatus extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'ApiErrorWithStatus';
  }
}

const handleApiError = async (response: Response): Promise<never> => {
  let errorMessage = 'Произошла ошибка при выполнении запроса';

  try {
    const errorData: ApiError = await response.json();
    errorMessage = errorData.detail || errorData.message || errorMessage;
  } catch {
    errorMessage = response.statusText || errorMessage;
  }

  throw new ApiErrorWithStatus(errorMessage, response.status);
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

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
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
  // Создание нового чата
  createChat: async (title?: string, spaceId?: number): Promise<ChatHistoryItem> => {
    return apiRequest<ChatHistoryItem>('/chat', {
      method: 'POST',
      body: JSON.stringify({ title, space_id: spaceId }),
    });
  },

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

  // Обновление чата (переименование или перемещение в пространство)
  updateChat: async (chatId: number, data: { title?: string; space_id?: number }): Promise<ChatHistoryItem> => {
    return apiRequest<ChatHistoryItem>(`/chat/${chatId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Удаление чата
  deleteChat: async (chatId: number): Promise<void> => {
    return apiRequest<void>(`/chat/${chatId}`, {
      method: 'DELETE',
    });
  },
};

// API методы для пространств (mock версия)
import type { Space, SpaceCreateRequest, SpaceUpdateRequest, Note, NotePreview, NoteCreateRequest, NoteUpdateRequest, SpaceTag, SpaceTagCreateRequest, SpaceTagUpdateRequest, SpaceChat, SupportFeedback, SupportFeedbackRequest, SupportArticle, SupportArticlesResponse, SearchResults, SearchRequest, NotificationSettingsResponse, NotificationSettingsRequest, Notification, NotificationListResponse, UserProfile, UserProfileUpdate } from '../types';

// Имитация задержки сети для mock методов
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const spacesAPI = {
  // Получить список пространств
  getSpaces: async (includeArchived = false, limit = 50, offset = 0): Promise<{ spaces: Space[]; total: number }> => {
    const params = new URLSearchParams();
    if (includeArchived) {
      params.append('include_archived', 'true');
    }
    params.append('limit', limit.toString());
    params.append('offset', offset.toString());

    return apiRequest<{ spaces: Space[]; total: number }>(`/spaces?${params.toString()}`, {
      method: 'GET',
    });
  },

  // Создать пространство
  createSpace: async (data: SpaceCreateRequest): Promise<Space> => {
    const requestBody: { name: string; description?: string } = {
      name: data.name,
    };

    if (data.description && data.description.trim()) {
      requestBody.description = data.description.trim();
    }

    return apiRequest<Space>('/spaces', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });
  },

  // Обновить пространство
  updateSpace: async (spaceId: number, data: SpaceUpdateRequest): Promise<Space> => {
    const requestBody: { name?: string; description?: string } = {};

    if (data.name !== undefined) {
      requestBody.name = data.name;
    }

    if (data.description !== undefined) {
      requestBody.description = data.description;
    }

    return apiRequest<Space>(`/spaces/${spaceId}`, {
      method: 'PUT',
      body: JSON.stringify(requestBody),
    });
  },

  // Удалить пространство
  deleteSpace: async (spaceId: number): Promise<void> => {
    await delay(300);

    const savedSpaces = localStorage.getItem('spaces');
    const spaces: Space[] = savedSpaces ? JSON.parse(savedSpaces) : [];
    const filtered = spaces.filter(s => s.id !== spaceId);

    localStorage.setItem('spaces', JSON.stringify(filtered));

    // Также удаляем связанные чаты и файлы
    const savedChats = localStorage.getItem('space_chats');
    const savedFiles = localStorage.getItem('space_files');

    if (savedChats) {
      const chats: Record<number, any[]> = JSON.parse(savedChats);
      delete chats[spaceId];
      localStorage.setItem('space_chats', JSON.stringify(chats));
    }

    if (savedFiles) {
      const files: Record<number, any[]> = JSON.parse(savedFiles);
      delete files[spaceId];
      localStorage.setItem('space_files', JSON.stringify(files));
    }
  },

  // Архивировать пространство
  archiveSpace: async (spaceId: number): Promise<Space> => {
    return apiRequest<Space>(`/spaces/${spaceId}/archive`, {
      method: 'POST',
    });
  },

  // Разархивировать пространство
  unarchiveSpace: async (spaceId: number): Promise<Space> => {
    return apiRequest<Space>(`/spaces/${spaceId}/unarchive`, {
      method: 'POST',
    });
  },

  // Получить конкретное пространство
  getSpace: async (spaceId: number): Promise<Space> => {
    return apiRequest<Space>(`/spaces/${spaceId}`, {
      method: 'GET',
    });
  },

  // Получить теги пространства
  getSpaceTags: async (spaceId: number): Promise<SpaceTag[]> => {
    const response = await apiRequest<{ tags: SpaceTag[]; total: number }>(`/spaces/${spaceId}/tags`, {
      method: 'GET',
    });
    return response.tags;
  },

  // Создать тег в пространстве
  createSpaceTag: async (spaceId: number, data: SpaceTagCreateRequest): Promise<SpaceTag> => {
    return apiRequest<SpaceTag>(`/spaces/${spaceId}/tags/create`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Обновить тег
  updateSpaceTag: async (spaceId: number, tagId: number, data: SpaceTagUpdateRequest): Promise<SpaceTag> => {
    return apiRequest<SpaceTag>(`/spaces/${spaceId}/tags/${tagId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Удалить тег
  deleteSpaceTag: async (spaceId: number, tagId: number): Promise<void> => {
    return apiRequest<void>(`/spaces/${spaceId}/tags/${tagId}`, {
      method: 'DELETE',
    });
  },

  // Получить настройки уведомлений для пространства
  getNotificationSettings: async (spaceId: number): Promise<NotificationSettingsResponse> => {
    return apiRequest<NotificationSettingsResponse>(`/spaces/${spaceId}/notifications/settings`, {
      method: 'GET',
    });
  },

  // Обновить настройки уведомлений для пространства
  updateNotificationSettings: async (spaceId: number, data: NotificationSettingsRequest): Promise<NotificationSettingsResponse> => {
    return apiRequest<NotificationSettingsResponse>(`/spaces/${spaceId}/notifications/settings`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Экспорт пространства в ZIP архив
  exportSpace: async (spaceId: number): Promise<{ blob: Blob; filename: string }> => {
    const token = getAccessToken();
    const headers: Record<string, string> = {};

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}/spaces/${spaceId}/export`, {
      method: 'POST',
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = 'Ошибка при экспорте пространства';
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.detail || errorData.message || errorMessage;
      } catch {
        errorMessage = response.statusText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    // Получаем имя файла из заголовка Content-Disposition
    const contentDisposition = response.headers.get('Content-Disposition');
    let filename = `space_${spaceId}_export.zip`;

    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (filenameMatch && filenameMatch[1]) {
        filename = filenameMatch[1].replace(/['"]/g, '');
      }
    }

    const blob = await response.blob();
    return { blob, filename };
  },
};

// API методы для заметок
export const notesAPI = {
  // Создание новой заметки
  createNote: async (data: NoteCreateRequest): Promise<Note> => {
    const requestBody: { title: string; content?: string; space_id?: number } = {
      title: data.title.trim(),
    };

    if (data.content && data.content.trim()) {
      requestBody.content = data.content.trim();
    }

    if (data.space_id) {
      requestBody.space_id = data.space_id;
    }

    return apiRequest<Note>('/notes/create', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });
  },

  // Получение списка заметок
  getNotes: async (spaceId?: number, limit = 50, offset = 0): Promise<{ notes: NotePreview[]; total: number }> => {
    const params = new URLSearchParams();
    if (spaceId) {
      params.append('space_id', spaceId.toString());
    }
    params.append('limit', limit.toString());
    params.append('offset', offset.toString());

    return apiRequest<{ notes: NotePreview[]; total: number }>(`/notes/list?${params.toString()}`, {
      method: 'GET',
    });
  },

  // Получение конкретной заметки
  getNote: async (noteId: number): Promise<Note> => {
    return apiRequest<Note>(`/notes/${noteId}`, {
      method: 'GET',
    });
  },

  // Обновление заметки
  updateNote: async (noteId: number, data: NoteUpdateRequest): Promise<Note> => {
    const requestBody: { title?: string; content?: string; space_id?: number } = {};

    if (data.title !== undefined) {
      requestBody.title = data.title.trim();
    }
    if (data.content !== undefined) {
      requestBody.content = data.content.trim();
    }
    if (data.space_id !== undefined) {
      requestBody.space_id = data.space_id;
    }

    return apiRequest<Note>(`/notes/${noteId}`, {
      method: 'PUT',
      body: JSON.stringify(requestBody),
    });
  },

  // Удаление заметки
  deleteNote: async (noteId: number): Promise<void> => {
    return apiRequest<void>(`/notes/${noteId}`, {
      method: 'DELETE',
    });
  },
};

// API методы для поддержки
export const supportAPI = {
  // Отправка отзыва или запроса в поддержку
  sendFeedback: async (data: SupportFeedbackRequest): Promise<SupportFeedback> => {
    return apiRequest<SupportFeedback>('/support/feedback', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Получение списка справочных статей
  getArticles: async (params?: {
    category?: string;
    limit?: number;
    offset?: number;
  }): Promise<SupportArticlesResponse> => {
    const queryParams = new URLSearchParams();
    if (params?.category) queryParams.append('category', params.category);
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());

    const url = `/support/articles${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return apiRequest<SupportArticlesResponse>(url, {
      method: 'GET',
    });
  },

  // Получение справочной статьи по ID
  getArticle: async (articleId: number): Promise<SupportArticle> => {
    return apiRequest<SupportArticle>(`/support/articles/${articleId}`, {
      method: 'GET',
    });
  },
};

// API методы для поиска
export const searchAPI = {
  // Универсальный поиск
  search: async (params: SearchRequest): Promise<SearchResults> => {
    const queryParams = new URLSearchParams();
    queryParams.append('q', params.q);

    if (params.type && params.type !== 'all') {
      queryParams.append('type', params.type);
    }

    if (params.space_id) {
      queryParams.append('space_id', params.space_id.toString());
    }

    if (params.limit) {
      queryParams.append('limit', params.limit.toString());
    }

    return apiRequest<SearchResults>(`/search?${queryParams.toString()}`, {
      method: 'GET',
    });
  },
};

// API методы для уведомлений
export const notificationAPI = {
  // Получить список уведомлений
  getNotifications: async (params?: {
    limit?: number;
    offset?: number;
    unread_only?: boolean;
  }): Promise<NotificationListResponse> => {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());
    if (params?.unread_only) queryParams.append('unread_only', 'true');

    const url = `/notifications${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return apiRequest<NotificationListResponse>(url, {
      method: 'GET',
    });
  },

  // Отметить уведомление как прочитанное
  markAsRead: async (notificationId: number): Promise<Notification> => {
    return apiRequest<Notification>(`/notifications/${notificationId}/read`, {
      method: 'PUT',
    });
  },

  // Отметить все уведомления как прочитанные
  markAllAsRead: async (): Promise<{ updated_count: number }> => {
    return apiRequest<{ updated_count: number }>('/notifications/read-all', {
      method: 'PUT',
    });
  },

  // Удалить уведомление
  deleteNotification: async (notificationId: number): Promise<void> => {
    return apiRequest<void>(`/notifications/${notificationId}`, {
      method: 'DELETE',
    });
  },

  // Получить количество непрочитанных уведомлений
  getUnreadCount: async (): Promise<{ unread_count: number }> => {
    return apiRequest<{ unread_count: number }>('/notifications/unread-count', {
      method: 'GET',
    });
  },
};

// API методы для профиля пользователя
export const userAPI = {
  // Получение профиля текущего пользователя
  getProfile: async (): Promise<UserProfile> => {
    return apiRequest<UserProfile>('/user/profile', {
      method: 'GET',
    });
  },

  // Обновление профиля пользователя
  updateProfile: async (data: UserProfileUpdate): Promise<UserProfile> => {
    return apiRequest<UserProfile>('/user/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
};

