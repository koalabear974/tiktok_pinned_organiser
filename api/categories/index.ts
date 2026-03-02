import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../_lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    return handleGet(req, res);
  }
  if (req.method === 'POST') {
    return handlePost(req, res);
  }
  return res.status(405).json({ error: 'Method not allowed' });
}

async function handleGet(_req: VercelRequest, res: VercelResponse) {
  try {
    // Get categories with video counts via a left join
    const { data, error } = await supabase
      .from('categories')
      .select('id, name, color, icon, description, created_at, updated_at, video_categories(count)')
      .order('name', { ascending: true });

    if (error) throw error;

    const categories = (data || []).map((c: any) => ({
      id: c.id,
      name: c.name,
      color: c.color,
      icon: c.icon,
      description: c.description,
      created_at: c.created_at,
      updated_at: c.updated_at,
      video_count: c.video_categories?.[0]?.count ?? 0,
    }));

    return res.json({ categories });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Error fetching categories:', message);
    return res.status(500).json({ error: `Failed to fetch categories: ${message}` });
  }
}

async function handlePost(req: VercelRequest, res: VercelResponse) {
  try {
    const { name, color, icon, description } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Category name is required' });
    }

    const { data, error } = await supabase
      .from('categories')
      .insert({
        name: name.trim(),
        color: color || '#6366f1',
        icon: icon || null,
        description: description || null,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'A category with this name already exists' });
      }
      throw error;
    }

    return res.status(201).json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Error creating category:', message);
    return res.status(500).json({ error: `Failed to create category: ${message}` });
  }
}
