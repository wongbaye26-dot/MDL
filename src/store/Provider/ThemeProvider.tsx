import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { Animated, Easing, StyleSheet, View } from 'react-native'

import themeState, { ThemeContext } from '../theme/state'


export default memo(({ children }: {
  children: React.ReactNode
}) => {
  const [theme, setTheme] = useState(themeState.theme)
  const fade = useRef(new Animated.Value(0)).current
  const [fadeColor, setFadeColor] = useState<string | null>(null)

  const handleUpdateTheme = useCallback((next: LX.ActiveTheme) => {
    // 同步提交，避免 rAF 延迟期间新旧主题混用造成闪屏
    setTheme(next)
    // 主题切换时盖一层「新主题底色」再淡出：
    // 重渲染那一瞬间哪怕原生层露了底，露出的也是主题色，不会再白屏/黑屏
    setFadeColor(next['c-main-background'])
    fade.stopAnimation()
    fade.setValue(0.94)
    Animated.timing(fade, {
      toValue: 0,
      duration: 240,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setFadeColor(null)
    })
  }, [fade])

  useEffect(() => {
    global.state_event.on('themeUpdated', handleUpdateTheme)
    return () => {
      global.state_event.off('themeUpdated', handleUpdateTheme)
    }
  }, [handleUpdateTheme])

  return (
    <ThemeContext.Provider value={theme}>
      <View style={styles.container}>
        {children}
        {
          fadeColor
            ? (
              <Animated.View
                pointerEvents='none'
                style={[StyleSheet.absoluteFill, { backgroundColor: fadeColor, opacity: fade }]}
              />
              )
            : null
        }
      </View>
    </ThemeContext.Provider>
  )
})

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
})
