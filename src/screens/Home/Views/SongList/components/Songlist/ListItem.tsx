import { memo } from 'react'
import { View, TouchableOpacity } from 'react-native'

import { createStyle } from '@/utils/tools'
import { type ListInfoItem } from '@/store/songlist/state'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { NAV_SHEAR_NATIVE_IDS } from '@/config/constant'
import { useTheme } from '@/store/theme/hook'
import Image from '@/components/common/Image'

export default memo(({ item, index, width, showSource, onPress }: {
  item: ListInfoItem
  index: number
  showSource: boolean
  width: number
  onPress: (item: ListInfoItem, index: number) => void
}) => {
  const theme = useTheme()

  if (!item.source) return <View style={{ width }} />

  const handlePress = () => {
    onPress(item, index)
  }

  return (
    <View style={{ ...styles.card, width }}>
      <TouchableOpacity activeOpacity={0.8} onPress={handlePress}>
        <View style={styles.coverWrap}>
          <Image
            url={item.img}
            nativeID={`${NAV_SHEAR_NATIVE_IDS.songlistDetail_pic}_from_${item.id}`}
            style={{ width, height: width, borderRadius: 14 }}
          />
          {
            item.play_count
              ? (
                <View style={styles.playBadge}>
                  <Icon name='play' size={8} color='#FFFFFF' />
                  <Text size={9} color='#FFFFFF' style={styles.playText}>{item.play_count}</Text>
                </View>
                )
              : null
          }
          { showSource ? <Text size={9} color='#FFFFFF' style={styles.sourceLabel}>{item.source}</Text> : null }
        </View>
        <Text size={12} numberOfLines={2} style={styles.name}>{item.name}</Text>
        {
          item.author
            ? <Text size={10} color={theme['c-450']} numberOfLines={1} style={styles.author}>{item.author}</Text>
            : null
        }
      </TouchableOpacity>
    </View>
  )
})

const styles = createStyle({
  card: {
    marginBottom: 16,
  },
  coverWrap: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  playBadge: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    height: 17,
    paddingLeft: 5,
    paddingRight: 6,
    borderRadius: 9,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  playText: {
    marginLeft: 2,
  },
  sourceLabel: {
    position: 'absolute',
    top: 0,
    right: 0,
    paddingLeft: 5,
    paddingRight: 5,
    paddingTop: 2,
    paddingBottom: 2,
    borderBottomLeftRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  name: {
    marginTop: 7,
    lineHeight: 16,
  },
  author: {
    marginTop: 3,
  },
})
