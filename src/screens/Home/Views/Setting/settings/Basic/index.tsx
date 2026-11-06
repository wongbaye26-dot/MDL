import { memo } from 'react'

import Section from '../../components/Section'
import SourceName from './SourceName'
import Language from './Language'
import FontSize from './FontSize'
import ShareType from './ShareType'
import IsHomePageScroll from './IsHomePageScroll'
import IsReduceMotion from './IsReduceMotion'
import { ThemeModeSelector, MaterialYouColors } from './ThemeSettings'
import { useI18n } from '@/lang/i18n'

/**
 * 基本设置：外观 / 主题色 / 界面 / 分享。
 *
 * - 音源选择已经搬到独立的「音源管理」；
 * - 「启动后自动播放」「允许通过底栏进度条调整播放进度」这两个播放行为项
 *   已按用户要求移动到「播放设置」（设置首页 → 播放设置 → 启动与播放）。
 */
export default memo(() => {
  const t = useI18n()

  return (
    <>
      <Section title='外观' icon='palette-outline'>
        <ThemeModeSelector />
      </Section>
      <Section title='主题色' icon='palette-swatch-outline'>
        <MaterialYouColors />
      </Section>
      <Section title='界面' icon='cellphone'>
        <IsHomePageScroll />
        <IsReduceMotion />
        <FontSize />
        <Language />
        <SourceName />
      </Section>
      <Section title={t('setting_basic_share_type')} icon='share-variant-outline'>
        <ShareType />
      </Section>
    </>
  )
})
