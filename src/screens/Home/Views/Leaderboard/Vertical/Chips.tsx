import { ScrollView, TouchableOpacity, View } from 'react-native'

import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import { useSourceListI18n } from '@/components/SourceSelector'
import leaderboardState, { type BoardItem } from '@/store/leaderboard/state'

export const SourceChips = ({ active, onChange }: {
  active: LX.OnlineSource
  onChange: (source: LX.OnlineSource) => void
}) => {
  const theme = useTheme()
  const sourceList = useSourceListI18n(leaderboardState.sources)

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.sourceRow}
    >
      {
        sourceList.map(({ label, action }) => {
          const isActive = action === active
          return (
            <TouchableOpacity
              key={action}
              activeOpacity={0.8}
              onPress={() => { if (!isActive) onChange(action as LX.OnlineSource) }}
              style={{
                ...styles.sourceChip,
                backgroundColor: isActive ? theme['c-primary'] : theme['c-primary-alpha-900'],
                borderColor: isActive ? theme['c-primary'] : theme['c-primary-alpha-700'],
              }}
            >
              <Text size={11} color={isActive ? '#FFFFFF' : theme['c-450']} style={styles.chipText}>{label}</Text>
            </TouchableOpacity>
          )
        })
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
      contentContainerStyle={styles.boardRow}
    >
      {
        boards.length
          ? boards.map(board => {
            const isActive = board.id === activeId
            return (
              <TouchableOpacity
                key={board.id}
                activeOpacity={0.8}
                onPress={() => { if (!isActive) onChange(board.id) }}
                style={{
                  ...styles.boardChip,
                  backgroundColor: isActive ? theme['c-primary-alpha-800'] : theme['c-primary-alpha-900'],
                  borderColor: isActive ? theme['c-primary-alpha-500'] : theme['c-primary-alpha-700'],
                }}
              >
                <Text
                  size={12}
                  color={isActive ? theme['c-primary-light-200'] : theme['c-450']}
                  numberOfLines={1}
                  style={styles.chipText}
                >{board.name}</Text>
              </TouchableOpacity>
            )
          })
          : [0, 1, 2, 3].map(i => (
            <View
              key={i}
              style={{ ...styles.boardChip, ...styles.skeleton, backgroundColor: theme['c-primary-alpha-900'] }}
            />
            ))
      }
    </ScrollView>
  )
}

const styles = createStyle({
  sourceRow: {
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 10,
  },
  sourceChip: {
    height: 26,
    paddingLeft: 12,
    paddingRight: 12,
    borderRadius: 13,
    borderWidth: 0.5,
    justifyContent: 'center',
    marginRight: 8,
  },
  boardRow: {
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 8,
    paddingBottom: 2,
  },
  boardChip: {
    height: 30,
    paddingLeft: 13,
    paddingRight: 13,
    borderRadius: 15,
    borderWidth: 0.5,
    justifyContent: 'center',
    marginRight: 8,
    maxWidth: 180,
  },
  chipText: {
    fontWeight: '500',
  },
  skeleton: {
    width: 62,
    borderWidth: 0,
  },
})
