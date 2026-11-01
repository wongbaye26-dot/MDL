import { View, StyleSheet } from 'react-native'
import SlideInView from '@/components/common/SlideInView'
import PageHeader, { HeaderButton } from '@/components/common/PageHeader'
import { useTheme } from '@/store/theme/hook'
import { getSolidBackground } from '@/theme/solid'
import { createStyle } from '@/utils/tools'

/**
 * 整屏子页（排行榜 / 收藏 / 已下载 …）。
 *
 * 头部直接用 PageHeader：和首页/下载中心/我的 同一套（标题 21/800、44dp 圆形按钮、
 * 横屏自动切紧凑版）。之前是自己画的 17sp 标题 + 裸图标，所以子页和主页面
 * 一眼就能看出是两套 UI。
 */
export default ({ title, onClose, right, children }: {
  title: string
  onClose: () => void
  /** 标题右侧的操作按钮 */
  right?: React.ReactNode
  children: React.ReactNode
}) => {
  const theme = useTheme()

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 200, elevation: 24 }]}>
      {/* 覆盖层必须用不透明底色：主题的 c-main-background 可能是半透明的（为了透出背景图），
          盖在首页之上时下层内容会透上来，形成鬼影 */}
      <SlideInView direction='up' style={{ ...styles.container, backgroundColor: getSolidBackground(theme) }}>
        <PageHeader
          title={title}
          left={<HeaderButton icon='chevron-left-2' size={22} onPress={onClose} />}
          right={right}
        />
        <View style={styles.content}>{children}</View>
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
})
