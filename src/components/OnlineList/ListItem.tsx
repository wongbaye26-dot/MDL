import { memo, useRef, type ComponentRef } from 'react'
import { View, TouchableOpacity, type GestureResponderEvent } from 'react-native'
// import Button from '@/components/common/Button'
import Text from '@/components/common/Text'
import Badge, { type BadgeType } from '@/components/common/Badge'
import { Icon } from '@/components/common/Icon'
import Image from '@/components/common/Image'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { getListDivider } from '@/theme/designTokens'
import { scaleSizeH } from '@/utils/pixelRatio'
import { LIST_ITEM_HEIGHT } from '@/config/constant'
import { createStyle, type RowInfo } from '@/utils/tools'
import type { Position } from './ListMenu'

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

export default memo(({ item, index, showSource, picUrl, onPress, onLongPress, onShowMenu, selectedList, rowInfo, isShowAlbumName, isShowInterval, viewMode = 'list', showRank }: {
  item: LX.Music.MusicInfoOnline
  index: number
  showSource?: boolean
  /** 已解析好的封面地址：源数据没带封面时由列表层补全（歌单详情的兜底） */
  picUrl?: string
  onPress: (item: LX.Music.MusicInfoOnline, index: number) => void
  /** 长按：除歌曲外还带出手指按下的屏幕位置，供悬浮菜单就近弹出 */
  onLongPress: (item: LX.Music.MusicInfoOnline, index: number, position: Position) => void
  onShowMenu: (item: LX.Music.MusicInfoOnline, index: number, position: Position) => void
  selectedList: LX.Music.MusicInfoOnline[]
  rowInfo: RowInfo
  isShowAlbumName: boolean
  isShowInterval: boolean
  viewMode?: 'list' | 'card'
  showRank?: boolean
}) => {
  const theme = useTheme()

  const isSelected = selectedList.includes(item)

  const moreButtonRef = useRef<ComponentRef<typeof TouchableOpacity>>(null)
  const handleShowMenu = () => {
    if (moreButtonRef.current?.measure) {
      moreButtonRef.current.measure((fx, fy, width, height, px, py) => {
        // console.log(fx, fy, width, height, px, py)
        onShowMenu(item, index, { x: Math.ceil(px), y: Math.ceil(py), w: Math.ceil(width), h: Math.ceil(height) })
      })
    }
  }
  /**
   * 长按：以前是直接进多选，现在和 ⋮ 一样弹悬浮菜单，位置用手指按下的屏幕坐标
   * （w/h 记 0，表示菜单以这个点为准定位，由 FloatingMenu 夹到屏内）。
   */
  const handleLongPress = (event: GestureResponderEvent) => {
    onLongPress(item, index, {
      x: Math.ceil(event.nativeEvent.pageX),
      y: Math.ceil(event.nativeEvent.pageY),
      w: 0,
      h: 0,
    })
  }
  const tagInfo = useQualityTag(item)

  const singer = `${item.singer}${isShowAlbumName && item.meta.albumName ? ` · ${item.meta.albumName}` : ''}`


  if (viewMode === 'card') {
    return (
      <View style={[
        styles.card,
        // 排行榜卡片第二行会折成两行（歌手 · 专辑名），比普通卡片高 8dp；
        // 搜索等其它卡片模式仍是 68dp，不受影响
        showRank ? styles.cardWithRank : null,
        {
          backgroundColor: isSelected ? theme['c-primary-background-hover'] : theme['c-primary-alpha-900'],
          borderColor: theme['c-primary-alpha-700'],
        },
      ]}>
        <TouchableOpacity
          style={styles.cardLeft}
          activeOpacity={0.75}
          accessibilityRole='button'
          accessibilityLabel={`${item.name}${item.singer ? ` ${item.singer}` : ''}`}
          accessibilityState={{ selected: isSelected }}
          onPress={() => { onPress(item, index) }}
          onLongPress={handleLongPress}
        >
          {/* 卡片行也要保留名次（排行榜已改用 list 行，card 模式留给搜索等调用方） */}
          { showRank ? <View style={styles.cardRank}><RankBadge index={index} /></View> : null }
          <Image url={picUrl} style={styles.cardCover} />
          <View style={styles.cardInfo}>
            <Text size={14} numberOfLines={1} style={styles.cardName}>{item.name}</Text>
            {/* 音质 / 来源角标：和列表模式保持一致，切卡片后不丢信息 */}
            <View style={[styles.cardMetaRow, showRank ? styles.cardMetaRowRank : null]}>
              { tagInfo.type ? <Badge type={tagInfo.type}>{tagInfo.text}</Badge> : null }
              { showSource ? <Badge type="tertiary">{(item.source as string) === 'local' ? '本地' : item.source}</Badge> : null }
              {/* 排行榜允许两行：一行为歌手、一行为「· 专辑名」，避免专辑名被省略号截掉 */}
              <Text size={11} color={theme['c-450']} numberOfLines={showRank ? 2 : 1} style={styles.cardSinger}>{singer}</Text>
            </View>
          </View>
          {isShowInterval ? <Text size={11} color={theme['c-400']} style={styles.interval}>{item.interval ?? ''}</Text> : null}
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleShowMenu}
          ref={moreButtonRef}
          style={styles.moreButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole='button'
          accessibilityLabel='更多操作'
        >
          <Icon name="dots-vertical" style={{ color: theme['c-350'] }} size={13} />
        </TouchableOpacity>
      </View>
    )
  }

  /** 列表模式显示专辑时给第二行多留一行高度：专辑名经常被歌手名挤掉 */
  const showAlbum = isShowAlbumName && !!item.meta.albumName
  return (
    <View style={{ ...styles.listItem, width: rowInfo.rowWidth, height: showAlbum ? ITEM_HEIGHT + 16 : ITEM_HEIGHT, backgroundColor: isSelected ? theme['c-primary-background-hover'] : 'rgba(0,0,0,0)' }}>
      <TouchableOpacity
        style={styles.listItemLeft}
        accessibilityRole='button'
        accessibilityLabel={`${item.name}${item.singer ? ` ${item.singer}` : ''}`}
        accessibilityState={{ selected: isSelected }}
        onPress={() => { onPress(item, index) }}
        onLongPress={handleLongPress}
      >
        { showRank ? <RankBadge index={index} /> : null }
        <Image url={picUrl} style={showRank ? styles.coverWithRank : styles.cover} />
        <View style={styles.itemInfo}>
          <Text numberOfLines={1}>{item.name}</Text>
          <View style={styles.listItemSingle}>
            { tagInfo.type ? <Badge type={tagInfo.type}>{tagInfo.text}</Badge> : null }
            { showSource ? <Badge type="tertiary">{(item.source as string) === 'local' ? '本地' : item.source}</Badge> : null }
            <Text style={styles.listItemSingleText} size={11} color={theme['c-500']} numberOfLines={showAlbum ? 2 : 1}>{singer}</Text>
          </View>
        </View>
        {
          isShowInterval ? (
            <Text size={11} color={theme['c-250']} numberOfLines={1} style={styles.interval}>{item.interval ?? ''}</Text>
          ) : null
        }
      </TouchableOpacity>
     <TouchableOpacity
        onPress={handleShowMenu}
        ref={moreButtonRef}
        style={styles.moreButton}
        accessibilityRole='button'
        accessibilityLabel='更多操作'
      >
        <Icon name="dots-vertical" style={{ color: theme['c-350'] }} size={12} />
      </TouchableOpacity>
      <View pointerEvents='none' style={{ position: 'absolute', left: showRank ? 95 : 65, right: 0, bottom: 0, height: 0.5, backgroundColor: getListDivider(theme) }} />
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
    // 封面补全后只更新这一行的地址，不参与比较的话新封面进不来
    prevProps.picUrl === nextProps.picUrl &&
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
    // 卡片行给固定高度：FlatList 的单元格在部分场景会把子项拉伸到整屏，
    // 固定高度才能保证一行就是一张 68dp 的卡片（封面 52 + 上下 padding 8）。
    height: 68,
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
  cardWithRank: {
    // 排行榜卡片：第二行可能折成两行（歌手 · 专辑名），比普通卡片高 8dp；
    // 只作用于 showRank 的卡片，搜索等其它卡片模式仍是 68dp
    height: 76,
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
    // Android 上必须把宽度约束死：只给 grow/shrink 时 Text 会按 max-content 撑开，
    // 再被父级裁掉 —— 表现就是「第二行专辑名被硬切、没有省略号也不折行」。
    // flexBasis: 0 让宽度完全由剩余空间决定，minWidth: 0 才允许收缩到内容宽度以下。
    flexBasis: 0,
    minWidth: 0,
  },
  cardRank: {
    marginRight: 2,
  },
  cardName: {
    fontWeight: '600',
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    // 同理：这一行是「角标 + 歌手/专辑」的横排，必须能收缩才能把剩余宽度交给 Text 去折行
    flexShrink: 1,
    minWidth: 0,
  },
  cardMetaRowRank: {
    // 第二行折成两行时角标改为顶对齐，避免角标被文字块居中后偏下
    alignItems: 'flex-start',
  },
  cardSinger: {
    flexShrink: 1,
    // 文字节点也要允许收缩到内容宽度以下，numberOfLines={2} 才会真正折行/省略
    minWidth: 0,
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

