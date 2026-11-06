import { View } from 'react-native'
import Section from '../../components/Section'
import LyricSize from '../Player/LyricSize'
import LyricAlign from '../Player/LyricAlign'
import LyricOffset from '../Player/LyricOffset'
import IsWordByWordLyric from '../Player/IsWordByWordLyric'
import IsSingleLineLyric from '../Player/IsSingleLineLyric'
import IsShowLyricTranslation from '../Player/IsShowLyricTranslation'
import IsShowLyricRoma from '../Player/IsShowLyricRoma'
import IsAutoJyutping from '../Player/IsAutoJyutping'
import IsS2T from '../Player/IsS2T'
import IsShowBluetoothLyric from '../Player/IsShowBluetoothLyric'
import IsShowBluetoothFullLyric from '../Player/IsShowBluetoothFullLyric'
import IsShowNotificationImage from '../Player/IsShowNotificationImage'

export default () => (
  <View>
    <Section title='歌词' icon='lyric-on'>
      <LyricSize />
      <LyricAlign />
      <LyricOffset />
      <IsWordByWordLyric />
      <IsSingleLineLyric />
      <IsShowLyricTranslation />
      <IsShowLyricRoma />
      <IsAutoJyutping />
      <IsS2T />
      <IsShowBluetoothLyric />
      <IsShowBluetoothFullLyric />
    </Section>
    <Section title='通知' icon='bell-outline'>
      <IsShowNotificationImage />
    </Section>
  </View>
)
