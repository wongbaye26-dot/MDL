import { useRef } from 'react'
import { ScrollView, View } from 'react-native'

import NavList from './NavList'
import Main, { type MainType } from '../Main'
import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { NAV_BAR_SPACE } from '@/config/constant'
import { getCardBackground, getCardBorder, getCardShadow } from '../components/surfaces'

/**
 * 横屏设置：左边是分组导航卡片（和竖屏的设置宫格同一套卡片语言），右边是具体设置项。
 */
export default () => {
  const theme = useTheme()
  const mainRef = useRef<MainType>(null)

  return (
    <View style={styles.container}>
      <View
        style={{
          ...styles.nav,
          backgroundColor: getCardBackground(theme),
          borderColor: getCardBorder(theme),
          ...getCardShadow(theme),
        }}
      >
        <NavList onChangeId={(id) => mainRef.current?.setActiveId(id)} />
      </View>
      <ScrollView
        style={styles.mainScroll}
        contentContainerStyle={styles.main}
        keyboardShouldPersistTaps='always'
      >
        <Main ref={mainRef} />
      </ScrollView>
    </View>
  )
}

const styles = createStyle({
  container: {
    flex: 1,
    flexDirection: 'row',
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 2,
  },
  nav: {
    width: '30%',
    maxWidth: 200,
    marginRight: 14,
    marginBottom: 8,
    borderRadius: 22,
    borderWidth: 0.8,
    paddingTop: 8,
    paddingBottom: 8,
    overflow: 'hidden',
  },
  mainScroll: {
    flex: 1,
  },
  main: {
    paddingBottom: NAV_BAR_SPACE,
  },
})
