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
import { Icon } from '@/components/common/Icon'
import { useWindowSize } from '@/utils/hooks'
import { CoverImage } from './cover'
import { useNeutralPalette } from './palette'

/**
 * 单曲「更多」菜单：飞牛音乐风格的底部 Sheet。
 *
 * 结构（对照参考图 /tmp/fn_menu.png）：
 *   顶部圆角 24 → 封面 + 歌名/歌手 → 3 个白色操作卡（播放 / 下一首播放 / 加入播放列表）
 *   → 一列白色圆角行（专辑 / 歌手 / 收藏 / 添加到歌单 / 歌曲信息 / 查看目录 / 从列表移除 / 删除文件）
 * 动画：遮罩淡入 + Sheet 上滑，统一 240ms（参考图的手感是「快进快出」）。
 */
export type SongAction =
  | 'play'
  | 'playNext'
  | 'addToPlaylist'
  | 'album'
  | 'artist'
  | 'toggleLove'
  | 'addToSonglist'
  | 'songInfo'
  | 'showPath'
  | 'removeFromList'
  | 'deleteFile'

interface Props {
  visible: boolean
  item: LX.Music.MusicInfoLocal | null
  /** 这首歌是否已在「我的收藏」里 */
  loved: boolean
  onClose: () => void
  onAction: (action: SongAction) => void
}

/** 遮罩 + Sheet 动画时长 */
const DURATION = 240
/** 行间距 / 卡片间距（参考图 8~12dp） */
const GAP = 12

export default ({ visible, item, loved, onClose, onAction }: Props) => {
  const palette = useNeutralPalette()
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

  useEffect(() => {
    // 没有选中歌曲时强制卸载，避免残留上一次的内容
    if (!item) setMounted(false)
  }, [item])

  if (!mounted || !item) return null

  const name = item.name || '未知歌曲'
  const singer = item.singer || '未知歌手'
  const albumName = item.meta.albumName || '未知专辑'

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
          {/* 封面 + 歌名/歌手 */}
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 16 }}>
            <CoverImage item={item} size={56} radius={12} inset={0} background={palette.card} />
            <View style={{ flexGrow: 1, flexShrink: 1, marginLeft: 12 }}>
              <Text size={16} color={palette.text} numberOfLines={1} style={{ fontWeight: '600' }}>{name}</Text>
              <Text size={13} color={palette.textSecondary} numberOfLines={1} style={{ marginTop: 4 }}>{singer}</Text>
            </View>
          </View>

          <ScrollView
            style={{ maxHeight: windowHeight * 0.62 }}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 4 }}
            keyboardShouldPersistTaps='handled'
          >
            {/* 3 个操作卡 */}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <ActionCard label='播放' icon='play' onPress={() => { onAction('play') }} />
              <ActionCard label='下一首播放' icon='arrow-down-left' onPress={() => { onAction('playNext') }} />
              <ActionCard label='加入播放列表' icon='playlist-plus' onPress={() => { onAction('addToPlaylist') }} />
            </View>

            <View style={{ height: GAP }} />

            <ActionRow label={`专辑：${albumName}`} icon='album' onPress={() => { onAction('album') }} />
            <ActionRow label={`歌手：${singer}`} icon='microphone' onPress={() => { onAction('artist') }} />
            <ActionRow
              label={loved ? '取消收藏' : '收藏'}
              icon={loved ? 'heart' : 'heart-outline'}
              onPress={() => { onAction('toggleLove') }}
            />
            <ActionRow label='添加到歌单' icon='playlist-music' onPress={() => { onAction('addToSonglist') }} />
            <ActionRow label='歌曲信息' icon='information-outline' onPress={() => { onAction('songInfo') }} />
            <ActionRow label='查看所在目录' icon='folder-outline' onPress={() => { onAction('showPath') }} />
            <ActionRow label='从列表移除' icon='delete-outline' onPress={() => { onAction('removeFromList') }} />
            <ActionRow
              label='删除文件'
              icon='trash-can-outline'
              danger
              onPress={() => { onAction('deleteFile') }}
            />
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  )
}

/** 顶部大操作卡：白底圆角 12、高 68、图标在上文字在下 */
const ActionCard = ({ label, icon, onPress }: { label: string, icon: string, onPress: () => void }) => {
  const palette = useNeutralPalette()
  return (
    <TouchableOpacity
      style={{
        flex: 1,
        height: 68,
        borderRadius: 12,
        backgroundColor: palette.card,
        alignItems: 'center',
        justifyContent: 'center',
      }}
      activeOpacity={0.7}
      onPress={onPress}
    >
      <Icon name={icon} size={20} color={palette.icon} />
      <Text size={12.5} color={palette.text} numberOfLines={1} style={{ marginTop: 8 }}>{label}</Text>
    </TouchableOpacity>
  )
}

/** 白色圆角条目行：高 50、左右 16、右侧线性图标 */
const ActionRow = ({ label, icon, danger = false, onPress }: {
  label: string
  icon: string
  /** 危险操作（删除文件）用红色文字/图标 */
  danger?: boolean
  onPress: () => void
}) => {
  const palette = useNeutralPalette()
  const color = danger ? palette.danger : palette.text
  return (
    <TouchableOpacity
      style={{
        height: 50,
        borderRadius: 12,
        backgroundColor: palette.card,
        marginBottom: GAP,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
      }}
      activeOpacity={0.7}
      onPress={onPress}
    >
      <Text size={15} color={color} numberOfLines={1} style={{ flexGrow: 1, flexShrink: 1 }}>{label}</Text>
      <Icon name={icon} size={20} color={danger ? palette.danger : palette.icon} />
    </TouchableOpacity>
  )
}
