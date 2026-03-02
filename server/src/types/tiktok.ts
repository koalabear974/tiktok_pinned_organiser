export interface TikTokApiResponse {
  cursor: number;
  extra: Record<string, unknown>;
  hasMore: boolean;
  itemList: TikTokItem[];
  total: number;
  statusCode: number;
  status_code?: number;
  status_msg?: string;
  log_pb?: Record<string, unknown>;
}

export interface TikTokAuthor {
  id: string;
  uniqueId: string;
  nickname: string;
  avatarThumb: string;
  avatarMedium?: string;
  avatarLarger?: string;
  signature?: string;
  verified?: boolean;
  secret?: boolean;
  privateAccount?: boolean;
  commentSetting?: number;
  downloadSetting?: number;
  duetSetting?: number;
  stitchSetting?: number;
  ftc?: boolean;
  relation?: number;
  openFavorite?: boolean;
  secUid?: string;
  isADVirtual?: boolean;
  isEmbedBanned?: boolean;
}

export interface TikTokMusic {
  id: string;
  title: string;
  authorName: string;
  duration: number;
  original: boolean;
  playUrl?: string;
  coverLarge?: string;
  coverMedium?: string;
  coverThumb?: string;
  isCopyrighted?: boolean;
  is_commerce_music?: boolean;
  is_unlimited_music?: boolean;
  private?: boolean;
  shoot_duration?: number;
}

export interface TikTokVideo {
  id: string;
  videoID: string;
  cover: string;
  duration: number;
  width: number;
  height: number;
  ratio: string;
  format: string;
  originCover?: string;
  dynamicCover?: string;
  playAddr?: string;
  downloadAddr?: string;
  bitrate?: number;
  size?: number;
  definition?: string;
  codecType?: string;
  encodedType?: string;
  videoQuality?: string;
  VQScore?: string;
  zoomCover?: Record<string, string>;
  bitrateInfo?: unknown[];
  subtitleInfos?: unknown[];
}

export interface TikTokStats {
  playCount: number;
  diggCount: number;
  commentCount: number;
  shareCount: number;
  collectCount: number;
}

export interface TikTokChallenge {
  id: string;
  title: string;
  desc?: string;
  coverLarger?: string;
  coverMedium?: string;
  coverThumb?: string;
  profileLarger?: string;
  profileMedium?: string;
  profileThumb?: string;
}

export interface TikTokPoi {
  id: string;
  name: string;
  address: string;
  city: string;
  category: string;
  cityCode?: string;
  country?: string;
  countryCode?: string;
  fatherPoiId?: string;
  fatherPoiName?: string;
  province?: string;
  type?: number;
  typeCode?: string;
  ttTypeCode?: string;
  ttTypeNameMedium?: string;
  ttTypeNameSuper?: string;
  ttTypeNameTiny?: string;
}

export interface TikTokImagePost {
  cover?: {
    imageHeight: number;
    imageWidth: number;
    imageURL?: { urlList: string[] };
  };
  images?: Array<{
    imageHeight: number;
    imageWidth: number;
    imageURL?: { urlList: string[] };
  }>;
  shareCover?: {
    imageHeight: number;
    imageWidth: number;
    imageURL?: { urlList: string[] };
    title?: string;
  };
}

export interface TikTokContent {
  desc: string;
  textExtra?: Array<{
    hashtagName?: string;
    type?: number;
    start?: number;
    end?: number;
  }>;
}

export interface TikTokItem {
  id: string;
  desc: string;
  createTime: number;
  CategoryType: number;
  author: TikTokAuthor;
  music: TikTokMusic;
  video: TikTokVideo;
  stats: TikTokStats;
  challenges?: TikTokChallenge[];
  poi?: TikTokPoi | null;
  textLanguage?: string;
  contents?: TikTokContent[];
  imagePost?: TikTokImagePost | null;
  collected?: boolean;
  digged?: boolean;
  isAd?: boolean;
  isReviewing?: boolean;
  forFriend?: boolean;
  secret?: boolean;
  privateItem?: boolean;
  duetEnabled?: boolean;
  stitchEnabled?: boolean;
  shareEnabled?: boolean;
  duetDisplay?: number;
  stitchDisplay?: number;
  itemCommentStatus?: number;
  officalItem?: boolean;
  originalItem?: boolean;
  AIGCDescription?: string;
  IsHDBitrate?: boolean;
  diversificationId?: number;
  textExtra?: unknown[];
  authorStats?: Record<string, unknown>;
  authorStatsV2?: Record<string, unknown>;
  statsV2?: Record<string, unknown>;
  item_control?: Record<string, unknown>;
  backendSourceEventTracking?: string;
  creatorAIComment?: Record<string, unknown>;
}
