import { memo, useEffect, useReducer } from 'react'
import { StyleSheet, TouchableOpacity, View } from 'react-native'

import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { getLeaderboardHero, subscribeLeaderboardHero } from '@/utils/leaderboardHero'

/**
 * 排行榜标题右侧的紧凑「当前榜单」卡片。
 *
 * 原来是标题下方一整张 Hero（名字 + 共 N 首 + 播放全部 + 下载），占掉一行高度；
 * 现在压成标题右侧一小块，列表整体上移。
 */
export default memo(() => {
  const theme = useTheme()
  const [, forceUpdate] = useReducer((n: number) => n + 1, 0)
  const state = getLeaderboardHero()

  useEffect(() => subscribeLeaderboardHero(forceUpdate), [])

  if (!state.name) return null

  return (
    <View style={{
      ...styles.card,
      backgroundColor: theme['c-primary-alpha-900'],
      borderColor: theme['c-primary-alpha-700'],
    }}>
      <View style={styles.info}>
        <Text size={12} numberOfLines={1} style={styles.name}>{state.name}</Text>
        <Text size={9} color={theme['c-450']} numberOfLines={1} style={styles.meta}>{state.meta}</Text>
      </View>
      <TouchableOpacity
        style={{ ...styles.btn, backgroundColor: theme['c-primary'] }}
        activeOpacity={0.85}
        onPress={() => { state.onPlayAll?.() }}
      >
        <Icon name='play' size={12} color='#FFFFFF' />
      </TouchableOpacity>
      <TouchableOpacity
        style={{ ...styles.btn, ...styles.btnGhost, borderColor: theme['c-primary-alpha-600'] }}
        activeOpacity={0.85}
        onPress={() => { state.onDownloadAll?.() }}
      >
        <Icon name='download-2' size={13} color={theme['c-primary']} />
      </TouchableOpacity>
    </View>
  )
})

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 168,
    height: 40,
    paddingLeft: 10,
    paddingRight: 4,
    borderRadius: 20,
    borderWidth: 0.5,
  },
  info: {
    flexGrow: 1,
    flexShrink: 1,
    marginRight: 4,
  },
  name: {
    fontWeight: '700',
  },
  meta: {
    marginTop: 1,
  },
  btn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnGhost: {
    borderWidth: 0.5,
    marginLeft: 4,
    backgroundColor: 'transparent',
  },
})
