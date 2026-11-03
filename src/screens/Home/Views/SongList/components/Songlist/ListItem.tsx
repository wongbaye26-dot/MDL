import { memo } from 'react'
import { View, TouchableOpacity } from 'react-native'

import { createStyle } from '@/utils/tools'
import { type ListInfoItem } from '@/store/songlist/state'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { NAV_SHEAR_NATIVE_IDS } from '@/config/constant'
import { useTheme } from '@/store/theme/hook'
import Image from '@/components/common/Image'

/**
 * 歌单广场的两列大卡片。
 *
 * 封面 1:1（宽度由列表算好传进来）、圆角 16、播放量角标保留；
 * 标题最多两行、创建者一行，字号比三列版放大一档，远看更清楚。
 */
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
        <View style={{ ...styles.coverWrap, width, height: width }}>
          <Image
            url={item.img}
            nativeID={`${NAV_SHEAR_NATIVE_IDS.songlistDetail_pic}_from_${item.id}`}
            style={{ width, height: width, borderRadius: 16 }}
          />
          {
            item.play_count
              ? (
                <View style={styles.playBadge}>
                  <Icon name='play' size={9} color='#FFFFFF' />
                  <Text size={10} color='#FFFFFF' style={styles.playText}>{item.play_count}</Text>
                </View>
                )
              : null
          }
          { showSource ? <Text size={9} color='#FFFFFF' style={styles.sourceLabel}>{item.source}</Text> : null }
        </View>
        <Text size={13.5} numberOfLines={2} style={styles.name}>{item.name}</Text>
        {
          item.author
            ? <Text size={11} color={theme['c-450']} numberOfLines={1} style={styles.author}>{item.author}</Text>
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
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  playBadge: {
    position: 'absolute',
    left: 7,
    bottom: 7,
    flexDirection: 'row',
    alignItems: 'center',
    height: 19,
    paddingLeft: 5,
    paddingRight: 7,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.46)',
  },
  playText: {
    marginLeft: 2,
  },
  sourceLabel: {
    position: 'absolute',
    top: 0,
    right: 0,
    paddingLeft: 6,
    paddingRight: 6,
    paddingTop: 2,
    paddingBottom: 2,
    borderBottomLeftRadius: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  name: {
    marginTop: 8,
    lineHeight: 19,
    fontWeight: '500',
  },
  author: {
    marginTop: 4,
  },
})
