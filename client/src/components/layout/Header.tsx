import { ArrowUpDown, ChevronDown, X } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

interface HeaderProps {
  sort: string;
  order: 'asc' | 'desc';
  onSortChange: (sort: string) => void;
  onOrderChange: (order: 'asc' | 'desc') => void;
  total: number;
  showing: number;
  filters: { label: string; onDismiss: () => void }[];
}

const SORT_OPTIONS = [
  { value: 'save_order', label: 'Date Saved' },
  { value: 'create_time', label: 'Date Created' },
  { value: 'digg_count', label: 'Likes' },
  { value: 'play_count', label: 'Views' },
  { value: 'comment_count', label: 'Comments' },
  { value: 'share_count', label: 'Shares' },
];

export default function Header({
  sort,
  order,
  onSortChange,
  onOrderChange,
  total,
  showing,
  filters,
}: HeaderProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentSortLabel =
    SORT_OPTIONS.find((o) => o.value === sort)?.label ?? 'Date';

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm border-b border-gray-200 px-6 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-gray-500 mr-auto">
          Showing{' '}
          <span className="font-medium text-gray-900">{showing}</span> of{' '}
          <span className="font-medium text-gray-900">{total}</span> videos
        </p>

        {filters.length > 0 && (
          <div className="flex items-center gap-2 order-last w-full sm:order-none sm:w-auto">
            {filters.map((f, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium
                  bg-indigo-50 text-indigo-700 rounded-full"
              >
                {f.label}
                <button
                  onClick={f.onDismiss}
                  className="hover:bg-indigo-100 rounded-full p-0.5 transition-colors"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 bg-white
              border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <ArrowUpDown size={14} className="text-gray-400" />
            {currentSortLabel}
            <ChevronDown size={14} className="text-gray-400" />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 mt-1 w-44 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-20">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => {
                    onSortChange(opt.value);
                    setDropdownOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                    sort === opt.value
                      ? 'bg-indigo-50 text-indigo-700 font-medium'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={() => onOrderChange(order === 'asc' ? 'desc' : 'asc')}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 bg-white
            border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          title={order === 'asc' ? 'Ascending' : 'Descending'}
        >
          {order === 'asc' ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M19 12l-7 7-7-7" />
            </svg>
          )}
          {order === 'asc' ? 'Oldest first' : 'Newest first'}
        </button>
      </div>
    </div>
  );
}
