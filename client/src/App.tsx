import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type Modifier,
} from '@dnd-kit/core';
import AppShell from './components/layout/AppShell';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import VideoGrid from './components/videos/VideoGrid';
import VideoModal from './components/videos/VideoModal';
import Pagination from './components/videos/Pagination';
import ImportDialog from './components/import/ImportDialog';
import CategoryManager from './components/categories/CategoryManager';
import DragPreview from './components/videos/DragPreview';
import SelectionToolbar from './components/videos/SelectionToolbar';
import { useVideos, useVideoStats, useBulkAssignCategory } from './hooks/useVideos';
import { useCategories } from './hooks/useCategories';
import { useVideoSelection } from './hooks/useVideoSelection';
import type { Video, VideosParams } from './types';

const snapCenterToCursor: Modifier = ({ activatorEvent, draggingNodeRect, transform }) => {
  if (activatorEvent && draggingNodeRect) {
    const event = activatorEvent as PointerEvent;
    const offsetX = event.clientX - draggingNodeRect.left;
    const offsetY = event.clientY - draggingNodeRect.top;
    return {
      ...transform,
      x: transform.x + offsetX - draggingNodeRect.width / 2,
      y: transform.y + offsetY - draggingNodeRect.height / 2,
    };
  }
  return transform;
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

function AppContent() {
  const [selectedCategory, setSelectedCategory] = useState<
    number | 'uncategorized' | null
  >(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sort, setSort] = useState('save_order');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);

  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);

  // Drag state
  const [isDragActive, setIsDragActive] = useState(false);
  const [dragVideoIds, setDragVideoIds] = useState<string[]>([]);
  const [dragThumbnailUrl, setDragThumbnailUrl] = useState<string | null>(null);

  const params: VideosParams = useMemo(
    () => ({
      page,
      limit: 40,
      sort,
      order,
      search: searchQuery || undefined,
      category: selectedCategory,
    }),
    [page, sort, order, searchQuery, selectedCategory]
  );

  const { data: videosData, isLoading: videosLoading } = useVideos(params);
  const { data: stats } = useVideoStats();
  const { data: categories = [] } = useCategories();

  const videos = videosData?.videos ?? [];
  const totalVideos = videosData?.total ?? 0;
  const totalPages = videosData?.totalPages ?? 1;

  const orderedIds = useMemo(() => videos.map((v) => v.id), [videos]);
  const { selectedIds, toggle, clearSelection, hasSelection } = useVideoSelection(orderedIds);
  const bulkAssign = useBulkAssignCategory();

  // Clear selection when filters/search/page change
  const prevParamsRef = useRef(params);
  useEffect(() => {
    if (prevParamsRef.current !== params) {
      clearSelection();
      prevParamsRef.current = params;
    }
  }, [params, clearSelection]);

  const handleSelectCategory = useCallback(
    (cat: number | 'uncategorized' | null) => {
      setSelectedCategory(cat);
      setPage(1);
    },
    []
  );

  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
    setPage(1);
  }, []);

  const handleSortChange = useCallback((newSort: string) => {
    setSort(newSort);
    setPage(1);
  }, []);

  const handleOrderChange = useCallback((newOrder: 'asc' | 'desc') => {
    setOrder(newOrder);
    setPage(1);
  }, []);

  // DnD sensors: 8px activation distance to differentiate click from drag
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const data = event.active.data.current as { videoIds: string[]; type: string } | undefined;
      if (data?.type === 'video') {
        const ids = data.videoIds;
        setDragVideoIds(ids);
        setIsDragActive(true);

        // Get thumbnail for the first dragged video
        const firstVideo = videos.find((v) => v.id === ids[0]);
        setDragThumbnailUrl(firstVideo?.thumbnail_url || null);
      }
    },
    [videos]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setIsDragActive(false);
      setDragVideoIds([]);
      setDragThumbnailUrl(null);

      const overData = event.over?.data.current as { categoryId: number; type: string } | undefined;
      if (overData?.type === 'category' && typeof overData.categoryId === 'number') {
        const activeData = event.active.data.current as { videoIds: string[] } | undefined;
        if (activeData?.videoIds.length) {
          bulkAssign.mutate(
            { videoIds: activeData.videoIds, categoryId: overData.categoryId },
            { onSuccess: () => clearSelection() }
          );
        }
      }
    },
    [bulkAssign, clearSelection]
  );

  const handleToolbarAssign = useCallback(
    (categoryId: number) => {
      const ids = Array.from(selectedIds);
      if (ids.length > 0) {
        bulkAssign.mutate(
          { videoIds: ids, categoryId },
          { onSuccess: () => clearSelection() }
        );
      }
    },
    [selectedIds, bulkAssign, clearSelection]
  );

  const handleVideoSelect = useCallback(
    (id: string, e: React.MouseEvent) => {
      toggle(id, { shiftKey: e.shiftKey, metaKey: e.metaKey, ctrlKey: e.ctrlKey });
    },
    [toggle]
  );

  const filters = useMemo(() => {
    const chips: { label: string; onDismiss: () => void }[] = [];

    if (searchQuery) {
      chips.push({
        label: `Search: "${searchQuery}"`,
        onDismiss: () => handleSearchChange(''),
      });
    }

    if (selectedCategory === 'uncategorized') {
      chips.push({
        label: 'Uncategorized',
        onDismiss: () => handleSelectCategory(null),
      });
    } else if (typeof selectedCategory === 'number') {
      const cat = categories.find((c) => c.id === selectedCategory);
      if (cat) {
        chips.push({
          label: `Category: ${cat.name}`,
          onDismiss: () => handleSelectCategory(null),
        });
      }
    }

    return chips;
  }, [searchQuery, selectedCategory, categories, handleSearchChange, handleSelectCategory]);

  const sidebarContent = (
    <Sidebar
      selectedCategory={selectedCategory}
      onSelectCategory={handleSelectCategory}
      searchQuery={searchQuery}
      onSearchChange={handleSearchChange}
      categories={categories}
      totalVideos={stats?.total ?? 0}
      uncategorizedCount={stats?.uncategorized ?? 0}
      onImportClick={() => setImportOpen(true)}
      onManageCategoriesClick={() => setCategoryManagerOpen(true)}
      isDragActive={isDragActive}
    />
  );

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <AppShell sidebar={sidebarContent}>
        <div className="flex flex-col h-full">
          <Header
            sort={sort}
            order={order}
            onSortChange={handleSortChange}
            onOrderChange={handleOrderChange}
            total={totalVideos}
            showing={videos.length}
            filters={filters}
          />

          <div className="flex-1 overflow-y-auto scrollbar-thin">
            <VideoGrid
              videos={videos}
              loading={videosLoading}
              onVideoClick={setSelectedVideo}
              selectedIds={selectedIds}
              onSelect={handleVideoSelect}
            />
          </div>

          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </div>
      </AppShell>

      <DragOverlay dropAnimation={null} modifiers={[snapCenterToCursor]}>
        {isDragActive && (
          <DragPreview
            count={dragVideoIds.length}
            thumbnailUrl={dragThumbnailUrl}
          />
        )}
      </DragOverlay>

      {hasSelection && (
        <SelectionToolbar
          count={selectedIds.size}
          categories={categories}
          onAssign={handleToolbarAssign}
          onClear={clearSelection}
        />
      )}

      {selectedVideo && (
        <VideoModal
          video={selectedVideo}
          onClose={() => setSelectedVideo(null)}
        />
      )}

      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} />

      <CategoryManager
        open={categoryManagerOpen}
        onClose={() => setCategoryManagerOpen(false)}
      />
    </DndContext>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}
