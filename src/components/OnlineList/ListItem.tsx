import { memo, useRef } from 'react'
import { View, TouchableOpacity } from 'react-native'
// import Button from '@/components/common/Button'
import Text from '@/components/common/Text'
import Badge, { type BadgeType } from '@/components/common/Badge'
import { Icon } from '@/components/common/Icon'
import Image from '@/components/common/Image'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { scaleSizeH } from '@/utils/pixelRatio'
import { LIST_ITEM_HEIGHT } from '@/config/constant'
import { createStyle, type RowInfo } from '@/utils/tools'

export const ITEM_HEIGHT = scaleSizeH(LIST_ITEM_HEIGHT)

const useQualityTag = (musicInfo: LX.Music.MusicInfoOnline) => {
  const t = useI18n()
  let info: { type: BadgeType | null, text: string } = { type: null, text: '' }
  // 本地歌曲没有 _qualitys（那是音源返回的），直接访问会抛 TypeError 把整页打白
  const qualitys = musicInfo.meta._qualitys ?? {}
  if (qualitys.flac24bit) {
    info.type = 'secondary'
    info.text = t('quality_lossless_24bit')
  } else if (qualitys.flac ?? qualitys.ape) {
    info.type = 'secondary'
    info.text = t('quality_lossless')
  } else if (qualitys['320k']) {
    info.type = 'tertiary'
    info.text = t('quality_high_quality')
  }

  return info
}

const RANK_COLORS = ['#F5B942', '#C9D3E0', '#D8915F']

const RankBadge = ({ index }: { index: number }) => {
  const theme = useTheme()
  const rank = index + 1
  if (rank <= 3) {
    const color = RANK_COLORS[rank - 1]
    return (
      <View style={styles.rankWrap}>
        <View style={{ ...styles.rankTop, backgroundColor: `${color}26`, borderColor: `${color}66` }}>
          <Text size={12} color={color} style={styles.rankTopText}>{rank}</Text>
        </View>
      </View>
    )
  }
  return (
    <View style={styles.rankWrap}>
      <Text size={12} color={theme['c-400']} style={styles.rankText}>{rank}</Text>
    </View>
  )
}

export default memo(({ item, index, showSource, onPress, onLongPress, onShowMenu, selectedList, rowInfo, isShowAlbumName, isShowInterval, viewMode = 'list', showRank }: {
  item: LX.Music.MusicInfoOnline
  index: number
  showSource?: boolean
  onPress: (item: LX.Music.MusicInfoOnline, index: number) => void
  onLongPress: (item: LX.Music.MusicInfoOnline, index: number) => void
  onShowMenu: (item: LX.Music.MusicInfoOnline, index: number, position: { x: number, y: number, w: number, h: number }) => void
  selectedList: LX.Music.MusicInfoOnline[]
  rowInfo: RowInfo
  isShowAlbumName: boolean
  isShowInterval: boolean
  viewMode?: 'list' | 'card'
  showRank?: boolean
}) => {
  const theme = useTheme()

  const isSelected = selectedList.includes(item)

  const moreButtonRef = useRef<TouchableOpacity>(null)
  const handleShowMenu = () => {
    if (moreButtonRef.current?.measure) {
      moreButtonRef.current.measure((fx, fy, width, height, px, py) => {
        // console.log(fx, fy, width, height, px, py)
        onShowMenu(item, index, { x: Math.ceil(px), y: Math.ceil(py), w: Math.ceil(width), h: Math.ceil(height) })
      })
    }
  }
  const tagInfo = useQualityTag(item)

  const singer = `${item.singer}${isShowAlbumName && item.meta.albumName ? ` · ${item.meta.albumName}` : ''}`


  if (viewMode === 'card') {
    return (
      <View style={{ ...styles.card, backgroundColor: isSelected ? theme['c-primary-background-hover'] : theme['c-primary-alpha-900'], borderColor: theme['c-primary-alpha-700'] }}>
        <TouchableOpacity style={styles.cardLeft} activeOpacity={0.75} onPress={() => { onPress(item, index) }} onLongPress={() => { onLongPress(item, index) }}>
          <Image url={item.meta.picUrl} style={styles.cardCover} />
          <View style={styles.cardInfo}>
            <Text size={14} numberOfLines={1} style={styles.cardName}>{item.name}</Text>
            <Text size={11} color={theme['c-450']} numberOfLines={1} style={styles.cardSinger}>{singer}</Text>
          </View>
          {isShowInterval ? <Text size={11} color={theme['c-400']} style={styles.interval}>{item.interval ?? ''}</Text> : null}
        </TouchableOpacity>
        <TouchableOpacity onPress={handleShowMenu} ref={moreButtonRef} style={styles.moreButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Icon name="dots-vertical" style={{ color: theme['c-350'] }} size={13} />
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={{ ...styles.listItem, width: rowInfo.rowWidth, height: ITEM_HEIGHT, backgroundColor: isSelected ? theme['c-primary-background-hover'] : 'rgba(0,0,0,0)' }}>
      <TouchableOpacity style={styles.listItemLeft} onPress={() => { onPress(item, index) }} onLongPress={() => { onLongPress(item, index) }}>
        { showRank ? <RankBadge index={index} /> : null }
        <Image url={item.meta.picUrl} style={showRank ? styles.coverWithRank : styles.cover} />
        <View style={styles.itemInfo}>
          <Text numberOfLines={1}>{item.name}</Text>
          <View style={styles.listItemSingle}>
            { tagInfo.type ? <Badge type={tagInfo.type}>{tagInfo.text}</Badge> : null }
            { showSource ? <Badge type="tertiary">{(item.source as string) === 'local' ? '本地' : item.source}</Badge> : null }
            <Text style={styles.listItemSingleText} size={11} color={theme['c-500']} numberOfLines={1}>{singer}</Text>
          </View>
        </View>
        {
          isShowInterval ? (
            <Text size={11} color={theme['c-250']} numberOfLines={1} style={styles.interval}>{item.interval ?? ''}</Text>
          ) : null
        }
      </TouchableOpacity>
     <TouchableOpacity onPress={handleShowMenu} ref={moreButtonRef} style={styles.moreButton}>
        <Icon name="dots-vertical" style={{ color: theme['c-350'] }} size={12} />
      </TouchableOpacity>
    </View>
  )
}, (prevProps, nextProps) => {
  return !!(prevProps.item === nextProps.item &&
    prevProps.index === nextProps.index &&
    prevProps.isShowAlbumName === nextProps.isShowAlbumName &&
    prevProps.isShowInterval === nextProps.isShowInterval &&
    // showSource 必须参与比较：搜索结果的「本地/来源」标记会随本地匹配变化，
    // 漏掉它的话旧行会被 memo 挡住不重渲染，出现「徽标不显示 / 刷新后才出现」。
    prevProps.showSource === nextProps.showSource &&
    nextProps.selectedList.includes(nextProps.item) == prevProps.selectedList.includes(nextProps.item)
  )
})

const styles = createStyle({
  listItem: {
    // width: '100%',
    flexDirection: 'row',
    flexWrap: 'nowrap',
    // paddingLeft: 10,
    paddingRight: 2,
    alignItems: 'center',
    // borderBottomWidth: BorderWidths.normal,
  },
  listItemLeft: {
    flex: 1,
    flexGrow: 1,
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sn: {
    width: 38,
    // fontSize: 12,
    textAlign: 'center',
    // backgroundColor: 'rgba(0,0,0,0.2)',
    paddingLeft: 3,
    paddingRight: 3,
  },
  cover: {
    width: 42,
    height: 42,
    borderRadius: 10,
    marginLeft: 12,
    marginRight: 11,
  },
  coverWithRank: {
    width: 42,
    height: 42,
    borderRadius: 10,
    marginLeft: 6,
    marginRight: 11,
  },
  rankWrap: {
    width: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  rankTop: {
    width: 22,
    height: 22,
    borderRadius: 8,
    borderWidth: 0.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankTopText: {
    fontWeight: '800',
  },
  rankText: {
    fontWeight: '600',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
    marginRight: 12,
    marginBottom: 8,
    paddingLeft: 8,
    paddingRight: 2,
    paddingTop: 8,
    paddingBottom: 8,
    borderRadius: 16,
    borderWidth: 0.5,
  },
  cardLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardCover: {
    width: 52,
    height: 52,
    borderRadius: 14,
    marginRight: 12,
  },
  cardInfo: {
    flexGrow: 1,
    flexShrink: 1,
  },
  cardName: {
    fontWeight: '600',
  },
  cardSinger: {
    marginTop: 3,
  },
  interval: {
    width: 44,
    flexGrow: 0,
    flexShrink: 0,
    textAlign: 'right',
    marginRight: 2,
  },
  itemInfo: {
    flexGrow: 1,
    flexShrink: 1,
    paddingRight: 2,
    // paddingTop: 10,
    // paddingBottom: 10,
  },
  // listItemTitle: {
  //   // backgroundColor: 'rgba(0,0,0,0.2)',
  //   flexGrow: 0,
  //   flexShrink: 1,
  //   // fontSize: 15,
  // },
  listItemSingle: {
    paddingTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    // alignItems: 'flex-end',
    // backgroundColor: 'rgba(0,0,0,0.2)',
  },
  listItemTimeLabel: {
    marginRight: 5,
    fontWeight: '400',
  },
  listItemSingleText: {
    // fontSize: 13,
    // paddingTop: 2,
    flexGrow: 0,
    flexShrink: 1,
    fontWeight: '300',
  },
  listItemBadge: {
    // fontSize: 10,
    paddingLeft: 5,
    paddingTop: 2,
    alignSelf: 'flex-start',
  },
  listItemRight: {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 'auto',
    justifyContent: 'center',
  },
  moreButton: {
    height: '80%',
    paddingLeft: 16,
    paddingRight: 16,
    // paddingTop: 10,
    // paddingBottom: 10,
    // backgroundColor: 'rgba(0,0,0,0.2)',
    justifyContent: 'center',
  },
})

