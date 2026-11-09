import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { Animated, View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native'

import SourceManage from './SourceManage'
import ToolsPage from './ToolsPage'
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
import { SETTINGS_HEADER_H } from '../components/headerMetrics'
import settingState from '@/store/setting/state'
import type { InitState as CommonState } from '@/store/common/state'
import useSwipeBack from '../useSwipeBack'

/** 主题切换等导致组件重挂载时，用来恢复当前打开的子页，避免闪回设置主页 */
let lastActiveId: SettingScreenIds | null = null

/** 只剩两个深页：音源管理 / 曲库工具；其余设置已内联到首页 */
const DEEP_SECTIONS: Partial<Record<SettingScreenIds, ReactElement>> = {
  sourcesearch: <SourceManage />,
  library: <ToolsPage />,
}
const DEEP_TITLES: Partial<Record<SettingScreenIds, { title: string, desc: string }>> = {
  sourcesearch: { title: '音源管理', desc: '当前音源、自定义源、音质矩阵与实测' },
  library: { title: '曲库工具', desc: '曲库体检、补封面、标签刮削、去重、重命名、隐藏与回收站' },
}
const getSection = (id: SettingScreenIds) => DEEP_SECTIONS[id] ?? null

export default () => {
  const theme = useTheme()
  const t = useI18n()
  const statusBarHeight = useStatusbarHeight()
  const [activeId, setActiveIdState] = useState<SettingScreenIds | null>(
    lastActiveId && DEEP_SECTIONS[lastActiveId] ? lastActiveId : null,
  )
  const activeIdRef = useRef<SettingScreenIds | null>(null)
  activeIdRef.current = activeId

  const section = useMemo(() => (activeId ? getSection(activeId) : null), [activeId])

  const setActiveId = useCallback((id: SettingScreenIds | null) => {
    lastActiveId = id
    setActiveIdState(id)
  }, [])

  const handleClose = useCallback(() => {
    setActiveId(null)
  }, [setActiveId])

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
  }, [setActiveId, swipeBack])

  // 子页打开时：胶囊切到哪个 Tab 就去哪个 Tab，只把子页收掉，不再强制弹回「我的」。
  // （之前这里 setNavActiveId('nav_mine') 会把用户刚点的目标页覆盖掉，表现为
  //  「先回到设置首页，然后怎么点都切不了页」。）
  useEffect(() => {
    const handleNavActiveIdUpdate = (id: CommonState['navActiveId']) => {
      if (id == 'nav_mine') return
      if (activeIdRef.current) setActiveId(null)
    }
    const handleCloseRequested = () => {
      if (activeIdRef.current) setActiveId(null)
    }
    const handleDeepRequested = (id: 'sourcesearch' | 'library') => {
      setActiveId(id)
    }
    global.state_event.on('navActiveIdUpdated', handleNavActiveIdUpdate)
    global.state_event.on('settingsSubpageCloseRequested', handleCloseRequested)
    global.state_event.on('settingsDeepScreenRequested', handleDeepRequested)
    return () => {
      global.state_event.off('navActiveIdUpdated', handleNavActiveIdUpdate)
      global.state_event.off('settingsSubpageCloseRequested', handleCloseRequested)
      global.state_event.off('settingsDeepScreenRequested', handleDeepRequested)
    }
  }, [setActiveId])

  // 把「设置子页是否打开」广播给胶囊导航：这样在子页里再点一次「我的」可以回到设置首页
  useEffect(() => {
    global.state_event.settingsSubpageUpdated(!!activeId)
    return () => { global.state_event.settingsSubpageUpdated(false) }
  }, [activeId])

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
  const overlayTop = -(statusBarHeight + SETTINGS_HEADER_H)
  // 横屏导航浮在内容之上，设置子页要往回盖住它
  const overlayLeft = useHorizontalMode() ? -HORIZONTAL_NAV_SPACE : 0

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
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
                  <View style={{ ...styles.modalHeader, height: 58 + statusBarHeight, paddingTop: statusBarHeight, backgroundColor: getSolidBackground(theme) }}>
                    <TouchableOpacity
                      style={{ ...styles.modalBack, backgroundColor: theme['c-primary-alpha-900'], borderColor: theme['c-primary-alpha-700'] }}
                      onPress={handleClose}
                      accessibilityRole='button'
                      accessibilityLabel='返回'
                    >
                      <Icon name='chevron-left-2' size={20} color={theme['c-font']} />
                    </TouchableOpacity>
                    <View style={styles.modalTitleWrap}>
                      <Text size={22} style={styles.modalTitle}>{DEEP_TITLES[activeId]?.title ?? t(`setting_${activeId}` as 'setting_basic')}</Text>
                      <Text size={12} color={theme['c-450']} numberOfLines={1} style={styles.modalDesc}>{DEEP_TITLES[activeId]?.desc ?? ''}</Text>
                    </View>
                  </View>
                  <ScrollView
                    contentContainerStyle={styles.modalContent}
                    keyboardShouldPersistTaps='always'
                    showsVerticalScrollIndicator={false}
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
    paddingTop: 2,
    // 大字号时最后一行要能滚到胶囊导航上方
    paddingBottom: NAV_BAR_SPACE,
  },
  modal: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 10,
    paddingRight: 16,
  },
  modalBack: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 0.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitleWrap: {
    flex: 1,
    marginLeft: 12,
  },
  modalTitle: {
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  modalDesc: {
    marginTop: 2,
  },
  modalContent: {
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 6,
    paddingBottom: NAV_BAR_SPACE,
  },
})
