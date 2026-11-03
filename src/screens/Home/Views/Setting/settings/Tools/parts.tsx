import { memo } from 'react'
import { ScrollView, TouchableOpacity, View } from 'react-native'

import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { contrastOn } from '@/theme/solid'
import { createStyle } from '@/utils/tools'

/**
 * 音乐工具里两个区块（补封面 / 刮削标签）共用的 UI 零件。
 * 样式沿用设置页现有的卡片风格（Section + 圆角行 + 半透明主色块）。
 */

/** 「缺少封面的歌曲 / 标签可补全的歌曲」这一行 */
export const CountRow = memo(({ title, desc, count, highlight }: {
  title: string
  desc: string
  count: string | number
  highlight?: boolean
}) => {
  const theme = useTheme()
  return (
    <View style={styles.row}>
      <View style={styles.info}>
        <Text size={14}>{title}</Text>
        <Text size={10} color={theme['c-450']} style={styles.desc}>{desc}</Text>
      </View>
      <Text size={20} color={highlight ? theme['c-primary'] : theme['c-450']} style={styles.count}>{count}</Text>
    </View>
  )
})

/** 进度条 + 「正在处理 n / total」 */
export const ProgressLine = memo(({ label, done, total }: {
  label: string
  done: number
  total: number
}) => {
  const theme = useTheme()
  const percent = total ? Math.min(100, Math.round(done / total * 100)) : 0
  return (
    <View style={styles.progressWrap}>
      <View style={styles.progressText}>
        <Text size={12} color={theme['c-450']}>{label} {done} / {total}</Text>
        <Text size={11} color={theme['c-450']}>{total ? `${percent}%` : ''}</Text>
      </View>
      <View style={{ ...styles.progressTrack, backgroundColor: theme['c-primary-alpha-800'] }}>
        <View style={{
          ...styles.progressBar,
          width: `${percent}%`,
          backgroundColor: theme['c-primary'],
        }} />
      </View>
    </View>
  )
})

/** 主操作按钮 + 重新统计按钮 */
export const ActionRow = memo(({ label, icon, disabled, onPress, onRefresh, refreshDisabled }: {
  label: string
  icon: string
  disabled: boolean
  onPress: () => void
  onRefresh: () => void
  refreshDisabled?: boolean
}) => {
  const theme = useTheme()
  const onPrimary = contrastOn(theme['c-primary'])
  return (
    <View style={styles.btnRow}>
      <TouchableOpacity
        activeOpacity={0.85}
        disabled={disabled}
        onPress={onPress}
        style={{
          ...styles.btn,
          backgroundColor: disabled ? theme['c-primary-alpha-800'] : theme['c-primary'],
        }}
      >
        <Icon name={icon} size={15} color={disabled ? theme['c-450'] : onPrimary} />
        <Text size={13} color={disabled ? theme['c-450'] : onPrimary} style={styles.btnText}>{label}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        activeOpacity={0.85}
        disabled={refreshDisabled}
        onPress={onRefresh}
        style={{ ...styles.refreshBtn, backgroundColor: theme['c-primary-alpha-900'] }}
      >
        <Icon name='refresh' size={15} color={theme['c-450']} />
      </TouchableOpacity>
    </View>
  )
})

/** 运行中的「停止」按钮（批量刮削可中止） */
export const StopRow = memo(({ onStop, disabled }: { onStop: () => void, disabled?: boolean }) => {
  const theme = useTheme()
  return (
    <View style={styles.btnRow}>
      <TouchableOpacity
        activeOpacity={0.85}
        disabled={disabled}
        onPress={onStop}
        style={{ ...styles.btn, backgroundColor: theme['c-primary-alpha-800'] }}
      >
        <Icon name='stop' size={15} color={theme['c-450']} />
        <Text size={13} color={theme['c-450']} style={styles.btnText}>
          {disabled ? '正在停止…' : '停止'}
        </Text>
      </TouchableOpacity>
    </View>
  )
})

export interface PreviewRow {
  key: string
  title: string
  sub?: string
}

/** 待处理列表（最多传 30 条，太多会把设置页拉得很长） */
export const PreviewList = memo(({ rows }: { rows: PreviewRow[] }) => {
  const theme = useTheme()
  return (
    <ScrollView style={styles.list} nestedScrollEnabled>
      {
        rows.map(row => (
          <View key={row.key} style={styles.listRow}>
            <View style={{ ...styles.dot, backgroundColor: theme['c-primary-alpha-700'] }} />
            <Text size={12} numberOfLines={1} style={styles.listName}>{row.title}</Text>
            {
              row.sub
                ? (
                  <Text size={10} color={theme['c-450']} numberOfLines={1} style={styles.listSub}>
                    {row.sub}
                  </Text>
                  )
                : null
            }
          </View>
        ))
      }
    </ScrollView>
  )
})

/** 跑完以后的一行小结 */
export const SummaryBar = memo(({ text }: { text: string }) => {
  const theme = useTheme()
  return (
    <View style={{ ...styles.summary, backgroundColor: theme['c-primary-alpha-900'] }}>
      <Text size={11.5} color={theme['c-450']} style={styles.summaryText}>{text}</Text>
    </View>
  )
})

const styles = createStyle({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 14,
    paddingRight: 14,
    paddingTop: 12,
    paddingBottom: 12,
  },
  info: {
    flexGrow: 1,
    flexShrink: 1,
  },
  desc: {
    marginTop: 3,
  },
  count: {
    fontWeight: '700',
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 14,
    marginRight: 14,
    marginBottom: 12,
  },
  btn: {
    flexGrow: 1,
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
    borderRadius: 20,
  },
  btnText: {
    marginLeft: 6,
  },
  refreshBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressWrap: {
    paddingLeft: 14,
    paddingRight: 14,
    paddingBottom: 14,
  },
  progressText: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
  },
  summary: {
    marginLeft: 14,
    marginRight: 14,
    marginBottom: 12,
    paddingLeft: 12,
    paddingRight: 12,
    paddingTop: 9,
    paddingBottom: 9,
    borderRadius: 12,
  },
  summaryText: {
    lineHeight: 17,
  },
  list: {
    maxHeight: 220,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 14,
    paddingRight: 14,
    paddingTop: 7,
    paddingBottom: 7,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginRight: 8,
  },
  listName: {
    flexShrink: 1,
  },
  listSub: {
    flexShrink: 0,
    marginLeft: 8,
    maxWidth: 150,
  },
})
