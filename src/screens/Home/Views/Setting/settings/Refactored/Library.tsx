import { View } from 'react-native'
import { Group, ToggleRow, ActionRow } from '../../components/ui'

/** 本地音乐（IA 第 5 组）；曲库工具是深页入口 */
export default ({ onOpenTools }: { onOpenTools?: () => void }) => (
  <View>
    <Group title='本地音乐'>
      <ToggleRow settingKey='list.isClickPlayList' title='点击歌曲直接播放' />
      <ToggleRow settingKey='list.isShowAlbumName' title='显示专辑名' />
      <ToggleRow settingKey='list.isShowInterval' title='显示歌曲时长' />
      <ToggleRow settingKey='search.isShowHistorySearch' title='显示搜索历史' desc='本地音乐搜索框的历史记录' />
      <ToggleRow settingKey='search.isShowHotSearch' title='显示热门搜索' />
      <ActionRow
        title='曲库工具'
        desc='曲库体检、补封面、标签刮削、去重、重命名、隐藏与回收站'
        action='打开'
        onPress={() => { onOpenTools?.() }}
      />
    </Group>
  </View>
)
