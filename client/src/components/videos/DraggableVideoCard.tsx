import { useDraggable } from '@dnd-kit/core';
import type { Video } from '../../types';
import VideoCard from './VideoCard';

interface DraggableVideoCardProps {
  video: Video;
  onClick: () => void;
  selected: boolean;
  selectionMode: boolean;
  onSelect: (e: React.MouseEvent) => void;
  selectedIds: Set<string>;
}

export default function DraggableVideoCard({
  video,
  onClick,
  selected,
  selectionMode,
  onSelect,
  selectedIds,
}: DraggableVideoCardProps) {
  const dragIds = selected ? Array.from(selectedIds) : [video.id];

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `video-${video.id}`,
    data: { videoIds: dragIds, type: 'video' },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      data-testid={`draggable-${video.id}`}
      style={{ opacity: isDragging ? 0.4 : 1 }}
    >
      <VideoCard
        video={video}
        onClick={onClick}
        selected={selected}
        selectionMode={selectionMode}
        onSelect={onSelect}
      />
    </div>
  );
}
