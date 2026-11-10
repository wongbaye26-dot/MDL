import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react'
import { View } from 'react-native'
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
import { useTheme } from '@/store/theme/hook'

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
 * 这里**不做任何切页动画**：
 *  - PagerView 手势左右滑本身有原生转场，再叠一层动画是重复的；
 *  - 之前的 opacity 0→1 会在切换第一帧让整页透明，露出下层 PageContent 的背景，
 *    亮色主题下就是左右上角闪一下的残影（暗色下底色接近所以看不出来）；
 *  - translateY / scale 还会让页面四周露出父容器底色。
 * 点击底部 Tab 是 `setPageWithoutAnimation` 瞬间跳，同样不需要淡入。
 * 已访问过的页面不会重建（visible 只置 true 一次），回来时滚动位置和播放状态都保留。
 */
const Page = ({ id, children }: { id: CommonState['navActiveId'], children: React.ReactNode }) => {
  const theme = useTheme()
  const [visible, setVisible] = useState(commonState.navActiveId == id)
  // children 只在首次挂载时取一次：切 Tab 不应该重建页面（否则滚动位置、播放状态都会丢）
  // React 19 的 ReactNode 包含 Promise<ReactNode>，lint 的 promise-function-async 会误判；这里就是同步缓存 children
  // eslint-disable-next-line react-hooks/exhaustive-deps, @typescript-eslint/promise-function-async
  const component = useMemo(() => children, [])
  // 页面背景保持主题的半透明底，让 PageContent 的背景图透出来
  const backgroundColor = theme['c-main-background']
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
      <View style={{ flex: 1, backgroundColor }}>
        {component}
      </View>
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
    if (global.lx.homePagerIdle != idle) {
      global.lx.homePagerIdle = idle
      /*
       * 通知玻璃层：滑动中把「整窗快照模糊」降级成纯色。
       *
       * GlassBlurView 是 preDraw 抓整个 window 的快照再软件模糊，滑动中刷新间隔
       * 50ms（20fps），跟不上页面 60fps 的位移，页头/胶囊边缘就会拖出上一页的
       * 模糊残影（亮色主题下最明显）。滑动这几百毫秒直接不模糊，结束后恢复。
       */
      global.state_event.homePagerScrollChanged(!idle)
    }
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
