import { useState, useCallback, useRef, useEffect } from 'react';

export function useVideoSelection(orderedIds: string[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const lastClickedRef = useRef<string | null>(null);

  const toggle = useCallback(
    (id: string, event: { shiftKey: boolean; metaKey: boolean; ctrlKey: boolean }) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);

        if (event.shiftKey && lastClickedRef.current) {
          // Range select
          const lastIdx = orderedIds.indexOf(lastClickedRef.current);
          const curIdx = orderedIds.indexOf(id);
          if (lastIdx !== -1 && curIdx !== -1) {
            const [start, end] = lastIdx < curIdx ? [lastIdx, curIdx] : [curIdx, lastIdx];
            for (let i = start; i <= end; i++) {
              next.add(orderedIds[i]);
            }
          }
        } else if (event.metaKey || event.ctrlKey) {
          // Toggle single
          if (next.has(id)) {
            next.delete(id);
          } else {
            next.add(id);
          }
        } else if (prev.size > 0) {
          // Already in selection mode: toggle this item
          if (next.has(id)) {
            next.delete(id);
          } else {
            next.add(id);
          }
        } else {
          // Nothing selected yet: start selection with this item
          next.add(id);
        }

        lastClickedRef.current = id;
        return next;
      });
    },
    [orderedIds]
  );

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(orderedIds));
  }, [orderedIds]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    lastClickedRef.current = null;
  }, []);

  // Clear selection on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedIds.size > 0) {
        clearSelection();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds.size, clearSelection]);

  return {
    selectedIds,
    toggle,
    selectAll,
    clearSelection,
    hasSelection: selectedIds.size > 0,
  };
}
