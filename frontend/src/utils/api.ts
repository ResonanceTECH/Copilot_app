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
  // Отправка сообщения
  sendMessage: async (data: ChatSendRequest): Promise<ChatSendResponse> => {
    return apiRequest<ChatSendResponse>('/chat/send', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Получение истории чатов (mock версия с поддержкой фильтрации по space_id)
  getHistory: async (spaceId?: number): Promise<ChatHistoryResponse> => {
    // Если есть реальный API, используем его
    if (import.meta.env.VITE_USE_REAL_API === 'true') {
      const params = spaceId ? `?space_id=${spaceId}` : '';
      return apiRequest<ChatHistoryResponse>(`/chat/history${params}`, {
        method: 'GET',
      });
    }

    // Mock версия
    await delay(300);

    const savedChats = localStorage.getItem('space_chats');
    const chats: Record<number, SpaceChat[]> = savedChats ? JSON.parse(savedChats) : {};

    let allChats: ChatHistoryItem[] = [];

    if (spaceId) {
      // Получаем чаты для конкретного пространства
      const spaceChats = chats[spaceId] || [];
      allChats = spaceChats.map(chat => ({
        id: parseInt(chat.id) || 0,
        title: chat.title,
        space_id: spaceId,
        space_name: '', // Будет заполнено из пространства
        last_message: chat.preview,
        last_message_at: chat.date,
        created_at: chat.date,
        updated_at: chat.date,
      }));
    } else {
      // Получаем все чаты из всех пространств
      Object.entries(chats).forEach(([spaceIdStr, spaceChats]) => {
        const sid = parseInt(spaceIdStr);
        spaceChats.forEach(chat => {
          allChats.push({
            id: parseInt(chat.id) || 0,
            title: chat.title,
            space_id: sid,
            space_name: '',
            last_message: chat.preview,
            last_message_at: chat.date,
            created_at: chat.date,
            updated_at: chat.date,
          });
        });
      });
    }

    // Заполняем space_name из пространств
    const savedSpaces = localStorage.getItem('spaces');
    const spaces: Space[] = savedSpaces ? JSON.parse(savedSpaces) : [];
    allChats = allChats.map(chat => {
      const space = spaces.find(s => s.id === chat.space_id);
      return {
        ...chat,
        space_name: space?.name || 'Без пространства',
      };
    });

    return {
      chats: allChats,
      total: allChats.length,
    };
  },

  // Получение сообщений чата
  getMessages: async (chatId: number): Promise<ChatMessagesResponse> => {
    return apiRequest<ChatMessagesResponse>(`/chat/${chatId}/messages`, {
      method: 'GET',
    });
  },
};

// API методы для пространств (mock версия)
import type { Space, SpaceCreateRequest, SpaceUpdateRequest, Note, NotePreview, NoteCreateRequest, NoteUpdateRequest, SpaceTag, SpaceTagCreateRequest, SpaceTagUpdateRequest, SpaceChat, SupportFeedback, SupportFeedbackRequest, SupportArticle, SupportArticlesResponse } from '../types';

// Имитация задержки сети для mock методов
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const spacesAPI = {
  // Получить список пространств
  getSpaces: async (includeArchived = false, limit = 50, offset = 0): Promise<{ spaces: Space[]; total: number }> => {
    await delay(300);

    // Mock данные из localStorage
    const savedSpaces = localStorage.getItem('spaces');
    let spaces: Space[] = savedSpaces ? JSON.parse(savedSpaces) : [];

    if (!includeArchived) {
      spaces = spaces.filter(s => !s.is_archived);
    }

    const total = spaces.length;
    spaces = spaces.slice(offset, offset + limit);

    return { spaces, total };
  },

  // Создать пространство
  createSpace: async (data: SpaceCreateRequest): Promise<Space> => {
    await delay(500);

    const savedSpaces = localStorage.getItem('spaces');
    const spaces: Space[] = savedSpaces ? JSON.parse(savedSpaces) : [];

    const newSpace: Space = {
      id: Date.now(),
      name: data.name,
      description: data.description,
      is_archived: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      chats_count: 0,
      notes_count: 0,
      tags_count: 0,
    };

    spaces.push(newSpace);
    localStorage.setItem('spaces', JSON.stringify(spaces));

    return newSpace;
  },

  // Обновить пространство
  updateSpace: async (spaceId: number, data: SpaceUpdateRequest): Promise<Space> => {
    await delay(400);

    const savedSpaces = localStorage.getItem('spaces');
    const spaces: Space[] = savedSpaces ? JSON.parse(savedSpaces) : [];
    const spaceIndex = spaces.findIndex(s => s.id === spaceId);

    if (spaceIndex === -1) {
      throw new Error('Пространство не найдено');
    }

    spaces[spaceIndex] = {
      ...spaces[spaceIndex],
      ...data,
      updated_at: new Date().toISOString(),
    };

    localStorage.setItem('spaces', JSON.stringify(spaces));
    return spaces[spaceIndex];
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
    await delay(300);

    const savedSpaces = localStorage.getItem('spaces');
    const spaces: Space[] = savedSpaces ? JSON.parse(savedSpaces) : [];
    const spaceIndex = spaces.findIndex(s => s.id === spaceId);

    if (spaceIndex === -1) {
      throw new Error('Пространство не найдено');
    }

    spaces[spaceIndex] = {
      ...spaces[spaceIndex],
      is_archived: true,
      updated_at: new Date().toISOString(),
    };

    localStorage.setItem('spaces', JSON.stringify(spaces));
    return spaces[spaceIndex];
  },

  // Разархивировать пространство
  unarchiveSpace: async (spaceId: number): Promise<Space> => {
    await delay(300);

    const savedSpaces = localStorage.getItem('spaces');
    const spaces: Space[] = savedSpaces ? JSON.parse(savedSpaces) : [];
    const spaceIndex = spaces.findIndex(s => s.id === spaceId);

    if (spaceIndex === -1) {
      throw new Error('Пространство не найдено');
    }

    spaces[spaceIndex] = {
      ...spaces[spaceIndex],
      is_archived: false,
      updated_at: new Date().toISOString(),
    };

    localStorage.setItem('spaces', JSON.stringify(spaces));
    return spaces[spaceIndex];
  },

  // Получить конкретное пространство
  getSpace: async (spaceId: number): Promise<Space> => {
    await delay(300);

    const savedSpaces = localStorage.getItem('spaces');
    const spaces: Space[] = savedSpaces ? JSON.parse(savedSpaces) : [];
    const space = spaces.find(s => s.id === spaceId);

    if (!space) {
      throw new Error('Пространство не найдено');
    }

    return space;
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
};

// API методы для заметок (mock версия)
export const notesAPI = {
  // Создание новой заметки
  createNote: async (data: NoteCreateRequest): Promise<Note> => {
    await delay(500);

    if (!data.title.trim()) {
      throw new Error('Название заметки не может быть пустым');
    }

    const savedNotes = localStorage.getItem('notes');
    const notes: Note[] = savedNotes ? JSON.parse(savedNotes) : [];

    // Получаем пространство (или используем дефолтное)
    const savedSpaces = localStorage.getItem('spaces');
    const spaces: Space[] = savedSpaces ? JSON.parse(savedSpaces) : [];
    let spaceId = data.space_id;
    let spaceName = 'Без пространства';

    if (spaceId) {
      const space = spaces.find(s => s.id === spaceId);
      if (!space) {
        throw new Error('Пространство не найдено');
      }
      spaceName = space.name;
    } else if (spaces.length > 0) {
      // Используем первое доступное пространство как дефолтное
      spaceId = spaces[0].id;
      spaceName = spaces[0].name;
    }

    const newNote: Note = {
      id: Date.now(),
      space_id: spaceId || 0,
      space_name: spaceName,
      user_id: 1, // Mock user ID
      title: data.title,
      content: data.content || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      tags: [],
    };

    notes.push(newNote);
    localStorage.setItem('notes', JSON.stringify(notes));

    return newNote;
  },

  // Получение списка заметок
  getNotes: async (spaceId?: number, limit = 50, offset = 0): Promise<{ notes: NotePreview[]; total: number }> => {
    await delay(300);

    const savedNotes = localStorage.getItem('notes');
    let notes: Note[] = savedNotes ? JSON.parse(savedNotes) : [];

    if (spaceId) {
      notes = notes.filter(n => n.space_id === spaceId);
    }

    const total = notes.length;
    const paginatedNotes = notes.slice(offset, offset + limit);

    const previews: NotePreview[] = paginatedNotes.map(note => ({
      id: note.id,
      space_id: note.space_id,
      space_name: note.space_name,
      title: note.title,
      content_preview: note.content.length > 100 ? note.content.substring(0, 100) + '...' : note.content,
      created_at: note.created_at,
      updated_at: note.updated_at,
    }));

    return { notes: previews, total };
  },

  // Получение конкретной заметки
  getNote: async (noteId: number): Promise<Note> => {
    await delay(300);

    const savedNotes = localStorage.getItem('notes');
    const notes: Note[] = savedNotes ? JSON.parse(savedNotes) : [];
    const note = notes.find(n => n.id === noteId);

    if (!note) {
      throw new Error('Заметка не найдена');
    }

    return note;
  },

  // Обновление заметки
  updateNote: async (noteId: number, data: NoteUpdateRequest): Promise<Note> => {
    await delay(400);

    const savedNotes = localStorage.getItem('notes');
    const notes: Note[] = savedNotes ? JSON.parse(savedNotes) : [];
    const noteIndex = notes.findIndex(n => n.id === noteId);

    if (noteIndex === -1) {
      throw new Error('Заметка не найдена');
    }

    if (data.title !== undefined && !data.title.trim()) {
      throw new Error('Название заметки не может быть пустым');
    }

    // Проверка пространства, если указано
    if (data.space_id !== undefined) {
      const savedSpaces = localStorage.getItem('spaces');
      const spaces: Space[] = savedSpaces ? JSON.parse(savedSpaces) : [];
      const space = spaces.find(s => s.id === data.space_id);
      if (!space) {
        throw new Error('Пространство не найдено');
      }
      notes[noteIndex].space_id = data.space_id;
      notes[noteIndex].space_name = space.name;
    }

    notes[noteIndex] = {
      ...notes[noteIndex],
      ...(data.title !== undefined && { title: data.title }),
      ...(data.content !== undefined && { content: data.content }),
      updated_at: new Date().toISOString(),
    };

    localStorage.setItem('notes', JSON.stringify(notes));
    return notes[noteIndex];
  },

  // Удаление заметки
  deleteNote: async (noteId: number): Promise<void> => {
    await delay(300);

    const savedNotes = localStorage.getItem('notes');
    const notes: Note[] = savedNotes ? JSON.parse(savedNotes) : [];
    const filtered = notes.filter(n => n.id !== noteId);

    if (filtered.length === notes.length) {
      throw new Error('Заметка не найдена');
    }

    localStorage.setItem('notes', JSON.stringify(filtered));
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

