import { useDroppable } from '@dnd-kit/core';
import type { ReactNode } from 'react';

interface DroppableCategoryItemProps {
  categoryId: number | 'uncategorized';
  children: ReactNode;
  isDragActive: boolean;
}

export default function DroppableCategoryItem({
  categoryId,
  children,
  isDragActive,
}: DroppableCategoryItemProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: `category-${categoryId}`,
    data: { categoryId, type: 'category' },
    disabled: categoryId === 'uncategorized',
  });

  if (!isDragActive || categoryId === 'uncategorized') {
    return <>{children}</>;
  }

  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg transition-all duration-150 ${
        isOver
          ? 'bg-indigo-100 ring-2 ring-indigo-400 scale-[1.02]'
          : 'ring-1 ring-dashed ring-gray-300'
      }`}
    >
      {children}
    </div>
  );
}
