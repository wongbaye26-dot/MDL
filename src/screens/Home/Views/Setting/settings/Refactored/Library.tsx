import { View } from 'react-native'
import { Group, ToggleRow, UiSectionTitle } from '../../components/ui'
import Tools from '../Tools'

export default () => (
  <View>
    <Group title='列表显示' icon='format-list-bulleted' color='#F97316'>
      <ToggleRow settingKey='list.isClickPlayList' title='点击歌曲直接播放' />
      <ToggleRow settingKey='list.isShowAlbumName' title='显示专辑名' />
      <ToggleRow settingKey='list.isShowInterval' title='显示歌曲时长' />
    </Group>
    <UiSectionTitle title='曲库工具' desc='体检、补封面、刮削标签、去重与重命名' />
    <Tools />
  </View>
)
