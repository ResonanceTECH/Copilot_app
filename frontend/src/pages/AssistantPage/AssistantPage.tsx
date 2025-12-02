import React, { useState, useCallback, useEffect } from 'react';
import { Sidebar } from '../../components/common/Sidebar';
import { Header } from '../../components/common/Header';
import { ChatArea } from '../../components/common/ChatArea';
import { SupportPanel } from '../../components/common/SupportPanel';
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
  const [showSupportPanel, setShowSupportPanel] = useState(false);
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
          console.log('[AssistantPage] Загрузка истории чатов...');
          const history = await chatAPI.getHistory();
          console.log('[AssistantPage] Получена история:', history);
          console.log('[AssistantPage] Количество чатов:', history.chats?.length || 0);

          const threadsMap = new Map<string, ThreadData>();

          if (history.chats && Array.isArray(history.chats)) {
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
          }

          console.log('[AssistantPage] Создано threads:', threadsMap.size);
          setThreads(threadsMap);
        } catch (error) {
          console.error('[AssistantPage] Ошибка загрузки истории чатов:', error);
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

  // Загрузить состояние закрепления из localStorage
  const loadPinnedThreads = useCallback((): Set<string> => {
    try {
      const saved = localStorage.getItem('pinnedThreads');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  }, []);

  // Сохранить состояние закрепления в localStorage
  const savePinnedThreads = useCallback((pinnedSet: Set<string>) => {
    try {
      localStorage.setItem('pinnedThreads', JSON.stringify(Array.from(pinnedSet)));
    } catch (error) {
      console.error('Ошибка сохранения закрепленных чатов:', error);
    }
  }, []);

  // Получить список чатов для отображения
  const getThreadsList = useCallback((): ChatThread[] => {
    const pinnedThreads = loadPinnedThreads();
    const threadsList = Array.from(threads.values())
      .map((data) => ({
        ...data.thread,
        is_pinned: pinnedThreads.has(data.thread.id),
      }))
      .sort((a, b) => {
        // Сначала закрепленные, потом обычные
        if (a.is_pinned && !b.is_pinned) return -1;
        if (!a.is_pinned && b.is_pinned) return 1;
        // Внутри каждой группы сортируем по времени
        return b.timestamp.getTime() - a.timestamp.getTime();
      });
    console.log('[AssistantPage] getThreadsList вызван, threads.size:', threads.size, 'threadsList.length:', threadsList.length);
    return threadsList;
  }, [threads, loadPinnedThreads]);

  // Создать новый чат
  const handleNewThread = useCallback(async () => {
    try {
      // Создаем чат на сервере
      const chatData = await chatAPI.createChat(getTranslation('newChat', language));

      const newThreadId = `chat-${chatData.id}`;
      const newThread: ChatThread = {
        id: newThreadId,
        title: chatData.title || getTranslation('newChat', language),
        timestamp: new Date(chatData.created_at),
      };

      const newThreadData: ThreadData = {
        thread: newThread,
        messages: [],
        chatId: chatData.id,
      };

      setThreads((prev) => {
        const updated = new Map(prev);
        updated.set(newThreadId, newThreadData);
        return updated;
      });

      setActiveThreadId(newThreadId);
      setMessages([]);
    } catch (error) {
      console.error('Ошибка создания чата:', error);
      // В случае ошибки создаем локально
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
    }
  }, [language]);

  // Выбрать чат
  const handleThreadSelect = useCallback(async (threadId: string) => {
    setShowSupportPanel(false);
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
  const handleThreadDelete = useCallback(async (threadId: string) => {
    const threadData = threads.get(threadId);
    const chatId = threadData?.chatId;

    if (!chatId) {
      // Если чат еще не создан на сервере, просто удаляем локально
      setThreads((prev) => {
        const updated = new Map(prev);
        updated.delete(threadId);
        return updated;
      });

      if (activeThreadId === threadId) {
        setActiveThreadId(null);
        setMessages([]);
      }
      return;
    }

    try {
      // Удаляем чат на сервере
      await chatAPI.deleteChat(chatId);

      // Удаляем локально
      setThreads((prev) => {
        const updated = new Map(prev);
        updated.delete(threadId);
        return updated;
      });

      if (activeThreadId === threadId) {
        setActiveThreadId(null);
        setMessages([]);
      }
    } catch (error) {
      console.error('Ошибка удаления чата:', error);
      // Можно показать уведомление об ошибке
    }
  }, [activeThreadId, threads]);

  // Переименовать чат
  const handleThreadRename = useCallback(async (threadId: string, newTitle: string) => {
    const finalTitle = newTitle.trim() || getTranslation('newChat', language);

    // Получаем текущие данные чата
    const currentThreadData = threads.get(threadId);
    if (!currentThreadData) {
      return;
    }

    const oldTitle = currentThreadData.thread.title;
    const chatId = currentThreadData.chatId;

    // Обновляем локально сразу для лучшего UX
    setThreads((prev) => {
      const updated = new Map(prev);
      const data = updated.get(threadId);
      if (data) {
        updated.set(threadId, {
          ...data,
          thread: {
            ...data.thread,
            title: finalTitle,
          },
        });
      }
      return updated;
    });

    if (!chatId) {
      // Если чат еще не создан на сервере, просто обновляем локально
      return;
    }

    try {
      // Обновляем на сервере
      await chatAPI.updateChat(chatId, { title: finalTitle });
    } catch (error) {
      console.error('Ошибка переименования чата:', error);
      // Откатываем изменение при ошибке
      setThreads((prev) => {
        const updated = new Map(prev);
        const data = updated.get(threadId);
        if (data) {
          updated.set(threadId, {
            ...data,
            thread: {
              ...data.thread,
              title: oldTitle, // Возвращаем старое название
            },
          });
        }
        return updated;
      });
    }
  }, [language, threads]);

  // Закрепить/открепить чат
  const handleThreadPin = useCallback((threadId: string) => {
    const pinnedThreads = loadPinnedThreads();
    if (pinnedThreads.has(threadId)) {
      pinnedThreads.delete(threadId);
    } else {
      pinnedThreads.add(threadId);
    }
    savePinnedThreads(pinnedThreads);
    // Принудительно обновляем состояние для перерисовки
    setThreads((prev) => {
      const updated = new Map(prev);
      return updated;
    });
  }, [loadPinnedThreads, savePinnedThreads]);

  // Отправить сообщение в конкретный чат
  const handleSendMessageToThread = useCallback(async (
    threadId: string,
    content: string,
    isNewThread: boolean
  ) => {
    const threadData = threads.get(threadId);
    const chatId = threadData?.chatId;

    // Проверяем, есть ли уже сообщения от ассистента (чтобы не показывать "Поиск..." для первого сообщения)
    const hasAssistantMessages = threadData?.messages.some(msg => msg.role === 'assistant') ?? false;

    // Добавляем сообщение пользователя в UI сразу
    const userMessage: ChatMessage = {
      id: `temp-user-${Date.now()}`,
      content,
      role: 'user',
      timestamp: new Date(),
    };

    // Добавляем сообщение "Поиск и формирование ответа" (кроме первого сообщения)
    const loadingMessage: ChatMessage | null = hasAssistantMessages ? {
      id: `loading-${Date.now()}`,
      content: 'Поиск и формирование ответа',
      role: 'assistant',
      timestamp: new Date(),
      isLoading: true,
    } : null;

    setThreads((prev) => {
      const updated = new Map(prev);
      const data = updated.get(threadId);

      if (data) {
        const updatedMessages = loadingMessage
          ? [...data.messages, userMessage, loadingMessage]
          : [...data.messages, userMessage];
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

    setMessages((prev) => {
      return loadingMessage ? [...prev, userMessage, loadingMessage] : [...prev, userMessage];
    });

    // Отправляем сообщение на сервер
    try {
      const response = await chatAPI.sendMessage({
        message: content,
        chat_id: chatId,
      });

      if (response.success && response.response) {
        // Обновляем ID чата если это был новый чат (fallback для старых чатов без chatId)
        const finalThreadId = (isNewThread && !chatId && response.chat_id)
          ? (() => {
            const newThreadId = `chat-${response.chat_id}`;
            setThreads((prev) => {
              const updated = new Map(prev);
              const data = updated.get(threadId);
              if (data) {
                updated.delete(threadId);
                updated.set(newThreadId, {
                  ...data,
                  chatId: response.chat_id,
                });
              }
              return updated;
            });
            if (activeThreadId === threadId) {
              setActiveThreadId(newThreadId);
            }
            return newThreadId;
          })()
          : threadId;

        // Добавляем ответ ассистента
        const assistantMessage: ChatMessage = {
          id: `temp-assistant-${Date.now()}`,
          content: response.response.raw_text,
          role: 'assistant',
          timestamp: new Date(response.response.timestamp),
        };

        setThreads((prev) => {
          const updated = new Map(prev);
          const data = updated.get(finalThreadId);
          if (data) {
            // Удаляем loading сообщение и добавляем реальный ответ
            const messagesWithoutLoading = data.messages.filter(
              msg => !msg.isLoading
            );
            // Сохраняем временное сообщение пользователя, добавляем ответ ассистента
            updated.set(finalThreadId, {
              ...data,
              messages: [...messagesWithoutLoading, assistantMessage],
            });
          }
          return updated;
        });

        setMessages((prev) => {
          // Удаляем loading сообщение, сохраняем пользовательское, добавляем ответ
          const withoutLoading = prev.filter(msg => !msg.isLoading);
          return [...withoutLoading, assistantMessage];
        });

        // Перезагружаем сообщения с сервера для получения реальных ID
        // Небольшая задержка, чтобы сервер успел сохранить оба сообщения
        if (response.chat_id) {
          setTimeout(async () => {
            try {
              const messagesData = await chatAPI.getMessages(response.chat_id);
              const chatMessages: ChatMessage[] = messagesData.messages.map((msg: MessageItem) => ({
                id: msg.id.toString(),
                content: msg.content,
                role: msg.role as 'user' | 'assistant',
                timestamp: new Date(msg.created_at),
              }));

              setThreads((prev) => {
                const updated = new Map(prev);
                const data = updated.get(finalThreadId);
                if (data) {
                  updated.set(finalThreadId, {
                    ...data,
                    messages: chatMessages,
                  });
                }
                return updated;
              });

              // Обновляем только если это все еще активный чат
              if (activeThreadId === finalThreadId || activeThreadId === threadId) {
                setMessages(chatMessages);
              }
            } catch (reloadError) {
              console.error('Ошибка перезагрузки сообщений:', reloadError);
              // Продолжаем с временными сообщениями
            }
          }, 100);
        }
      } else {
        throw new Error(response.error || 'Ошибка отправки сообщения');
      }
    } catch (error: any) {
      console.error('Ошибка отправки сообщения:', error);

      // Удаляем временное сообщение пользователя и loading при ошибке
      setThreads((prev) => {
        const updated = new Map(prev);
        const data = updated.get(threadId);
        if (data) {
          updated.set(threadId, {
            ...data,
            messages: data.messages.filter(
              msg => !msg.id.startsWith('temp-') && !msg.isLoading
            ),
          });
        }
        return updated;
      });

      setMessages((prev) => prev.filter(
        msg => !msg.id.startsWith('temp-') && !msg.isLoading
      ));

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
  const handleSendMessage = useCallback(async (content: string) => {
    if (!activeThreadId) {
      // Если нет активного чата, создаем новый на сервере
      try {
        const chatData = await chatAPI.createChat(getTranslation('newChat', language));
        const newThreadId = `chat-${chatData.id}`;
        const newThread: ChatThread = {
          id: newThreadId,
          title: chatData.title || getTranslation('newChat', language),
          timestamp: new Date(chatData.created_at),
        };

        const newThreadData: ThreadData = {
          thread: newThread,
          messages: [],
          chatId: chatData.id,
        };

        setThreads((prev) => {
          const updated = new Map(prev);
          updated.set(newThreadId, newThreadData);
          return updated;
        });

        setActiveThreadId(newThreadId);
        setMessages([]);

        // Отправляем сообщение в новый чат
        await handleSendMessageToThread(newThreadId, content, true);
        return;
      } catch (error) {
        console.error('Ошибка создания чата при отправке сообщения:', error);
        // Fallback: создаем локально
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

        await handleSendMessageToThread(newThreadId, content, true);
        return;
      }
    }

    await handleSendMessageToThread(activeThreadId, content, false);
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
          onThreadPin={handleThreadPin}
          onSettingsClick={() => setShowSupportPanel(true)}
        />
      )}
      <div className={`assistant-main ${panelMode === 'bottom' ? 'assistant-main--full-width' : ''} ${isSidebarCollapsed && panelMode === 'sidebar' ? 'assistant-main--sidebar-collapsed' : ''}`}>
        <Header
          title={showSupportPanel ? 'Поддержка' : (activeThreadId ? threads.get(activeThreadId)?.thread.title : undefined)}
          threadId={activeThreadId}
          onRename={handleThreadRename}
          activeTool={activeTool}
          onToolSelect={setActiveTool}
        />
        {showSupportPanel ? (
          <SupportPanel />
        ) : (
          <ChatArea
            userName={userName}
            messages={messages}
            onSendMessage={handleSendMessage}
            activeTool={activeTool}
            onToolSelect={setActiveTool}
          />
        )}
      </div>
      {panelMode === 'bottom' && (
        <BottomPanel
          threads={getThreadsList()}
          activeThreadId={activeThreadId}
          onThreadSelect={handleThreadSelect}
          onThreadDelete={handleThreadDelete}
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

