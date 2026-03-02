import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../_lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Video ID is required' });
  }

  try {
    const { categoryIds } = req.body;

    if (!Array.isArray(categoryIds)) {
      return res.status(400).json({ error: 'categoryIds must be an array of numbers' });
    }

    // Verify video exists
    const { data: video, error: videoError } = await supabase
      .from('videos')
      .select('id')
      .eq('id', id)
      .single();

    if (videoError || !video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    // Delete all existing assignments
    await supabase
      .from('video_categories')
      .delete()
      .eq('video_id', id);

    // Insert new assignments
    if (categoryIds.length > 0) {
      const rows = categoryIds.map((categoryId: number) => ({
        video_id: id,
        category_id: categoryId,
        assigned_by: 'manual',
      }));

      const { error } = await supabase
        .from('video_categories')
        .insert(rows);

      if (error) throw error;
    }

    // Return updated categories
    const { data: categories } = await supabase
      .from('video_categories')
      .select('category_id, assigned_by, confidence, assigned_at, categories(id, name, color, icon, description)')
      .eq('video_id', id);

    const flatCategories = (categories || []).map((row: any) => ({
      ...row.categories,
      assigned_by: row.assigned_by,
      confidence: row.confidence,
      assigned_at: row.assigned_at,
    }));

    return res.json({ success: true, categories: flatCategories });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Error updating video categories:', message);
    return res.status(500).json({ error: `Failed to update categories: ${message}` });
  }
}
