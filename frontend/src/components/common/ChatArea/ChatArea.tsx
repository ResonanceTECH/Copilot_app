import React, { useState } from 'react';
import { Icon } from '../../ui/Icon';
import { Button } from '../../ui/Button';
import { ICONS } from '../../../utils/icons';
import { ChatMessage, TrendingCard } from '../../../types';
import logoIcon from '../../../assets/icons/logo.svg';
import './ChatArea.css';

interface ChatAreaProps {
  userName?: string;
  messages?: ChatMessage[];
  trendingCards?: TrendingCard[];
  onSendMessage?: (message: string) => void;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  userName = '',
  messages = [],
  trendingCards = [],
  onSendMessage,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [activeTool, setActiveTool] = useState<string>('assistant');

  const handleSend = () => {
    if (inputValue.trim() && onSendMessage) {
      onSendMessage(inputValue.trim());
      setInputValue('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const defaultTrendingCards: TrendingCard[] = [
    {
      id: '1',
      category: 'Новости',
      title: 'Празднование Дня освобождения',
      imageUrl: 'https://images.unsplash.com/photo-1524419986249-348e8fa6ad4a?w=400&h=300&fit=crop',
    },
    {
      id: '2',
      category: 'Развлечения',
      title: 'Музыка для путешествий - Ваш плейлист',
      imageUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=300&fit=crop',
    },
    {
      id: '3',
      category: 'Новости',
      title: 'Пожар в Южном Форке в Руидозо',
      imageUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=300&fit=crop',
    },
    {
      id: '4',
      category: 'Образ жизни',
      title: 'Идеальный план питания: сжигай жир, сохраняй мышцы',
      imageUrl: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=300&fit=crop',
    },
  ];

  const cards = trendingCards.length > 0 ? trendingCards : defaultTrendingCards;

  return (
    <div className="chat-area">
      {messages.length === 0 ? (
        <div className="chat-welcome-container">
          <div className="chat-welcome">
            <div className="chat-welcome-icon">
              <img src={logoIcon} alt="AI-ассистент" className="chat-welcome-logo" />
            </div>
            <h2 className="chat-welcome-title">
              {userName ? `Привет ${userName}, чем могу помочь?` : 'Привет, чем могу помочь?'}
            </h2>
          </div>

          {cards.length > 0 && (
            <div className="chat-trending">
              <h3 className="chat-trending-title">В тренде</h3>
              <div className="chat-trending-grid">
                {cards.map((card) => (
                  <div key={card.id} className="chat-trending-card">
                    {card.imageUrl && (
                      <div className="chat-trending-card-image">
                        <img src={card.imageUrl} alt={card.title} />
                      </div>
                    )}
                    <div className="chat-trending-card-content">
                      <span className="chat-trending-card-category">{card.category}</span>
                      <h4 className="chat-trending-card-title">{card.title}</h4>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="chat-messages">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`chat-message chat-message--${message.role}`}
            >
              <div className="chat-message-content">{message.content}</div>
            </div>
          ))}
        </div>
      )}

      <div className="chat-actions">
        <Button
          variant={activeTool === 'assistant' ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => setActiveTool('assistant')}
          className="chat-action-btn"
        >
          Ассистент
        </Button>
        <Button
          variant={activeTool === 'web-search' ? 'primary' : 'ghost'}
          size="sm"
          icon={ICONS.search}
          onClick={() => setActiveTool('web-search')}
          className="chat-action-btn"
        >
          Веб-поиск
        </Button>
        <Button
          variant={activeTool === 'gpt-4o' ? 'primary' : 'ghost'}
          size="sm"
          icon={ICONS.brain}
          onClick={() => setActiveTool('gpt-4o')}
          className="chat-action-btn"
        >
          GPT-4o
        </Button>
        <Button
          variant={activeTool === 'claude-3' ? 'primary' : 'ghost'}
          size="sm"
          icon={ICONS.cloud}
          onClick={() => setActiveTool('claude-3')}
          className="chat-action-btn"
        >
          Claude 3 Sonnet
        </Button>
        <Button
          variant={activeTool === 'gemini-pro' ? 'primary' : 'ghost'}
          size="sm"
          icon={ICONS.sparkle}
          onClick={() => setActiveTool('gemini-pro')}
          className="chat-action-btn"
        >
          Gemini 1.5 Pro
        </Button>
      </div>

      <div className="chat-input-wrapper">
        <div className="chat-input-container">
          <input
            type="text"
            className="chat-input"
            placeholder="Начните новый тред..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <div className="chat-input-actions">
            <button className="chat-input-icon-btn" type="button">
              <Icon src={ICONS.paperclip} size="md" />
            </button>
            <button className="chat-input-icon-btn" type="button">
              <Icon src={ICONS.microphone} size="md" />
            </button>
            <button
              className="chat-input-icon-btn chat-input-send-btn"
              type="button"
              onClick={handleSend}
            >
              <Icon src={ICONS.send} size="md" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
