import { View } from 'react-native'

import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'

/**
 * 列表页共用的空态。
 *
 * 排行榜 / 歌单广场 / 歌单详情 三个页面用同一套「圆角图标底 + 标题 + 说明」，
 * 颜色全部走主题 token（c-primary-alpha-900 / c-400 / c-450），深浅主题都成立。
 */
export default ({ icon = 'music-note-off', title, tip }: {
  icon?: string
  title: string
  tip?: string
}) => {
  const theme = useTheme()

  return (
    <View style={styles.wrap}>
      <View style={{
        ...styles.iconWrap,
        backgroundColor: theme['c-primary-alpha-900'],
        borderColor: theme['c-primary-alpha-800'],
      }}>
        <Icon name={icon} size={26} color={theme['c-400']} />
      </View>
      <Text size={14} style={styles.title}>{title}</Text>
      {tip ? <Text size={11} color={theme['c-450']} style={styles.tip}>{tip}</Text> : null}
    </View>
  )
}

const styles = createStyle({
  wrap: {
    alignItems: 'center',
    paddingTop: 64,
    paddingLeft: 24,
    paddingRight: 24,
    paddingBottom: 24,
  },
  iconWrap: {
    width: 58,
    height: 58,
    borderRadius: 20,
    borderWidth: 0.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    marginTop: 14,
    fontWeight: '600',
  },
  tip: {
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 18,
  },
})
