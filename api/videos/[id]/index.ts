import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../_lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Video ID is required' });
  }

  try {
    // Fetch video
    const { data: video, error: videoError } = await supabase
      .from('videos')
      .select('*')
      .eq('id', id)
      .single();

    if (videoError || !video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    // Fetch categories
    const { data: categories } = await supabase
      .from('video_categories')
      .select('category_id, assigned_by, confidence, assigned_at, categories(id, name, color, icon, description)')
      .eq('video_id', id);

    // Fetch hashtags
    const { data: hashtagRows } = await supabase
      .from('video_hashtags')
      .select('hashtag_id, hashtags(id, title)')
      .eq('video_id', id);

    const flatCategories = (categories || []).map((row: any) => ({
      ...row.categories,
      assigned_by: row.assigned_by,
      confidence: row.confidence,
      assigned_at: row.assigned_at,
    }));

    const flatHashtags = (hashtagRows || []).map((row: any) => row.hashtags);

    return res.json({
      ...video,
      categories: flatCategories,
      hashtags: flatHashtags,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Error fetching video:', message);
    return res.status(500).json({ error: `Failed to fetch video: ${message}` });
  }
}
