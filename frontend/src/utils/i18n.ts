export type Language = 'ru' | 'en';

export interface Translations {
  // Header
  thread: string;
  english: string;
  russian: string;

  // Sidebar
  aiAssistant: string;
  createNew: string;
  chats: string;
  explore: string;
  settings: string;
  more: string;

  // ChatArea
  greeting: string;
  greetingWithName: string;
  trending: string;
  startNewThread: string;
  assistant: string;
  deepseekChimera: string;

  // Thread management
  newChat: string;
  deleteThread: string;
  rename: string;

  // BottomPanel
  createNewChat: string;

  // Sidebar
  signUpForFree: string;
  signUp: string;
  saveChatHistory: string;
  noChats: string;
}

const translations: Record<Language, Translations> = {
  ru: {
    thread: 'Тред',
    english: 'English',
    russian: 'Русский',
    aiAssistant: 'AI-ассистент',
    createNew: '+ Создать новый',
    chats: 'Чаты',
    explore: 'Пространства',
    settings: 'Настройки',
    more: 'Еще',
    greeting: 'Привет, чем могу помочь?',
    greetingWithName: 'Привет {name}, чем могу помочь?',
    trending: 'В тренде',
    startNewThread: 'Начните новый тред...',
    assistant: 'Ассистент',
    deepseekChimera: 'Deepseek Chimera',
    newChat: 'Новый чат',
    deleteThread: 'Удалить Thread',
    rename: 'Переименовать',
    createNewChat: 'Создать новый чат',
    signUpForFree: 'Зарегистрируйтесь бесплатно, чтобы сохранить историю чатов',
    signUp: 'Зарегистрироваться',
    saveChatHistory: 'Сохранить историю чатов',
    noChats: 'Нет чатов. Создайте новый чат, чтобы начать общение.',
  },
  en: {
    thread: 'Thread',
    english: 'English',
    russian: 'Русский',
    aiAssistant: 'AI Assistant',
    createNew: '+ Create New',
    chats: 'Chats',
    explore: 'Explore',
    settings: 'Settings',
    more: 'More',
    greeting: 'Hello, how can I help?',
    greetingWithName: 'Hello {name}, how can I help?',
    trending: 'Trending',
    startNewThread: 'Start a new thread...',
    assistant: 'Assistant',
    deepseekChimera: 'Deepseek Chimera',
    newChat: 'New Chat',
    deleteThread: 'Delete Thread',
    rename: 'Rename',
    createNewChat: 'Create New Chat',
    signUpForFree: 'Sign up for free to save your chat history',
    signUp: 'Sign up',
    saveChatHistory: 'Save chat history',
    noChats: 'No chats. Create a new chat to start a conversation.',
  },
};

export const getTranslation = (key: keyof Translations, language: Language, params?: Record<string, string>): string => {
  let translation = translations[language][key];

  if (params) {
    Object.entries(params).forEach(([paramKey, paramValue]) => {
      translation = translation.replace(`{${paramKey}}`, paramValue);
    });
  }

  return translation;
};

export const getLanguageName = (language: Language): string => {
  return language === 'ru' ? translations.ru.russian : translations.en.english;
};

