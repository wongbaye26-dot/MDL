import { View } from 'react-native'
import { Group, ToggleRow, ValueRow } from '../../components/ui'

/** 音源与搜索（IA 第 3 组）；音源管理是深页入口 */
export default ({ onOpenSource }: { onOpenSource?: () => void }) => (
  <View>
    <Group title='音源与搜索'>
      <ValueRow title='音源管理' desc='当前音源、自定义源、音质矩阵与实测' value='打开' onPress={() => { onOpenSource?.() }} />
      <ToggleRow settingKey='search.isShowHistorySearch' title='显示搜索历史' />
      <ToggleRow settingKey='search.isShowHotSearch' title='显示热门搜索' />
    </Group>
  </View>
)
