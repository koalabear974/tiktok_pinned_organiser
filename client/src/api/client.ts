import type {
  Video,
  VideoStats,
  VideosResponse,
  VideosParams,
  Category,
  ImportResult,
} from '../types';

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(body.error || res.statusText, res.status);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json();
}

// ---------- Videos ----------

export async function fetchVideos(params: VideosParams): Promise<VideosResponse> {
  const searchParams = new URLSearchParams();

  if (params.page) searchParams.set('page', String(params.page));
  if (params.limit) searchParams.set('limit', String(params.limit));
  if (params.sort) searchParams.set('sort', params.sort);
  if (params.order) searchParams.set('order', params.order);
  if (params.search) searchParams.set('search', params.search);
  if (params.category !== null && params.category !== undefined) {
    searchParams.set('category', String(params.category));
  }

  const qs = searchParams.toString();
  return request<VideosResponse>(`/api/videos${qs ? `?${qs}` : ''}`);
}

export async function fetchVideo(id: string): Promise<Video> {
  return request<Video>(`/api/videos/${id}`);
}

export async function fetchVideoStats(): Promise<VideoStats> {
  return request<VideoStats>('/api/videos/stats');
}

export async function updateVideoCategories(
  id: string,
  categoryIds: number[]
): Promise<{ success: boolean; categories: Category[] }> {
  return request(`/api/videos/${id}/categories`, {
    method: 'PATCH',
    body: JSON.stringify({ categoryIds }),
  });
}

export async function bulkAssignCategory(
  videoIds: string[],
  categoryId: number
): Promise<{ success: boolean; assigned: number; total: number }> {
  return request('/api/videos/bulk/categories', {
    method: 'POST',
    body: JSON.stringify({ videoIds, categoryId }),
  });
}

// ---------- Categories ----------

export async function fetchCategories(): Promise<Category[]> {
  const data = await request<{ categories: Category[] }>('/api/categories');
  return data.categories;
}

export async function createCategory(data: {
  name: string;
  color: string;
  description?: string;
}): Promise<Category> {
  return request<Category>('/api/categories', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateCategory(
  id: number,
  data: { name?: string; color?: string; description?: string }
): Promise<Category> {
  return request<Category>(`/api/categories/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteCategory(id: number): Promise<void> {
  return request<void>(`/api/categories/${id}`, {
    method: 'DELETE',
  });
}

// ---------- Import ----------

export async function importFile(file: File): Promise<ImportResult> {
  const text = await file.text();
  const data = JSON.parse(text);

  // Pass the full parsed JSON (which includes itemList, cursor, total, hasMore)
  return request<ImportResult>('/api/import', {
    method: 'POST',
    body: JSON.stringify({
      ...data,
      filename: file.name,
    }),
  });
}

export async function fetchImports(): Promise<unknown[]> {
  const data = await request<{ imports: unknown[] }>('/api/imports');
  return data.imports;
}

// ---------- Thumbnails ----------

export async function downloadThumbnailBatch(
  videoIds: string[]
): Promise<{ downloaded: number; failed: number; remaining: number }> {
  return request('/api/thumbnails/download-batch', {
    method: 'POST',
    body: JSON.stringify({ videoIds }),
  });
}
