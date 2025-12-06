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
import { FeedbackModal } from './FeedbackModal';
import './ChatArea.css';

// Компонент анимации печатания
const TypingAnimation: React.FC<{ text: string }> = ({ text }) => {
  const [dots, setDots] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => {
        if (prev === '') return '.';
        if (prev === '.') return '..';
        if (prev === '..') return '...';
        return '';
      });
    }, 500);

    return () => clearInterval(interval);
  }, []);

  return (
    <span>
      {text}{dots}
    </span>
  );
};

interface ChatAreaProps {
  userName?: string;
  messages?: ChatMessage[];
  activeTool?: string;
  onToolSelect?: (tool: string) => void;
  onSendMessage?: (message: string) => void;
  chatId?: number;
  spaceId?: number;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  userName = '',
  messages = [],
  activeTool: externalActiveTool,
  onToolSelect,
  onSendMessage,
  chatId,
  spaceId,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [internalActiveTool, setInternalActiveTool] = useState<string>('assistant');
  const [isNotesPanelVisible, setIsNotesPanelVisible] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [showReportMenu, setShowReportMenu] = useState<string | null>(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const reportMenuRef = useRef<HTMLDivElement>(null);
  const { language } = useLanguage();

  // activeTool и handleToolSelect могут использоваться в будущем
  void (externalActiveTool !== undefined ? externalActiveTool : internalActiveTool);
  void ((tool: string) => {
    if (onToolSelect) {
      onToolSelect(tool);
    } else {
      setInternalActiveTool(tool);
    }
  });

  const handleSend = () => {
    const textContent = inputValue.trim();
    
    // Если есть текст или прикрепленные файлы, отправляем сообщение
    if ((textContent || attachedFiles.length > 0) && onSendMessage) {
      // Отслеживаем активность пользователя
      trackActivity();
      
      // Формируем сообщение с текстом и файлами
      let messageContent = textContent;
      
      // Убираем любые упоминания о прикреплении файлов из текста
      // Фильтруем строки, содержащие "прикреплен" или эмодзи с названием файла
      const lines = messageContent.split('\n');
      const filteredLines = lines.filter(line => {
        const trimmedLine = line.trim();
        // Убираем строки, содержащие "прикреплен" или паттерны типа "📎 файл прикреплен"
        return !trimmedLine.toLowerCase().includes('прикреплен') && 
               !trimmedLine.match(/^[📎🖼️📄📝]\s+.*прикреплен/i);
      });
      messageContent = filteredLines.join('\n').trim();
      
      // Добавляем HTML для изображений
      const imageFiles = attachedFiles.filter(f => f.file_type === 'image');
      const otherFiles = attachedFiles.filter(f => f.file_type !== 'image');
      
      if (imageFiles.length > 0) {
        const imagesHtml = imageFiles.map(file => {
          return `
            <div class="message-file-card" style="margin-top: ${messageContent ? '12px' : '0'};">
              <div class="message-file-icon">IMG</div>
              <div class="message-file-name">${file.filename}</div>
            </div>
            <div class="uploaded-file-image" style="margin-top: 8px;">
              <img src="/${file.file_url}" alt="${file.filename}" style="max-width: 100%; max-height: 500px; border-radius: 8px; object-fit: contain;" />
            </div>
            ${file.analysis_result ? `
              <details class="uploaded-file-analysis" style="margin-top: 12px;">
                <summary style="cursor: pointer; color: var(--color-primary); font-weight: 500; user-select: none;">🔍 Показать анализ изображения</summary>
                <div style="margin-top: 8px; padding: 12px; background: var(--color-hover); border-radius: 8px; font-size: 14px; line-height: 1.6;">
                  ${file.analysis_result}
                </div>
              </details>
            ` : ''}
          `;
        }).join('');
        
        // Если есть текст, добавляем его перед изображениями
        if (messageContent) {
          messageContent = `${messageContent}${imagesHtml}`;
        } else {
          messageContent = imagesHtml;
        }
      }
      
      // Добавляем HTML для других файлов (PDF/DOC) - компактные карточки
      if (otherFiles.length > 0) {
        const filesHtml = otherFiles.map(file => {
          const fileIcon = file.file_type === 'pdf' ? 'PDF' : file.file_type === 'document' ? 'DOC' : 'FILE';
          return `
            <div class="message-file-card" style="margin-top: ${messageContent ? '12px' : '0'};">
              <div class="message-file-icon">${fileIcon}</div>
              <div class="message-file-name">${file.filename}</div>
            </div>
          `;
        }).join('');
        
        // Если есть текст, добавляем его перед файлами
        if (messageContent) {
          messageContent = `${messageContent}${filesHtml}`;
        } else {
          messageContent = filesHtml;
        }
      }
      
      // Логируем для отладки
      console.log('📤 Отправляем сообщение:', {
        originalText: textContent,
        filteredText: messageContent.split('<div')[0] || messageContent,
        hasFiles: attachedFiles.length > 0,
        finalLength: messageContent.length
      });
      
      // Отправляем сообщение
      onSendMessage(messageContent);
      
      // Очищаем поле ввода и прикрепленные файлы
      setInputValue('');
      setAttachedFiles([]);
      
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

  // Копирование сообщения в буфер обмена
  const handleCopyMessage = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      // Можно добавить уведомление об успешном копировании
      console.log('✅ Сообщение скопировано в буфер обмена');
    } catch (error) {
      console.error('❌ Ошибка копирования:', error);
      // Fallback для старых браузеров
      const textArea = document.createElement('textarea');
      textArea.value = content;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        console.log('✅ Сообщение скопировано (fallback)');
      } catch (err) {
        console.error('❌ Ошибка копирования (fallback):', err);
      }
      document.body.removeChild(textArea);
    }
  };

  // Обработка реакций (лайки/дизлайки)
  const handleReaction = (messageId: string, reaction: 'like' | 'dislike') => {
    console.log(`👍 Реакция ${reaction} на сообщение ${messageId}`);
    // Здесь можно добавить логику сохранения реакций
    // Например, отправка на бэкенд или сохранение в локальном состоянии
  };

  // Обработка жалобы на сообщение
  const handleReport = (messageId: string) => {
    setShowReportMenu(null);
    setShowFeedbackModal(messageId);
  };

  // Обработка отправки обратной связи
  const handleFeedbackSubmit = async (messageId: string, selectedReasons: string[], feedback: string) => {
    // Конвертируем messageId в число (в backend это integer)
    const messageIdNum = parseInt(messageId, 10);
    if (isNaN(messageIdNum)) {
      throw new Error('Неверный ID сообщения');
    }

    const response = await chatAPI.submitFeedback(messageIdNum, selectedReasons, feedback);

    if (!response.success) {
      throw new Error(response.message || 'Ошибка при отправке обратной связи');
    }

    console.log('✅ Обратная связь успешно отправлена:', response);
  };

  // Закрытие меню при клике вне его
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (reportMenuRef.current && !reportMenuRef.current.contains(event.target as Node)) {
        setShowReportMenu(null);
      }
    };

    if (showReportMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showReportMenu]);

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

  // Состояние для прикрепленных файлов (до отправки)
  const [attachedFiles, setAttachedFiles] = useState<Array<{
    file_url: string;
    filename: string;
    file_type: string;
    analysis_result?: string;
    extracted_text?: string;
  }>>([]);

  // Обработчик загрузки файла
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Проверяем формат файла
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/gif',
      'image/bmp',
      'image/webp'
    ];

    const allowedExtensions = ['.pdf', '.doc', '.docx', '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'];
    const fileExt = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));

    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExt)) {
      alert(`Неподдерживаемый формат файла. Разрешены: ${allowedExtensions.join(', ')}`);
      return;
    }

    // Проверяем размер (50MB)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      alert('Файл слишком большой. Максимальный размер: 50MB');
      return;
    }

    try {
      console.log('📤 Загрузка файла:', file.name, file.size, 'байт');
      
      const result = await chatAPI.uploadFile(file, chatId, spaceId);
      
      if (result.success && result.file_url) {
        console.log('✅ Файл загружен:', result);
        
        // Добавляем файл к списку прикрепленных файлов
        setAttachedFiles(prev => [...prev, {
          file_url: result.file_url!,
          filename: result.filename || file.name,
          file_type: result.file_type || 'unknown',
          analysis_result: result.analysis_result,
          extracted_text: result.extracted_text
        }]);
      } else {
        throw new Error(result.error || 'Ошибка загрузки файла');
      }
    } catch (error: any) {
      console.error('❌ Ошибка загрузки файла:', error);
      alert(error.message || 'Не удалось загрузить файл. Попробуйте еще раз.');
    } finally {
      // Очищаем input для возможности повторной загрузки того же файла
      event.target.value = '';
    }
  };

  // Удаление прикрепленного файла
  const handleRemoveFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Получение иконки для типа файла
  const getFileIcon = (fileType: string) => {
    if (fileType === 'image') {
      return '🖼️';
    } else if (fileType === 'pdf') {
      return '📄';
    } else if (fileType === 'document') {
      return '📝';
    }
    return '📎';
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
              <div className="chat-message-wrapper">
                <div className="chat-message-content">
                  {message.role === 'assistant' && message.isLoading ? (
                    <TypingAnimation text={message.content} />
                  ) : message.role === 'assistant' && !message.isLoading ? (
                  // Проверяем, содержит ли контент HTML теги
                  message.content.includes('<div') || message.content.includes('<img') || message.content.includes('<p') ? (
                    <div dangerouslySetInnerHTML={{ __html: message.content }} />
                  ) : (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {message.content}
                  </ReactMarkdown>
                  )
                ) : message.role === 'user' ? (
                  (() => {
                    // Извлекаем карточки файлов из HTML контента
                    const fileCards: Array<{ icon: string; filename: string }> = [];
                    let cleanedContent = message.content;
                    
                    // Ищем карточки файлов в HTML
                    const fileCardRegex = /<div class="message-file-card"[^>]*>[\s\S]*?<div class="message-file-icon">([^<]+)<\/div>[\s\S]*?<div class="message-file-name">([^<]+)<\/div>[\s\S]*?<\/div>/g;
                    let match;
                    const matches: string[] = [];
                    while ((match = fileCardRegex.exec(message.content)) !== null) {
                      fileCards.push({
                        icon: match[1].trim(),
                        filename: match[2].trim()
                      });
                      matches.push(match[0]);
                    }
                    
                    // Удаляем все карточки файлов из контента
                    matches.forEach(cardHtml => {
                      cleanedContent = cleanedContent.replace(cardHtml, '');
                    });
                    
                    // Очищаем пустые строки и пробелы
                    cleanedContent = cleanedContent.trim();
                    
                    // Проверяем, есть ли изображения или другой HTML контент
                    const hasHtmlContent = cleanedContent.includes('<img') || 
                                          cleanedContent.includes('<div class="uploaded-file') ||
                                          cleanedContent.includes('<div');
                    
                    return (
                      <>
                        {/* Текст сообщения или HTML контент (изображения и т.д.) */}
                        {cleanedContent && 
                         !cleanedContent.toLowerCase().includes('прикреплен') && 
                         !cleanedContent.match(/[📎🖼️📄📝]\s+.*прикреплен/i) && (
                          <div>
                            {hasHtmlContent ? (
                              <div dangerouslySetInnerHTML={{ __html: cleanedContent }} />
                            ) : (
                              cleanedContent
                            )}
                          </div>
                        )}
                      </>
                    );
                  })()
                ) : (
                  // Обычный текст - фильтруем сообщения о прикреплении
                  message.content && 
                  !message.content.toLowerCase().includes('прикреплен') && 
                  !message.content.match(/[📎🖼️📄📝]\s+.*прикреплен/i) 
                    ? message.content 
                    : ''
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
                {message.role === 'assistant' && !message.isLoading && (
                  <div className="chat-message-actions">
                    <button
                      className="chat-message-action-btn"
                      onClick={() => handleCopyMessage(message.content)}
                      title="Копировать"
                    >
                      <Icon src={ICONS.copy} size="sm" />
                    </button>
                    <button
                      className="chat-message-action-btn"
                      onClick={() => handleReaction(message.id, 'like')}
                        title="Вверх"
                    >
                      <Icon src={ICONS.thumbsUp} size="sm" />
                    </button>
                    <button
                      className="chat-message-action-btn"
                      onClick={() => handleReaction(message.id, 'dislike')}
                        title="Вниз"
                    >
                      <Icon src={ICONS.thumbsDown} size="sm" />
                    </button>
                    <div className="chat-message-menu" ref={reportMenuRef}>
                      <button
                        className="chat-message-action-btn"
                        onClick={() => setShowReportMenu(showReportMenu === message.id ? null : message.id)}
                        title="Еще"
                      >
                        <Icon src={ICONS.more} size="sm" />
                      </button>
                      {showReportMenu === message.id && (
                        <div className="chat-message-menu-dropdown">
                          <button
                            className="chat-message-menu-item"
                            onClick={() => handleReport(message.id)}
                          >
                            <Icon src={ICONS.flag} size="sm" />
                            <span>Отчет</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              {/* Карточки файлов рядом с сообщением пользователя */}
              {message.role === 'user' && (() => {
                const fileCards: Array<{ icon: string; filename: string }> = [];
                const fileCardRegex = /<div class="message-file-card"[^>]*>[\s\S]*?<div class="message-file-icon">([^<]+)<\/div>[\s\S]*?<div class="message-file-name">([^<]+)<\/div>[\s\S]*?<\/div>/g;
                let match;
                while ((match = fileCardRegex.exec(message.content)) !== null) {
                  fileCards.push({
                    icon: match[1].trim(),
                    filename: match[2].trim()
                  });
                }
                return fileCards.length > 0 ? (
                  <div className="message-files-container">
                    {fileCards.map((file, idx) => (
                      <div key={idx} className="message-file-card">
                        <div className="message-file-icon">{file.icon}</div>
                        <div className="message-file-name">{file.filename}</div>
                      </div>
                    ))}
                  </div>
                ) : null;
              })()}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      )}

      <div className="chat-input-section">
        <div className="chat-input-wrapper">
          {attachedFiles.length > 0 && (
            <div className="chat-attached-files">
              {attachedFiles.map((file, index) => (
                <div key={`${file.file_url}-${index}`} className="chat-attached-file-card">
                  <div className="chat-attached-file-icon" aria-hidden="true">
                    <span className="chat-attached-file-icon-emoji">{getFileIcon(file.file_type)}</span>
                  </div>
                  <div className="chat-attached-file-info">
                    <div className="chat-attached-file-name" title={file.filename}>
                      {file.filename}
                    </div>
                    <div className="chat-attached-file-type">
                      {file.file_type === 'image' ? 'Изображение' : 
                       file.file_type === 'pdf' ? 'PDF документ' : 
                       file.file_type === 'document' ? 'Документ' : 'Файл'}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="chat-attached-file-remove"
                    onClick={() => handleRemoveFile(index)}
                    title="Удалить файл"
                    aria-label={`Удалить файл ${file.filename}`}
                  >
                    <Icon src={ICONS.close} size="sm" />
                  </button>
                </div>
              ))}
            </div>
          )}
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
              <label className="chat-input-icon-btn" style={{ cursor: 'pointer', position: 'relative' }} title="Прикрепить файл">
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.gif,.bmp,.webp"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
                <Icon src={ICONS.paperclip} size="md" />
                {attachedFiles.length > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '-4px',
                    right: '-4px',
                    background: 'var(--color-primary)',
                    color: 'white',
                    borderRadius: '50%',
                    width: '18px',
                    height: '18px',
                    fontSize: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold'
                  }}>
                    {attachedFiles.length}
                  </span>
                )}
              </label>
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
                disabled={!inputValue.trim() && attachedFiles.length === 0}
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
      {showFeedbackModal && (
        <FeedbackModal
          isOpen={true}
          onClose={() => setShowFeedbackModal(null)}
          onSubmit={(selectedReasons, feedback) => {
            if (showFeedbackModal) {
              handleFeedbackSubmit(showFeedbackModal, selectedReasons, feedback);
            }
          }}
        />
      )}
    </div>
  );
};
