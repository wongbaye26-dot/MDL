import { View } from 'react-native'
import Aside from './Aside'
import { useNavActiveId } from '@/store/common/hook'
import MiniPlayer from '../Vertical/MiniPlayer'
import StatusBar from '@/components/common/StatusBar'
import Main from './Main'
import { createStyle } from '@/utils/tools'
import { HORIZONTAL_NAV_SPACE } from '@/config/constant'
import { useOverlayVisible } from '@/utils/overlayLock'

/**
 * 横屏布局：内容区整屏铺满，左侧导航浮在内容之上。
 *
 * 之前是 row 布局（[导航][内容]），播放器的深色底只从导航右边开始，
 * 左边永远留一条页面底色的竖条 —— 看起来就是「播放器错位、没铺满」。
 * 现在导航改成绝对定位的悬浮胶囊：
 *  - 播放器页不留左内边距，封面直接铺到屏幕左边（和飞牛横版一致）；
 *  - 其它页面用 paddingLeft 让出导航的位置，视觉和之前一样。
 */
const styles = createStyle({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    overflow: 'hidden',
  },
  contentInset: {
    paddingLeft: HORIZONTAL_NAV_SPACE,
  },
  miniWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
})

export default () => {
  const navActiveId = useNavActiveId()
  const isPlayer = navActiveId === 'nav_player'
  const overlayVisible = useOverlayVisible()

  return (
    <>
      <StatusBar />
      <View style={styles.container}>
        <View style={[styles.content, isPlayer ? null : styles.contentInset]}>
          <Main />
          {/* 播放器页自己占满整块内容区，迷你播放器会压住它的控制键 */}
          {
            isPlayer
              ? null
              : (
                <View style={styles.miniWrap} pointerEvents='box-none'>
                  <MiniPlayer />
                </View>
                )
          }
        </View>
        {/* 播放器页整屏铺满，左侧导航会压住封面；和竖屏一样在播放器页收起 */}
        {isPlayer || overlayVisible ? null : <Aside />}
      </View>
    </>
  )
}
