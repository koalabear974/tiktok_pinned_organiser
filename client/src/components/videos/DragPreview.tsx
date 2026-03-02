import { GripVertical } from 'lucide-react';

interface DragPreviewProps {
  count: number;
  thumbnailUrl: string | null;
}

export default function DragPreview({ count, thumbnailUrl }: DragPreviewProps) {
  return (
    <div className="relative w-24 h-36 pointer-events-none">
      {/* Stacked card effect */}
      {count > 2 && (
        <div className="absolute inset-0 translate-x-2 translate-y-2 rounded-lg bg-gray-300 shadow-sm" />
      )}
      {count > 1 && (
        <div className="absolute inset-0 translate-x-1 translate-y-1 rounded-lg bg-gray-200 shadow-sm" />
      )}

      {/* Main card */}
      <div className="absolute inset-0 rounded-lg bg-white shadow-lg border border-gray-200 overflow-hidden">
        {thumbnailUrl ? (
          <img src={thumbnailUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-100">
            <GripVertical size={20} className="text-gray-400" />
          </div>
        )}
      </div>

      {/* Count badge */}
      {count > 1 && (
        <div className="absolute -top-2 -right-2 min-w-6 h-6 px-1.5 rounded-full bg-indigo-600 text-white
          text-xs font-bold flex items-center justify-center shadow-md">
          {count}
        </div>
      )}
    </div>
  );
}
