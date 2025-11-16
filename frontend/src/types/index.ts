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

