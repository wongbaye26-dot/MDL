import { View } from 'react-native'
import Aside from './Aside'
import { useNavActiveId } from '@/store/common/hook'
import MiniPlayer from '../Vertical/MiniPlayer'
import StatusBar from '@/components/common/StatusBar'
import Main from './Main'
import { createStyle } from '@/utils/tools'

/**
 * 横屏布局：左侧悬浮导航栏 + 右侧内容区。
 *
 * 内容区不再单独渲染页头 —— 首页/下载中心/我的 各自用 PageHeader（横屏会自动切紧凑版），
 * 之前这里再画一次标题，会出现「EMO音乐」和「首页」两个标题叠在一起。
 * 迷你播放器改成悬浮在内容区底部，内容可以滚到它下面（各页面用 NAV_BAR_SPACE 留白）。
 */
const styles = createStyle({
  container: {
    flex: 1,
    flexDirection: 'row',
  },
  content: {
    flex: 1,
    overflow: 'hidden',
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

  return (
    <>
      <StatusBar />
      <View style={styles.container}>
        <Aside />
        <View style={styles.content}>
          <Main />
          {/* 播放器页自己占满整块内容区，迷你播放器会压住它的控制键 */}
          {
            navActiveId === 'nav_player'
              ? null
              : (
                <View style={styles.miniWrap} pointerEvents='box-none'>
                  <MiniPlayer />
                </View>
                )
          }
        </View>
      </View>
    </>
  )
}
