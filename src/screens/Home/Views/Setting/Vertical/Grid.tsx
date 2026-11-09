import { View } from 'react-native'

import { useHorizontalMode } from '@/utils/hooks'

import Playback from '../settings/Refactored/Playback'
import Lyric from '../settings/Refactored/Lyric'
import Appearance from '../settings/Refactored/Appearance'
import Library from '../settings/Refactored/Library'
import SourceSearch from '../settings/Refactored/SourceSearch'
import DownloadStorage from '../settings/Refactored/DownloadStorage'
import System from '../settings/Refactored/System'
import Misc from '../settings/Refactored/Misc'
import { createStyle } from '@/utils/tools'
import { Space } from '@/theme/designTokens'
import { type SettingScreenIds } from '../Main'

/**
 * 设置首页（扁平分组，IA 11 组）：
 * 播放设置 / 音质与音效 / 音源与搜索 / 歌词设置 / 本地音乐 / 下载管理 /
 * 主题与外观 / 播放器与交互 / 通知与系统 / 数据与存储 / 关于与版本。
 *
 * 分组顺序即渲染顺序；每个分组是 Group 平铺列表，不再是一张 24dp 大卡。
 * 音源管理 / 曲库工具是深页入口，其余设置直接内联。
 */
export default ({ onPress }: { onPress: (id: SettingScreenIds) => void }) => {
  const horizontal = useHorizontalMode()
  const left = (
    <>
      <Playback />
      <SourceSearch onOpenSource={() => { onPress('sourcesearch') }} />
      <Lyric />
      <Library onOpenTools={() => { onPress('library') }} />
    </>
  )
  const right = (
    <>
      <DownloadStorage />
      <Appearance />
      <System />
      <Misc />
    </>
  )
  // 横屏：两列瀑布式排布，避免单列被拉成整屏宽、右侧大片留白
  if (horizontal) {
    return (
      <View style={styles.twoCols}>
        <View style={styles.col}>{left}</View>
        <View style={styles.col}>{right}</View>
      </View>
    )
  }
  return (
    <View style={styles.container}>
      {left}
      {right}
    </View>
  )
}

const styles = createStyle({
  container: {
    paddingLeft: Space.lg,
    paddingRight: Space.lg,
    paddingTop: Space.sm,
  },
  twoCols: {
    flexDirection: 'row',
    paddingLeft: Space.lg,
    paddingRight: Space.lg,
    paddingTop: Space.sm,
    gap: Space.xl,
  },
  col: {
    flex: 1,
    minWidth: 0,
  },
})
