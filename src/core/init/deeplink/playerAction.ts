import { collectMusic, dislikeMusic, pause, play, playNext, playPrev, togglePlay, uncollectMusic } from '@/core/player/player'
import { openPlayerWithTransition } from '@/utils/playerOpen'

export type PlayerAction = 'play' | 'pause' | 'skipNext' | 'skipPrev' | 'togglePlay' | 'collect' | 'uncollect' | 'dislike' | 'open'

export const handlePlayerAction = async(action: PlayerAction) => {
  switch (action) {
    case 'play':
      play()
      break
    case 'pause':
      void pause()
      break
    case 'skipNext':
      void playNext()
      break
    case 'skipPrev':
      void playPrev()
      break
    case 'togglePlay':
      togglePlay()
      break
    case 'collect':
      collectMusic()
      break
    case 'uncollect':
      uncollectMusic()
      break
    case 'dislike':
      void dislikeMusic()
      break
    case 'open':
      // 桌面小组件封面点击：直接切到播放器页（已在播放器页时等于无操作）
      openPlayerWithTransition()
      break
    // default: throw new Error('Unknown action: ' + (action as any ?? ''))
  }
}
