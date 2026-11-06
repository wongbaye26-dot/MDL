import { Animated, Easing, View, Image } from 'react-native'
import { useEffect, useRef } from 'react'

import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { useStatusbarHeight } from '@/store/common/hook'
import { useHorizontalMode, useReducedMotion } from '@/utils/hooks'
import Text from '@/components/common/Text'
import { SETTINGS_HEADER_COMPACT_H, SETTINGS_HEADER_H } from '../Setting/components/headerMetrics'
import Setting from '../Setting'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const emoLogo = require('@/resources/images/emo-logo.png')

/**
 * 「我的」页头：品牌 logo + 大标题 + 副标题。
 * 只改设置入口的页头视觉，和设置页共用同一层渐变背景；不新增登录/账号入口。
 */
export default () => {
  const theme = useTheme()
  // 页头 logo 光晕的呼吸：无动效页面里最轻的一层反馈，reduce-motion 时保持静态
  const reduced = useReducedMotion()
  const glow = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (reduced) {
      glow.setValue(0.5)
      return
    }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(glow, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(glow, { toValue: 0, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]))
    loop.start()
    return () => { loop.stop() }
  }, [glow, reduced])
  const statusBarHeight = useStatusbarHeight()
  const compact = useHorizontalMode()
  const headerH = compact ? SETTINGS_HEADER_COMPACT_H : SETTINGS_HEADER_H
  // 横屏下 statusbarHeight 报 0，但时钟浮在左上角，页头要自己让出一条
  const topInset = statusBarHeight > 0 ? statusBarHeight : (compact ? 20 : 0)

  return (
    <View style={styles.container}>
      <View style={{
        ...styles.header,
        height: topInset + headerH,
        paddingTop: topInset + (compact ? 7 : 12),
      }}>
        <View style={styles.logoWrap}>
          <Animated.View style={[
            styles.logoGlow,
            {
              backgroundColor: theme['c-primary'],
              opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.14, 0.26] }),
              transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.06] }) }],
            },
          ]} />
          <Image source={emoLogo} style={compact ? styles.logoCompact : styles.logo} />
        </View>
        <View style={styles.titleArea}>
          <Text size={compact ? 21 : 27} numberOfLines={1} style={styles.title}>我的</Text>
          <Text size={compact ? 10 : 11.5} color={theme['c-450']} numberOfLines={1} style={styles.subtitle}>
            EMO Music · 享受音乐，遇见更好的自己
          </Text>
        </View>
      </View>
      <View style={styles.setting}>
        <Setting />
      </View>
    </View>
  )
}

const styles = createStyle({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 20,
    paddingRight: 20,
  },
  logoWrap: {
    width: 54,
    height: 54,
    borderRadius: 17,
    marginRight: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoGlow: {
    position: 'absolute',
    width: 52,
    height: 52,
    borderRadius: 18,
    transform: [{ scale: 1.16 }],
    opacity: 0.85,
  },
  logo: {
    width: 52,
    height: 52,
    borderRadius: 16,
  },
  logoCompact: {
    width: 44,
    height: 44,
    borderRadius: 14,
  },
  titleArea: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  title: {
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  subtitle: {
    marginTop: 5,
    letterSpacing: 0.2,
  },
  setting: {
    flex: 1,
  },
})
