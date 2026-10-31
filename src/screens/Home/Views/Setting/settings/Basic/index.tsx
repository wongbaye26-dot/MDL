import { memo } from 'react'

import Section from '../../components/Section'
import Source from './Source'
import SourceName from './SourceName'
import Language from './Language'
import FontSize from './FontSize'
import ShareType from './ShareType'
import IsStartupAutoPlay from './IsStartupAutoPlay'
import IsStartupPushPlayDetailScreen from './IsStartupPushPlayDetailScreen'
import IsHomePageScroll from './IsHomePageScroll'
import IsAllowProgressBarSeek from './IsAllowProgressBarSeek'
import ThemeSettings from './ThemeSettings'
import { useI18n } from '@/lang/i18n'

export default memo(() => {
  const t = useI18n()

  return (
    <>
      <Section title='主题'>
        <ThemeSettings />
      </Section>
      <Section title='启动与播放'>
        <IsStartupAutoPlay />
        <IsStartupPushPlayDetailScreen />
      </Section>
      <Section title='界面'>
        <IsHomePageScroll />
        <IsAllowProgressBarSeek />
        <FontSize />
        <Language />
      </Section>
      <Section title={t('setting_basic_source')}>
        <Source />
        <SourceName />
      </Section>
      <Section title={t('setting_basic_share_type')}>
        <ShareType />
      </Section>
    </>
  )
})
