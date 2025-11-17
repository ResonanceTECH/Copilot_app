export interface IconProps {
  src: string;
  size?: 'sm' | 'md' | 'lg';
  color?: string;
  className?: string;
}

export interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: string;
  className?: string;
  disabled?: boolean;
}

export interface InputProps {
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  icon?: string;
  onIconClick?: () => void;
  className?: string;
}

export interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  isLoading?: boolean; // Флаг для сообщения "Поиск и формирование ответа"
}

export interface TrendingCard {
  id: string;
  category: string;
  title: string;
  image?: string;
  imageUrl?: string;
}

export interface ChatThread {
  id: string;
  title: string;
  lastMessage?: string;
  timestamp: Date;
}

export interface Space {
  id: number;
  name: string;
  description?: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  chats_count: number;
  notes_count: number;
  tags_count: number;
}

export interface SpaceCreateRequest {
  name: string;
  description?: string;
}

export interface SpaceUpdateRequest {
  name?: string;
  description?: string;
}

export interface SpaceFile {
  id: string;
  name: string;
  type: string;
  size: number;
  uploaded_at: string;
  thumbnail?: string;
}

export interface SpaceChat {
  id: string;
  title: string;
  preview: string;
  date: string;
  is_important?: boolean;
}

export interface Note {
  id: number;
  space_id: number;
  space_name: string;
  user_id: number;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  tags: string[];
}

export interface NotePreview {
  id: number;
  space_id: number;
  space_name: string;
  title: string;
  content_preview: string;
  created_at: string;
  updated_at: string;
}

export interface NoteCreateRequest {
  title: string;
  content?: string;
  space_id?: number;
}

export interface NoteUpdateRequest {
  title?: string;
  content?: string;
  space_id?: number;
}

export interface SpaceTag {
  id: number;
  name: string;
  color?: string;
  tag_type?: string;
  space_id: number;
  created_at: string;
}

export interface SpaceTagCreateRequest {
  name: string;
  color?: string;
  tag_type?: string;
}

export interface SpaceTagUpdateRequest {
  name?: string;
  color?: string;
  tag_type?: string;
}

export interface SupportFeedback {
  id: number;
  message: string;
  created_at: string;
}

export interface SupportFeedbackRequest {
  subject: string;
  message: string;
  feedback_type?: 'bug' | 'feature' | 'question' | 'other';
  email?: string; // обязательно для неавторизованных
  name?: string; // обязательно для неавторизованных
}

export interface SupportArticle {
  id: number;
  title: string;
  content: string;
  category: string;
  order: number;
  created_at: string;
  updated_at: string;
}

export interface SupportArticlesResponse {
  articles: SupportArticle[];
  total: number;
}

// Типы для поиска
export interface SearchChatItem {
  id: number;
  title: string | null;
  space_id: number;
  space_name: string;
  created_at: string;
  updated_at: string;
  snippet: string | null;
}

export interface SearchNoteItem {
  id: number;
  title: string;
  space_id: number;
  space_name: string;
  created_at: string;
  updated_at: string;
  snippet: string | null;
}

export interface SearchMessageItem {
  id: number;
  chat_id: number;
  chat_title: string | null;
  space_id: number;
  space_name: string;
  role: string;
  content: string;
  created_at: string;
  snippet: string | null;
}

export interface SearchResults {
  query: string;
  total: number;
  results: {
    chats_count: number;
    notes_count: number;
    messages_count: number;
  };
  chats: SearchChatItem[];
  notes: SearchNoteItem[];
  messages: SearchMessageItem[];
}

export interface SearchRequest {
  q: string;
  type?: 'all' | 'chats' | 'notes' | 'messages';
  space_id?: number;
  limit?: number;
}

// Типы для настроек уведомлений
export interface NotificationSettings {
  new_message: boolean;
  new_note: boolean;
  new_file: boolean;
}

export interface NotificationSettingsResponse {
  id: number;
  space_id: number;
  settings_json: NotificationSettings;
}

export interface NotificationSettingsRequest {
  settings_json: NotificationSettings;
}

