import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  Easing,
  Modal,
  ScrollView,
  StyleSheet,
  TouchableHighlight,
  TouchableOpacity,
  View,
} from 'react-native'

import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { useSheetPalette } from '@/components/common/ActionSheet'
import { useWindowSize } from '@/utils/hooks'
import type { Position } from '@/components/common/Menu'

/**
 * Material You 悬浮菜单：点击行尾 ⋮ / 长按歌曲时，在触发位置附近弹出的上下文小卡片。
 *
 * 与底部 ActionSheet 的分工：
 *   - ActionSheet：本地音乐、下载中心这类「信息 + 主操作」场景（靠底部、面积大）
 *   - FloatingMenu：排行榜 / 歌单详情 / 搜索这类长列表里的「单行更多操作」
 *     （靠触发位置、紧凑、不遮挡整屏）
 *
 * 结构：全屏透明 Modal（点外部关闭）+ 按 position 定位的小卡片：
 *   圆角 16、主题底色 + 主色描边 + 阴影、行高 46（图标 18 + 文字 14）、
 *   入场 scale 0.92→1 + 淡入 160ms，条目多时卡片高度夹到屏内并内部滚动。
 *
 * 定位语义与 `components/common/Menu.tsx` 一致：
 *   position 是触发元素的屏幕矩形（x/y/w/h，长按时 w/h 可以是 0，表示手指点）；
 *   优先显示在触发元素下方，空间不够翻到上方，左右/上下都夹在屏幕内。
 */
export interface FloatingMenuItem {
  key: string
  label: string
  icon: string
  onPress?: () => void
  /** 置灰不可点（仍显示，比如没有缓存时的「清除缓存」） */
  disabled?: boolean
  /** 危险操作：红色文字 / 图标 */
  danger?: boolean
  /** 强调（当前项 / 已选中）：图标用主色 */
  active?: boolean
}

export interface FloatingMenuProps {
  visible: boolean
  /** 触发元素矩形（屏幕坐标） */
  position: Position
  items: readonly FloatingMenuItem[]
  onClose: () => void
}

/** 入场 / 退场动画时长（Material You 菜单的「快进快出」手感） */
const DURATION = 160
const EXIT_DURATION = 120
/** 卡片距屏幕边缘的最小留白 */
const MARGIN = 12
/** 行高 / 卡片圆角 / 卡片宽度 / 上下内边距 */
const ROW_HEIGHT = 46
const RADIUS = 16
const WIDTH = 220
const PADDING_V = 6
/** 卡片与触发元素之间的间隙 */
const OFFSET = 4

export default ({ visible, position, items, onClose }: FloatingMenuProps) => {
  const palette = useSheetPalette()
  const { width: windowWidth, height: windowHeight } = useWindowSize()
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
        duration: EXIT_DURATION,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setMounted(false)
      })
    }
  }, [visible, anim])

  const layout = useMemo(() => {
    const fullHeight = items.length * ROW_HEIGHT + PADDING_V * 2
    // 行高是固定的，所以卡片高度可以提前算出来；超过一屏就夹到可用高度、内部滚动
    const menuHeight = Math.min(fullHeight, Math.max(ROW_HEIGHT * 2, windowHeight - MARGIN * 2))

    const spaceBelow = windowHeight - position.y - position.h - MARGIN
    const spaceAbove = position.y - MARGIN
    // 下方放得下就放下方，否则放上方；两边都不够时选空间大的一侧
    const showBelow = spaceBelow >= menuHeight || spaceBelow >= spaceAbove
    let top = showBelow ? position.y + position.h + OFFSET : position.y - menuHeight - OFFSET
    top = Math.min(Math.max(MARGIN, top), Math.max(MARGIN, windowHeight - menuHeight - MARGIN))

    // 水平：默认贴触发元素左边缘；右边放不下就右对齐，最后夹到屏幕内
    let left = position.x
    if (left + WIDTH > windowWidth - MARGIN) left = position.x + position.w - WIDTH
    left = Math.min(Math.max(MARGIN, left), Math.max(MARGIN, windowWidth - WIDTH - MARGIN))

    return { top, left, height: menuHeight, scrollHeight: menuHeight - PADDING_V * 2 }
  }, [items.length, position, windowHeight, windowWidth])

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
        {/* 全屏透明遮罩：点外部关闭 */}
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <Animated.View
          style={{
            position: 'absolute',
            top: layout.top,
            left: layout.left,
            width: WIDTH,
            borderRadius: RADIUS,
            paddingTop: PADDING_V,
            paddingBottom: PADDING_V,
            backgroundColor: palette.bg,
            borderWidth: 0.5,
            borderColor: palette.border,
            elevation: 8,
            shadowColor: '#000000',
            shadowOpacity: 0.18,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 4 },
            opacity: anim,
            transform: [{
              scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }),
            }],
          }}
        >
          <ScrollView
            style={{ maxHeight: layout.scrollHeight }}
            bounces={false}
            keyboardShouldPersistTaps='handled'
            showsVerticalScrollIndicator={items.length * ROW_HEIGHT > layout.scrollHeight}
          >
            {items.map(item => <Row key={item.key} item={item} />)}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  )
}

/** 紧凑操作行：高 46、左标签右图标，按下时主色 10% 衬底（Material You 的 state layer） */
const Row = ({ item }: { item: FloatingMenuItem }) => {
  const palette = useSheetPalette()
  const labelColor = item.danger ? palette.danger : item.disabled ? palette.textSecondary : palette.text
  const iconColor = item.danger ? palette.danger : item.active ? palette.primary : palette.icon
  return (
    <TouchableHighlight
      underlayColor={palette.card}
      disabled={item.disabled}
      onPress={item.onPress}
    >
      <View style={{
        height: ROW_HEIGHT,
        paddingHorizontal: 14,
        flexDirection: 'row',
        alignItems: 'center',
        opacity: item.disabled ? 0.4 : 1,
      }}>
        <Text size={14} color={labelColor} numberOfLines={1} style={{ flexGrow: 1, flexShrink: 1 }}>{item.label}</Text>
        <Icon name={item.icon} size={18} color={iconColor} style={{ marginLeft: 12 }} />
      </View>
    </TouchableHighlight>
  )
}
