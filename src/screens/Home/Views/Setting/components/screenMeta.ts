import type { SettingScreenIds } from '../Main'

/**
 * 设置分类的图标与主题色（首页列表 / 横屏左侧导航共用，保证两处图标一致）。
 * 颜色只用于图标底的 18% 透明度叠加，跟随各分类保持原有彩色识别度。
 */
export const SCREEN_META: Record<SettingScreenIds, { icon: string, color: string }> = {
  playback: { icon: 'play', color: '#EC4899' },
  lyric: { icon: 'lyric-on', color: '#8B5CF6' },
  appearance: { icon: 'palette-outline', color: '#A855F7' },
  library: { icon: 'folder-music', color: '#F97316' },
  sourcesearch: { icon: 'database-search-outline', color: '#3B82F6' },
  download: { icon: 'download-2', color: '#F59E0B' },
  system: { icon: 'shield-check-outline', color: '#64748B' },
  misc: { icon: 'dots-horizontal-circle-outline', color: '#10B981' },
}

export interface ScreenGroup {
  title: string
  ids: SettingScreenIds[]
  icon: string
  color: string
}

/**
 * 设置首页分组：8 个入口拆成 3 张 Section 卡，组标题/卡片/行间距与子设置页完全一致。
 * 顺序即设置首页展示顺序（不能改动）：播放 → 下载 → 音源 → 搜索与列表 → 工具 → 基本 → 其他 → 关于。
 */
export const SCREEN_GROUPS: ScreenGroup[] = [
  { title: '播放与显示', ids: ['playback', 'lyric'], icon: 'play-circle-outline', color: '#EC4899' },
  { title: '界面与曲库', ids: ['appearance', 'library', 'sourcesearch'], icon: 'view-grid-outline', color: '#8B5CF6' },
  { title: '下载与系统', ids: ['download', 'system', 'misc'], icon: 'cog', color: '#10B981' },
]
