import type { Video } from '../../types';
import DraggableVideoCard from './DraggableVideoCard';
import { Bookmark } from 'lucide-react';

interface VideoGridProps {
  videos: Video[];
  loading: boolean;
  onVideoClick: (video: Video) => void;
  selectedIds: Set<string>;
  onSelect: (id: string, e: React.MouseEvent) => void;
}

function SkeletonCard() {
  return (
    <div className="rounded-xl overflow-hidden bg-white shadow-sm border border-gray-100">
      <div className="aspect-[9/16] skeleton" />
      <div className="p-3 space-y-2">
        <div className="h-4 w-3/4 rounded skeleton" />
        <div className="h-3 w-1/2 rounded skeleton" />
      </div>
    </div>
  );
}

export default function VideoGrid({
  videos,
  loading,
  onVideoClick,
  selectedIds,
  onSelect,
}: VideoGridProps) {
  const selectionMode = selectedIds.size > 0;

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 p-6">
        {Array.from({ length: 20 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-6">
        <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
          <Bookmark size={28} className="text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">
          No videos found
        </h3>
        <p className="text-sm text-gray-500 text-center max-w-sm">
          Try adjusting your search or filters, or import some TikTok saved
          videos data to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 p-6">
      {videos.map((video) => (
        <DraggableVideoCard
          key={video.id}
          video={video}
          onClick={() => onVideoClick(video)}
          selected={selectedIds.has(video.id)}
          selectionMode={selectionMode}
          onSelect={(e) => onSelect(video.id, e)}
          selectedIds={selectedIds}
        />
      ))}
    </div>
  );
}
