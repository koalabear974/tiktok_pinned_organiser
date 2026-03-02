import { useEffect, useCallback } from 'react';
import {
  X,
  Play,
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  Music,
  MapPin,
  Hash,
  Clock,
  Eye,
  User,
} from 'lucide-react';
import type { Video } from '../../types';
import { formatNumber, formatDuration, formatRelativeDate } from '../../utils';
import CategoryAssigner from '../categories/CategoryAssigner';
import { useVideo } from '../../hooks/useVideos';

interface VideoModalProps {
  video: Video;
  onClose: () => void;
}

export default function VideoModal({ video: initialVideo, onClose }: VideoModalProps) {
  // Fetch full video details (with categories and hashtags)
  const { data: video } = useVideo(initialVideo.id);
  const v = video ?? initialVideo;

  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [handleEscape]);

  const tiktokId = v.id;
  const location = [v.poi_name, v.poi_city].filter(Boolean).join(', ');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div
        className="relative z-10 bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col md:flex-row"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-20 p-2 bg-white/90 hover:bg-white rounded-full shadow transition-colors"
        >
          <X size={18} className="text-gray-700" />
        </button>

        {/* Video embed */}
        <div className="md:w-[360px] flex-shrink-0 bg-black flex items-center justify-center">
          <div className="w-full aspect-[9/16]">
            <iframe
              src={`https://www.tiktok.com/player/v1/${tiktokId}`}
              className="w-full h-full"
              allowFullScreen
              allow="encrypted-media"
              title={v.description || 'TikTok video'}
            />
          </div>
        </div>

        {/* Details panel */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="p-6 space-y-5">
            {/* Author */}
            <div className="flex items-center gap-3">
              {v.author_avatar_url ? (
                <img
                  src={v.author_avatar_url}
                  alt={v.author_nickname}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                  <User size={18} className="text-indigo-600" />
                </div>
              )}
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  {v.author_nickname}
                </p>
                <p className="text-xs text-gray-500">
                  @{v.author_unique_id}
                </p>
              </div>
              <span className="ml-auto text-xs text-gray-400">
                {formatRelativeDate(v.create_time)}
              </span>
            </div>

            {/* Description */}
            {v.description && (
              <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                {v.description}
              </p>
            )}

            {/* Hashtags */}
            {v.hashtags && v.hashtags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {v.hashtags.map((tag) => (
                  <span
                    key={tag.id}
                    className="inline-flex items-center gap-0.5 px-2 py-1 text-xs font-medium
                      bg-indigo-50 text-indigo-600 rounded-full"
                  >
                    <Hash size={10} />
                    {tag.title}
                  </span>
                ))}
              </div>
            )}

            {/* Music */}
            {v.music_title && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Music size={14} className="text-gray-400 flex-shrink-0" />
                <span className="truncate">
                  {v.music_title}
                  {v.music_author && (
                    <span className="text-gray-400">
                      {' '}- {v.music_author}
                    </span>
                  )}
                </span>
              </div>
            )}

            {/* Location */}
            {location && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <MapPin size={14} className="text-gray-400 flex-shrink-0" />
                <span>{location}</span>
              </div>
            )}

            {/* Duration */}
            {v.duration > 0 && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Clock size={14} className="text-gray-400 flex-shrink-0" />
                <span>{formatDuration(v.duration)}</span>
              </div>
            )}

            {/* Stats grid */}
            <div className="grid grid-cols-3 gap-3">
              <StatItem
                icon={<Eye size={16} />}
                label="Views"
                value={formatNumber(v.play_count)}
              />
              <StatItem
                icon={<Heart size={16} />}
                label="Likes"
                value={formatNumber(v.digg_count)}
              />
              <StatItem
                icon={<MessageCircle size={16} />}
                label="Comments"
                value={formatNumber(v.comment_count)}
              />
              <StatItem
                icon={<Share2 size={16} />}
                label="Shares"
                value={formatNumber(v.share_count)}
              />
              <StatItem
                icon={<Bookmark size={16} />}
                label="Saves"
                value={formatNumber(v.collect_count)}
              />
            </div>

            {/* Categories */}
            <div className="pt-2 border-t border-gray-100">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
                Categories
              </p>
              <CategoryAssigner
                videoId={v.id}
                currentCategoryIds={(v.categories ?? []).map((c) => c.id)}
              />
            </div>

            {/* Link to original */}
            <div className="pt-2 border-t border-gray-100">
              <a
                href={`https://www.tiktok.com/@${v.author_unique_id}/video/${v.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
              >
                View on TikTok
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 p-3 bg-gray-50 rounded-xl">
      <span className="text-gray-400">{icon}</span>
      <span className="text-sm font-semibold text-gray-900">{value}</span>
      <span className="text-xs text-gray-500">{label}</span>
    </div>
  );
}
