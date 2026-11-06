import { memo } from 'react'

import Section from '../../components/Section'
import IsShowHotSearch from '../Search/IsShowHotSearch'
import IsShowHistorySearch from '../Search/IsShowHistorySearch'
import IsClickPlayList from '../List/IsClickPlayList'
import IsShowAlbumName from '../List/IsShowAlbumName'
import IsShowInterval from '../List/IsShowInterval'

import { useI18n } from '@/lang'

/**
 * 「搜索与列表」合并页：搜索（热搜/历史） + 列表（点击行为/专辑名/时长）。
 *
 * 注意：「添加歌曲到列表时的位置」（list.addMusicLocationType）按用户要求已从 UI 移除，
 * 设置 key 与 core 行为保持不变（旧用户存储值继续生效，只是不再提供入口）。
 */
export default memo(() => {
  const t = useI18n()

  return (
    <>
      <Section title={t('setting_search')} icon='magnify'>
        <IsShowHotSearch />
        <IsShowHistorySearch />
      </Section>
      <Section title={t('setting_list')} icon='format-list-bulleted'>
        <IsClickPlayList />
        <IsShowAlbumName />
        <IsShowInterval />
      </Section>
    </>
  )
})
