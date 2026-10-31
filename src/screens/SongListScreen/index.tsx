import { View, TouchableOpacity } from 'react-native'
import { Navigation } from 'react-native-navigation'

import PageContent from '@/components/PageContent'
import StatusBar from '@/components/common/StatusBar'
import PlayerBar from '@/components/player/PlayerBar'
import { Icon } from '@/components/common/Icon'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { useStatusbarHeight } from '@/store/common/hook'
import { createStyle } from '@/utils/tools'
import SongList from '@/screens/Home/Views/SongList'

export default ({ componentId }: { componentId: string }) => {
  const theme = useTheme()
  const statusBarHeight = useStatusbarHeight()

  const handleBack = () => {
    void Navigation.pop(componentId)
  }

  return (
    <PageContent>
      <StatusBar />
      <View style={{ ...styles.header, height: 52 + statusBarHeight, paddingTop: statusBarHeight }}>
        <TouchableOpacity
          style={styles.back}
          onPress={handleBack}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Icon name='chevron-left-2' size={22} color={theme['c-font']} />
        </TouchableOpacity>
        <Text size={17} style={styles.title} numberOfLines={1}>歌单广场</Text>
        <TouchableOpacity
          style={styles.back}
          onPress={() => { global.app_event.openSonglistLink() }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Icon name='link-variant' size={19} color={theme['c-450']} />
        </TouchableOpacity>
      </View>
      <View style={styles.content}>
        <SongList />
      </View>
      <PlayerBar />
    </PageContent>
  )
}

const styles = createStyle({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 6,
    paddingRight: 6,
  },
  back: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    flexGrow: 1,
    fontWeight: '700',
    marginLeft: 2,
  },
  content: {
    flex: 1,
  },
})
