import { Play, Heart, MessageCircle, Clock, Check } from 'lucide-react';
import type { Video } from '../../types';
import { formatNumber, formatDuration } from '../../utils';

interface VideoCardProps {
  video: Video;
  onClick: () => void;
  selected?: boolean;
  selectionMode?: boolean;
  onSelect?: (e: React.MouseEvent) => void;
}

export default function VideoCard({ video, onClick, selected, selectionMode, onSelect }: VideoCardProps) {
  const thumbnailUrl = video.thumbnail_url || null;

  const handleClick = (e: React.MouseEvent) => {
    if (selectionMode || e.shiftKey || e.metaKey || e.ctrlKey) {
      e.preventDefault();
      onSelect?.(e);
    } else {
      onClick();
    }
  };

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect?.(e);
  };

  return (
    <div
      onClick={handleClick}
      data-testid={`video-card-${video.id}`}
      data-selected={selected || undefined}
      className={`group relative rounded-xl overflow-hidden bg-white shadow-sm border
        hover:shadow-lg hover:scale-[1.02] transition-all duration-200 cursor-pointer
        ${selected ? 'ring-2 ring-indigo-500 border-indigo-300' : 'border-gray-100'}`}
    >
      {/* Selection checkbox */}
      <div
        onClick={handleCheckboxClick}
        data-testid={`video-checkbox-${video.id}`}
        className={`absolute top-2 left-2 z-10 w-6 h-6 rounded-md border-2 flex items-center justify-center
          transition-all duration-150 cursor-pointer
          ${selected
            ? 'bg-indigo-500 border-indigo-500 text-white'
            : 'bg-white/80 border-white/90 text-transparent hover:border-gray-300'
          }
          ${selectionMode ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}
        `}
      >
        <Check size={14} strokeWidth={3} />
      </div>

      {/* Thumbnail */}
      <div className="relative aspect-[9/16] bg-gray-100 overflow-hidden">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={video.description || 'TikTok video'}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-200 to-gray-300">
            <Play size={32} className="text-gray-400" />
          </div>
        )}

        {/* Duration badge */}
        {video.duration > 0 && (
          <span className="absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 bg-black/70 text-white text-xs font-medium rounded">
            <Clock size={10} />
            {formatDuration(video.duration)}
          </span>
        )}

        {/* Stats overlay on hover */}
        <div
          className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent
            opacity-0 group-hover:opacity-100 transition-opacity duration-200
            flex items-end"
        >
          <div className="w-full p-3 flex items-center gap-3 text-white text-xs">
            <span className="flex items-center gap-1">
              <Play size={12} />
              {formatNumber(video.play_count)}
            </span>
            <span className="flex items-center gap-1">
              <Heart size={12} />
              {formatNumber(video.digg_count)}
            </span>
            <span className="flex items-center gap-1">
              <MessageCircle size={12} />
              {formatNumber(video.comment_count)}
            </span>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="text-sm font-medium text-gray-900 line-clamp-2 leading-snug mb-1.5">
          {video.description || 'Untitled video'}
        </p>
        <p className="text-xs text-gray-500 truncate">
          @{video.author_unique_id}
        </p>
      </div>
    </div>
  );
}
