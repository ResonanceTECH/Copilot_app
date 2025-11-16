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

// API методы для пространств (mock версия)
import type { Space, SpaceCreateRequest, SpaceUpdateRequest, Note, NotePreview, NoteCreateRequest, NoteUpdateRequest } from '../types';

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

