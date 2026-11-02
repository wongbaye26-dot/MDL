import { memo, useCallback, useMemo, useState } from 'react'
import { ScrollView, TouchableOpacity, View, type LayoutChangeEvent } from 'react-native'

import Text from '@/components/common/Text'
import Image from '@/components/common/Image'
import CoverPlaceholder from '@/components/common/CoverPlaceholder'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import { scaleSizeW } from '@/utils/pixelRatio'

/**
 * 首页「横向歌曲流」。
 *
 * 照飞牛音乐首页的最近播放：固定 **4 行**，列数随数据增长，左右滑动查看。
 * 实现上把数据按 4 个一组切成「列」，每列内部竖排 ——
 * 这样高度天然锁死在 4 行，不会像 flexWrap 那样在不同宽度下变成 3 行或 5 行。
 *
 * 一屏放 2 列（8 首），列宽按容器实际宽度算（横屏内容区被导航挤窄，不能用窗口宽）。
 */

/** 固定 4 行 */
export const RAIL_ROWS = 4
/** 一屏两列 */
const COLS_PER_SCREEN = 2

const PAD = scaleSizeW(16)
const GAP = scaleSizeW(12)
const COVER = scaleSizeW(44)

export interface SongRailProps {
  items: LX.Music.MusicInfo[]
  /** 点击第 index 首（全局下标，不是列内下标） */
  onPress: (index: number) => void
  onLongPress?: (index: number) => void
  /** 显示「本地 / 在线」小标签 */
  showSource?: boolean
  /** 容器宽度变化时回调，方便外部对齐标题的左右边距 */
  onWidthChange?: (width: number) => void
}

const Cell = memo(({ musicInfo, showSource, onPress, onLongPress }: {
  musicInfo: LX.Music.MusicInfo
  /** 显示「本地 / 在线」小标签（最近播放用） */
  showSource?: boolean
  onPress: () => void
  onLongPress?: () => void
}) => {
  const theme = useTheme()
  const [picFailed, setPicFailed] = useState(false)
  // 本地歌曲的封面在 meta.picUrl（MediaStore 的 albumart 或缓存文件路径）
  const pic = musicInfo.meta?.picUrl
  const isLocal = musicInfo.source === 'local'

  return (
    <TouchableOpacity
      style={styles.cell}
      activeOpacity={0.65}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={320}
    >
      {
        pic && !picFailed
          ? <Image url={pic} style={styles.cover} onError={() => { setPicFailed(true) }} />
          : <CoverPlaceholder name={musicInfo.name} size={COVER} radius={10} style={styles.cover} />
      }
      <View style={styles.cellInfo}>
        <Text size={13} numberOfLines={1}>{musicInfo.name}</Text>
        <View style={styles.subRow}>
          <Text size={10} color={theme['c-450']} numberOfLines={1} style={styles.cellSub}>
            {musicInfo.singer || '未知歌手'}
          </Text>
          {
            showSource
              ? (
                <View style={{
                  ...styles.tag,
                  backgroundColor: isLocal ? theme['c-primary-alpha-800'] : 'transparent',
                  borderColor: theme['c-primary-alpha-600'],
                }}>
                  <Text size={8} color={isLocal ? theme['c-primary'] : theme['c-450']}>{isLocal ? '本地' : '在线'}</Text>
                </View>
                )
              : null
          }
        </View>
      </View>
    </TouchableOpacity>
  )
})

export default memo(({ items, onPress, onLongPress, showSource, onWidthChange }: SongRailProps) => {
  const [boxWidth, setBoxWidth] = useState(0)

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width
    setBoxWidth(prev => (Math.abs(prev - w) < 1 ? prev : w))
    onWidthChange?.(w)
  }, [onWidthChange])

  /** 按 4 个一组切列 */
  const columns = useMemo(() => {
    const out: LX.Music.MusicInfo[][] = []
    for (let i = 0; i < items.length; i += RAIL_ROWS) out.push(items.slice(i, i + RAIL_ROWS))
    return out
  }, [items])

  // 首帧还没量到宽度时先用 0，列宽给个保守值避免闪一下超宽
  const colWidth = boxWidth > 0
    ? (boxWidth - PAD * 2 - GAP * (COLS_PER_SCREEN - 1)) / COLS_PER_SCREEN
    : 0

  return (
    <View style={styles.wrap} onLayout={handleLayout}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
        // 一列一停，滑起来有分页感，但不像 pagingEnabled 那样强制整屏
        snapToInterval={colWidth > 0 ? colWidth + GAP : undefined}
        decelerationRate='fast'
        disableIntervalMomentum
      >
        {
          columns.map((column, colIndex) => (
            <View
              key={column[0]?.id ?? colIndex}
              style={[styles.column, { width: colWidth > 0 ? colWidth : undefined }, colIndex > 0 ? styles.columnGap : null]}
            >
              {
                column.map((musicInfo, rowIndex) => (
                  <Cell
                    key={`${musicInfo.id}_${rowIndex}`}
                    musicInfo={musicInfo}
                    showSource={showSource}
                    onPress={() => { onPress(colIndex * RAIL_ROWS + rowIndex) }}
                    onLongPress={onLongPress ? () => { onLongPress(colIndex * RAIL_ROWS + rowIndex) } : undefined}
                  />
                ))
              }
            </View>
          ))
        }
      </ScrollView>
    </View>
  )
})

const styles = createStyle({
  wrap: {
    flexGrow: 0,
    flexShrink: 0,
  },
  content: {
    paddingLeft: 16,
    paddingRight: 16,
  },
  column: {
    justifyContent: 'flex-start',
  },
  columnGap: {
    marginLeft: 12,
  },
  cell: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    marginBottom: 6,
  },
  cover: {
    width: 44,
    height: 44,
    borderRadius: 10,
    marginRight: 10,
  },
  cellInfo: {
    flexGrow: 1,
    flexShrink: 1,
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  cellSub: {
    flexShrink: 1,
  },
  tag: {
    marginLeft: 5,
    paddingLeft: 4,
    paddingRight: 4,
    paddingTop: 0.5,
    paddingBottom: 0.5,
    borderRadius: 4,
    borderWidth: 0.5,
  },
})
