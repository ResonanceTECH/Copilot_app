import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { spacesAPI } from '../../utils/api';
import type { Space, SpaceChat, SpaceFile } from '../../types';
import { Header } from '../../components/common/Header';
import './SpacesPage.css';

export const SpacesPage: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [selectedSpace, setSelectedSpace] = useState<Space | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'timeline' | 'files'>('overview');
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState('');
  const [newSpaceDescription, setNewSpaceDescription] = useState('');

  // Загрузка пространств
  useEffect(() => {
    if (isAuthenticated) {
      loadSpaces();
    }
  }, [isAuthenticated]);

  const loadSpaces = async () => {
    setIsLoading(true);
    try {
      const response = await spacesAPI.getSpaces();
      setSpaces(response.spaces);
      if (response.spaces.length > 0 && !selectedSpace) {
        setSelectedSpace(response.spaces[0]);
      }
    } catch (error) {
      console.error('Ошибка загрузки пространств:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Создание нового пространства
  const handleCreateSpace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSpaceName.trim()) return;

    try {
      const newSpace = await spacesAPI.createSpace({
        name: newSpaceName.trim(),
        description: newSpaceDescription.trim() || undefined,
      });
      setSpaces([...spaces, newSpace]);
      setSelectedSpace(newSpace);
      setShowCreateModal(false);
      setNewSpaceName('');
      setNewSpaceDescription('');
    } catch (error: any) {
      console.error('Ошибка создания пространства:', error);
      alert(error.message || 'Ошибка при создании пространства. Попробуйте позже.');
    }
  };

  // Получение чатов для пространства
  const getSpaceChats = (spaceId: number): SpaceChat[] => {
    const saved = localStorage.getItem('space_chats');
    if (!saved) return [];
    const chats: Record<number, SpaceChat[]> = JSON.parse(saved);
    return chats[spaceId] || [];
  };

  // Получение файлов для пространства
  const getSpaceFiles = (spaceId: number): SpaceFile[] => {
    const saved = localStorage.getItem('space_files');
    if (!saved) return [];
    const files: Record<number, SpaceFile[]> = JSON.parse(saved);
    return files[spaceId] || [];
  };

  // Добавление чата в пространство
  const handleAddChat = (chatId: string, spaceId: number) => {
    const savedChats = localStorage.getItem('space_chats');
    const chats: Record<number, SpaceChat[]> = savedChats ? JSON.parse(savedChats) : {};
    
    if (!chats[spaceId]) {
      chats[spaceId] = [];
    }

    // Проверяем, не добавлен ли уже этот чат
    if (chats[spaceId].some(c => c.id === chatId)) {
      return; // Чат уже добавлен
    }

    // Получаем информацию о чате из истории
    const savedThreads = localStorage.getItem('chat_threads');
    if (savedThreads) {
      const threads: Record<string, any> = JSON.parse(savedThreads);
      const thread = threads[chatId];
      
      if (thread) {
        const newChat: SpaceChat = {
          id: chatId,
          title: thread.thread.title,
          preview: thread.messages[0]?.content || '',
          date: new Date().toISOString(),
        };
        
        chats[spaceId].push(newChat);
        localStorage.setItem('space_chats', JSON.stringify(chats));
        
        // Обновляем счетчик
        const updatedSpaces = spaces.map(s => 
          s.id === spaceId 
            ? { ...s, chats_count: s.chats_count + 1 }
            : s
        );
        setSpaces(updatedSpaces);
        if (selectedSpace?.id === spaceId) {
          setSelectedSpace({ ...selectedSpace, chats_count: selectedSpace.chats_count + 1 });
        }
      }
    }
  };

  // Добавление файла в пространство
  const handleAddFile = (file: File) => {
    if (!selectedSpace) return;

    const savedFiles = localStorage.getItem('space_files');
    const files: Record<number, SpaceFile[]> = savedFiles ? JSON.parse(savedFiles) : {};
    
    if (!files[selectedSpace.id]) {
      files[selectedSpace.id] = [];
    }

    const newFile: SpaceFile = {
      id: Date.now().toString(),
      name: file.name,
      type: file.type,
      size: file.size,
      uploaded_at: new Date().toISOString(),
    };

    files[selectedSpace.id].push(newFile);
    localStorage.setItem('space_files', JSON.stringify(files));

    // Обновляем счетчик
    const updatedSpaces = spaces.map(s => 
      s.id === selectedSpace.id 
        ? { ...s, notes_count: s.notes_count + 1 }
        : s
    );
    setSpaces(updatedSpaces);
    setSelectedSpace({ ...selectedSpace, notes_count: selectedSpace.notes_count + 1 });
  };

  if (!isAuthenticated) {
    return <div>Пожалуйста, войдите в систему</div>;
  }

  if (isLoading) {
    return <div className="spaces-loading">Загрузка...</div>;
  }

  if (!selectedSpace && spaces.length === 0) {
    return (
      <div className="spaces-page">
        <div className="spaces-empty">
          <h2>Нет пространств</h2>
          <button 
            className="spaces-create-btn"
            onClick={() => setShowCreateModal(true)}
          >
            Создать пространство
          </button>
        </div>
        
        {showCreateModal && (
          <div className="spaces-modal-overlay" onClick={() => setShowCreateModal(false)}>
            <div className="spaces-modal" onClick={(e) => e.stopPropagation()}>
              <h3>Создать пространство</h3>
              <form onSubmit={handleCreateSpace}>
                <input
                  type="text"
                  placeholder="Название пространства"
                  value={newSpaceName}
                  onChange={(e) => setNewSpaceName(e.target.value)}
                  required
                />
                <textarea
                  placeholder="Описание (необязательно)"
                  value={newSpaceDescription}
                  onChange={(e) => setNewSpaceDescription(e.target.value)}
                />
                <div className="spaces-modal-actions">
                  <button type="button" onClick={() => setShowCreateModal(false)}>Отмена</button>
                  <button type="submit">Создать</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  const spaceChats = selectedSpace ? getSpaceChats(selectedSpace.id) : [];
  const spaceFiles = selectedSpace ? getSpaceFiles(selectedSpace.id) : [];

  return (
    <div className="spaces-page">
      <Header 
        title={selectedSpace?.name}
        activeTool="assistant"
        onToolSelect={() => {}}
      />
      <div className="spaces-layout">
      <div className="spaces-sidebar">
        <div className="spaces-sidebar-header">
          <h2>Пространства</h2>
          <button 
            className="spaces-add-btn"
            onClick={() => setShowCreateModal(true)}
            title="Создать пространство"
          >
            +
          </button>
        </div>
        <div className="spaces-list">
          {spaces.map(space => (
            <div
              key={space.id}
              className={`spaces-item ${selectedSpace?.id === space.id ? 'active' : ''}`}
              onClick={() => setSelectedSpace(space)}
            >
              <div className="spaces-item-name">{space.name}</div>
              <div className="spaces-item-meta">
                {space.chats_count} чатов • {space.notes_count} файлов
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="spaces-content">
        {selectedSpace && (
          <>
            <div className="spaces-header">
              <div className="spaces-header-main">
                <h1>{selectedSpace.name}</h1>
                <div className="spaces-header-badge">high priority</div>
              </div>
              <p className="spaces-description">
                {selectedSpace.description || 'Описание отсутствует'}
              </p>
              <div className="spaces-meta">
                <span>Обновлено: {new Date(selectedSpace.updated_at).toLocaleDateString('ru-RU')}</span>
              </div>
            </div>

            <div className="spaces-tabs">
              <button
                className={activeTab === 'overview' ? 'active' : ''}
                onClick={() => setActiveTab('overview')}
              >
                Overview
              </button>
              <button
                className={activeTab === 'timeline' ? 'active' : ''}
                onClick={() => setActiveTab('timeline')}
              >
                Timeline
              </button>
              <button
                className={activeTab === 'files' ? 'active' : ''}
                onClick={() => setActiveTab('files')}
              >
                Files
              </button>
            </div>

            {activeTab === 'overview' && (
              <div className="spaces-overview">
                <div className="spaces-summary-cards">
                  <div className="spaces-summary-card">
                    <div className="spaces-summary-icon">💬</div>
                    <div className="spaces-summary-label">Important chats</div>
                    <div className="spaces-summary-value">
                      {spaceChats.filter(c => c.is_important).length}
                    </div>
                  </div>
                  <div className="spaces-summary-card">
                    <div className="spaces-summary-icon">📁</div>
                    <div className="spaces-summary-label">Total files shared</div>
                    <div className="spaces-summary-value">{spaceFiles.length}</div>
                  </div>
                  <div className="spaces-summary-card">
                    <div className="spaces-summary-icon">🕐</div>
                    <div className="spaces-summary-label">Last updated</div>
                    <div className="spaces-summary-value">
                      {new Date(selectedSpace.updated_at).toLocaleDateString('ru-RU')}
                    </div>
                  </div>
                </div>

                <div className="spaces-section">
                  <div className="spaces-section-header">
                    <h3>Shared Files ({spaceFiles.length})</h3>
                    <button className="spaces-view-all">View All →</button>
                  </div>
                  <div className="spaces-files-grid">
                    {spaceFiles.slice(0, 5).map(file => (
                      <div key={file.id} className="spaces-file-card">
                        <div className="spaces-file-icon">📄</div>
                        <div className="spaces-file-info">
                          <div className="spaces-file-name">{file.name}</div>
                          <div className="spaces-file-meta">
                            {new Date(file.uploaded_at).toLocaleDateString('ru-RU')} • {(file.size / 1024 / 1024).toFixed(1)} MB
                          </div>
                        </div>
                      </div>
                    ))}
                    {spaceFiles.length === 0 && (
                      <div className="spaces-empty-section">Нет файлов</div>
                    )}
                  </div>
                </div>

                <div className="spaces-section">
                  <div className="spaces-section-header">
                    <h3>Important Chats ({spaceChats.filter(c => c.is_important).length})</h3>
                    <button className="spaces-view-all">View All →</button>
                  </div>
                  <div className="spaces-chats-list">
                    {spaceChats.filter(c => c.is_important).slice(0, 2).map(chat => (
                      <div key={chat.id} className="spaces-chat-item important">
                        <div className="spaces-chat-icon">⭐</div>
                        <div className="spaces-chat-content">
                          <div className="spaces-chat-preview">{chat.preview}</div>
                          <div className="spaces-chat-date">{new Date(chat.date).toLocaleDateString('ru-RU')}</div>
                        </div>
                      </div>
                    ))}
                    {spaceChats.filter(c => c.is_important).length === 0 && (
                      <div className="spaces-empty-section">Нет важных чатов</div>
                    )}
                  </div>
                </div>

                <div className="spaces-section">
                  <div className="spaces-section-header">
                    <h3>Recent Chats ({spaceChats.length})</h3>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        className="spaces-add-chat-btn"
                        onClick={() => {
                          // Получаем все чаты из истории
                          const savedThreads = localStorage.getItem('chat_threads');
                          if (savedThreads) {
                            const threads: Record<string, any> = JSON.parse(savedThreads);
                            const threadIds = Object.keys(threads);
                            // Добавляем все чаты в текущее пространство
                            threadIds.forEach(chatId => {
                              if (selectedSpace) {
                                handleAddChat(chatId, selectedSpace.id);
                              }
                            });
                          }
                        }}
                      >
                        Добавить чаты
                      </button>
                      <button className="spaces-view-all">View All →</button>
                    </div>
                  </div>
                  <div className="spaces-chats-list">
                    {spaceChats.slice(0, 4).map(chat => (
                      <div key={chat.id} className="spaces-chat-item">
                        <div className="spaces-chat-icon">💬</div>
                        <div className="spaces-chat-content">
                          <div className="spaces-chat-preview">{chat.title}</div>
                          <div className="spaces-chat-date">{new Date(chat.date).toLocaleDateString('ru-RU')}</div>
                        </div>
                        <button
                          className="spaces-chat-important-btn"
                          onClick={() => {
                            const savedChats = localStorage.getItem('space_chats');
                            const chats: Record<number, SpaceChat[]> = savedChats ? JSON.parse(savedChats) : {};
                            if (chats[selectedSpace!.id]) {
                              const chatIndex = chats[selectedSpace!.id].findIndex(c => c.id === chat.id);
                              if (chatIndex !== -1) {
                                chats[selectedSpace!.id][chatIndex].is_important = !chats[selectedSpace!.id][chatIndex].is_important;
                                localStorage.setItem('space_chats', JSON.stringify(chats));
                                loadSpaces();
                              }
                            }
                          }}
                        >
                          {chat.is_important ? '⭐' : '☆'}
                        </button>
                      </div>
                    ))}
                    {spaceChats.length === 0 && (
                      <div className="spaces-empty-section">Нет чатов. Нажмите "Добавить чаты" чтобы добавить чаты из истории.</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'files' && (
              <div className="spaces-files-tab">
                <div className="spaces-files-header">
                  <h3>Files</h3>
                  <label className="spaces-upload-btn">
                    <input
                      type="file"
                      multiple
                      onChange={(e) => {
                        if (e.target.files) {
                          Array.from(e.target.files).forEach(file => handleAddFile(file));
                        }
                      }}
                      style={{ display: 'none' }}
                    />
                    Загрузить файлы
                  </label>
                </div>
                <div className="spaces-files-list">
                  {spaceFiles.map(file => (
                    <div key={file.id} className="spaces-file-item">
                      <div className="spaces-file-icon">📄</div>
                      <div className="spaces-file-details">
                        <div className="spaces-file-name">{file.name}</div>
                        <div className="spaces-file-meta">
                          {(file.size / 1024 / 1024).toFixed(1)} MB • {new Date(file.uploaded_at).toLocaleDateString('ru-RU')}
                        </div>
                      </div>
                    </div>
                  ))}
                  {spaceFiles.length === 0 && (
                    <div className="spaces-empty-section">Нет файлов. Загрузите файлы, чтобы начать.</div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
      </div>

      {showCreateModal && (
        <div className="spaces-modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="spaces-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Создать пространство</h3>
            <form onSubmit={handleCreateSpace}>
              <input
                type="text"
                placeholder="Название пространства"
                value={newSpaceName}
                onChange={(e) => setNewSpaceName(e.target.value)}
                required
              />
              <textarea
                placeholder="Описание (необязательно)"
                value={newSpaceDescription}
                onChange={(e) => setNewSpaceDescription(e.target.value)}
              />
              <div className="spaces-modal-actions">
                <button type="button" onClick={() => setShowCreateModal(false)}>Отмена</button>
                <button type="submit">Создать</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

