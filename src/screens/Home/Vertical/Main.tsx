import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react'
import { View, Animated, Easing } from 'react-native'
import Home from '../Views/Home'
import Download from '../Views/Download'
import Mine from '../Views/Mine'
import Player from '../Views/Player'
import LocalMusic from '../Views/LocalMusic'
import commonState, { type InitState as CommonState } from '@/store/common/state'
import { createStyle } from '@/utils/tools'
import PagerView, { type PageScrollStateChangedNativeEvent, type PagerViewOnPageSelectedEvent } from 'react-native-pager-view'
import { setNavActiveId } from '@/core/common'
import settingState from '@/store/setting/state'

const hideKeys = [
  'list.isShowAlbumName',
  'list.isShowInterval',
  'theme.fontShadow',
] as Readonly<Array<keyof LX.AppSetting>>

const PAGES = [
  { id: 'nav_home', component: Home },
  { id: 'nav_download', component: Download },
  { id: 'nav_local', component: LocalMusic },
  { id: 'nav_mine', component: Mine },
  { id: 'nav_player', component: Player },
] as const

/**
 * 单个 Tab 页面。
 *
 * PagerView 切页是 `setPageWithoutAnimation`（瞬间跳），所以切换质感全靠这里：
 * 淡入 + 轻微上浮 + 一点点推近（240~280ms ease-out），比原来的纯 200ms 淡入更有层次；
 * 已访问过的页面不会重播（visible 只置 true 一次），回来时内容不跳。
 */
const Page = ({ id, children }: { id: CommonState['navActiveId'], children: React.ReactNode }) => {
  const [visible, setVisible] = useState(commonState.navActiveId == id)
  // children 只在首次挂载时取一次：切 Tab 不应该重建页面（否则滚动位置、播放状态都会丢）
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const component = useMemo(() => children, [])
  const opacity = useRef(new Animated.Value(1)).current
  const translateY = useRef(new Animated.Value(0)).current
  const scale = useRef(new Animated.Value(1)).current
  useEffect(() => {
    if (!visible) return
    opacity.setValue(0)
    translateY.setValue(12)
    scale.setValue(0.992)
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start()
  }, [visible, opacity, translateY, scale])
  useEffect(() => {
    let currentId: CommonState['navActiveId'] = commonState.navActiveId
    const handleNavIdUpdate = (_id: CommonState['navActiveId']) => {
      currentId = _id
      if (_id == id) {
        requestAnimationFrame(() => {
          setVisible(true)
        })
      }
    }
    const handleHide = () => {
      if (currentId != 'nav_mine') return
      // 主题/语言变化时让设置页重建一次，但必须马上挂回来：
      // 只置 false 不置 true 会让「我的」页面直接空白（用户看到的黑/白屏）
      setVisible(false)
      requestAnimationFrame(() => {
        setVisible(true)
      })
    }
    const handleConfigUpdated = (keys: Array<keyof LX.AppSetting>) => {
      if (keys.some(k => hideKeys.includes(k))) handleHide()
    }
    global.state_event.on('navActiveIdUpdated', handleNavIdUpdate)
    global.state_event.on('themeUpdated', handleHide)
    global.state_event.on('languageChanged', handleHide)
    global.state_event.on('configUpdated', handleConfigUpdated)

    return () => {
      global.state_event.off('navActiveIdUpdated', handleNavIdUpdate)
      global.state_event.off('themeUpdated', handleHide)
      global.state_event.off('languageChanged', handleHide)
      global.state_event.off('configUpdated', handleConfigUpdated)
    }
    // id 是固定 prop，加上不会导致重复订阅，但能让 lint 满意
  }, [id])

  return visible
    ? (
      <Animated.View style={{ flex: 1, opacity, transform: [{ translateY }, { scale }] }}>
        {component}
      </Animated.View>
      )
    : null
}

const getIndex = (id: CommonState['navActiveId']) => {
  const index = PAGES.findIndex(page => page.id === id)
  return index < 0 ? 0 : index
}

const Main = () => {
  const pagerViewRef = useRef<ComponentRef<typeof PagerView>>(null)
  const activeIndexRef = useRef(getIndex(commonState.navActiveId))

  const onPageSelected = useCallback(({ nativeEvent }: PagerViewOnPageSelectedEvent) => {
    activeIndexRef.current = nativeEvent.position
    const id = PAGES[nativeEvent.position]?.id
    if (id && id != commonState.navActiveId) setNavActiveId(id)
  }, [])

  const onPageScrollStateChanged = useCallback(({ nativeEvent }: PageScrollStateChangedNativeEvent) => {
    const idle = nativeEvent.pageScrollState == 'idle'
    if (global.lx.homePagerIdle != idle) global.lx.homePagerIdle = idle
  }, [])

  useEffect(() => {
    const handleUpdate = (id: CommonState['navActiveId']) => {
      /*
        播放器页关掉 PagerView 的横向滚动。
        原生 ViewPager 会抢走竖向拖动的触摸序列（实测播放器里的 PanResponder
        只能收到 dy=4~7 就断了，下滑关闭完全失效）。播放器是最后一个 Tab，
        本来也不需要左右切页，关掉没有副作用。
      */
      pagerViewRef.current?.setScrollEnabled(
        id !== 'nav_player' && settingState.setting['common.homePageScroll'],
      )
      const index = getIndex(id)
      if (activeIndexRef.current == index) return
      activeIndexRef.current = index
      pagerViewRef.current?.setPageWithoutAnimation(index)
    }
    const handleConfigUpdate = (keys: Array<keyof LX.AppSetting>, setting: Partial<LX.AppSetting>) => {
      if (!keys.includes('common.homePageScroll')) return
      pagerViewRef.current?.setScrollEnabled(
        setting['common.homePageScroll']! && commonState.navActiveId !== 'nav_player',
      )
    }
    global.state_event.on('navActiveIdUpdated', handleUpdate)
    global.state_event.on('configUpdated', handleConfigUpdate)
    return () => {
      global.state_event.off('navActiveIdUpdated', handleUpdate)
      global.state_event.off('configUpdated', handleConfigUpdate)
    }
  }, [])

  // 首帧如果就落在播放器页（重启恢复），也要先把横向滚动关掉
  useEffect(() => {
    pagerViewRef.current?.setScrollEnabled(
      commonState.navActiveId !== 'nav_player' && settingState.setting['common.homePageScroll'],
    )
  }, [])

  const component = useMemo(() => (
    <PagerView
      ref={pagerViewRef}
      initialPage={activeIndexRef.current}
      offscreenPageLimit={1}
      onPageSelected={onPageSelected}
      onPageScrollStateChanged={onPageScrollStateChanged}
      scrollEnabled={settingState.setting['common.homePageScroll']}
      style={styles.pagerView}
    >
      {
        PAGES.map(({ id, component: PageComponent }) => (
          <View collapsable={false} key={id} style={styles.pageStyle}>
            <Page id={id}><PageComponent /></Page>
          </View>
        ))
      }
    </PagerView>
  ), [onPageScrollStateChanged, onPageSelected])

  return component
}

const styles = createStyle({
  pagerView: {
    flex: 1,
    overflow: 'hidden',
  },
  pageStyle: {
    // alignItems: 'center',
  },
})


export default Main
