import { ScrollView, View } from 'react-native'

import Chip from '@/components/common/Chip'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import { type BoardItem } from '@/store/leaderboard/state'

export const BoardChips = ({ boards, activeId, onChange }: {
  boards: BoardItem[]
  activeId: string
  onChange: (id: string) => void
}) => {
  const theme = useTheme()

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
          : [0, 1, 2, 3].map(i => <View key={i} style={{ ...styles.skeleton, backgroundColor: theme['c-primary-alpha-900'] }} />)
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
    width: 62,
    height: 30,
    borderRadius: 15,
    marginRight: 8,
  },
})
