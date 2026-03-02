import {
  Search,
  Upload,
  Bookmark,
  FolderOpen,
  Settings,
  Layers,
} from 'lucide-react';
import type { Category } from '../../types';
import DroppableCategoryItem from './DroppableCategoryItem';

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
