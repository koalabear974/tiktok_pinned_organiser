import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './_lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { data, error } = await supabase
      .from('imports')
      .select('id, filename, cursor_value, items_count, total_reported, has_more, imported_at')
      .order('imported_at', { ascending: false });

    if (error) throw error;

    return res.json({ imports: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Error fetching imports:', message);
    return res.status(500).json({ error: `Failed to fetch imports: ${message}` });
  }
}
