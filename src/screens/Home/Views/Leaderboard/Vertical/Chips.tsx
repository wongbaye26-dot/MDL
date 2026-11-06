import { ScrollView } from 'react-native'

import Chip from '@/components/common/Chip'
import { SkeletonBlock } from '@/components/common/Skeleton'
import { createStyle } from '@/utils/tools'
import { type BoardItem } from '@/store/leaderboard/state'

export const BoardChips = ({ boards, activeId, onChange }: {
  boards: BoardItem[]
  activeId: string
  onChange: (id: string) => void
}) => {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.boardRow}
    >
      {
        boards.length
          ? boards.map(board => (
            <Chip
              key={board.id}
              label={board.name}
              active={board.id === activeId}
              onPress={() => { if (board.id !== activeId) onChange(board.id) }}
            />
          ))
          : [0, 1, 2, 3].map(i => <SkeletonBlock key={i} width={62} height={30} radius={15} style={styles.skeleton} />)
      }
    </ScrollView>
  )
}

const styles = createStyle({
  scroll: {
    flexGrow: 0,
    flexShrink: 0,
  },
  boardRow: {
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 8,
  },
  skeleton: {
    marginRight: 8,
  },
})
