import { View, TouchableOpacity, StyleSheet } from 'react-native'
import { Icon } from '@/components/common/Icon'
import Text from '@/components/common/Text'
import SlideInView from '@/components/common/SlideInView'
import { useTheme } from '@/store/theme/hook'
import { useStatusbarHeight } from '@/store/common/hook'
import { createStyle } from '@/utils/tools'
import { getSolidBackground } from '@/theme/solid'

export default ({ title, onClose, right, children }: {
  title: string
  onClose: () => void
  /** 标题右侧的操作按钮 */
  right?: React.ReactNode
  children: React.ReactNode
}) => {
  const theme = useTheme()
  const statusBarHeight = useStatusbarHeight()

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 200, elevation: 24 }]}>
      {/* 覆盖层必须用不透明底色：主题的 c-main-background 可能是半透明的（为了透出背景图），
          盖在首页之上时下层内容会透上来，形成鬼影 */}
      <SlideInView style={{ ...styles.container, backgroundColor: getSolidBackground(theme) }}>
        <View style={{ ...styles.header, height: 50 + statusBarHeight, paddingTop: statusBarHeight }}>
          <TouchableOpacity style={styles.back} onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Icon name='chevron-left-2' size={20} color={theme['c-font']} />
          </TouchableOpacity>
          <Text size={17} style={styles.title} numberOfLines={1}>{title}</Text>
          {right ?? <View style={styles.back} />}
        </View>
        <View style={styles.content}>{children}</View>
      </SlideInView>
    </View>
  )
}

const styles = createStyle({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 6,
    paddingRight: 16,
  },
  back: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontWeight: '700',
    marginLeft: 4,
  },
  content: {
    flex: 1,
  },
})
