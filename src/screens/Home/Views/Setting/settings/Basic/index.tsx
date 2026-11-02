import { memo } from 'react'

import Section from '../../components/Section'
import Source from './Source'
import SourceName from './SourceName'
import Language from './Language'
import FontSize from './FontSize'
import ShareType from './ShareType'
import IsStartupAutoPlay from './IsStartupAutoPlay'
import IsHomePageScroll from './IsHomePageScroll'
import IsAllowProgressBarSeek from './IsAllowProgressBarSeek'
import { ThemeModeSelector, MaterialYouColors } from './ThemeSettings'
import { useI18n } from '@/lang/i18n'

export default memo(() => {
  const t = useI18n()

  return (
    <>
      <Section title='外观'>
        <ThemeModeSelector />
      </Section>
      <Section title='主题色'>
        <MaterialYouColors />
      </Section>
      <Section title='启动与播放'>
        <IsStartupAutoPlay />
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
