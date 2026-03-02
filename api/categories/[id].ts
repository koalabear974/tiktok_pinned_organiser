import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../_lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'PATCH') {
    return handlePatch(req, res);
  }
  if (req.method === 'DELETE') {
    return handleDelete(req, res);
  }
  return res.status(405).json({ error: 'Method not allowed' });
}

async function handlePatch(req: VercelRequest, res: VercelResponse) {
  try {
    const categoryId = parseInt(req.query.id as string);

    // Verify exists
    const { data: existing, error: existError } = await supabase
      .from('categories')
      .select('*')
      .eq('id', categoryId)
      .single();

    if (existError || !existing) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const { name, color, icon, description } = req.body;
    const updates: Record<string, unknown> = {};

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ error: 'Category name cannot be empty' });
      }
      updates.name = name.trim();
    }
    if (color !== undefined) updates.color = color;
    if (icon !== undefined) updates.icon = icon;
    if (description !== undefined) updates.description = description;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.updated_at = new Date().toISOString();

    const { error: updateError } = await supabase
      .from('categories')
      .update(updates)
      .eq('id', categoryId);

    if (updateError) {
      if (updateError.code === '23505') {
        return res.status(409).json({ error: 'A category with this name already exists' });
      }
      throw updateError;
    }

    // Return updated category with video count
    const { data: updated } = await supabase
      .from('categories')
      .select('id, name, color, icon, description, created_at, updated_at, video_categories(count)')
      .eq('id', categoryId)
      .single();

    const result = updated ? {
      ...updated,
      video_count: (updated as any).video_categories?.[0]?.count ?? 0,
      video_categories: undefined,
    } : null;
    if (result) delete result.video_categories;

    return res.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Error updating category:', message);
    return res.status(500).json({ error: `Failed to update category: ${message}` });
  }
}

async function handleDelete(req: VercelRequest, res: VercelResponse) {
  try {
    const categoryId = parseInt(req.query.id as string);

    const { data: existing, error: existError } = await supabase
      .from('categories')
      .select('*')
      .eq('id', categoryId)
      .single();

    if (existError || !existing) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', categoryId);

    if (error) throw error;

    return res.json({ success: true, deleted: existing });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Error deleting category:', message);
    return res.status(500).json({ error: `Failed to delete category: ${message}` });
  }
}
