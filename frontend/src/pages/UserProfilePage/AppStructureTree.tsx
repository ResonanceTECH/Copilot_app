import React, { useCallback, useEffect, useState } from 'react';
import { chatAPI, spacesAPI, type ChatHistoryItem } from '../../utils/api';
import type { Space, SpaceAttachmentItem } from '../../types';

/** API `GET /spaces/:id/files` — `limit` максимум 200 (см. spaces_routes.py). */
const SPACE_FILES_PAGE = 200;

async function fetchAllSpaceFiles(spaceId: number): Promise<SpaceAttachmentItem[]> {
  const all: SpaceAttachmentItem[] = [];
  let reportedTotal: number | null = null;

  while (all.length < 50_000) {
    const resp = await spacesAPI.getSpaceFiles(spaceId, {
      limit: SPACE_FILES_PAGE,
      offset: all.length,
    });
    if (reportedTotal === null && typeof resp.total === 'number' && Number.isFinite(resp.total)) {
      reportedTotal = resp.total;
    }
    const batch = resp.files || [];
    if (!batch.length) break;
    all.push(...batch);
    if (batch.length < SPACE_FILES_PAGE) break;
    if (reportedTotal !== null && all.length >= reportedTotal) break;
  }
  return all;
}

/** В подписи дерева только строки — иначе React покажет «[object Object]». */
function treeLineText(value: unknown, fallback: string): string {
  if (typeof value === 'string') {
    const t = value.trim();
    return t || fallback;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  if (value !== null && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    if (typeof o.name === 'string' && o.name.trim()) return o.name.trim();
    if (typeof o.label === 'string' && o.label.trim()) return o.label.trim();
    if (typeof o.title === 'string' && o.title.trim()) return o.title.trim();
  }
  return fallback;
}

function treePath(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value.trim().replace(/^\/+/, '');
  return undefined;
}

const isImageFile = (f: SpaceAttachmentItem): boolean => {
  if (typeof f.mime_type === 'string' && f.mime_type.startsWith('image/')) return true;
  if (f.file_type === 'image') return true;
  const name = treeLineText(f.filename, '').toLowerCase();
  return ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'].some((ext) => name.endsWith(ext));
};

interface TreeChild {
  label: string;
  href?: string;
  children?: TreeChild[];
}

function buildTreeData(
  userName: unknown,
  spaces: Space[],
  chatsBySpace: Map<number, ChatHistoryItem[]>,
  filesBySpaceChat: Map<string, SpaceAttachmentItem[]>
): TreeChild {
  const rootLabel = treeLineText(userName, 'Пользователь');
  const orderedSpaces = [...spaces].sort((a, b) =>
    treeLineText(a.name, '').localeCompare(treeLineText(b.name, ''), undefined, { sensitivity: 'base' })
  );
  const spaceNodes: TreeChild[] = orderedSpaces.map((space) => {
    const chats = [...(chatsBySpace.get(space.id) || [])].sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
    const chatNodes: TreeChild[] = chats.map((chat) => {
      const key = `${space.id}:${chat.id}`;
      const files = filesBySpaceChat.get(key) || [];
      const nonImg = files.filter((f) => !isImageFile(f));
      const imgs = files.filter((f) => isImageFile(f));
      const fileNodes: TreeChild[] = [
        ...nonImg.map((f) => {
          const path = treePath(f.file_path);
          return {
            label: `Файл: ${treeLineText(f.filename, 'файл')}`,
            href: path ? `/${path}` : undefined,
          };
        }),
        ...imgs.map((f) => {
          const path = treePath(f.file_path);
          return {
            label: `Картинка: ${treeLineText(f.filename, 'изображение')}`,
            href: path ? `/${path}` : undefined,
          };
        }),
      ];
      return {
        label: treeLineText(chat.title, `Чат ${chat.id}`),
        href: `/assistant?chat=${chat.id}`,
        children: fileNodes.length ? fileNodes : undefined,
      };
    });
    return {
      label: treeLineText(space.name, `Пространство ${space.id}`),
      href: `/spaces/${space.id}`,
      children: chatNodes.length ? chatNodes : undefined,
    };
  });

  return { label: rootLabel, children: spaceNodes.length ? spaceNodes : undefined };
}

interface TreeNodeProps {
  node: TreeChild;
  nodeKey: string;
  depth: number;
  /** Для каждого уровня предков: true, если предок был последним среди братьев — вертикаль в этой колонке не продолжается. */
  ancestorIsLast: boolean[];
  isLastSibling: boolean;
  collapsed: Set<string>;
  toggleNode: (id: string) => void;
}

function TreeNode({
  node,
  nodeKey,
  depth,
  ancestorIsLast,
  isLastSibling,
  collapsed,
  toggleNode,
}: TreeNodeProps): React.ReactElement {
  const children = node.children;
  const hasChildren = Boolean(children?.length);
  const expanded = !collapsed.has(nodeKey);
  const lineLabel = treeLineText(node.label, '…');

  const guides = ancestorIsLast.map((isLast, i) => (
    <span
      key={i}
      className={
        isLast
          ? 'app-structure-tree-guide app-structure-tree-guide--skip'
          : 'app-structure-tree-guide app-structure-tree-guide--pass'
      }
      aria-hidden
    />
  ));

  const branchClass =
    'app-structure-tree-branch ' +
    (isLastSibling ? 'app-structure-tree-branch--corner' : 'app-structure-tree-branch--tee');

  return (
    <div className="app-structure-tree-node">
      <div className="app-structure-tree-line">
        {guides}
        <span className={branchClass} aria-hidden />
        {hasChildren ? (
          <button
            type="button"
            className="app-structure-tree-toggle"
            onClick={() => toggleNode(nodeKey)}
            aria-expanded={expanded}
            aria-label={expanded ? 'Свернуть' : 'Развернуть'}
          >
            <span className={expanded ? 'app-structure-tree-chevron app-structure-tree-chevron--open' : 'app-structure-tree-chevron'} />
          </button>
        ) : (
          <span className="app-structure-tree-toggle-spacer" aria-hidden />
        )}
        <span className="app-structure-tree-label-cell">
          {node.href ? (
            <a href={node.href} className="app-structure-tree-link">
              {lineLabel}
            </a>
          ) : (
            <span className="app-structure-tree-text">{lineLabel}</span>
          )}
        </span>
      </div>
      {hasChildren && expanded && (
        <div className="app-structure-tree-children">
          {children!.map((child, i) => {
            const childKey = `${nodeKey}/${i}`;
            return (
              <TreeNode
                key={childKey}
                node={child}
                nodeKey={childKey}
                depth={depth + 1}
                ancestorIsLast={[...ancestorIsLast, isLastSibling]}
                isLastSibling={i === children!.length - 1}
                collapsed={collapsed}
                toggleNode={toggleNode}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

interface TreeRootProps {
  root: TreeChild;
  collapsed: Set<string>;
  toggleNode: (id: string) => void;
}

function TreeRoot({ root, collapsed, toggleNode }: TreeRootProps): React.ReactElement {
  const rootText = treeLineText(root.label, 'Пользователь');
  const spaces = root.children;
  const hasSpaces = Boolean(spaces?.length);
  const rootExpanded = !collapsed.has('root');

  return (
    <div className="app-structure-tree-inner">
      <div className="app-structure-tree-line app-structure-tree-line--root">
        {hasSpaces ? (
          <button
            type="button"
            className="app-structure-tree-toggle"
            onClick={() => toggleNode('root')}
            aria-expanded={rootExpanded}
            aria-label={rootExpanded ? 'Свернуть пространства' : 'Развернуть пространства'}
          >
            <span
              className={rootExpanded ? 'app-structure-tree-chevron app-structure-tree-chevron--open' : 'app-structure-tree-chevron'}
            />
          </button>
        ) : (
          <span className="app-structure-tree-toggle-spacer" aria-hidden />
        )}
        <span className="app-structure-tree-label-cell app-structure-tree-label-cell--root">
          <span className="app-structure-tree-text">{rootText}</span>
        </span>
      </div>
      {hasSpaces && rootExpanded && (
        <div className="app-structure-tree-children app-structure-tree-children--root">
          {spaces!.map((space, si) => (
            <TreeNode
              key={`s-${si}`}
              node={space}
              nodeKey={`s-${si}`}
              depth={0}
              ancestorIsLast={[]}
              isLastSibling={si === spaces!.length - 1}
              collapsed={collapsed}
              toggleNode={toggleNode}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export interface AppStructureTreeProps {
  /** Имя с профиля; на всякий случай принимаем unknown — объект даст «[object Object]» в React. */
  userName: unknown;
}

export const AppStructureTree: React.FC<AppStructureTreeProps> = ({ userName }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [root, setRoot] = useState<TreeChild | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggleNode = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { spaces: rawSpaces } = await spacesAPI.getSpaces(false, 100, 0);
      const spaces = (rawSpaces || []).filter((s) => !s.is_archived);
      const chatsBySpace = new Map<number, ChatHistoryItem[]>();
      const filesBySpaceChat = new Map<string, SpaceAttachmentItem[]>();

      await Promise.all(
        spaces.map(async (space) => {
          const [history, filesList] = await Promise.all([
            chatAPI.getHistory(space.id),
            fetchAllSpaceFiles(space.id),
          ]);
          const chats = history.chats || [];
          chatsBySpace.set(space.id, chats);

          const byChat = new Map<number, SpaceAttachmentItem[]>();
          for (const f of filesList) {
            const cid = f.chat_id;
            if (cid == null) continue;
            const list = byChat.get(cid) || [];
            list.push(f);
            byChat.set(cid, list);
          }
          for (const chat of chats) {
            const key = `${space.id}:${chat.id}`;
            filesBySpaceChat.set(key, byChat.get(chat.id) || []);
          }
        })
      );

      setRoot(buildTreeData(userName, spaces, chatsBySpace, filesBySpaceChat));
    } catch (e: unknown) {
      console.error('[AppStructureTree]', e);
      setError(e instanceof Error ? e.message : 'Ошибка загрузки');
      setRoot(null);
    } finally {
      setLoading(false);
    }
  }, [userName]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <div className="user-profile-empty">Загрузка структуры…</div>;
  }
  if (error) {
    return <div className="user-profile-error">{error}</div>;
  }
  if (!root) {
    return <div className="user-profile-empty">Нет данных</div>;
  }

  const hasSpaces = root.children && root.children.length > 0;
  return (
    <div className="app-structure-tree">
      <TreeRoot root={root} collapsed={collapsed} toggleNode={toggleNode} />
      {!hasSpaces && (
        <div className="app-structure-tree-hint">Пока нет пространств — создайте пространство в приложении.</div>
      )}
    </div>
  );
};
