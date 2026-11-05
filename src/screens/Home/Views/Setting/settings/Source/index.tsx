import { memo, useEffect } from 'react'
import { View } from 'react-native'

import SummaryCard from './SummaryCard'
import CurrentSource from './CurrentSource'
import SourceList from './SourceList'
import QualityMatrix from './QualityMatrix'
import MusicQualityCheck from './MusicQualityCheck'
import { useQualityList } from './state'
import { useSettingValue } from '@/store/setting/hook'
import { useUserApiList } from '@/store/userApi'
import { updateUserApiInfo } from '@/core/userApi'
import { createStyle } from '@/utils/tools'

/**
 * 音源管理整页：
 * 顶部汇总 → 当前音源状态 → 自定义源列表（启用/删除/导入/检查更新）→ 音质矩阵 → 实测检测。
 */
export default memo(() => {
  const activeId = useSettingValue('common.apiSource')
  const userApiList = useUserApiList()
  const qualityList = useQualityList()

  // 把当前脚本初始化上报的音质矩阵缓存到自定义源信息上，
  // 这样切到别的源之后，列表里仍能看到每个源「上次已知」支持哪些音质
  useEffect(() => {
    if (!activeId.startsWith('user_api')) return
    const activeApi = userApiList.find(api => api.id === activeId)
    if (!activeApi) return
    if (!Object.keys(qualityList).length) return
    if (JSON.stringify(activeApi.qualitys ?? {}) === JSON.stringify(qualityList)) return
    void updateUserApiInfo(activeId, { qualitys: { ...qualityList } })
  }, [activeId, userApiList, qualityList])

  return (
    <View style={styles.container}>
      <SummaryCard />
      <CurrentSource />
      <SourceList />
      <QualityMatrix />
      <MusicQualityCheck />
    </View>
  )
})

const styles = createStyle({
  container: {
    flex: 1,
  },
})
