import fs from 'fs';
import path from 'path';
import db from '../db/connection';
import { TikTokApiResponse, TikTokItem } from '../types/tiktok';

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

export class ImportService {
  private insertVideo!: ReturnType<typeof db.prepare>;
  private insertHashtag!: ReturnType<typeof db.prepare>;
  private insertVideoHashtag!: ReturnType<typeof db.prepare>;
  private insertImport!: ReturnType<typeof db.prepare>;
  private initialized = false;

  private ensureInitialized() {
    if (this.initialized) return;
    this.insertVideo = db.prepare(`
      INSERT OR IGNORE INTO videos (
        id, video_id, description, create_time, duration, width, height,
        ratio, format, is_image_post, image_count, category_type,
        author_id, author_unique_id, author_nickname, author_avatar_url,
        music_id, music_title, music_author, music_duration, music_is_original,
        play_count, digg_count, comment_count, share_count, collect_count,
        poi_id, poi_name, poi_address, poi_city, poi_category,
        thumbnail_path, text_language, raw_json, save_order
      ) VALUES (
        @id, @video_id, @description, @create_time, @duration, @width, @height,
        @ratio, @format, @is_image_post, @image_count, @category_type,
        @author_id, @author_unique_id, @author_nickname, @author_avatar_url,
        @music_id, @music_title, @music_author, @music_duration, @music_is_original,
        @play_count, @digg_count, @comment_count, @share_count, @collect_count,
        @poi_id, @poi_name, @poi_address, @poi_city, @poi_category,
        @thumbnail_path, @text_language, @raw_json, @save_order
      )
    `);
    this.insertHashtag = db.prepare(`
      INSERT OR IGNORE INTO hashtags (id, title) VALUES (@id, @title)
    `);
    this.insertVideoHashtag = db.prepare(`
      INSERT OR IGNORE INTO video_hashtags (video_id, hashtag_id) VALUES (@video_id, @hashtag_id)
    `);
    this.insertImport = db.prepare(`
      INSERT INTO imports (filename, cursor_value, items_count, total_reported, has_more)
      VALUES (@filename, @cursor_value, @items_count, @total_reported, @has_more)
    `);
    this.initialized = true;
  }

  importFromJson(filePath: string): ImportResult {
    this.ensureInitialized();
    const rawData = fs.readFileSync(filePath, 'utf-8');
    const data: TikTokApiResponse = JSON.parse(rawData);

    const itemList = data.itemList;
    if (!itemList || !Array.isArray(itemList)) {
      return { imported: 0, skipped: 0, errors: ['No itemList found in JSON data'] };
    }

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    const importMany = db.transaction(() => {
      // Get current max save_order so new items continue the sequence.
      // Items in JSON are ordered most-recently-saved first, so item[0]
      // gets the highest save_order value.
      const maxRow = db.prepare('SELECT COALESCE(MAX(save_order), 0) as max_order FROM videos').get() as { max_order: number };
      let nextOrder = maxRow.max_order + itemList.length;

      for (const item of itemList) {
        try {
          const isImagePost = item.imagePost != null;
          const imageCount = isImagePost && item.imagePost?.images
            ? item.imagePost.images.length
            : 0;

          const coverUrl = isImagePost && item.imagePost?.cover?.imageURL?.urlList?.[0]
            ? item.imagePost.cover.imageURL.urlList[0]
            : item.video?.cover || null;

          const result = this.insertVideo.run({
            id: item.id,
            video_id: item.video?.videoID || null,
            description: item.desc || '',
            create_time: item.createTime,
            duration: item.video?.duration || 0,
            width: item.video?.width || 0,
            height: item.video?.height || 0,
            ratio: item.video?.ratio || '',
            format: item.video?.format || '',
            is_image_post: isImagePost ? 1 : 0,
            image_count: imageCount,
            category_type: item.CategoryType ?? null,
            author_id: item.author?.id || null,
            author_unique_id: item.author?.uniqueId || null,
            author_nickname: item.author?.nickname || null,
            author_avatar_url: item.author?.avatarThumb || null,
            music_id: item.music?.id || null,
            music_title: item.music?.title || null,
            music_author: item.music?.authorName || null,
            music_duration: item.music?.duration || 0,
            music_is_original: item.music?.original ? 1 : 0,
            play_count: item.stats?.playCount || 0,
            digg_count: item.stats?.diggCount || 0,
            comment_count: item.stats?.commentCount || 0,
            share_count: item.stats?.shareCount || 0,
            collect_count: item.stats?.collectCount || 0,
            poi_id: item.poi?.id || null,
            poi_name: item.poi?.name || null,
            poi_address: item.poi?.address || null,
            poi_city: item.poi?.city || null,
            poi_category: item.poi?.category || null,
            thumbnail_path: null,
            text_language: item.textLanguage || null,
            raw_json: JSON.stringify(item),
            save_order: nextOrder,
          });

          if (result.changes > 0) {
            imported++;
          } else {
            skipped++;
          }
          nextOrder--;

          // Insert hashtags from challenges
          if (item.challenges && Array.isArray(item.challenges)) {
            for (const challenge of item.challenges) {
              this.insertHashtag.run({
                id: challenge.id,
                title: challenge.title,
              });
              this.insertVideoHashtag.run({
                video_id: item.id,
                hashtag_id: challenge.id,
              });
            }
          }
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          errors.push(`Error importing item ${item.id}: ${message}`);
        }
      }

      // Record the import
      this.insertImport.run({
        filename: path.basename(filePath),
        cursor_value: data.cursor ?? null,
        items_count: itemList.length,
        total_reported: data.total ?? null,
        has_more: data.hasMore ? 1 : 0,
      });
    });

    importMany();

    return { imported, skipped, errors };
  }

  /**
   * Returns a list of all videos with their cover URLs for thumbnail downloading.
   */
  getVideosForThumbnails(): Array<{ id: string; coverUrl: string }> {
    const rows = db.prepare(`
      SELECT id, raw_json FROM videos WHERE thumbnail_path IS NULL
    `).all() as Array<{ id: string; raw_json: string }>;

    return rows.map((row) => {
      try {
        const item: TikTokItem = JSON.parse(row.raw_json);
        const isImagePost = item.imagePost != null;
        const coverUrl = isImagePost && item.imagePost?.cover?.imageURL?.urlList?.[0]
          ? item.imagePost.cover.imageURL.urlList[0]
          : item.video?.cover || '';
        return { id: row.id, coverUrl };
      } catch {
        return { id: row.id, coverUrl: '' };
      }
    }).filter((v) => v.coverUrl !== '');
  }
}

export default new ImportService();
