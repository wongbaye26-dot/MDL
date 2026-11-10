import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { Animated, View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native'

import SourceManage from './SourceManage'
import ToolsPage from './ToolsPage'
import { ThemeSection, PlayerInteractionSection } from '../settings/Refactored/Appearance'
import { PlaybackSection, AudioQualitySection } from '../settings/Refactored/Playback'
import Lyric from '../settings/Refactored/Lyric'
import Library from '../settings/Refactored/Library'
import DownloadStorage from '../settings/Refactored/DownloadStorage'
import System from '../settings/Refactored/System'
import { DataSection, AboutSection } from '../settings/Refactored/Misc'
import { createStyle } from '@/utils/tools'
import { type SettingScreenIds } from '../Main'
import { Icon } from '@/components/common/Icon'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { useStatusbarHeight } from '@/store/common/hook'
import { useHorizontalMode } from '@/utils/hooks'
import SlideInView from '@/components/common/SlideInView'
import { NAV_BAR_SPACE } from '@/config/constant'
import { getSolidBackground } from '@/theme/solid'
import { SETTINGS_HEADER_COMPACT_H, SETTINGS_HEADER_H } from '../components/headerMetrics'
import ImportBtn from '../settings/Basic/UserApiEditModal/ImportBtn'
import settingState from '@/store/setting/state'
import type { InitState as CommonState } from '@/store/common/state'
import useSwipeBack from '../useSwipeBack'
import CapsuleIconButton from '@/components/common/CapsuleIconButton'
import { useBackHandler } from '@/utils/hooks/useBackHandler'

/** 主题切换等导致组件重挂载时，用来恢复当前打开的子页，避免闪回设置主页 */
let lastActiveId: SettingScreenIds | null = null

/** 只剩两个深页：音源管理 / 曲库工具；其余设置已内联到首页 */
const DEEP_SECTIONS: Partial<Record<SettingScreenIds, ReactElement>> = {
  sourcesearch: <SourceManage />,
  library: <ToolsPage />,
  download: <DownloadStorage />,
}
const DEEP_TITLES: Partial<Record<SettingScreenIds, { title: string, desc: string }>> = {
  sourcesearch: { title: '音源管理', desc: '当前音源、自定义源、音质矩阵与实测' },
  library: { title: '曲库工具', desc: '曲库体检、补封面、标签刮削、去重、重命名、隐藏与回收站' },
  download: { title: '下载管理', desc: '保存位置、下载音质、附加文件与存储权限' },
}
const getSection = (id: SettingScreenIds) => DEEP_SECTIONS[id] ?? null

/** 横屏主-子（master-detail）分类 */
const CATEGORIES = [
  { key: 'theme', label: '主题与外观', icon: 'palette-outline' },
  { key: 'interaction', label: '播放器与交互', icon: 'gesture-swipe-horizontal' },
  { key: 'playback', label: '播放设置', icon: 'play-circle-outline' },
  { key: 'quality', label: '音质与音效', icon: 'speedometer' },
  { key: 'lyric', label: '歌词设置', icon: 'lyric-on' },
  { key: 'library', label: '本地音乐', icon: 'folder-music' },
  { key: 'system', label: '通知与系统', icon: 'shield-check-outline' },
  { key: 'data', label: '数据与存储', icon: 'database-outline' },
  { key: 'about', label: '关于与版本', icon: 'information-outline' },
] as const
type CategoryKey = typeof CATEGORIES[number]['key']

export default () => {
  const theme = useTheme()
  const t = useI18n()
  const statusBarHeight = useStatusbarHeight()
  const horizontal = useHorizontalMode()
  const [category, setCategory] = useState<CategoryKey>('theme')
  /** 竖屏主/子二级：null = 分类列表，非空 = 对应子页 */
  const [portraitCategory, setPortraitCategory] = useState<CategoryKey | null>(null)
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
    const handleDeepRequested = (id: 'sourcesearch' | 'library' | 'download') => {
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

  /** 深页打开时系统返回先关闭深页；设置首页返回 false，交给系统退到后台 */
  useBackHandler(useCallback(() => {
    if (activeIdRef.current) {
      setActiveId(null)
      return true
    }
    if (portraitCategory) {
      setPortraitCategory(null)
      return true
    }
    return false
  }, [portraitCategory, setActiveId]))

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

  // 子页往上盖住「我的」页头（高度 = 状态栏 + 页头本体）；横屏用紧凑页头高度
  const overlayTop = -(statusBarHeight + (horizontal ? SETTINGS_HEADER_COMPACT_H : SETTINGS_HEADER_H))
  // 深页和设置页内容区对齐：横屏不再往左扩，避免盖住左侧导航/超出设置页宽度
  const overlayLeft = 0

  const renderCategory = (key: CategoryKey) => {
    switch (key) {
      case 'theme': return <ThemeSection />
      case 'interaction': return <PlayerInteractionSection />
      case 'playback': return <PlaybackSection />
      case 'quality': return <AudioQualitySection />
      case 'lyric': return <Lyric />
      case 'library': return <Library />
      case 'system': return <System />
      case 'data': return <DataSection />
      default: return <AboutSection />
    }
  }
  const categoryContent = renderCategory(category)
  const portraitContent = portraitCategory ? renderCategory(portraitCategory) : null
  const portraitLabel = portraitCategory
    ? CATEGORIES.find(item => item.key === portraitCategory)?.label ?? ''
    : ''

  return (
    <View style={styles.container}>
      {
        horizontal
          ? (
            <View style={styles.masterDetail}>
              <ScrollView style={styles.master} contentContainerStyle={styles.masterContent} showsVerticalScrollIndicator={false}>
                {CATEGORIES.map(item => {
                  const active = item.key === category
                  return (
                    <TouchableOpacity
                      key={item.key}
                      style={[styles.masterItem, active ? { backgroundColor: theme['c-primary-alpha-900'] } : null]}
                      activeOpacity={0.7}
                      onPress={() => { setCategory(item.key) }}
                      accessibilityRole='button'
                      accessibilityState={{ selected: active }}
                    >
                      <Icon name={item.icon} size={18} color={active ? theme['c-primary'] : theme['c-450']} />
                      <Text size={13.5} color={active ? theme['c-primary'] : theme['c-font']} numberOfLines={1} style={styles.masterLabel}>{item.label}</Text>
                    </TouchableOpacity>
                  )
                })}
              </ScrollView>
              <ScrollView style={styles.detailPane} contentContainerStyle={styles.detailContent} showsVerticalScrollIndicator={false}>
                {categoryContent}
              </ScrollView>
            </View>
            )
          : portraitCategory
            ? (
              <View style={styles.portraitDetail}>
                <View style={styles.portraitBackRow}>
                  <CapsuleIconButton icon='chevron-left' label='返回设置' onPress={() => { setPortraitCategory(null) }} />
                  <Text size={19} style={styles.portraitDetailTitle}>{portraitLabel}</Text>
                </View>
                <ScrollView
                  key={portraitCategory}
                  contentContainerStyle={styles.portraitDetailContent}
                  showsVerticalScrollIndicator={false}
                >
                  {portraitContent}
                </ScrollView>
              </View>
              )
            : (
              <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
                <View style={styles.portraitMaster}>
                  {CATEGORIES.map((item, index) => (
                    <TouchableOpacity
                      key={item.key}
                      style={[styles.portraitRow, index > 0 ? { borderTopWidth: 0.5, borderTopColor: theme['c-primary-alpha-700'] } : null]}
                      activeOpacity={0.72}
                      onPress={() => { setPortraitCategory(item.key) }}
                      accessibilityRole='button'
                      accessibilityLabel={item.label}
                    >
                      <View style={[styles.portraitRowIcon, { backgroundColor: theme['c-primary-alpha-900'] }]}>
                        <Icon name={item.icon} size={19} color={theme['c-primary']} />
                      </View>
                      <Text size={14.5} style={styles.portraitRowLabel}>{item.label}</Text>
                      <Icon name='chevron-right' size={19} color={theme['c-450']} />
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
              )
      }

      {
        activeId
          ? (
              <Animated.View
                {...swipeBack.panHandlers}
                style={[
                  StyleSheet.absoluteFill,
                  { top: overlayTop, left: overlayLeft, bottom: 0, zIndex: 200, elevation: 24 },
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
                    {activeId === 'sourcesearch'
                      ? (
                        <>
                          <TouchableOpacity
                            style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: theme['c-primary-alpha-900'], marginRight: 6 }}
                            activeOpacity={0.8}
                            accessibilityRole='button'
                            accessibilityLabel='音源检测'
                            onPress={() => { global.state_event.sourceCheckRequested() }}
                          >
                            <Icon name='radar' size={19} color={theme['c-font']} />
                          </TouchableOpacity>
                          <ImportBtn
                          iconOnly
                          color={theme['c-font']}
                            btnStyle={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: theme['c-primary-alpha-900'] }}
                          />
                        </>
                        )
                      : null}
                  </View>
                  <ScrollView
                    contentContainerStyle={styles.modalContent}
                    keyboardShouldPersistTaps='always'
                    showsVerticalScrollIndicator={false}
                  >
                    <View style={styles.deepInner}>{section}</View>
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
  masterDetail: {
    flex: 1,
    flexDirection: 'row',
  },
  master: {
    width: 190,
    flexGrow: 0,
    borderRightWidth: 0.5,
  },
  masterContent: {
    paddingTop: 4,
    paddingBottom: NAV_BAR_SPACE,
    paddingLeft: 12,
    paddingRight: 12,
  },
  masterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: 12,
    paddingLeft: 12,
    paddingRight: 10,
    marginBottom: 2,
  },
  masterLabel: {
    marginLeft: 10,
  },
  detailPane: {
    flex: 1,
  },
  detailContent: {
    paddingLeft: 24,
    paddingRight: 24,
    paddingTop: 4,
    paddingBottom: NAV_BAR_SPACE,
  },
  portraitMaster: {
    marginLeft: 16,
    marginRight: 16,
    marginTop: 4,
    borderRadius: 18,
    borderWidth: 0.5,
    overflow: 'hidden',
    borderColor: 'rgba(128,128,128,0.18)',
    backgroundColor: 'rgba(128,128,128,0.06)',
  },
  portraitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 58,
    paddingLeft: 12,
    paddingRight: 12,
  },
  portraitRowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  portraitRowLabel: { flex: 1 },
  portraitDetail: { flex: 1 },
  portraitBackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 4,
    paddingBottom: 8,
  },
  portraitDetailTitle: { marginLeft: 10, fontWeight: '700' },
  portraitDetailContent: {
    paddingLeft: 16,
    paddingRight: 16,
    paddingBottom: NAV_BAR_SPACE,
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
  deepInner: {
    width: '100%',
    maxWidth: 980,
    alignSelf: 'center',
  },
  modalContent: {
    paddingLeft: 24,
    paddingRight: 24,
    paddingTop: 6,
    paddingBottom: NAV_BAR_SPACE,
  },
})
