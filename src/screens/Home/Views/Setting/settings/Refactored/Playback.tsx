import { View } from 'react-native'
import Section from '../../components/Section'
import IsSavePlayTime from '../Player/IsSavePlayTime'
import IsAutoCleanPlayedList from '../Player/IsAutoCleanPlayedList'
import IsHandleAudioFocus from '../Player/IsHandleAudioFocus'
import IsEnableAudioOffload from '../Player/IsEnableAudioOffload'
import PlayHighQuality from '../Player/PlayHighQuality'
import PlaybackRate from '../Player/PlaybackRate'
import FadeSeconds from '../Player/FadeSeconds'
import IsStartupAutoPlay from '../Player/IsStartupAutoPlay'
import IsAllowProgressBarSeek from '../Player/IsAllowProgressBarSeek'
import MaxCache from '../Player/MaxCache'

export default () => (
  <View>
    <Section title='播放' icon='play'>
      <IsSavePlayTime />
      <IsAutoCleanPlayedList />
      <IsHandleAudioFocus />
      <IsEnableAudioOffload />
      <PlayHighQuality />
      <PlaybackRate />
      <FadeSeconds />
    </Section>
    <Section title='启动与进度' icon='play-circle-outline'>
      <IsStartupAutoPlay />
      <IsAllowProgressBarSeek />
    </Section>
    <Section title='缓存' icon='database-outline'>
      <MaxCache />
    </Section>
  </View>
)
