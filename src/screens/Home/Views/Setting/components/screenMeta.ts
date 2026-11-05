import type { SettingScreenIds } from '../Main'

/**
 * 设置分类的图标与主题色（首页列表 / 横屏左侧导航共用，保证两处图标一致）。
 * 颜色只用于 36dp 图标底的 18% 透明度叠加，跟随各分类保持原有彩色识别度。
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
