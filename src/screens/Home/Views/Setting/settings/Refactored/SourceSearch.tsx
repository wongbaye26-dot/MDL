import { View } from 'react-native'
import { Group, ToggleRow } from '../../components/ui'
import Source from '../Source'

export default () => (
  <View>
    <Source />
    <Group title='搜索' icon='magnify' color='#3B82F6'>
      <ToggleRow settingKey='search.isShowHistorySearch' title='显示搜索历史' />
      <ToggleRow settingKey='search.isShowHotSearch' title='显示热门搜索' />
    </Group>
  </View>
)
