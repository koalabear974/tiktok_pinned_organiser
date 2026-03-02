import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../_lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      page = '1',
      limit = '30',
      sort = 'save_order',
      order = 'desc',
      category,
      hashtag,
      search,
      author,
      type,
    } = req.query as Record<string, string | undefined>;

    const { data, error } = await supabase.rpc('get_videos', {
      p_page: parseInt(page || '1'),
      p_limit: parseInt(limit || '30'),
      p_sort: sort || 'save_order',
      p_order: order || 'desc',
      p_category: category || null,
      p_hashtag: hashtag || null,
      p_search: search || null,
      p_author: author || null,
      p_type: type || null,
    });

    if (error) throw error;

    return res.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Error fetching videos:', message);
    return res.status(500).json({ error: `Failed to fetch videos: ${message}` });
  }
}
