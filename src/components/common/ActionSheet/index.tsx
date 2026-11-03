import { useEffect, useRef, useState, type ReactNode } from 'react'
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
import { Icon } from '@/components/common/Icon'
import { useWindowSize } from '@/utils/hooks'
import { useSheetPalette } from './palette'

/**
 * Material You 底部 ActionSheet：全 App「更多菜单」的统一容器。
 *
 * 布局（沿用本地音乐的更多菜单，参考飞牛音乐）：
 *   黑 50% 遮罩 → Sheet 上滑 240ms → 顶部圆角 24、左右留 16
 *   → header（封面 + 标题 + 副标题）
 *   → 快捷操作卡（高 68、圆角 12、间隙 8，通常 3 个）
 *   → 一列圆角操作行（高 50、行间距 12、右侧图标 / 补充文字）
 *   → 底部安全区留白
 * 配色全部来自主题 token（见 ./palette），深色主题自动适配。
 *
 * 用法：
 *   <ActionSheet
 *     visible={visible}
 *     header={{ cover: <PicImage musicInfo={info} style={...} />, title: name, subtitle: singer }}
 *     actions={[{ key: 'play', label: '播放', icon: 'play', onPress }]}
 *     items={[{ key: 'add', label: '添加到', icon: 'playlist-plus', onPress }]}
 *     onClose={() => { setVisible(false) }}
 *   />
 *
 * visible 只控制动画：关闭时会先播完退场动画再卸载 Modal，
 * 父组件不需要做延迟卸载；但组件本身要常驻渲染，不能 `visible ? <ActionSheet/> : null`，
 * 否则退场动画会被直接打断（表现为「闪一下消失」）。
 */
export interface ActionSheetHeader {
  /** 左侧 56×56 封面：直接传页面自己的封面组件（本地封面 / 网络封面都行） */
  cover?: ReactNode
  /** 主标题：歌名 / 任务名 / 榜单名 */
  title: string
  /** 副标题：歌手 / 状态等 */
  subtitle?: string
}

export interface ActionSheetAction {
  key: string
  label: string
  icon: string
  onPress: () => void
  /** 置灰不可点（仍显示） */
  disabled?: boolean
}

export interface ActionSheetItem {
  key: string
  label: string
  icon: string
  onPress?: () => void
  /** 右侧补充文字（如「已收藏」） */
  value?: string
  /** 危险操作：红色文字 / 图标（删除文件、从列表移除） */
  danger?: boolean
  /** 强调状态（已收藏 / 当前项）：图标用主色 */
  active?: boolean
  /** 置灰不可点（仍显示，比如没有缓存时的「清除缓存」） */
  disabled?: boolean
}

export interface ActionSheetProps {
  visible: boolean
  header?: ActionSheetHeader
  /** 顶部快捷操作卡（通常 3 个），不传则不渲染这一行 */
  actions?: readonly ActionSheetAction[]
  /** 下方操作行 */
  items: readonly ActionSheetItem[]
  onClose: () => void
}

/** 遮罩淡入 + Sheet 上滑时长 */
const DURATION = 240
/** 行间距 / 卡片间距（参考图 8~12dp） */
const GAP = 12

export default ({ visible, header, actions, items, onClose }: ActionSheetProps) => {
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
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingTop: 16,
            paddingBottom: 20,
            backgroundColor: palette.bg,
            transform: [{
              translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [windowHeight, 0] }),
            }],
          }}
        >
          {header != null ? <Header header={header} /> : null}

          <ScrollView
            style={{ maxHeight: windowHeight * 0.62 }}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 4 }}
            keyboardShouldPersistTaps='handled'
            showsVerticalScrollIndicator={false}
          >
            {
              actions?.length
                ? (
                    <>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        {actions.map(action => <ActionCard key={action.key} action={action} />)}
                      </View>
                      <View style={{ height: GAP }} />
                    </>
                  )
                : null
            }
            {items.map(item => <ActionRow key={item.key} item={item} />)}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  )
}

/** 顶部信息区：封面 + 标题 + 副标题 */
const Header = ({ header }: { header: ActionSheetHeader }) => {
  const palette = useSheetPalette()
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 16 }}>
      {header.cover}
      <View style={{ flexGrow: 1, flexShrink: 1, marginLeft: header.cover != null ? 12 : 0 }}>
        <Text size={16} color={palette.text} numberOfLines={1} style={{ fontWeight: '600' }}>{header.title}</Text>
        {
          header.subtitle
            ? <Text size={13} color={palette.textSecondary} numberOfLines={1} style={{ marginTop: 4 }}>{header.subtitle}</Text>
            : null
        }
      </View>
    </View>
  )
}

/** 顶部快捷操作卡：主色衬底圆角 12、高 68、图标在上文字在下 */
const ActionCard = ({ action }: { action: ActionSheetAction }) => {
  const palette = useSheetPalette()
  return (
    <TouchableOpacity
      style={{
        flex: 1,
        height: 68,
        borderRadius: 12,
        backgroundColor: palette.card,
        borderWidth: 0.5,
        borderColor: palette.border,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: action.disabled ? 0.4 : 1,
      }}
      activeOpacity={0.7}
      disabled={action.disabled}
      onPress={action.onPress}
    >
      <Icon name={action.icon} size={20} color={palette.primary} />
      <Text size={12.5} color={palette.text} numberOfLines={1} style={{ marginTop: 8 }}>{action.label}</Text>
    </TouchableOpacity>
  )
}

/** 圆角操作行：高 50、左侧标签、右侧补充值 + 图标 */
const ActionRow = ({ item }: { item: ActionSheetItem }) => {
  const palette = useSheetPalette()
  const labelColor = item.danger ? palette.danger : item.disabled ? palette.textSecondary : palette.text
  const iconColor = item.danger ? palette.danger : item.active ? palette.primary : palette.icon
  return (
    <TouchableOpacity
      style={{
        height: 50,
        borderRadius: 12,
        backgroundColor: palette.card,
        borderWidth: 0.5,
        borderColor: palette.border,
        marginBottom: GAP,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        opacity: item.disabled ? 0.4 : 1,
      }}
      activeOpacity={0.7}
      disabled={item.disabled}
      onPress={item.onPress}
    >
      <Text size={15} color={labelColor} numberOfLines={1} style={{ flexGrow: 1, flexShrink: 1 }}>{item.label}</Text>
      {
        item.value
          ? <Text size={13} color={palette.textSecondary} numberOfLines={1} style={{ marginLeft: 8, flexShrink: 1 }}>{item.value}</Text>
          : null
      }
      <Icon name={item.icon} size={20} color={iconColor} style={{ marginLeft: 10 }} />
    </TouchableOpacity>
  )
}

export { useSheetPalette, type SheetPalette } from './palette'
