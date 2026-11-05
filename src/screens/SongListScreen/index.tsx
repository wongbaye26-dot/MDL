import { View } from 'react-native'

import PageContent from '@/components/PageContent'
import CutoutCompensator from '@/components/common/CutoutCompensator'
import StatusBar from '@/components/common/StatusBar'
import PlayerBar from '@/components/player/PlayerBar'
import PageHeader, { HeaderButton } from '@/components/common/PageHeader'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import SongList from '@/screens/Home/Views/SongList'
import HeaderSourceBar from '@/screens/Home/Views/SongList/HeaderSourceBar'

/**
 * 歌单广场（RNN 压栈的独立屏）。
 *
 * 页头不再放返回键：标题「歌单广场」直接从 16 的内容边界开始，和排行榜 PageModal
 * 的标题「排行榜」左对齐、字号/垂直位置一致。返回靠系统返回键/侧滑手势，右侧保留
 * 来源图标组 +「打开歌单链接」按钮。
 */
export default ({ componentId: _componentId }: { componentId: string }) => {
  const theme = useTheme()

  return (
    <CutoutCompensator>
    <PageContent>
      <StatusBar />
      <PageHeader
        title='歌单广场'
        right={(
          <View style={styles.headerRight}>
            {/* 来源图标放到标题右侧空白处：和右侧「打开歌单链接」按钮同一水平线对齐 */}
            <HeaderSourceBar />
            <HeaderButton
              icon='link-variant'
              // 与品牌图标组的光学尺寸对齐（品牌字形约 20dp）
              size={20}
              color={theme['c-450']}
              onPress={() => { global.app_event.openSonglistLink() }}
            />
          </View>
        )}
      />
      <View style={styles.content}>
        <SongList />
      </View>
      <PlayerBar />
    </PageContent>
    </CutoutCompensator>
  )
}

const styles = createStyle({
  content: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
})
