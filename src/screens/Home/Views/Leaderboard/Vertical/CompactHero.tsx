import { memo, useEffect, useReducer } from 'react'
import { TouchableOpacity, View } from 'react-native'

import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import { getLeaderboardHero, subscribeLeaderboardHero } from '@/utils/leaderboardHero'
import HeaderSourceBar from './HeaderSourceBar'

/**
 * 排行榜页头右侧的紧凑操作组。
 *
 * 之前这里是一张「当前榜单 + 共 N 首 + 播放 + 下载」的卡片，和下面两排筛选胶囊
 * 挤在一起（榜单名在胶囊里已经高亮，状态信息重复）。现在标题右侧只留两个
 * 38dp 圆形按钮：播放当前榜单 / 下载当前榜单；榜单名与歌曲数交给下面的胶囊。
 *
 * 样式对齐本地音乐 / 下载中心的页头操作组：38dp 圆形、icon 20、主色淡底、
 * 按钮间距 6，保证各页头看起来是同一套控件。
 */
export default memo(() => {
  const theme = useTheme()
  const [, forceUpdate] = useReducer((n: number) => n + 1, 0)
  const state = getLeaderboardHero()

  useEffect(() => subscribeLeaderboardHero(forceUpdate), [])

  // 榜单还没加载出来（name 为空）时按钮置灰不可点，避免按钮消失导致标题栏跳动
  const enabled = !!state.name

  return (
    <View style={styles.actions}>
      {/* 来源图标组：和播放/下载同一水平线、同一行居中；多选时会自动隐藏 */}
      <HeaderSourceBar />
      <TouchableOpacity
        style={{
          ...styles.btn,
          backgroundColor: theme['c-primary-alpha-900'],
          opacity: enabled ? 1 : 0.45,
        }}
        activeOpacity={0.8}
        disabled={!enabled}
        onPress={() => { state.onPlayAll?.() }}
      >
        <Icon name='play' size={20} color={theme['c-font']} />
      </TouchableOpacity>
      <TouchableOpacity
        style={{
          ...styles.btn,
          backgroundColor: theme['c-primary-alpha-900'],
          opacity: enabled ? 1 : 0.45,
        }}
        activeOpacity={0.8}
        disabled={!enabled}
        onPress={() => { state.onDownloadAll?.() }}
      >
        <Icon name='download-2' size={20} color={theme['c-font']} />
      </TouchableOpacity>
    </View>
  )
})

const styles = createStyle({
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  btn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    marginLeft: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
})
