import { memo } from 'react'

import Section from '../../components/Section'
import IsSavePlayTime from './IsSavePlayTime'
import PlayHighQuality from './PlayHighQuality'
import IsHandleAudioFocus from './IsHandleAudioFocus'
import IsEnableAudioOffload from './IsEnableAudioOffload'
import IsAutoCleanPlayedList from './IsAutoCleanPlayedList'
import IsShowBluetoothLyric from './IsShowBluetoothLyric'
import IsShowBluetoothFullLyric from './IsShowBluetoothFullLyric'
import IsShowNotificationImage from './IsShowNotificationImage'
import IsShowLyricTranslation from './IsShowLyricTranslation'
import IsShowLyricRoma from './IsShowLyricRoma'
import IsS2T from './IsS2T'
import MaxCache from './MaxCache'
import IsWordByWordLyric from './IsWordByWordLyric'
import IsSingleLineLyric from './IsSingleLineLyric'
import NavSwipeSwitch from './NavSwipeSwitch'
import NavProgressStyle from './NavProgressStyle'

export default memo(() => {
  return (
    <>
      <Section title='播放'>
        <IsSavePlayTime />
        <IsAutoCleanPlayedList />
        <IsHandleAudioFocus />
        <IsEnableAudioOffload />
        <PlayHighQuality />
        <NavSwipeSwitch />
      </Section>
      <NavProgressStyle />
      <Section title='歌词'>
        <IsWordByWordLyric />
        <IsSingleLineLyric />
        <IsShowLyricTranslation />
        <IsShowLyricRoma />
        <IsS2T />
        <IsShowBluetoothLyric />
        <IsShowBluetoothFullLyric />
      </Section>
      <Section title='通知'>
        <IsShowNotificationImage />
      </Section>
      <Section title='缓存'>
        <MaxCache />
      </Section>
    </>
  )
})
