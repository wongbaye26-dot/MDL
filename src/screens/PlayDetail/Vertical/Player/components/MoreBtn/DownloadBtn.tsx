import { toast } from '@/utils/tools'
import playerState from '@/store/player/state'
import { addTasks } from '@/core/download'
import Btn from './Btn'


export default () => {
  const handleDownload = () => {
    const musicInfo = playerState.playMusicInfo.musicInfo
    if (!musicInfo) return
    const target = 'progress' in musicInfo ? musicInfo.metadata.musicInfo : musicInfo
    if (target.source === 'local') {
      toast('本地歌曲无需下载')
      return
    }
    const count = addTasks([target], { listId: playerState.playMusicInfo.listId })
    toast(count ? `已添加 ${count} 个下载任务` : '这首歌已在下载列表中')
  }

  return <Btn icon="download-2" onPress={handleDownload} />
}
