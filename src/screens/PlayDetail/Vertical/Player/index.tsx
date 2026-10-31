import { memo } from 'react'
import { View } from 'react-native'

import MoreBtn from './components/MoreBtn'
import PlayInfo from './components/PlayInfo'
import PlayerMeta from './components/PlayerMeta'
import ControlBtn from './components/ControlBtn'
import VolumeBar from './components/VolumeBar'
import { createStyle } from '@/utils/tools'
import { NAV_SHEAR_NATIVE_IDS } from '@/config/constant'


export default memo(() => {
  return (
    <View style={styles.container} nativeID={NAV_SHEAR_NATIVE_IDS.playDetail_player}>
      <PlayInfo />
      <PlayerMeta />
      <MoreBtn />
      <ControlBtn />
      <VolumeBar />
    </View>
  )
})

const styles = createStyle({
  container: {
    flex: 0,
    width: '100%',
    paddingHorizontal: 15,
    paddingBottom: 10,
    paddingTop: 5,
    flexDirection: 'column',
  },
  status: {
    marginTop: 10,
    flexDirection: 'column',
    flex: 0,
    paddingLeft: 5,
    justifyContent: 'space-evenly',
  },
})
