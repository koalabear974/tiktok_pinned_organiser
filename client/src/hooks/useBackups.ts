import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchBackups,
  createBackup,
  restoreBackup,
  deleteBackup,
} from '../api/client';

export function useBackups() {
  return useQuery({
    queryKey: ['backups'],
    queryFn: fetchBackups,
  });
}

export function useCreateBackup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) => createBackup(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backups'] });
    },
  });
}

export function useRestoreBackup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) => restoreBackup(name),
    onSuccess: () => {
      // Invalidate everything — the entire DB was replaced
      queryClient.invalidateQueries();
    },
  });
}

export function useDeleteBackup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) => deleteBackup(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backups'] });
    },
  });
}
