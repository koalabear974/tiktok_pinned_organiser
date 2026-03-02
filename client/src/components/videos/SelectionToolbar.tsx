import { X, FolderPlus } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import type { Category } from '../../types';

interface SelectionToolbarProps {
  count: number;
  categories: Category[];
  onAssign: (categoryId: number) => void;
  onClear: () => void;
}

export default function SelectionToolbar({ count, categories, onAssign, onClear }: SelectionToolbarProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [dropdownOpen]);

  return (
    <div data-testid="selection-toolbar" className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3
      bg-gray-900 text-white px-5 py-3 rounded-2xl shadow-2xl">
      <span data-testid="selection-count" className="text-sm font-medium">
        {count} selected
      </span>

      <div className="w-px h-5 bg-gray-600" />

      <div className="relative" ref={dropdownRef}>
        <button
          data-testid="assign-to-button"
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg
            bg-indigo-600 hover:bg-indigo-500 transition-colors"
        >
          <FolderPlus size={14} />
          Assign to...
        </button>

        {dropdownOpen && (
          <div className="absolute bottom-full left-0 mb-2 w-52 bg-white text-gray-900 rounded-xl
            shadow-2xl border border-gray-200 py-1 max-h-64 overflow-y-auto">
            {categories.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500">No categories yet</div>
            ) : (
              categories.map((cat) => (
                <button
                  key={cat.id}
                  data-testid={`assign-category-${cat.id}`}
                  onClick={() => {
                    onAssign(cat.id);
                    setDropdownOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-gray-100 transition-colors"
                >
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: cat.color }}
                  />
                  <span className="truncate">{cat.name}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      <button
        data-testid="clear-selection"
        onClick={onClear}
        className="flex items-center gap-1 px-2 py-1.5 text-sm text-gray-400
          hover:text-white rounded-lg transition-colors"
      >
        <X size={14} />
        Clear
      </button>
    </div>
  );
}
