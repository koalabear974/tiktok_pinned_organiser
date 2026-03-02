import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { importFile, fetchImports } from '../api/client';

export function useImportFile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: File) => importFile(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['videos'] });
      queryClient.invalidateQueries({ queryKey: ['videoStats'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['imports'] });
    },
  });
}

export function useImports() {
  return useQuery({
    queryKey: ['imports'],
    queryFn: fetchImports,
  });
}
