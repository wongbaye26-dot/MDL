import { memo, useMemo } from 'react'
import { TouchableOpacity, View } from 'react-native'

import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'

/**
 * 右侧 A-Z 首字母筛选栏（本地音乐列表）。
 *
 * - 点字母：只看该字母开头的歌；再点同一个字母取消筛选；
 * - 传 `available` 时，没有歌的字母置灰不可点；
 * - '#' = 数字/符号/无法识别拼音的歌。
 *
 * 无障碍：每个字母都是 button，带选中状态；整栏不参与滚动。
 */
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

export default memo(({
  active,
  available,
  onSelect,
}: {
  active: string | null
  available?: Set<string>
  onSelect: (letter: string | null) => void
}) => {
  const theme = useTheme()
  const letters = useMemo(() => [...LETTERS, '#'], [])

  return (
    <View style={styles.wrap} pointerEvents='box-none'>
      <View style={styles.inner}>
        {
          letters.map(letter => {
            const isActive = active === letter
            const disabled = !!available && !available.has(letter)
            return (
              <TouchableOpacity
                key={letter}
                style={styles.item}
                activeOpacity={0.6}
                disabled={disabled}
                onPress={() => { onSelect(isActive ? null : letter) }}
                accessibilityRole='button'
                accessibilityState={{ selected: isActive, disabled }}
                accessibilityLabel={`按首字母 ${letter} 筛选`}
              >
                <Text
                  size={9}
                  color={isActive ? theme['c-primary'] : (disabled ? theme['c-350'] : theme['c-450'])}
                  style={isActive ? styles.activeText : undefined}
                >
                  {letter}
                </Text>
              </TouchableOpacity>
            )
          })
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
