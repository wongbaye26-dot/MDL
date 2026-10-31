import { useMemo } from 'react'
import { View, ScrollView } from 'react-native'
import Text from '@/components/common/Text'
import Image from '@/components/common/Image'
import { useTheme } from '@/store/theme/hook'
import { usePlayerMusicInfo } from '@/store/player/hook'
import { useStatusbarHeight } from '@/store/common/hook'
import { useWindowSize } from '@/utils/hooks'
import { createStyle } from '@/utils/tools'
import PlayInfo from '@/screens/PlayDetail/Vertical/Player/components/PlayInfo'
import PlayerMeta from '@/screens/PlayDetail/Vertical/Player/components/PlayerMeta'
import MoreBtn from '@/screens/PlayDetail/Vertical/Player/components/MoreBtn'
import ControlBtn from '@/screens/PlayDetail/Vertical/Player/components/ControlBtn'
import VolumeBar from '@/screens/PlayDetail/Vertical/Player/components/VolumeBar'

export default () => {
  const theme = useTheme()
  const musicInfo = usePlayerMusicInfo()
  const statusBarHeight = useStatusbarHeight()
  const { width, height } = useWindowSize()

  const artSize = useMemo(() => Math.min(width * 0.82, height * 0.42), [width, height])

  return (
    <ScrollView contentContainerStyle={{ paddingTop: statusBarHeight + 8, paddingBottom: 12 }}>
      <View style={styles.topBar}>
        <Text size={11} color={theme['c-450']} style={styles.topLabel}>正在播放</Text>
      </View>

      <View style={styles.artWrap}>
        <Image url={musicInfo.pic} style={{ width: artSize, height: artSize, borderRadius: 24 }} />
      </View>

      <View style={styles.playerBlock}>
        <PlayInfo />
        <PlayerMeta />
        <MoreBtn />
        <ControlBtn />
        <VolumeBar />
      </View>
    </ScrollView>
  )
}

const styles = createStyle({
  topBar: {
    alignItems: 'center',
    marginBottom: 6,
  },
  topLabel: {
    letterSpacing: 2,
  },
  artWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  playerBlock: {
    paddingTop: 8,
  },
})
