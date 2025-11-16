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
import './AssistantPage.css';

interface ThreadData {
  thread: ChatThread;
  messages: ChatMessage[];
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

  // Загрузка истории чатов из localStorage при входе
  useEffect(() => {
    if (isAuthenticated) {
      const savedThreads = localStorage.getItem('chat_threads');
      if (savedThreads) {
        try {
          const parsed = JSON.parse(savedThreads);
          const threadsMap = new Map<string, ThreadData>();
          
          // Преобразуем сохраненные данные обратно в Map
          Object.entries(parsed).forEach(([id, data]: [string, any]) => {
            threadsMap.set(id, {
              thread: {
                ...data.thread,
                timestamp: new Date(data.thread.timestamp),
              },
              messages: data.messages.map((msg: any) => ({
                ...msg,
                timestamp: new Date(msg.timestamp),
              })),
            });
          });
          
          setThreads(threadsMap);
        } catch (error) {
          console.error('Ошибка загрузки истории чатов:', error);
        }
      }
    } else {
      // Если пользователь не авторизован, очищаем историю
      setThreads(new Map());
      setActiveThreadId(null);
      setMessages([]);
    }
  }, [isAuthenticated]);

  // Сохранение истории чатов в localStorage при изменении
  useEffect(() => {
    if (isAuthenticated && threads.size > 0) {
      const threadsObj: Record<string, any> = {};
      threads.forEach((data, id) => {
        threadsObj[id] = {
          thread: {
            ...data.thread,
            timestamp: data.thread.timestamp.toISOString(),
          },
          messages: data.messages.map(msg => ({
            ...msg,
            timestamp: msg.timestamp.toISOString(),
          })),
        };
      });
      localStorage.setItem('chat_threads', JSON.stringify(threadsObj));
    }
  }, [threads, isAuthenticated]);

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
  const handleThreadSelect = useCallback((threadId: string) => {
    setActiveThreadId(threadId);
    const threadData = threads.get(threadId);
    if (threadData) {
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
  const handleSendMessageToThread = useCallback((
    threadId: string, 
    content: string, 
    isNewThread: boolean
  ) => {
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      content,
      role: 'user',
      timestamp: new Date(),
    };

    setThreads((prev) => {
      const updated = new Map(prev);
      const threadData = updated.get(threadId);
      
      if (threadData) {
        const updatedMessages = [...threadData.messages, newMessage];
        
        // Если это первое сообщение в новом чате, обновляем название
        if (isNewThread && updatedMessages.length === 1) {
          const title = content.length > 30 
            ? `${content.substring(0, 30)}...` 
            : content;
          updated.set(threadId, {
            ...threadData,
            thread: {
              ...threadData.thread,
              title,
              lastMessage: content,
            },
            messages: updatedMessages,
          });
        } else {
          // Обновляем lastMessage
          updated.set(threadId, {
            ...threadData,
            thread: {
              ...threadData.thread,
              lastMessage: content,
            },
            messages: updatedMessages,
          });
        }
        
        return updated;
      }
      
      return updated;
    });

    setMessages((prev) => [...prev, newMessage]);

    // Simulate assistant response
    setTimeout(() => {
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        content: 'This is a simulated response from the assistant.',
        role: 'assistant',
        timestamp: new Date(),
      };

      setThreads((prev) => {
        const updated = new Map(prev);
        const threadData = updated.get(threadId);
        if (threadData) {
          updated.set(threadId, {
            ...threadData,
            messages: [...threadData.messages, assistantMessage],
          });
        }
        return updated;
      });

      setMessages((prev) => [...prev, assistantMessage]);
    }, 1000);
  }, []);

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
          showActions={panelMode === 'sidebar'}
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

