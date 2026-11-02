import { View } from 'react-native'

import PageContent from '@/components/PageContent'
import CutoutCompensator from '@/components/common/CutoutCompensator'
import StatusBar from '@/components/common/StatusBar'
import PlayerBar from '@/components/player/PlayerBar'
import PageHeader, { HeaderButton } from '@/components/common/PageHeader'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import SongList from '@/screens/Home/Views/SongList'

/**
 * 歌单广场。
 * 头部改成和首页/下载中心/我的 同一个 PageHeader（标题 21/800 + 44dp 圆形按钮），
 * 之前是自己画的 17sp 标题 + 裸图标，和主 Tab 的头部完全是两套。
 */
export default () => {
  const theme = useTheme()

  return (
    <CutoutCompensator>
    <PageContent>
      <StatusBar />
      <PageHeader
        title='歌单广场'
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
})
