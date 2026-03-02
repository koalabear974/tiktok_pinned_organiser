import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchVideos,
  fetchVideo,
  fetchVideoStats,
  updateVideoCategories,
  bulkAssignCategory,
} from '../api/client';
import type { VideosParams } from '../types';

export function useVideos(params: VideosParams) {
  return useQuery({
    queryKey: ['videos', params],
    queryFn: () => fetchVideos(params),
    placeholderData: (prev) => prev,
  });
}

export function useVideo(id: string | null) {
  return useQuery({
    queryKey: ['video', id],
    queryFn: () => fetchVideo(id!),
    enabled: id !== null,
  });
}

export function useVideoStats() {
  return useQuery({
    queryKey: ['videoStats'],
    queryFn: fetchVideoStats,
  });
}

export function useUpdateVideoCategories() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      categoryIds,
    }: {
      id: string;
      categoryIds: number[];
    }) => updateVideoCategories(id, categoryIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['videos'] });
      queryClient.invalidateQueries({ queryKey: ['video'] });
      queryClient.invalidateQueries({ queryKey: ['videoStats'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}

export function useBulkAssignCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      videoIds,
      categoryId,
    }: {
      videoIds: string[];
      categoryId: number;
    }) => bulkAssignCategory(videoIds, categoryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['videos'] });
      queryClient.invalidateQueries({ queryKey: ['video'] });
      queryClient.invalidateQueries({ queryKey: ['videoStats'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}
