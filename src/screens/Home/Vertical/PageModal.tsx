import { View, StyleSheet } from 'react-native'
import SlideInView from '@/components/common/SlideInView'
import PageHeader from '@/components/common/PageHeader'
import { useTheme } from '@/store/theme/hook'
import { getSolidBackground } from '@/theme/solid'
import { createStyle } from '@/utils/tools'
import { useHorizontalMode } from '@/utils/hooks'
import { HORIZONTAL_NAV_SPACE } from '@/config/constant'
import { useOverlayLock } from '@/utils/overlayLock'
import { SelectionBarSlotContext } from '@/utils/selectionBar'
import SelectionBarSlot from '@/components/OnlineList/SelectionBarSlot'

/**
 * 整屏子页（排行榜 / 收藏 / 已下载 …）。
 *
 * 头部直接用 PageHeader：和首页/下载中心/我的 同一套（标题 21/800、44dp 圆形按钮、
 * 横屏自动切紧凑版）。之前是自己画的 17sp 标题 + 裸图标，所以子页和主页面
 * 一眼就能看出是两套 UI。
 */
export default ({ title, titleRight, onClose: _onClose, right, children }: {
  title: string
  /** 标题同一行、紧跟标题之后的节点（比如收藏页的两个页签） */
  titleRight?: React.ReactNode
  /** 保留接口：关闭由系统返回手势触发（useBackHandler） */
  onClose?: () => void
  /** 标题右侧的操作按钮 */
  right?: React.ReactNode
  children: React.ReactNode
}) => {
  const theme = useTheme()
  const isLandscape = useHorizontalMode()
  // 打开期间把横屏左侧导航收起来，子页才是真整屏
  useOverlayLock()

  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        // 横屏时导航是浮在内容之上的，整屏子页要往回盖住它，否则右边是子页、左边还是导航
        isLandscape ? { left: -HORIZONTAL_NAV_SPACE } : null,
        { zIndex: 300, elevation: 30 },
      ]}
    >
      {/* 覆盖层必须用不透明底色：主题的 c-main-background 可能是半透明的（为了透出背景图），
          盖在首页之上时下层内容会透上来，形成鬼影 */}
      {/* 进场 320ms ease-out：和 RNN 全屏页（歌单广场/歌单详情）、播放器转场同一档时长 */}
      <SlideInView direction='up' durationMs={320} style={{ ...styles.container, backgroundColor: getSolidBackground(theme) }}>
        {/*
          提供「多选插槽」：列表的多选栏渲染到标题右侧（原来它绝对定位在列表顶部、会盖住第一行）。
          子页里的 MultipleModeBar 检测到这个 context 就不再自己画。
        */}
        <SelectionBarSlotContext.Provider value>
          <PageHeader
            title={title}
            titleRight={titleRight}
            right={(
              <View style={styles.headerRight}>
                {right}
                <SelectionBarSlot />
              </View>
            )}
          />
          <View style={styles.content}>{children}</View>
        </SelectionBarSlotContext.Provider>
      </SlideInView>
    </View>
  )
}

const styles = createStyle({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
})
