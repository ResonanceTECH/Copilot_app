import React, { useState, useCallback, useEffect } from 'react';
import { Sidebar } from '../../components/common/Sidebar';
import { Header } from '../../components/common/Header';
import { ChatArea } from '../../components/common/ChatArea';
import { BottomPanel } from '../../components/common/BottomPanel';
import { PanelToggle } from '../../components/common/PanelToggle';
import { ChatMessage, ChatThread } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { getTranslation } from '../../utils/i18n';
import { chatAPI, ChatHistoryItem, MessageItem } from '../../utils/api';
import './AssistantPage.css';

interface ThreadData {
  thread: ChatThread;
  messages: ChatMessage[];
  chatId?: number; // ID чата из бэкенда
}

export const AssistantPage: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const [userName] = useState('');
  const [threads, setThreads] = useState<Map<string, ThreadData>>(new Map());
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [panelMode, setPanelMode] = useState<'sidebar' | 'bottom'>('sidebar');
  const [activeTool, setActiveTool] = useState<string>('assistant');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const { language } = useLanguage();
  const [panelTogglePosition, setPanelTogglePosition] = useState<{
    side: 'left' | 'right' | 'top' | 'bottom';
    offset: number;
  }>(() => {
    const saved = localStorage.getItem('panelTogglePosition');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return { side: 'left', offset: 50 };
      }
    }
    return { side: 'left', offset: 50 };
  });

  // Загрузка истории чатов из API при входе
  useEffect(() => {
    if (isAuthenticated) {
      const loadChatHistory = async () => {
        // Небольшая задержка, чтобы убедиться, что токен сохранен
        await new Promise(resolve => setTimeout(resolve, 100));
        
        try {
          const history = await chatAPI.getHistory();
          const threadsMap = new Map<string, ThreadData>();
          
          history.chats.forEach((chat: ChatHistoryItem) => {
            const threadId = `chat-${chat.id}`;
            threadsMap.set(threadId, {
              thread: {
                id: threadId,
                title: chat.title || getTranslation('newChat', language),
                timestamp: new Date(chat.updated_at || chat.created_at),
                lastMessage: chat.last_message || undefined,
              },
              messages: [],
              chatId: chat.id,
            });
          });
          
          setThreads(threadsMap);
        } catch (error) {
          console.error('Ошибка загрузки истории чатов:', error);
          // При ошибке 401 не очищаем историю, так как это может быть временная проблема
        }
      };
      
      loadChatHistory();
    } else {
      // Если пользователь не авторизован, очищаем историю
      setThreads(new Map());
      setActiveThreadId(null);
      setMessages([]);
    }
  }, [isAuthenticated, language]);

  // Удаляем сохранение в localStorage, так как теперь используем API

  // Получить список чатов для отображения
  const getThreadsList = useCallback((): ChatThread[] => {
    return Array.from(threads.values())
      .map((data) => data.thread)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [threads]);

  // Создать новый чат
  const handleNewThread = useCallback(() => {
    const newThreadId = `thread-${Date.now()}`;
    const newThread: ChatThread = {
      id: newThreadId,
      title: getTranslation('newChat', language),
      timestamp: new Date(),
    };

    const newThreadData: ThreadData = {
      thread: newThread,
      messages: [],
    };

    setThreads((prev) => {
      const updated = new Map(prev);
      updated.set(newThreadId, newThreadData);
      return updated;
    });

    setActiveThreadId(newThreadId);
    setMessages([]);
  }, [language]);

  // Выбрать чат
  const handleThreadSelect = useCallback(async (threadId: string) => {
    setActiveThreadId(threadId);
    const threadData = threads.get(threadId);
    
    if (threadData && threadData.chatId) {
      // Загружаем сообщения из API
      try {
        const messagesData = await chatAPI.getMessages(threadData.chatId);
        const chatMessages: ChatMessage[] = messagesData.messages.map((msg: MessageItem) => ({
          id: msg.id.toString(),
          content: msg.content,
          role: msg.role as 'user' | 'assistant',
          timestamp: new Date(msg.created_at),
        }));
        
        // Обновляем сообщения в состоянии
        setMessages(chatMessages);
        
        // Обновляем сообщения в threads
        setThreads((prev) => {
          const updated = new Map(prev);
          const data = updated.get(threadId);
          if (data) {
            updated.set(threadId, {
              ...data,
              messages: chatMessages,
            });
          }
          return updated;
        });
      } catch (error) {
        console.error('Ошибка загрузки сообщений:', error);
        setMessages(threadData.messages);
      }
    } else if (threadData) {
      setMessages(threadData.messages);
    } else {
      setMessages([]);
    }
  }, [threads]);

  // Удалить чат
  const handleThreadDelete = useCallback((threadId: string) => {
    setThreads((prev) => {
      const updated = new Map(prev);
      updated.delete(threadId);
      return updated;
    });

    if (activeThreadId === threadId) {
      setActiveThreadId(null);
      setMessages([]);
    }
  }, [activeThreadId]);

  // Переименовать чат
  const handleThreadRename = useCallback((threadId: string, newTitle: string) => {
    setThreads((prev) => {
      const updated = new Map(prev);
      const threadData = updated.get(threadId);
      if (threadData) {
        updated.set(threadId, {
          ...threadData,
          thread: {
            ...threadData.thread,
            title: newTitle.trim() || getTranslation('newChat', language),
          },
        });
      }
      return updated;
    });
  }, [language]);

  // Отправить сообщение в конкретный чат
  const handleSendMessageToThread = useCallback(async (
    threadId: string, 
    content: string, 
    isNewThread: boolean
  ) => {
    const threadData = threads.get(threadId);
    const chatId = threadData?.chatId;
    
    // Добавляем сообщение пользователя в UI сразу
    const userMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      content,
      role: 'user',
      timestamp: new Date(),
    };

    setThreads((prev) => {
      const updated = new Map(prev);
      const data = updated.get(threadId);
      
      if (data) {
        const updatedMessages = [...data.messages, userMessage];
        updated.set(threadId, {
          ...data,
          thread: {
            ...data.thread,
            lastMessage: content,
          },
          messages: updatedMessages,
        });
      }
      
      return updated;
    });

    setMessages((prev) => [...prev, userMessage]);

    // Отправляем сообщение на сервер
    try {
      const response = await chatAPI.sendMessage({
        message: content,
        chat_id: chatId,
      });

      if (response.success && response.response) {
        // Обновляем ID чата если это был новый чат
        if (isNewThread && response.chat_id) {
          setThreads((prev) => {
            const updated = new Map(prev);
            const data = updated.get(threadId);
            if (data) {
              // Обновляем threadId на основе реального chat_id из бэкенда
              const newThreadId = `chat-${response.chat_id}`;
              updated.delete(threadId);
              updated.set(newThreadId, {
                ...data,
                chatId: response.chat_id,
              });
              // Обновляем активный threadId
              if (activeThreadId === threadId) {
                setActiveThreadId(newThreadId);
              }
            }
            return updated;
          });
        }

        // Добавляем ответ ассистента
        const assistantMessage: ChatMessage = {
          id: response.message_id.toString(),
          content: response.response.raw_text,
          role: 'assistant',
          timestamp: new Date(response.response.timestamp),
        };

        setThreads((prev) => {
          const updated = new Map(prev);
          const data = updated.get(threadId);
          if (data) {
            // Заменяем временное сообщение пользователя на реальное
            const messagesWithoutTemp = data.messages.filter(
              msg => !msg.id.startsWith('temp-')
            );
            updated.set(threadId, {
              ...data,
              messages: [...messagesWithoutTemp, assistantMessage],
            });
          }
          return updated;
        });

        setMessages((prev) => {
          const withoutTemp = prev.filter(msg => !msg.id.startsWith('temp-'));
          return [...withoutTemp, assistantMessage];
        });
      } else {
        throw new Error(response.error || 'Ошибка отправки сообщения');
      }
    } catch (error: any) {
      console.error('Ошибка отправки сообщения:', error);
      
      // Удаляем временное сообщение при ошибке
      setThreads((prev) => {
        const updated = new Map(prev);
        const data = updated.get(threadId);
        if (data) {
          updated.set(threadId, {
            ...data,
            messages: data.messages.filter(msg => !msg.id.startsWith('temp-')),
          });
        }
        return updated;
      });

      setMessages((prev) => prev.filter(msg => !msg.id.startsWith('temp-')));
      
      // Показываем сообщение об ошибке
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        content: `Ошибка: ${error.message || 'Не удалось отправить сообщение'}`,
        role: 'assistant',
        timestamp: new Date(),
      };
      
      setMessages((prev) => [...prev, errorMessage]);
    }
  }, [threads, activeThreadId]);

  // Отправить сообщение
  const handleSendMessage = useCallback((content: string) => {
    if (!activeThreadId) {
      // Если нет активного чата, создаем новый
      const newThreadId = `thread-${Date.now()}`;
      const newThread: ChatThread = {
        id: newThreadId,
        title: getTranslation('newChat', language),
        timestamp: new Date(),
      };

      const newThreadData: ThreadData = {
        thread: newThread,
        messages: [],
      };

      setThreads((prev) => {
        const updated = new Map(prev);
        updated.set(newThreadId, newThreadData);
        return updated;
      });

      setActiveThreadId(newThreadId);
      setMessages([]);
      
      // Отправляем сообщение в новый чат
      handleSendMessageToThread(newThreadId, content, true);
      return;
    }

    handleSendMessageToThread(activeThreadId, content, false);
  }, [activeThreadId, handleSendMessageToThread, language]);

  return (
    <div className="assistant-page">
      {panelMode === 'sidebar' && (
        <Sidebar
          threads={getThreadsList()}
          activeThreadId={activeThreadId}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          onNewThread={handleNewThread}
          onThreadSelect={handleThreadSelect}
          onThreadDelete={handleThreadDelete}
          onThreadRename={handleThreadRename}
        />
      )}
      <div className={`assistant-main ${panelMode === 'bottom' ? 'assistant-main--full-width' : ''} ${isSidebarCollapsed && panelMode === 'sidebar' ? 'assistant-main--sidebar-collapsed' : ''}`}>
        <Header 
          title={activeThreadId ? threads.get(activeThreadId)?.thread.title : undefined}
          threadId={activeThreadId}
          onRename={handleThreadRename}
          activeTool={activeTool}
          onToolSelect={setActiveTool}
        />
        <ChatArea
          userName={userName}
          messages={messages}
          onSendMessage={handleSendMessage}
          activeTool={activeTool}
          onToolSelect={setActiveTool}
        />
      </div>
      {panelMode === 'bottom' && (
        <BottomPanel
          threads={getThreadsList()}
          activeThreadId={activeThreadId}
          onThreadSelect={handleThreadSelect}
          onNewThread={handleNewThread}
        />
      )}
      <PanelToggle
        panelMode={panelMode}
        onPanelModeChange={setPanelMode}
        position={panelTogglePosition}
        onPositionChange={(pos) => {
          setPanelTogglePosition(pos);
          localStorage.setItem('panelTogglePosition', JSON.stringify(pos));
        }}
      />
    </div>
  );
};

