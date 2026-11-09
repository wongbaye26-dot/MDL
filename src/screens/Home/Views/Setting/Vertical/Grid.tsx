import { View } from 'react-native'

import { ThemeSection, PlayerInteractionSection } from '../settings/Refactored/Appearance'
import { PlaybackSection, AudioQualitySection } from '../settings/Refactored/Playback'
import Lyric from '../settings/Refactored/Lyric'
import Library from '../settings/Refactored/Library'
import System from '../settings/Refactored/System'
import { DataSection, AboutSection } from '../settings/Refactored/Misc'
import { createStyle } from '@/utils/tools'
import { Space } from '@/theme/designTokens'
import { type SettingScreenIds } from '../Main'

/**
 * 设置首页（扁平分组）。顺序：主题与外观 → 播放器与交互 → 播放设置 →
 * 音质与音效 → 歌词设置 → 本地音乐 → 通知与系统 → 数据与存储 → 关于与版本。
 *
 * 音源管理 / 曲库工具 / 下载管理 都有独立页面，通过页头图标进入，不在设置列表里重复。
 */
export default ({ onPress }: { onPress: (id: SettingScreenIds) => void }) => (
  <View style={styles.container}>
    <ThemeSection />
    <PlayerInteractionSection />
    <PlaybackSection />
    <AudioQualitySection />
    <Lyric />
    <Library />
    <System />
    <DataSection />
    <AboutSection />
  </View>
)

const styles = createStyle({
  container: { paddingLeft: Space.lg, paddingRight: Space.lg, paddingTop: Space.sm },
})
