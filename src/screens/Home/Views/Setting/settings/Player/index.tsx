import { memo } from 'react'

import Section from '../../components/Section'
import IsSavePlayTime from './IsSavePlayTime'
import PlayHighQuality from './PlayHighQuality'
import PlaybackRate from './PlaybackRate'
import FadeSeconds from './FadeSeconds'
import IsHandleAudioFocus from './IsHandleAudioFocus'
import IsEnableAudioOffload from './IsEnableAudioOffload'
import IsAutoCleanPlayedList from './IsAutoCleanPlayedList'
import IsShowBluetoothLyric from './IsShowBluetoothLyric'
import IsShowBluetoothFullLyric from './IsShowBluetoothFullLyric'
import IsShowNotificationImage from './IsShowNotificationImage'
import IsShowLyricTranslation from './IsShowLyricTranslation'
import IsShowLyricRoma from './IsShowLyricRoma'
import IsAutoJyutping from './IsAutoJyutping'
import LyricSize from './LyricSize'
import LyricAlign from './LyricAlign'
import LyricOffset from './LyricOffset'
import IsS2T from './IsS2T'
import MaxCache from './MaxCache'
import IsWordByWordLyric from './IsWordByWordLyric'
import IsSingleLineLyric from './IsSingleLineLyric'
import NavSwipeSwitch from './NavSwipeSwitch'
import NavProgressStyle from './NavProgressStyle'
import NavGlassStyle from './NavGlassStyle'
// 「启动与播放」两个播放行为项由基本设置移入本页（组件文件也已搬到 Player 目录）
import IsStartupAutoPlay from './IsStartupAutoPlay'
import IsAllowProgressBarSeek from './IsAllowProgressBarSeek'

export default memo(() => {
  return (
    <>
      <Section title='播放' icon='play'>
        <IsSavePlayTime />
        <IsAutoCleanPlayedList />
        <IsHandleAudioFocus />
        <IsEnableAudioOffload />
        <PlayHighQuality />
        <PlaybackRate />
        <FadeSeconds />
        <NavSwipeSwitch />
      </Section>
      <Section title='启动与播放' icon='play-circle-outline'>
        <IsStartupAutoPlay />
        <IsAllowProgressBarSeek />
      </Section>
      <NavGlassStyle />
      <NavProgressStyle />
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
      <Section title='缓存' icon='database-outline'>
        <MaxCache />
      </Section>
    </>
  )
})
