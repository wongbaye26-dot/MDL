import type { SettingScreenIds } from '../Main'

/**
 * 设置分类的图标与主题色（首页列表 / 横屏左侧导航共用，保证两处图标一致）。
 * 颜色只用于图标底的 18% 透明度叠加，跟随各分类保持原有彩色识别度。
 */
export const SCREEN_META: Record<SettingScreenIds, { icon: string, color: string }> = {
  player: { icon: 'play', color: '#EC4899' },
  download: { icon: 'download-2', color: '#F59E0B' },
  source: { icon: 'script-text-outline', color: '#6366F1' },
  searchlist: { icon: 'search-2', color: '#3B82F6' },
  tools: { icon: 'wrench', color: '#F97316' },
  basic: { icon: 'setting', color: '#8B5CF6' },
  other: { icon: 'slider', color: '#64748B' },
  about: { icon: 'help', color: '#10B981' },
}

export interface ScreenGroup {
  title: string
  ids: SettingScreenIds[]
}

/**
 * 设置首页分组：8 个入口拆成 3 张 Section 卡，组标题/卡片/行间距与子设置页完全一致。
 * 顺序即设置首页展示顺序（不能改动）：播放 → 下载 → 音源 → 搜索与列表 → 工具 → 基本 → 其他 → 关于。
 */
export const SCREEN_GROUPS: ScreenGroup[] = [
  { title: '播放与下载', ids: ['player', 'download'] },
  { title: '内容与工具', ids: ['source', 'searchlist', 'tools'] },
  { title: '系统与关于', ids: ['basic', 'other', 'about'] },
]
