import { View } from 'react-native'
import { Group, ToggleRow, ChoiceRow } from '../../components/ui'

const SIZE_LABELS = ['小', '标准', '大', '超大']

/** 歌词设置（IA 第 4 组） */
export default () => (
  <View>
    <Group title='歌词设置'>
      <ChoiceRow settingKey='player.lyricSizeIndex' title='歌词字号' desc='播放器歌词页立即生效' options={SIZE_LABELS.map((label, value) => ({ value, label }))} />
      <ChoiceRow settingKey='player.lyricAlign' title='歌词对齐' desc='自动＝竖屏居中、横屏左对齐' options={[
        { value: 'auto', label: '自动' },
        { value: 'center', label: '居中' },
        { value: 'left', label: '左对齐' },
      ]} />
      <ChoiceRow settingKey='player.lyricOffsetMs' title='歌词偏移' desc='歌词比声音快时选负值' options={[-500, -100, 0, 100, 500].map(value => ({
        value,
        label: value === 0 ? '无偏移' : `${value > 0 ? '+' : ''}${(value / 1000).toFixed(1)}s`,
      }))} />
      <ToggleRow settingKey='player.isWordByWordLyric' title='逐字显示' desc='按时间逐字点亮歌词' />
      <ToggleRow settingKey='player.isSingleLineLyric' title='一行显示' desc='只显示当前一行，减少干扰' />
      <ToggleRow settingKey='player.isShowLyricTranslation' title='显示翻译' />
      <ToggleRow settingKey='player.isShowLyricRoma' title='显示罗马音' />
      <ToggleRow settingKey='player.isAutoJyutping' title='自动粤拼' />
      <ToggleRow settingKey='player.isS2t' title='简体转繁体' desc='歌词按繁体显示' />
      <ToggleRow settingKey='player.isShowBluetoothLyric' title='蓝牙歌词' desc='向车载/耳机推送当前歌词' />
      <ToggleRow settingKey='player.isShowBluetoothFullLyric' title='蓝牙全屏歌词' />
    </Group>
  </View>
)
