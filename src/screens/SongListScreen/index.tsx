import { View, TouchableOpacity } from 'react-native'

import PageContent from '@/components/PageContent'
import CutoutCompensator from '@/components/common/CutoutCompensator'
import StatusBar from '@/components/common/StatusBar'
import PlayerBar from '@/components/player/PlayerBar'
import PageHeader, { HeaderButton } from '@/components/common/PageHeader'
import { Icon } from '@/components/common/Icon'
import { pop } from '@/navigation'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import SongList from '@/screens/Home/Views/SongList'

/**
 * 歌单广场（RNN 压栈的独立屏）。
 *
 * 头部和首页/下载中心/我的统一走 PageHeader（标题 21/800 + 44dp 圆形按钮），
 * 左侧补返回键（之前只有系统手势，页面上看不到入口），右侧保留「打开歌单链接」。
 */
export default ({ componentId }: { componentId: string }) => {
  const theme = useTheme()

  return (
    <CutoutCompensator>
    <PageContent>
      <StatusBar />
      <PageHeader
        title='歌单广场'
        left={(
          <TouchableOpacity
            style={styles.backBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            onPress={() => { void pop(componentId) }}
          >
            <Icon name='chevron-left' size={24} color={theme['c-font']} />
          </TouchableOpacity>
        )}
        right={(
          <HeaderButton
            icon='link-variant'
            size={19}
            color={theme['c-450']}
            onPress={() => { global.app_event.openSonglistLink() }}
          />
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
  backBtn: {
    width: 34,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
})
