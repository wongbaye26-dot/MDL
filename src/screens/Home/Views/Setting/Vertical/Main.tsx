import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Animated, View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native'

import Basic from '../settings/Basic'
import Player from '../settings/Player'
import Search from '../settings/Search'
import List from '../settings/List'
import Download from '../settings/Download'
import Other from '../settings/Other'
import About from '../settings/About'
import Tools from '../settings/Tools'
import { createStyle } from '@/utils/tools'
import { type SettingScreenIds } from '../Main'
import { Icon } from '@/components/common/Icon'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { useStatusbarHeight } from '@/store/common/hook'
import { useHorizontalMode } from '@/utils/hooks'
import SlideInView from '@/components/common/SlideInView'
import Grid from './Grid'
import { NAV_BAR_SPACE, HORIZONTAL_NAV_SPACE } from '@/config/constant'
import { getSolidBackground } from '@/theme/solid'
import { PAGE_HEADER_H } from '@/components/common/PageHeader'
import settingState from '@/store/setting/state'
import type { InitState as CommonState } from '@/store/common/state'
import useSwipeBack from '../useSwipeBack'
import { setNavActiveId } from '@/core/common'

const getSection = (id: SettingScreenIds) => {
  switch (id) {
    case 'player': return <Player />
    case 'search': return <Search />
    case 'list': return <List />
    case 'download': return <Download />
    case 'other': return <Other />
    case 'tools': return <Tools />
    case 'about': return <About />
    case 'basic':
    default: return <Basic />
  }
}

export default () => {
  const theme = useTheme()
  const t = useI18n()
  const statusBarHeight = useStatusbarHeight()
  const [activeId, setActiveId] = useState<SettingScreenIds | null>(null)
  const activeIdRef = useRef<SettingScreenIds | null>(null)
  activeIdRef.current = activeId

  const section = useMemo(() => (activeId ? getSection(activeId) : null), [activeId])

  const handleClose = useCallback(() => {
    setActiveId(null)
  }, [])

  /**
   * 右滑返回：子页是整屏 overlay，向右拖动时整页跟手右移（同步淡出，露出左侧下层网格），
   * 向右滑过屏宽 25% 或快速向右甩动就滑出关闭，否则弹回。
   * （之前的下拉返回走的是子页 ScrollView 的 RefreshControl，已去掉）
   */
  const swipeBack = useSwipeBack(handleClose)

  const handlePress = useCallback((id: SettingScreenIds) => {
    // 上一次可能是滑出关闭，整页还停在屏幕外，重新打开前必须复位
    swipeBack.reset()
    setActiveId(id)
  }, [swipeBack])

  // 返回键离开「我的」页时把子页一起收掉（否则再回到「我的」会看到子页还开着，且 PagerView 锁没释放）
  useEffect(() => {
    const handleNavActiveIdUpdate = (id: CommonState['navActiveId']) => {
      if (id == 'nav_mine') return
      // 子页打开时下标变化只可能来自「横滑被原生 PagerView 抢走」：
      // 关闭子页并回到「我的」，避免出现「设置页消失、人却到了本地音乐」的错位
      if (activeIdRef.current) {
        setActiveId(null)
        setNavActiveId('nav_mine')
        return
      }
      setActiveId(null)
    }
    global.state_event.on('navActiveIdUpdated', handleNavActiveIdUpdate)
    return () => {
      global.state_event.off('navActiveIdUpdated', handleNavActiveIdUpdate)
    }
  }, [])

  /**
   * 子页打开期间锁住 Home 的 PagerView 横向切页：
   * 子页是整屏浮层，横滑只应该用来返回，不能顺手切到「本地音乐」。
   * 这里通过 configUpdated 事件把 PagerView 的 scrollEnabled 临时关掉，
   * 只影响运行时的滑动开关，用户设置项本身不动（关闭子页时按原值恢复）。
   */
  useEffect(() => {
    if (!activeId) return
    const restore = () => {
      global.state_event.configUpdated(['common.homePageScroll'], {
        'common.homePageScroll': settingState.setting['common.homePageScroll'],
      })
    }
    global.state_event.configUpdated(['common.homePageScroll'], { 'common.homePageScroll': false })
    return restore
  }, [activeId])

  // 子页是整屏详情页：往上盖住「我的」页头（高度 = 状态栏 + 页头本体）
  const overlayTop = -(statusBarHeight + PAGE_HEADER_H)
  // 横屏导航浮在内容之上，设置子页要往回盖住它
  const overlayLeft = useHorizontalMode() ? -HORIZONTAL_NAV_SPACE : 0

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.list}>
        <Grid onPress={handlePress} />
      </ScrollView>

      {
        activeId
          ? (
              <Animated.View
                {...swipeBack.panHandlers}
                style={[
                  StyleSheet.absoluteFill,
                  { top: overlayTop, left: overlayLeft, zIndex: 200, elevation: 24 },
                  swipeBack.animatedStyle,
                ]}
              >
                <SlideInView style={{ ...styles.modal, backgroundColor: getSolidBackground(theme) }}>
                  <View style={{ ...styles.modalHeader, height: 52 + statusBarHeight, paddingTop: statusBarHeight }}>
                    <TouchableOpacity style={styles.modalBack} onPress={handleClose}>
                      <Icon name='chevron-left-2' size={20} color={theme['c-font']} />
                    </TouchableOpacity>
                    <Text size={19} style={styles.modalTitle}>{t(`setting_${activeId}` as 'setting_basic')}</Text>
                  </View>
                  <ScrollView
                    contentContainerStyle={styles.modalContent}
                    keyboardShouldPersistTaps='always'
                  >
                    {section}
                  </ScrollView>
                </SlideInView>
              </Animated.View>
            )
          : null
      }
    </View>
  )
}

const styles = createStyle({
  container: {
    flex: 1,
  },
  list: {
    paddingTop: 6,
    paddingBottom: NAV_BAR_SPACE,
  },
  modal: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 6,
    paddingRight: 16,
  },
  modalBack: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontWeight: '700',
    marginLeft: 4,
  },
  modalContent: {
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 10,
    paddingBottom: NAV_BAR_SPACE,
  },
})
