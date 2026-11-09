import { View } from 'react-native'
import { Group, ToggleRow } from '../../components/ui'

/** 本地音乐（IA 第 5 组）；曲库工具走页头独立入口，不在设置列表重复 */
export default () => (
  <View>
    <Group title='本地音乐'>
      <ToggleRow settingKey='list.isClickPlayList' title='点击歌曲直接播放' />
      <ToggleRow settingKey='list.isShowAlbumName' title='显示专辑名' />
      <ToggleRow settingKey='list.isShowInterval' title='显示歌曲时长' />
      <ToggleRow settingKey='search.isShowHistorySearch' title='显示搜索历史' desc='本地音乐搜索框的历史记录' />
      <ToggleRow settingKey='search.isShowHotSearch' title='显示热门搜索' />
    </Group>
  </View>
)
