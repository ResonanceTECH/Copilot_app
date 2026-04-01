import React, { useEffect, useState, useCallback } from 'react';
import { Icon } from '../../ui/Icon';
import { ICONS } from '../../../utils/icons';
import { chatAPI, spacesAPI } from '../../../utils/api';
import type { SpaceAttachmentItem } from '../../../types';
import { useLanguage } from '../../../contexts/LanguageContext';
import { getTranslation } from '../../../utils/i18n';
import './ChatFilesModal.css';

export interface ChatFilesModalProps {
  open: boolean;
  onClose: () => void;
  chatId: number;
  chatTitle?: string;
  /** Для переименования через API пространства; если null — кнопка переименования скрыта */
  spaceIdForRename?: number | null;
}

const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes)) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  const precision = i === 0 ? 0 : i === 1 ? 0 : 1;
  return `${v.toFixed(precision)} ${units[i]}`;
};

const isImageFile = (f: SpaceAttachmentItem): boolean => {
  if (f.mime_type && f.mime_type.startsWith('image/')) return true;
  if (f.file_type === 'image') return true;
  const name = (f.filename || '').toLowerCase();
  return ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'].some((ext) => name.endsWith(ext));
};

export const ChatFilesModal: React.FC<ChatFilesModalProps> = ({
  open,
  onClose,
  chatId,
  chatTitle,
  spaceIdForRename,
}) => {
  const { language } = useLanguage();
  const [files, setFiles] = useState<SpaceAttachmentItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'images' | 'documents'>('all');
  const [origin, setOrigin] = useState<'all' | 'assistant' | 'user'>('all');
  const [query, setQuery] = useState('');
  const [offset, setOffset] = useState(0);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [savingName, setSavingName] = useState(false);

  const limit = 50;

  const load = useCallback(async () => {
    if (!open || !chatId) return;
    setLoading(true);
    try {
      const fileType =
        filter === 'all' ? undefined : filter === 'images' ? 'image' : 'document';
      const resp = await chatAPI.getChatFiles(chatId, {
        limit,
        offset,
        q: query.trim() || undefined,
        file_type: fileType,
        origin,
      });
      setFiles(resp.files);
      setTotal(resp.total);
    } catch (e) {
      console.error(e);
      setFiles([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [open, chatId, filter, origin, query, offset]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (open) {
      setOffset(0);
      setEditingId(null);
      setEditName('');
    }
  }, [open, chatId]);

  if (!open) return null;

  const sid = spaceIdForRename ?? null;

  const applyRename = async (fileId: number) => {
    const name = editName.trim();
    if (!name || sid == null) return;
    setSavingName(true);
    try {
      await spacesAPI.renameSpaceFile(sid, fileId, name);
      setEditingId(null);
      setEditName('');
      await load();
    } catch (e: any) {
      alert(e?.message || 'Ошибка переименования');
    } finally {
      setSavingName(false);
    }
  };

  return (
    <div className="chat-files-modal-overlay" onClick={onClose} role="presentation">
      <div
        className="chat-files-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="chat-files-modal-title"
      >
        <div className="chat-files-modal-header">
          <h2 id="chat-files-modal-title">
            {getTranslation('threadFiles', language)}
            {chatTitle ? ` — ${chatTitle}` : ''}
          </h2>
          <button type="button" className="chat-files-modal-close" onClick={onClose} aria-label="Close">
            <Icon src={ICONS.dismiss} size="sm" />
          </button>
        </div>

        <div className="chat-files-modal-toolbar">
          <div className="chat-files-modal-filters">
            <button type="button" className={filter === 'all' ? 'active' : ''} onClick={() => { setFilter('all'); setOffset(0); }}>
              Все
            </button>
            <button type="button" className={filter === 'images' ? 'active' : ''} onClick={() => { setFilter('images'); setOffset(0); }}>
              Картинки
            </button>
            <button type="button" className={filter === 'documents' ? 'active' : ''} onClick={() => { setFilter('documents'); setOffset(0); }}>
              Документы
            </button>
          </div>
          <div className="chat-files-modal-filters">
            <button type="button" className={origin === 'all' ? 'active' : ''} onClick={() => { setOrigin('all'); setOffset(0); }}>
              Все
            </button>
            <button type="button" className={origin === 'user' ? 'active' : ''} onClick={() => { setOrigin('user'); setOffset(0); }}>
              Пользователь
            </button>
            <button type="button" className={origin === 'assistant' ? 'active' : ''} onClick={() => { setOrigin('assistant'); setOffset(0); }}>
              ИИ
            </button>
          </div>
          <div className="chat-files-modal-search">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск по имени…"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setOffset(0);
                  void load();
                }
              }}
            />
            <button type="button" onClick={() => { setOffset(0); void load(); }}>
              Найти
            </button>
          </div>
        </div>

        <div className="chat-files-modal-body">
          {loading ? (
            <div className="chat-files-modal-empty">{getTranslation('loading', language)}</div>
          ) : files.length === 0 ? (
            <div className="chat-files-modal-empty">В этом чате пока нет файлов</div>
          ) : (
            <ul className="chat-files-modal-list">
              {files.map((f) => {
                const url = `/${f.file_path}`;
                const img = isImageFile(f);
                return (
                  <li key={f.id} className="chat-files-modal-item">
                    <div className="chat-files-modal-preview">
                      {img ? (
                        <a href={url} target="_blank" rel="noreferrer">
                          <img src={url} alt="" />
                        </a>
                      ) : (
                        <Icon src={ICONS.paperclip} size="md" />
                      )}
                    </div>
                    <div className="chat-files-modal-meta">
                      {editingId === f.id ? (
                        <input
                          className="chat-files-modal-rename-input"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void applyRename(f.id);
                            if (e.key === 'Escape') { setEditingId(null); setEditName(''); }
                          }}
                          disabled={savingName}
                          autoFocus
                        />
                      ) : (
                        <a href={url} target="_blank" rel="noreferrer" className="chat-files-modal-link">
                          {f.filename}
                        </a>
                      )}
                      <div className="chat-files-modal-sub">
                        {formatBytes(f.file_size)} · {new Date(f.created_at).toLocaleString('ru-RU')}
                      </div>
                    </div>
                    {sid != null && (
                      <div className="chat-files-modal-actions">
                        {editingId === f.id ? (
                          <>
                            <button type="button" onClick={() => void applyRename(f.id)} disabled={savingName}>
                              <Icon src={ICONS.send} size="sm" />
                            </button>
                            <button type="button" onClick={() => { setEditingId(null); setEditName(''); }} disabled={savingName}>
                              <Icon src={ICONS.dismiss} size="sm" />
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            title={getTranslation('rename', language)}
                            onClick={() => { setEditingId(f.id); setEditName(f.filename); }}
                          >
                            <Icon src={ICONS.edit} size="sm" />
                          </button>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {!loading && total > limit && (
          <div className="chat-files-modal-footer">
            <span>Всего: {total}</span>
            <div>
              <button type="button" disabled={offset === 0} onClick={() => setOffset((o) => Math.max(0, o - limit))}>
                Назад
              </button>
              <button
                type="button"
                disabled={offset + limit >= total}
                onClick={() => setOffset((o) => o + limit)}
              >
                Дальше
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
