import React from 'react';
import { Icon } from '../../ui/Icon';
import { ICONS } from '../../../utils/icons';
import { ChatThread } from '../../../types';
import { useLanguage } from '../../../contexts/LanguageContext';
import { getTranslation } from '../../../utils/i18n';
import './BottomPanel.css';

interface BottomPanelProps {
  threads?: ChatThread[];
  activeThreadId?: string | null;
  onThreadSelect?: (threadId: string) => void;
  onNewThread?: () => void;
}

export const BottomPanel: React.FC<BottomPanelProps> = ({
  threads = [],
  activeThreadId,
  onThreadSelect,
  onNewThread,
}) => {
  const { language } = useLanguage();
  
  return (
    <div className="bottom-panel">
      <div className="bottom-panel-tools">
        <button
          className="bottom-panel-tool bottom-panel-tool--new"
          onClick={onNewThread}
          title={getTranslation('createNewChat', language)}
        >
          <Icon src={ICONS.plus} size="md" />
        </button>
        {threads.map((thread) => (
          <button
            key={thread.id}
            className={`bottom-panel-tool ${activeThreadId === thread.id ? 'bottom-panel-tool--active' : ''}`}
            onClick={() => onThreadSelect?.(thread.id)}
            title={thread.title}
          >
            <Icon src={ICONS.rocket} size="md" />
          </button>
        ))}
      </div>
    </div>
  );
};

