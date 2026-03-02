import { useState, useRef, useEffect } from 'react';
import {
  Search,
  Upload,
  Bookmark,
  FolderOpen,
  Settings,
  Layers,
  Save,
  RotateCcw,
  Trash2,
  ChevronDown,
  HardDrive,
  X,
} from 'lucide-react';
import type { Category } from '../../types';
import DroppableCategoryItem from './DroppableCategoryItem';
import { useBackups, useCreateBackup, useRestoreBackup, useDeleteBackup } from '../../hooks/useBackups';

interface SidebarProps {
  selectedCategory: number | 'uncategorized' | null;
  onSelectCategory: (category: number | 'uncategorized' | null) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  categories: Category[];
  totalVideos: number;
  uncategorizedCount: number;
  onImportClick: () => void;
  onManageCategoriesClick: () => void;
  isDragActive?: boolean;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Sidebar({
  selectedCategory,
  onSelectCategory,
  searchQuery,
  onSearchChange,
  categories,
  totalVideos,
  uncategorizedCount,
  onImportClick,
  onManageCategoriesClick,
  isDragActive = false,
}: SidebarProps) {
  const [showSavePrompt, setShowSavePrompt] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [showLoadMenu, setShowLoadMenu] = useState(false);
  const loadMenuRef = useRef<HTMLDivElement>(null);
  const saveInputRef = useRef<HTMLInputElement>(null);

  const { data: backups = [] } = useBackups();
  const createBackup = useCreateBackup();
  const restoreBackup = useRestoreBackup();
  const deleteBackup = useDeleteBackup();

  // Close load menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (loadMenuRef.current && !loadMenuRef.current.contains(e.target as Node)) {
        setShowLoadMenu(false);
      }
    }
    if (showLoadMenu) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [showLoadMenu]);

  // Focus save input when opened
  useEffect(() => {
    if (showSavePrompt && saveInputRef.current) {
      saveInputRef.current.focus();
    }
  }, [showSavePrompt]);

  function handleSave() {
    const defaultName = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    setSaveName(defaultName);
    setShowSavePrompt(true);
  }

  function handleSaveConfirm() {
    const name = saveName.trim();
    if (!name) return;
    createBackup.mutate(name, {
      onSuccess: () => {
        setShowSavePrompt(false);
        setSaveName('');
      },
    });
  }

  function handleRestore(name: string) {
    if (!confirm(`Restore backup "${name}"? This will replace the current database.`)) return;
    restoreBackup.mutate(name, {
      onSuccess: () => setShowLoadMenu(false),
    });
  }

  function handleDelete(name: string) {
    if (!confirm(`Delete backup "${name}"?`)) return;
    deleteBackup.mutate(name);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Logo / Title */}
      <div className="p-5 hidden lg:block">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-9 h-9 bg-indigo-600 rounded-xl">
            <Bookmark size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">TikTok Saved</h1>
            <p className="text-xs text-gray-500">Video Manager</p>
          </div>
        </div>
      </div>

      {/* Import button */}
      <div className="px-4 pb-3">
        <button
          onClick={onImportClick}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg
            hover:bg-indigo-700 transition-colors font-medium text-sm"
        >
          <Upload size={16} />
          Import Videos
        </button>
      </div>

      {/* Database section */}
      <div className="px-4 pb-3" ref={loadMenuRef}>
        <div className="flex items-center gap-1.5 mb-2">
          <HardDrive size={12} className="text-gray-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Database
          </span>
        </div>

        <div className="flex gap-2">
          <button
            data-testid="save-db-btn"
            onClick={handleSave}
            disabled={createBackup.isPending}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 border border-gray-200
              bg-white hover:bg-gray-50 rounded-md transition-colors font-medium disabled:opacity-50 whitespace-nowrap"
          >
            <Save size={12} />
            {createBackup.isPending ? 'Saving...' : 'Save'}
          </button>
          <button
            data-testid="load-db-btn"
            onClick={() => setShowLoadMenu(!showLoadMenu)}
            disabled={restoreBackup.isPending}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 border border-gray-200
              bg-white hover:bg-gray-50 rounded-md transition-colors font-medium disabled:opacity-50 whitespace-nowrap"
          >
            <RotateCcw size={12} />
            {restoreBackup.isPending ? 'Loading...' : 'Load'}
            <ChevronDown size={10} className={`transition-transform ${showLoadMenu ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Save prompt — full-width below buttons */}
        {showSavePrompt && (
          <div className="mt-2" data-testid="save-prompt">
            <div className="flex gap-1.5">
              <input
                ref={saveInputRef}
                data-testid="save-name-input"
                type="text"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveConfirm();
                  if (e.key === 'Escape') setShowSavePrompt(false);
                }}
                placeholder="Backup name..."
                className="flex-1 min-w-0 px-2 py-1 text-xs border border-gray-200 rounded-md
                  bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500
                  focus:border-indigo-500"
              />
              <button
                data-testid="save-confirm-btn"
                onClick={handleSaveConfirm}
                disabled={!saveName.trim() || createBackup.isPending}
                className="px-2.5 py-1 text-xs bg-indigo-600 text-white rounded-md hover:bg-indigo-700
                  transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                Save
              </button>
              <button
                onClick={() => setShowSavePrompt(false)}
                className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
            {createBackup.isError && (
              <p className="mt-1 text-xs text-red-500">
                {(createBackup.error as Error).message}
              </p>
            )}
          </div>
        )}

        {/* Load dropdown — positioned wider, anchored to the full Database section */}
        {showLoadMenu && (
          <div
            data-testid="load-menu"
            className="mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto"
          >
            {backups.length === 0 ? (
              <p className="px-3 py-3 text-xs text-gray-400 text-center">No backups yet</p>
            ) : (
              backups.map((b) => (
                <div
                  key={b.name}
                  data-testid={`backup-item-${b.name}`}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-0 group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-700 truncate" title={b.name}>
                      {b.name}
                    </p>
                    <p className="text-[10px] text-gray-400 leading-tight">
                      {formatDate(b.createdAt)} · {formatSize(b.size)}
                    </p>
                  </div>
                  <button
                    data-testid={`restore-btn-${b.name}`}
                    onClick={() => handleRestore(b.name)}
                    title="Restore this backup"
                    className="p-1 text-gray-400 hover:text-indigo-600 transition-colors"
                  >
                    <RotateCcw size={13} />
                  </button>
                  <button
                    data-testid={`delete-btn-${b.name}`}
                    onClick={() => handleDelete(b.name)}
                    title="Delete this backup"
                    className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Search */}
      <div className="px-4 pb-4">
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search videos..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg
              bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500
              focus:border-transparent placeholder:text-gray-400 transition-colors"
          />
        </div>
      </div>

      {/* Category list */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-2">
        <div className="px-2 pb-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
            Library
          </p>
        </div>

        {/* All Videos */}
        <button
          onClick={() => onSelectCategory(null)}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors mb-0.5 ${
            selectedCategory === null
              ? 'bg-indigo-50 text-indigo-700 font-medium'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          <Layers size={16} className={selectedCategory === null ? 'text-indigo-600' : 'text-gray-400'} />
          <span className="flex-1 text-left">All Videos</span>
          <span className={`text-xs px-1.5 py-0.5 rounded-full ${
            selectedCategory === null
              ? 'bg-indigo-100 text-indigo-700'
              : 'bg-gray-100 text-gray-500'
          }`}>
            {totalVideos}
          </span>
        </button>

        {/* Uncategorized */}
        <button
          onClick={() => onSelectCategory('uncategorized')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors mb-0.5 ${
            selectedCategory === 'uncategorized'
              ? 'bg-indigo-50 text-indigo-700 font-medium'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          <FolderOpen size={16} className={selectedCategory === 'uncategorized' ? 'text-indigo-600' : 'text-gray-400'} />
          <span className="flex-1 text-left">Uncategorized</span>
          <span className={`text-xs px-1.5 py-0.5 rounded-full ${
            selectedCategory === 'uncategorized'
              ? 'bg-indigo-100 text-indigo-700'
              : 'bg-gray-100 text-gray-500'
          }`}>
            {uncategorizedCount}
          </span>
        </button>

        {/* Categories section */}
        {categories.length > 0 && (
          <>
            <div className="px-2 pt-4 pb-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
                {isDragActive ? 'Drop on a category' : 'Categories'}
              </p>
            </div>

            {categories.map((cat) => (
              <DroppableCategoryItem key={cat.id} categoryId={cat.id} isDragActive={isDragActive}>
                <button
                  data-testid={`sidebar-category-${cat.id}`}
                  onClick={() => onSelectCategory(cat.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors mb-0.5 ${
                    selectedCategory === cat.id
                      ? 'bg-indigo-50 text-indigo-700 font-medium'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: cat.color }}
                  />
                  <span className="flex-1 text-left truncate">{cat.name}</span>
                  {cat.video_count !== undefined && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                      selectedCategory === cat.id
                        ? 'bg-indigo-100 text-indigo-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                      {cat.video_count}
                    </span>
                  )}
                </button>
              </DroppableCategoryItem>
            ))}
          </>
        )}
      </div>

      {/* Manage categories button */}
      <div className="p-4 border-t border-gray-200">
        <button
          onClick={onManageCategoriesClick}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-gray-600
            hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <Settings size={16} />
          Manage Categories
        </button>
      </div>
    </div>
  );
}
