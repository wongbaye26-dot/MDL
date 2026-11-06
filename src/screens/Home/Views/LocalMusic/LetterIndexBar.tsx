import { memo, useEffect, useRef } from 'react'
import { Animated, TouchableOpacity, View } from 'react-native'

import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'

/**
 * 右侧 A-Z 首字母「定位 + 高亮」栏（本地音乐列表）。
 *
 * - 不再做筛选：点字母只把列表滚动到该字母第一首；
 * - 列表滚动时高亮当前首字母（缩放 + 透明度 spring 动效）；
 * - '#' = 数字/符号/无法识别拼音的歌。
 */
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

const LetterItem = memo(({ letter, active, onPress }: {
  letter: string
  active: boolean
  onPress: (letter: string) => void
}) => {
  const theme = useTheme()
  const anim = useRef(new Animated.Value(active ? 1 : 0)).current

  useEffect(() => {
    Animated.spring(anim, {
      toValue: active ? 1 : 0,
      useNativeDriver: true,
      speed: 22,
      bounciness: 7,
    }).start()
  }, [active, anim])

  return (
    <TouchableOpacity
      style={styles.item}
      activeOpacity={0.6}
      onPress={() => { onPress(letter) }}
      accessibilityRole='button'
      accessibilityLabel={`跳到首字母 ${letter}`}
      accessibilityState={{ selected: active }}
    >
      <Animated.View
        style={{
          opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }),
          transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.3] }) }],
        }}
      >
        <Text
          size={9}
          color={active ? theme['c-primary'] : theme['c-450']}
          style={active ? styles.activeText : undefined}
        >
          {letter}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  )
})

export default memo(({
  active,
  onSelect,
}: {
  active: string | null
  onSelect: (letter: string) => void
}) => {
  return (
    <View style={styles.wrap} pointerEvents='box-none'>
      <View style={styles.inner}>
        {
          [...LETTERS, '#'].map(letter => (
            <LetterItem key={letter} letter={letter} active={active === letter} onPress={onSelect} />
          ))
        }
      </View>
    </View>
  )
})

const styles = createStyle({
  wrap: {
    position: 'absolute',
    right: 2,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  inner: {
    borderRadius: 10,
    paddingTop: 4,
    paddingBottom: 4,
    paddingLeft: 2,
    paddingRight: 2,
  },
  item: {
    height: 13,
    minWidth: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeText: {
    fontWeight: '700',
  },
})
