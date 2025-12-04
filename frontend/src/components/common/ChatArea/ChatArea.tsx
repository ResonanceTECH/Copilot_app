import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Icon } from '../../ui/Icon';
import { ICONS } from '../../../utils/icons';
import { ChatMessage } from '../../../types';
import logoIcon from '../../../assets/icons/logo.svg';
import { useLanguage } from '../../../contexts/LanguageContext';
import { getTranslation } from '../../../utils/i18n';
import { NotesPanel } from '../NotesPanel';
import { trackActivity } from '../../../utils/activityTracker';
import { chatAPI } from '../../../utils/api';
import './ChatArea.css';

interface ChatAreaProps {
  userName?: string;
  messages?: ChatMessage[];
  activeTool?: string;
  onToolSelect?: (tool: string) => void;
  onSendMessage?: (message: string) => void;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  userName = '',
  messages = [],
  activeTool: externalActiveTool,
  onToolSelect,
  onSendMessage,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [internalActiveTool, setInternalActiveTool] = useState<string>('assistant');
  const [isNotesPanelVisible, setIsNotesPanelVisible] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const { language } = useLanguage();

  const activeTool = externalActiveTool !== undefined ? externalActiveTool : internalActiveTool;
  const handleToolSelect = (tool: string) => {
    if (onToolSelect) {
      onToolSelect(tool);
    } else {
      setInternalActiveTool(tool);
    }
  };

  const handleSend = () => {
    if (inputValue.trim() && onSendMessage) {
      // Отслеживаем активность пользователя
      trackActivity();
      onSendMessage(inputValue.trim());
      setInputValue('');
      // Фокус на поле ввода после отправки
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Автоматическое изменение размера textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 200)}px`;
    }
  }, [inputValue]);

  // Автофокус на поле ввода при загрузке
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Автопрокрутка сообщений вниз
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Очистка ресурсов при размонтировании
  useEffect(() => {
    return () => {
      console.log('🧹 Очистка ресурсов при размонтировании компонента');
      // Останавливаем запись если компонент размонтируется
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        console.log('🛑 Останавливаем запись при размонтировании');
        try {
          mediaRecorderRef.current.stop();
        } catch (e) {
          console.error('Ошибка при остановке записи:', e);
        }
      }
      // Закрываем поток микрофона
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          track.stop();
          console.log('🔇 Трек остановлен при размонтировании:', track.label);
        });
        streamRef.current = null;
      }
    };
  }, []); // Убираем зависимость от isRecording, чтобы не вызывать очистку при каждом изменении

  // Функция начала записи
  const startRecording = async () => {
    try {
      // Очищаем предыдущие чанки
      audioChunksRef.current = [];
      
      // Запрашиваем доступ к микрофону
      console.log('🎤 Запрос доступа к микрофону...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      streamRef.current = stream;
      
      // Проверяем состояние треков
      const audioTracks = stream.getAudioTracks();
      console.log('🎤 Получен доступ к микрофону:', {
        tracksCount: audioTracks.length,
        trackState: audioTracks[0]?.readyState,
        trackEnabled: audioTracks[0]?.enabled,
        trackLabel: audioTracks[0]?.label
      });
      
      // Отслеживаем состояние трека
      audioTracks[0]?.addEventListener('ended', () => {
        console.warn('⚠️ Трек микрофона завершился автоматически!');
        if (isRecording && mediaRecorderRef.current) {
          console.log('🛑 Останавливаем запись из-за завершения трека');
          stopRecording();
        }
      });

      // Создаем MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') 
        ? 'audio/webm' 
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : 'audio/webm'; // fallback

      const recorder = new MediaRecorder(stream, { 
        mimeType,
        audioBitsPerSecond: 128000 // Качество записи
      });
      mediaRecorderRef.current = recorder;

      // Записываем данные каждые 250мс для более надежной записи
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
          console.log('📝 Получен аудио чанк:', e.data.size, 'байт, всего чанков:', audioChunksRef.current.length);
        } else {
          console.warn('⚠️ Пустой чанк данных');
        }
      };

      recorder.onstop = async () => {
        console.log('🛑 Событие onstop вызвано, состояние записи:', isRecording);
        
        // Создаем Blob из записанных чанков
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        
        console.log('🎤 Запись остановлена:', {
          chunks: audioChunksRef.current.length,
          totalSize: audioBlob.size,
          sizeKB: (audioBlob.size / 1024).toFixed(2),
          mimeType: mimeType,
          chunksSizes: audioChunksRef.current.map(c => c.size)
        });
        
        // Проверяем, что запись не пустая
        if (audioBlob.size === 0) {
          console.error('❌ Аудио запись пустая!');
          alert('Запись пустая. Попробуйте записать еще раз.');
          setIsRecording(false);
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
          }
          return;
        }
        
        // Проверяем минимальный размер (например, 1KB)
        if (audioBlob.size < 1024) {
          console.warn('⚠️ Аудио запись очень короткая:', audioBlob.size, 'байт');
          alert(`Запись слишком короткая (${audioBlob.size} байт). Попробуйте записать дольше.`);
        }
        
        // Обнуляем ссылку на recorder после остановки
        mediaRecorderRef.current = null;
        
        // Останавливаем поток микрофона
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => {
            track.stop();
            console.log('🔇 Трек остановлен:', track.label);
          });
          streamRef.current = null;
        }

        // Отправляем на транскрибацию только если есть данные
        if (audioBlob.size > 0) {
          await sendAudioToBackend(audioBlob);
        } else {
          setIsRecording(false);
        }
      };

      recorder.onerror = (e) => {
        console.error('❌ Ошибка записи:', e);
        setIsRecording(false);
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
        alert('Ошибка записи. Попробуйте еще раз.');
      };

      recorder.onstart = () => {
        console.log('✅ Запись началась успешно, состояние:', recorder.state);
      };

      recorder.onpause = () => {
        console.warn('⏸️ Запись приостановлена');
      };

      recorder.onresume = () => {
        console.log('▶️ Запись возобновлена');
      };

      // Запускаем запись с интервалом 250мс для более надежной записи
      // Если не указать интервал, запись будет идти до остановки
      if (recorder.state === 'inactive') {
        recorder.start(250); // Записываем данные каждые 250мс
        setIsRecording(true);
        console.log('🎤 Начало записи, MIME type:', mimeType, 'состояние:', recorder.state);
      } else {
        console.warn('⚠️ Recorder уже активен, состояние:', recorder.state);
      }
    } catch (error: any) {
      console.error('❌ Ошибка доступа к микрофону:', error);
      alert(`Не удалось получить доступ к микрофону: ${error.message || 'Проверьте разрешения браузера'}`);
      setIsRecording(false);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    }
  };

  // Функция остановки записи
  const stopRecording = () => {
    console.log('🛑 stopRecording вызвана, состояние:', {
      hasRecorder: !!mediaRecorderRef.current,
      isRecording: isRecording,
      recorderState: mediaRecorderRef.current?.state
    });
    
    if (mediaRecorderRef.current) {
      const recorder = mediaRecorderRef.current;
      const state = recorder.state;
      
      console.log('🛑 Состояние recorder перед остановкой:', state);
      
      if (state === 'recording') {
        recorder.stop();
        console.log('✅ Команда stop() отправлена');
      } else if (state === 'paused') {
        recorder.stop();
        console.log('✅ Команда stop() отправлена (была пауза)');
      } else {
        console.warn('⚠️ Recorder не в состоянии recording, текущее состояние:', state);
      }
      
      setIsRecording(false);
      // Не обнуляем mediaRecorderRef здесь, так как onstop еще должен сработать
    } else {
      console.warn('⚠️ mediaRecorderRef.current отсутствует');
      setIsRecording(false);
    }
  };

  // Отправка аудио на бэкенд для транскрибации
  const sendAudioToBackend = async (audioBlob: Blob) => {
    setIsTranscribing(true);
    try {
      console.log('📤 Отправка аудио на транскрибацию:', {
        size: audioBlob.size,
        type: audioBlob.type
      });
      
      const result = await chatAPI.transcribeAudio(audioBlob);
      
      console.log('📥 Результат транскрибации:', result);
      
      if (result.success) {
        if (result.audio_url) {
          console.log('💾 Аудио файл сохранен:', result.audio_url);
        }
        
        if (result.text) {
          console.log('✅ Распознанный текст:', result.text);
          // Добавляем распознанный текст в поле ввода
          setInputValue(prev => {
            const newValue = prev + (prev ? ' ' : '') + result.text!.trim();
            return newValue;
          });
          
          // Фокус на поле ввода
          setTimeout(() => {
            inputRef.current?.focus();
            // Прокручиваем в конец текста
            if (inputRef.current) {
              inputRef.current.setSelectionRange(
                inputRef.current.value.length,
                inputRef.current.value.length
              );
            }
          }, 0);
        } else {
          console.warn('⚠️ Текст не распознан, но аудио файл сохранен');
        }
      } else {
        console.error('❌ Ошибка транскрибации:', result.error);
        throw new Error(result.error || 'Не удалось распознать речь');
      }
    } catch (error: any) {
      console.error('❌ Ошибка транскрибации:', error);
      alert(error.message || 'Не удалось распознать речь. Попробуйте еще раз.');
    } finally {
      setIsTranscribing(false);
    }
  };

  // Обработчик нажатия на кнопку микрофона
  const handleMicrophoneClick = () => {
    console.log('🖱️ Клик по кнопке микрофона, текущее состояние:', {
      isRecording,
      isTranscribing,
      hasRecorder: !!mediaRecorderRef.current,
      recorderState: mediaRecorderRef.current?.state
    });
    
    // Предотвращаем действия во время транскрибации
    if (isTranscribing) {
      console.warn('⚠️ Транскрибация в процессе, игнорируем клик');
      return;
    }
    
    if (isRecording) {
      console.log('🛑 Останавливаем запись по клику');
      stopRecording();
    } else {
      console.log('🎤 Начинаем запись по клику');
      startRecording();
    }
  };


  return (
    <div className="chat-area">
      {messages.length === 0 ? (
        <div className="chat-welcome-container">
          <div className="chat-welcome">
            <div className="chat-welcome-icon">
              <img src={logoIcon} alt="AI-ассистент" className="chat-welcome-logo" />
            </div>
            {userName ? (
              <>
                <h2 className="chat-welcome-title">
                  {getTranslation('greetingWithName', language, { name: userName }).split(',')[0]}
                </h2>
                <p className="chat-welcome-subtitle">
                  {getTranslation('greeting', language)}
                </p>
              </>
            ) : (
              <h2 className="chat-welcome-title">
                {getTranslation('greeting', language)}
              </h2>
            )}
          </div>
        </div>
      ) : (
        <div className="chat-messages">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`chat-message chat-message--${message.role} ${message.isLoading ? 'chat-message--loading' : ''}`}
            >
              <div className="chat-message-content">
                {message.role === 'assistant' && !message.isLoading ? (
                  // Проверяем, содержит ли контент HTML теги
                  message.content.includes('<div') || message.content.includes('<img') || message.content.includes('<p') ? (
                    <div dangerouslySetInnerHTML={{ __html: message.content }} />
                  ) : (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {message.content}
                    </ReactMarkdown>
                  )
                ) : (
                  message.content
                )}
                {!message.isLoading && message.timestamp && (
                  <div className="chat-message-timestamp">
                    {message.timestamp instanceof Date
                      ? message.timestamp.toLocaleTimeString('ru-RU', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })
                      : new Date(message.timestamp).toLocaleTimeString('ru-RU', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })
                    }
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      )}

      <div className="chat-input-section">
        <div className="chat-input-wrapper">
          <div className="chat-input-container">
            <textarea
              ref={inputRef}
              className="chat-input"
              placeholder={getTranslation('startNewThread', language)}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
            />
            <div className="chat-input-actions">
              <button
                className="chat-input-icon-btn"
                type="button"
                onClick={() => setIsNotesPanelVisible(!isNotesPanelVisible)}
                title="Заметки"
              >
                <Icon src={ICONS.note} size="md" />
              </button>
              <button className="chat-input-icon-btn" type="button">
                <Icon src={ICONS.paperclip} size="md" />
              </button>
              <button 
                className={`chat-input-icon-btn ${isRecording ? 'chat-input-icon-btn--recording' : ''} ${isTranscribing ? 'chat-input-icon-btn--transcribing' : ''}`}
                type="button"
                onClick={handleMicrophoneClick}
                disabled={isTranscribing}
                title={isRecording ? 'Остановить запись' : isTranscribing ? 'Распознавание речи...' : 'Записать голосовое сообщение'}
              >
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
      {isNotesPanelVisible && (
        <NotesPanel onClose={() => setIsNotesPanelVisible(false)} />
      )}
    </div>
  );
};
