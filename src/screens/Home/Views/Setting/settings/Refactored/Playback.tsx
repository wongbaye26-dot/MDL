import { View } from 'react-native'
import { Group, ToggleRow, ChoiceRow } from '../../components/ui'
import { setPlaybackRate } from '@/plugins/player'
import { TRY_QUALITYS_LIST } from '@/core/music/utils'
import { QUALITY_LABEL } from '@/core/download/utils'

const RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map(value => ({ value, label: `${value}×` }))

export const PlaybackSection = () => (
  <View>
    <Group title='播放设置'>
      <ToggleRow settingKey='player.isSavePlayTime' title='记住播放进度' desc='应用重启后回到上次播放位置' />
      <ToggleRow settingKey='player.isAutoCleanPlayedList' title='自动清空已播放列表' desc='随机播放时已播放歌曲重新参与随机' />
      <ToggleRow settingKey='player.isHandleAudioFocus' title='音频焦点自动暂停' desc='其他应用发声时自动暂停' />
      <ToggleRow settingKey='player.startupAutoPlay' title='启动后自动播放' desc='冷启动恢复上次歌曲后直接播放' />
    </Group>
  </View>
)

export const AudioQualitySection = () => {
  const qualityOptions = ([...TRY_QUALITYS_LIST, '128k'] as LX.Quality[]).reverse().map(value => ({
    value,
    label: QUALITY_LABEL[value] ?? value,
  }))
  return (
    <View>
      <Group title='音质与音效'>
        <ChoiceRow settingKey='player.playQuality' title='优先播放音质' desc='音源缺少该档位时自动降级' options={qualityOptions} />
        <ChoiceRow settingKey='player.playbackRate' title='播放倍速' desc='切歌/重启后保持，蓝牙与通知控制不受影响' options={RATES} onChange={value => { void setPlaybackRate(value) }} />
        <ChoiceRow settingKey='player.fadeSeconds' title='切歌淡入淡出' desc='切换歌曲时音量渐变，避免爆音' options={[0, 2, 4, 6, 8, 12].map(value => ({ value, label: value ? `${value} 秒` : '关闭' }))} />
        <ToggleRow settingKey='player.isEnableAudioOffload' title='启用音频卸载' desc='省电；部分设备可能加载失败' />
      </Group>
    </View>
  )
}

export default () => (
  <View>
    <PlaybackSection />
    <AudioQualitySection />
  </View>
)
