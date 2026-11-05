import { memo } from 'react'

import Section from '../../components/Section'
import IsShowHotSearch from '../Search/IsShowHotSearch'
import IsShowHistorySearch from '../Search/IsShowHistorySearch'
import IsClickPlayList from '../List/IsClickPlayList'
import IsShowAlbumName from '../List/IsShowAlbumName'
import IsShowInterval from '../List/IsShowInterval'
import AddMusicLocationType from '../List/AddMusicLocationType'

import { useI18n } from '@/lang'

/**
 * 「搜索与列表」合并页。
 * 之前是「搜索」「列表」两张小卡，为了让设置首页正好 8 张统一大卡，
 * 这里把两组设置并到一页里，各占一个 Section。
 */
export default memo(() => {
  const t = useI18n()

  return (
    <>
      <Section title={t('setting_search')}>
        <IsShowHotSearch />
        <IsShowHistorySearch />
      </Section>
      <Section title={t('setting_list')}>
        <IsClickPlayList />
        <IsShowAlbumName />
        <IsShowInterval />
        <AddMusicLocationType />
      </Section>
    </>
  )
})
