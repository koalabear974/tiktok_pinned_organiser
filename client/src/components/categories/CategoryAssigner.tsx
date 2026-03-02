import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, X } from 'lucide-react';
import { useCategories } from '../../hooks/useCategories';
import { useUpdateVideoCategories } from '../../hooks/useVideos';

interface CategoryAssignerProps {
  videoId: string;
  currentCategoryIds: number[];
}

export default function CategoryAssigner({
  videoId,
  currentCategoryIds,
}: CategoryAssignerProps) {
  const { data: categories = [] } = useCategories();
  const updateCategories = useUpdateVideoCategories();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<number[]>(currentCategoryIds);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelected(currentCategoryIds);
  }, [currentCategoryIds]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = (categoryId: number) => {
    const newSelected = selected.includes(categoryId)
      ? selected.filter((id) => id !== categoryId)
      : [...selected, categoryId];

    setSelected(newSelected);
    updateCategories.mutate({ id: videoId, categoryIds: newSelected });
  };

  const handleRemove = (categoryId: number) => {
    const newSelected = selected.filter((id) => id !== categoryId);
    setSelected(newSelected);
    updateCategories.mutate({ id: videoId, categoryIds: newSelected });
  };

  const selectedCategories = categories.filter((c) => selected.includes(c.id));

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {selectedCategories.length === 0 && (
          <span className="text-xs text-gray-400 italic">No categories assigned</span>
        )}
        {selectedCategories.map((cat) => (
          <span
            key={cat.id}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white"
            style={{ backgroundColor: cat.color }}
          >
            {cat.name}
            <button
              onClick={() => handleRemove(cat.id)}
              className="hover:bg-white/20 rounded-full p-0.5 transition-colors"
            >
              <X size={10} />
            </button>
          </span>
        ))}
      </div>

      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-600 bg-gray-50
          border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
      >
        Assign categories
        <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-30 max-h-60 overflow-y-auto scrollbar-thin">
          {categories.length === 0 && (
            <p className="px-3 py-2 text-xs text-gray-400">
              No categories yet. Create one first.
            </p>
          )}
          {categories.map((cat) => {
            const isSelected = selected.includes(cat.id);
            return (
              <button
                key={cat.id}
                onClick={() => handleToggle(cat.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
                  isSelected ? 'bg-indigo-50' : 'hover:bg-gray-50'
                }`}
              >
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: cat.color }}
                />
                <span className={`flex-1 text-left ${isSelected ? 'text-indigo-700 font-medium' : 'text-gray-700'}`}>
                  {cat.name}
                </span>
                {isSelected && (
                  <Check size={14} className="text-indigo-600 flex-shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
