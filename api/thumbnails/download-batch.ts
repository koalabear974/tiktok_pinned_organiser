import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../_lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { videoIds } = req.body;

    if (!Array.isArray(videoIds) || videoIds.length === 0) {
      return res.status(400).json({ error: 'videoIds must be a non-empty array' });
    }

    // Limit batch size to prevent timeout
    const ids = videoIds.slice(0, 10);

    // Get videos that need thumbnails
    const { data: videos, error: fetchError } = await supabase
      .from('videos')
      .select('id, raw_json')
      .in('id', ids)
      .is('thumbnail_url', null);

    if (fetchError) throw fetchError;

    let downloaded = 0;
    let failed = 0;

    for (const video of videos || []) {
      try {
        const coverUrl = extractCoverUrl(video.raw_json);
        if (!coverUrl) {
          failed++;
          continue;
        }

        // Fetch image from TikTok CDN
        const imageResponse = await fetch(coverUrl, {
          redirect: 'follow',
          signal: AbortSignal.timeout(10000),
        });

        if (!imageResponse.ok) {
          failed++;
          continue;
        }

        const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
        const buffer = Buffer.from(await imageResponse.arrayBuffer());

        // Upload to Supabase Storage
        const filename = `${video.id}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from('thumbnails')
          .upload(filename, buffer, {
            contentType,
            upsert: true,
          });

        if (uploadError) {
          console.error(`Upload error for ${video.id}:`, uploadError.message);
          failed++;
          continue;
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('thumbnails')
          .getPublicUrl(filename);

        // Update video record
        await supabase
          .from('videos')
          .update({
            thumbnail_url: urlData.publicUrl,
            thumbnail_cached_at: new Date().toISOString(),
          })
          .eq('id', video.id);

        downloaded++;
      } catch (err) {
        console.error(`Failed to download thumbnail for ${video.id}:`, err);
        failed++;
      }
    }

    // Count remaining videos without thumbnails
    const { count: remaining } = await supabase
      .from('videos')
      .select('id', { count: 'exact', head: true })
      .is('thumbnail_url', null);

    return res.json({ downloaded, failed, remaining: remaining ?? 0 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Thumbnail batch download error:', message);
    return res.status(500).json({ error: `Thumbnail download failed: ${message}` });
  }
}

function extractCoverUrl(rawJson: any): string | null {
  if (!rawJson) return null;

  const item = typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson;
  const isImagePost = item.imagePost != null;

  if (isImagePost && item.imagePost?.cover?.imageURL?.urlList?.[0]) {
    return item.imagePost.cover.imageURL.urlList[0];
  }

  return item.video?.cover || null;
}
