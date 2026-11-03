import { ScrollView, View } from 'react-native'

import Chip from '@/components/common/Chip'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import { useSourceListI18n } from '@/components/SourceSelector'
import leaderboardState, { type BoardItem } from '@/store/leaderboard/state'

export const SourceChips = ({ active, onChange }: {
  active: LX.OnlineSource
  onChange: (source: LX.OnlineSource) => void
}) => {
  const sourceList = useSourceListI18n(leaderboardState.sources)

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.sourceRow}
    >
      {
        sourceList.map(({ label, action }) => (
          <Chip
            key={action}
            size='sm'
            label={label}
            active={action === active}
            onPress={() => { if (action !== active) onChange(action as LX.OnlineSource) }}
          />
        ))
      }
    </ScrollView>
  )
}

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
  sourceRow: {
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 6,
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
