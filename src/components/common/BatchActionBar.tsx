import { memo, useEffect, useRef } from 'react'
import { Animated, Easing, TouchableOpacity, View } from 'react-native'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'

export interface BatchBarAction {
  key: string
  label: string
  icon: string
  /** 危险操作用红色图标/文字 */
  color?: string
  onPress: () => void
}

/**
 * 批量管理底部操作条（本地音乐 / 下载中心共用）。
 *
 * 设计目标：
 * - 批量模式下把底部胶囊导航收起（调用方 useOverlayLock），操作条和胶囊同位置、同样的悬浮语言，
 *   不再出现「操作条浮在内容中间、胶囊在下面」的双层底栏；
 * - 左侧固定「已选 N」，中间操作按钮等分，右侧单独关闭按钮，避免先前 6 个按钮挤在一起、
 *   「已选 2」被挤成竖排的问题；
 * - 入场做 200ms 上浮 + 淡入，和 App 其它浮层一致。
 */
export default memo(({ count, actions, onExit }: {
  count: number
  actions: readonly BatchBarAction[]
  onExit: () => void
}) => {
  const theme = useTheme()
  const anim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start()
  }, [anim])

  return (
    <Animated.View
      style={[
        styles.wrap,
        {
          backgroundColor: theme['c-content-background'],
          borderColor: theme['c-primary-alpha-700'],
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) }],
        },
      ]}
    >
      <View style={styles.countWrap}>
        <Text size={11.5} color={theme['c-primary']} numberOfLines={1} style={styles.count}>{`已选 ${count}`}</Text>
      </View>
      <View style={[styles.divider, { backgroundColor: theme['c-primary-alpha-700'] }]} />
      <View style={styles.actions}>
        {actions.map(action => (
          <TouchableOpacity
            key={action.key}
            style={styles.action}
            activeOpacity={0.7}
            onPress={action.onPress}
            accessibilityRole='button'
            accessibilityLabel={action.label}
          >
            <Icon name={action.icon} size={20} color={action.color ?? theme['c-font']} />
            <Text size={10.5} color={action.color ?? theme['c-450']} numberOfLines={1} style={styles.label}>{action.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity
        style={styles.exit}
        activeOpacity={0.7}
        onPress={onExit}
        accessibilityRole='button'
        accessibilityLabel='退出批量选择'
      >
        <Icon name='close' size={20} color={theme['c-450']} />
      </TouchableOpacity>
    </Animated.View>
  )
})

const styles = createStyle({
  wrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 14,
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 22,
    borderWidth: 0.5,
    paddingLeft: 10,
    paddingRight: 6,
    elevation: 18,
    shadowColor: '#000000',
    shadowOpacity: 0.24,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    zIndex: 20,
  },
  countWrap: {
    width: 58,
    alignItems: 'center',
    justifyContent: 'center',
  },
  count: {
    textAlign: 'center',
  },
  divider: {
    width: 1,
    height: 28,
    borderRadius: 0.5,
    marginRight: 4,
  },
  actions: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
  },
  action: {
    minWidth: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    marginTop: 3,
  },
  exit: {
    width: 36,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
