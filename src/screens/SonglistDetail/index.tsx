import { useEffect, useRef } from 'react'
import { View } from 'react-native'

import MusicList, { type MusicListType } from './MusicList'
import PageContent from '@/components/PageContent'
import CutoutCompensator from '@/components/common/CutoutCompensator'
import StatusBar from '@/components/common/StatusBar'
import PageHeader from '@/components/common/PageHeader'
import SelectionBarSlot from '@/components/OnlineList/SelectionBarSlot'
import { setComponentId } from '@/core/common'
import { COMPONENT_IDS } from '@/config/constant'
import { type ListInfoItem } from '@/store/songlist/state'
import PlayerBar from '@/components/player/PlayerBar'
import { SelectionBarSlotContext } from '@/utils/selectionBar'
import { createStyle } from '@/utils/tools'
import { ListInfoContext } from './state'

/**
 * 歌单详情（RNN 压栈的独立屏）。
 *
 * 版面：
 *   1. 固定页头：只有歌单名（PageHeader，和排行榜/歌单广场同一套，标题 21/800 从 16 起始），
 *      不放返回键；右侧是多选操作插槽。返回靠系统返回键/侧滑手势。
 *   2. 列表里第一屏是圆角概览卡（封面/标题/作者/简介 + 播放全部/收藏/下载）
 *   3. 歌曲列表 + 底部悬浮 PlayerBar（列表底部由 OnlineList 预留 NAV_BAR_SPACE）
 */
export default ({ componentId, info }: { componentId: string, info: ListInfoItem }) => {
  const musicListRef = useRef<MusicListType>(null)
  const isUnmountedRef = useRef(false)

  useEffect(() => {
    setComponentId(COMPONENT_IDS.songlistDetail, componentId)

    isUnmountedRef.current = false

    musicListRef.current?.loadList(info.source, info.id)


    return () => {
      isUnmountedRef.current = true
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])


  return (
    <CutoutCompensator>
    <PageContent>
      <StatusBar />
      {/* 多选插槽要包住整个页面：MultipleModeBar 在列表里，只包 Header 它读不到 */}
      <SelectionBarSlotContext.Provider value>
        <PageHeader
          title={info.name || '歌单'}
          right={<SelectionBarSlot />}
        />
        <View style={styles.content}>
          <ListInfoContext.Provider value={info}>
            <MusicList ref={musicListRef} componentId={componentId} />
          </ListInfoContext.Provider>
        </View>
      </SelectionBarSlotContext.Provider>
      <PlayerBar />
    </PageContent>
    </CutoutCompensator>
  )
}

const styles = createStyle({
  content: {
    flex: 1,
  },
})
