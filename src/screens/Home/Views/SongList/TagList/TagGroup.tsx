import { View } from 'react-native'

import Chip from '@/components/common/Chip'
import { type TagInfoItem } from '@/store/songlist/state'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import Text from '@/components/common/Text'

export interface TagGroupProps {
  name: string
  list: TagInfoItem[]
  onTagChange: (name: string, id: string) => void
  activeId: string
}

export default ({ name, list, onTagChange, activeId }: TagGroupProps) => {
  const theme = useTheme()
  return (
    <View>
      {
        name
          ? <Text size={12} style={styles.tagTypeTitle} color={theme['c-450']}>{name}</Text>
          : null
      }
      <View style={styles.tagTypeList}>
        {
          list.map(item => (
            <View key={item.id} style={styles.chipWrap}>
              <Chip
                soft
                label={item.name}
                active={activeId === item.id}
                onPress={() => { onTagChange(item.name, item.id) }}
              />
            </View>
          ))
        }
      </View>
    </View>
  )
}

const styles = createStyle({
  tagTypeTitle: {
    marginTop: 18,
    marginBottom: 10,
  },
  tagTypeList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chipWrap: {
    marginBottom: 8,
  },
})
