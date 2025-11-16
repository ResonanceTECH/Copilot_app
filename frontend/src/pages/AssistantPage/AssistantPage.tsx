import React, { useState, useCallback } from 'react';
import { Sidebar } from '../../components/common/Sidebar';
import { Header } from '../../components/common/Header';
import { ChatArea } from '../../components/common/ChatArea';
import { ChatMessage, ChatThread } from '../../types';
import './AssistantPage.css';

interface ThreadData {
  thread: ChatThread;
  messages: ChatMessage[];
}

export const AssistantPage: React.FC = () => {
  const [userName] = useState('');
  const [threads, setThreads] = useState<Map<string, ThreadData>>(new Map());
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

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
      title: 'Новый чат',
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
  }, []);

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
            title: newTitle.trim() || 'New Chat',
          },
        });
      }
      return updated;
    });
  }, []);

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
        title: 'Новый чат',
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
  }, [activeThreadId, handleSendMessageToThread]);

  return (
    <div className="assistant-page">
      <Sidebar
        threads={getThreadsList()}
        onNewThread={handleNewThread}
        onThreadSelect={handleThreadSelect}
        onThreadDelete={handleThreadDelete}
        onThreadRename={handleThreadRename}
      />
      <div className="assistant-main">
        <Header title={activeThreadId ? threads.get(activeThreadId)?.thread.title || "Тред" : "Тред"} />
        <ChatArea
          userName={userName}
          messages={messages}
          onSendMessage={handleSendMessage}
        />
      </div>
    </div>
  );
};

