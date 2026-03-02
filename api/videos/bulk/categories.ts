import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../_lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { videoIds, categoryId } = req.body;

    if (!Array.isArray(videoIds) || videoIds.length === 0) {
      return res.status(400).json({ error: 'videoIds must be a non-empty array of strings' });
    }

    if (typeof categoryId !== 'number') {
      return res.status(400).json({ error: 'categoryId must be a number' });
    }

    // Verify category exists
    const { data: category, error: catError } = await supabase
      .from('categories')
      .select('id')
      .eq('id', categoryId)
      .single();

    if (catError || !category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Bulk insert with ON CONFLICT DO NOTHING
    const rows = videoIds.map((videoId: string) => ({
      video_id: videoId,
      category_id: categoryId,
      assigned_by: 'manual',
    }));

    const { error } = await supabase
      .from('video_categories')
      .upsert(rows, { onConflict: 'video_id,category_id', ignoreDuplicates: true });

    if (error) throw error;

    return res.json({ success: true, assigned: videoIds.length, total: videoIds.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Error bulk assigning categories:', message);
    return res.status(500).json({ error: `Failed to bulk assign categories: ${message}` });
  }
}
