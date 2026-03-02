import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './_lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const data = req.body;

    if (!data || !data.itemList || !Array.isArray(data.itemList)) {
      return res.status(400).json({ error: 'Invalid JSON: expected { itemList: [...] }' });
    }

    const itemList = data.itemList;
    const BATCH_SIZE = 500;
    let totalImported = 0;
    let totalSkipped = 0;
    const allErrors: string[] = [];

    // Process in batches to stay within Supabase limits
    for (let i = 0; i < itemList.length; i += BATCH_SIZE) {
      const batch = itemList.slice(i, i + BATCH_SIZE);

      const { data: result, error } = await supabase.rpc('import_videos', {
        p_items: batch,
        p_filename: data.filename || 'upload.json',
        p_cursor: data.cursor ?? null,
        p_total: data.total ?? null,
        p_has_more: data.hasMore ?? false,
      });

      if (error) throw error;

      totalImported += result.imported;
      totalSkipped += result.skipped;
      if (result.errors && result.errors.length > 0) {
        allErrors.push(...result.errors);
      }
    }

    return res.json({
      success: true,
      imported: totalImported,
      skipped: totalSkipped,
      errors: allErrors,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Import error:', message);
    return res.status(500).json({ error: `Import failed: ${message}` });
  }
}
