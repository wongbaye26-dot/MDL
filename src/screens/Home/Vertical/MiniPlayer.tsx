import { memo, useRef } from 'react'
import { View, TouchableOpacity } from 'react-native'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import LiquidGlass from '@/components/common/LiquidGlass'
import AlbumDiscSpin, { DISC_SIZE, DISC_RING_SIZE } from '@/components/common/AlbumDiscSpin'
import { useTheme } from '@/store/theme/hook'
import { usePlayerMusicInfo, useIsPlay, useProgress } from '@/store/player/hook'
import { useLrcPlay } from '@/plugins/lyric'
import { useSettingValue } from '@/store/setting/hook'
import { useKeyboard } from '@/utils/hooks'
import { playNext, togglePlay } from '@/core/player/player'
import { measureStartRect, openPlayerWithTransition } from '@/utils/playerOpen'
import PlayGlyph from '../Views/Player/PlayGlyph'
import { createStyle } from '@/utils/tools'
import { contrastOn } from '@/theme/solid'
import { cleanSongName } from '@/utils/songName'

/**
 * 横屏内容区底部的迷你播放器。
 *
 * 和竖屏胶囊 / 子页 PlayerBar 是同一套语言：
 *  - 磨砂玻璃 + 上半部反光 + 底部内阴影，没有一圈完整的描边线、没有外圈动画光带；
 *  - 左侧圆盘直接复用 `AlbumDiscSpin`：48dp 盘面 + 54dp 进度环 + 描边/高光/阴影，
 *    和胶囊右侧的专辑圆盘**完全一致**，不再各写一个 38dp 圆角方块；
 *  - 播放进度只走封面圆环（`common.navProgressStyle` 的 ring / 关闭两档；
 *    「胶囊描边」功能已在 v3.8.2 下线，这里不再有边缘进度光）。
 *
 * 点进播放器走和圆盘同一个共享元素 helper（utils/playerOpen）：
 * 起点就是左边这块小圆盘，量它的屏幕位置交给飞行封面。
 */
export default memo(() => {
  const theme = useTheme()
  const musicInfo = usePlayerMusicInfo()
  const isPlay = useIsPlay()
  const { progress } = useProgress()
  const lrcPlay = useLrcPlay()
  const progressStyle = useSettingValue('common.navProgressStyle') ?? 'ring'
  const glassStyle = useSettingValue('common.navGlassStyle') ?? 'liquid'
  const autoHidePlayBar = useSettingValue('common.autoHidePlayBar')
  const { keyboardShown } = useKeyboard()
  const isDark = theme.isDark
  /** 圆盘节点：打开播放器时量它的屏幕位置作为共享元素动画起点 */
  const discRef = useRef<View>(null)

  if (autoHidePlayBar && keyboardShown) return null
  if (!musicInfo.name) return null
  const songName = cleanSongName(musicInfo.name, musicInfo.singer)
  const ratio = Math.max(0, Math.min(1, progress))

  const openPlayer = () => {
    openPlayerWithTransition(done => {
      // 共享元素只算 48dp 的盘面，外面 54dp 的进度环不算进飞行封面
      measureStartRect(discRef.current, done, DISC_SIZE)
    })
  }

  return (
    <View style={styles.wrap} pointerEvents='box-none'>
      <View
        style={[
          styles.card,
          isDark ? null : styles.cardLight,
          isDark
            ? {
                backgroundColor: glassStyle === 'none' ? 'rgba(24,18,34,0.88)' : 'rgba(24,18,34,0.20)',
                shadowColor: '#000000',
              }
            : {
                // 亮色：只留很薄一层白，靠 BlurView 透出背后颜色，不做「整块白」
                backgroundColor: glassStyle === 'none' ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.10)',
                shadowColor: '#6E6285',
              },
        ]}
      >
        <LiquidGlass
          mode={glassStyle}
          blurRadius={24}
          tint={isDark ? 'rgba(22,17,30,0.42)' : 'rgba(255,255,255,0.14)'}
          radius={BAR_RADIUS}
          isDark={isDark}
        />

        <TouchableOpacity
          style={styles.infoArea}
          activeOpacity={0.75}
          onPress={openPlayer}
        >
          {/* 圆盘包一层原生 View 才能当测量节点（AlbumDiscSpin 不是原生 View） */}
          <View ref={discRef} collapsable={false} style={styles.discWrap}>
            <AlbumDiscSpin
              progress={progressStyle === 'ring' ? ratio : 0}
              showRing={progressStyle !== 'none'}
              dark={isDark}
            />
          </View>
          <View style={styles.textArea}>
            <Text size={13} numberOfLines={1} style={isDark ? styles.name : [styles.name, styles.lightTextShadow]}>{songName}</Text>
            <Text size={11} color={theme['c-450']} numberOfLines={1} style={isDark ? styles.singer : [styles.singer, styles.lightTextShadow]}>{lrcPlay.text || musicInfo.singer || '未知歌手'}</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.playBtn}
          activeOpacity={0.8}
          onPress={togglePlay}
        >
          <View style={{ ...styles.playCircle, backgroundColor: theme['c-primary'] }}>
            <PlayGlyph playing={isPlay} box={15} color={contrastOn(theme['c-primary'])} />
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btn} activeOpacity={0.6} onPress={() => { void playNext() }}>
          <Icon name='nextMusic' color={theme['c-primary']} size={20} />
        </TouchableOpacity>
      </View>
    </View>
  )
})

/** 和底部胶囊同高（59dp）的全圆角，横屏时收窄居中 */
const BAR_HEIGHT = 59
const BAR_RADIUS = BAR_HEIGHT / 2

const styles = createStyle({
  wrap: {
    paddingLeft: 10,
    paddingRight: 10,
    paddingTop: 4,
    paddingBottom: 10,
    // 横屏内容区很宽，播放条拉满会显得很空；收窄并居中
    alignItems: 'center',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    maxWidth: 360,
    height: BAR_HEIGHT,
    borderRadius: BAR_RADIUS,
    // 左内边距和胶囊 / PlayerBar 一致：进度环左缘距条边 3dp，圆盘才和胶囊对得上
    paddingLeft: 3,
    paddingRight: 6,
    elevation: 10,
    shadowOpacity: 0.26,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    overflow: 'hidden',
  },
  cardLight: {
    // 亮色下玻璃更透，外部阴影稍微加重一点把边界托出来（深色分支沿用 card 的阴影）
    elevation: 18,
    shadowOpacity: 0.42,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 12 },
  },
  lightTextShadow: {
    // 亮色玻璃是深色文字：给一层白色微阴影，透出深色背景时也能读
    textShadowColor: 'rgba(255,255,255,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
  infoArea: {
    flexGrow: 1,
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  discWrap: {
    width: DISC_RING_SIZE,
    height: DISC_RING_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textArea: {
    flexGrow: 1,
    flexShrink: 1,
    // 和 PlayerBar / 胶囊圆盘右侧的间距一致
    marginLeft: 6,
    marginRight: 6,
  },
  name: {
    fontWeight: '600',
  },
  singer: {
    marginTop: 2,
  },
  playBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btn: {
    width: 38,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
})
