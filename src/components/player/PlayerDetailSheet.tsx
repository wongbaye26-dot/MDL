import { useEffect, useRef, useState } from 'react'
import {
  Animated,
  Easing,
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native'

import Text from '@/components/common/Text'
import Image from '@/components/common/Image'
import { Icon } from '@/components/common/Icon'
import { useSheetPalette } from '@/components/common/ActionSheet'
import { useWindowSize } from '@/utils/hooks'

/**
 * 播放器页的「歌曲详情」底部 Sheet。
 *
 * 视觉和本地音乐的「更多」菜单（components/common/ActionSheet）同一套 Material You：
 *   黑 50% 遮罩淡入 + Sheet 从底部上滑（240ms）→ 顶部圆角 24
 *   → header 是当前歌封面 + 歌名/歌手 → 下面一列圆角信息行。
 * 配色也直接共用 useSheetPalette：Sheet 底 = getSolidBackground（主题背景可能半透明，
 * 弹层必须压成不透明）、行卡片 = c-primary-alpha-900、label 次文字 / value 主文字，
 * 深色主题自动适配。
 *
 * 和「更多」菜单的区别是这里**只读**：不提供编辑/删除，所以没有操作卡，
 * 只有原来 detailRows 里的字段（来源 / 格式 / 文件 / 时长 …）。
 */

interface Props {
  visible: boolean
  /** 当前封面（musicInfo.pic），没有时 Image 自己出占位 */
  pic?: string | null
  /** 已清洗过的歌名（去掉「歌手 -」前缀） */
  name: string
  singer: string
  /** 字段行：格式/大小/音质/路径等，沿用播放器原来的 detailRows */
  rows: Array<{ label: string, value: string }>
  onClose: () => void
}

/** 遮罩 + 上滑动画时长，和本地音乐「更多」菜单一致 */
const DURATION = 240
/** 底部 Sheet 圆角 */
const RADIUS = 24
/** 行间距 */
const GAP = 12

export default ({ visible, pic, name, singer, rows, onClose }: Props) => {
  const palette = useSheetPalette()
  const { height: windowHeight } = useWindowSize()
  /** 关闭动画播完之前 Modal 不能卸载，否则会「闪一下直接消失」 */
  const [mounted, setMounted] = useState(visible)
  const anim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (visible) {
      setMounted(true)
      anim.setValue(0)
      // 下一帧再启动：Modal 刚挂载时还不能做原生动画
      requestAnimationFrame(() => {
        Animated.timing(anim, {
          toValue: 1,
          duration: DURATION,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start()
      })
    } else {
      Animated.timing(anim, {
        toValue: 0,
        duration: DURATION,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setMounted(false)
      })
    }
  }, [visible, anim])

  if (!mounted) return null

  return (
    <Modal
      visible={mounted}
      transparent
      statusBarTranslucent
      animationType='none'
      onRequestClose={onClose}
    >
      <View style={{ flex: 1 }}>
        {/* 遮罩：点一下关掉 */}
        <Animated.View
          style={{
            ...StyleSheet.absoluteFillObject,
            backgroundColor: palette.scrim,
            opacity: anim,
          }}
        >
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        </Animated.View>

        <Animated.View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            maxHeight: windowHeight * 0.86,
            borderTopLeftRadius: RADIUS,
            borderTopRightRadius: RADIUS,
            paddingTop: 16,
            paddingBottom: 20,
            backgroundColor: palette.bg,
            transform: [{
              translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [windowHeight, 0] }),
            }],
          }}
        >
          {/* header：当前歌封面 + 歌名/歌手 */}
          <View style={styles.header}>
            <Image url={pic ?? undefined} style={styles.cover} />
            <View style={styles.headerText}>
              <Text size={16} color={palette.text} numberOfLines={1} style={styles.name}>{name || '未在播放'}</Text>
              <Text size={13} color={palette.textSecondary} numberOfLines={1} style={styles.singer}>{singer}</Text>
            </View>
          </View>

          {/* 段标题：这里只是查看，没有可点的操作 */}
          <View style={styles.sectionTitle}>
            <Icon name='information-outline' size={15} color={palette.primary} />
            <Text size={13} color={palette.textSecondary} style={styles.sectionText}>歌曲详情</Text>
          </View>

          <ScrollView
            style={{ maxHeight: windowHeight * 0.6 }}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          >
            {
              rows.map(row => (
                <View
                  key={row.label}
                  style={{
                    ...styles.row,
                    backgroundColor: palette.card,
                    borderColor: palette.border,
                  }}
                >
                  <Text size={13} color={palette.textSecondary} style={styles.rowLabel}>{row.label}</Text>
                  {/* 路径可能很长：允许换行 + 可长按复制，不在这里做截断 */}
                  <Text size={13} color={palette.text} selectable numberOfLines={4} style={styles.rowValue}>{row.value}</Text>
                </View>
              ))
            }
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 16,
    marginBottom: 16,
  },
  cover: {
    width: 56,
    height: 56,
    borderRadius: 12,
  },
  headerText: {
    flexGrow: 1,
    flexShrink: 1,
    marginLeft: 12,
  },
  name: {
    fontWeight: '600',
  },
  singer: {
    marginTop: 4,
  },
  sectionTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 16,
    marginBottom: 10,
  },
  sectionText: {
    marginLeft: 6,
  },
  list: {
    paddingLeft: 16,
    paddingRight: 16,
    paddingBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    minHeight: 50,
    borderRadius: 12,
    borderWidth: 0.5,
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 13,
    paddingBottom: 13,
    marginBottom: GAP,
  },
  rowLabel: {
    width: 58,
  },
  rowValue: {
    flexGrow: 1,
    flexShrink: 1,
    lineHeight: 19,
  },
})
