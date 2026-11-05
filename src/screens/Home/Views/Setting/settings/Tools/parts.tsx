import { memo, useEffect, useState } from 'react'
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native'

import Text from '@/components/common/Text'
import Image from '@/components/common/Image'
import CoverPlaceholder from '@/components/common/CoverPlaceholder'
import { Icon } from '@/components/common/Icon'
import Tag from '@/components/common/Tag'
import { isCoverUsable, readEmbeddedCover } from '@/core/localMusic/cover'
import { cleanSongName } from '@/utils/songName'
import { useTheme } from '@/store/theme/hook'
import { contrastOn } from '@/theme/solid'
import { createStyle } from '@/utils/tools'
import { setSpText } from '@/utils/pixelRatio'
import { copyReport, exportReport } from './report'

/**
 * 音乐工具 UI 零件：中性卡片 + 统计块 + 按钮 + 进度条 + 汇总 chip + 带封面的预览列表。
 *
 * 视觉走「干净卡片」：卡片用半透明白（浅色主题）/ 半透明白光（深色主题），
 * 不再用大块主题色铺底；主题色只出现在主按钮、进度条、关键数字上，
 * 这样切任何主题（含深色）都不会出现刺眼的撞色。
 */

/** 问题数字的提示色（主题里没有 warning 语义色，用这个在深浅底上都读得出来） */
const WARN_COLOR = '#E8A33D'

// 和设置页其它卡片同一套 Material You 主色淡底，不再用中性灰白卡片
const cardBackground = (theme: LX.ActiveTheme) => theme['c-primary-alpha-900']
const cardBorder = (theme: LX.ActiveTheme) => theme['c-primary-alpha-700']
const dividerColor = (theme: LX.ActiveTheme) => theme['c-primary-alpha-700']
const tileBackground = (theme: LX.ActiveTheme) => theme['c-primary-alpha-800']

/** 分区卡片：标题 + 说明 + 内容 */
export const Card = memo(({ title, desc, right, children }: {
  title: string
  desc?: string
  /** 标题右侧的自定义内容（例如数量 badge） */
  right?: React.ReactNode
  children: React.ReactNode
}) => {
  const theme = useTheme()
  return (
    <View style={{ ...styles.card, backgroundColor: cardBackground(theme), borderColor: cardBorder(theme) }}>
      <View style={styles.cardHead}>
        <View style={styles.cardTitleWrap}>
          <Text size={14} style={styles.cardTitle}>{title}</Text>
          {desc ? <Text size={10} color={theme['c-450']} style={styles.cardDesc}>{desc}</Text> : null}
        </View>
        {right}
      </View>
      {children}
    </View>
  )
})

export interface HeroStat {
  key: string
  label: string
  value: string | number
  /** 有问题时用警示色突出，健康数量保持普通字色 */
  tone?: 'warning' | 'primary' | 'muted'
}

/** 曲库体检 hero：标题 + 总结 + 6 个数字块 + 扫描进度 */
export const HeroCard = memo(({
  title,
  subtitle,
  stats,
  scanning,
  progress,
  onRefresh,
  refreshDisabled,
}: {
  title: string
  subtitle: string
  stats: HeroStat[]
  scanning: boolean
  progress: { done: number, total: number }
  onRefresh: () => void
  refreshDisabled?: boolean
}) => {
  const theme = useTheme()
  return (
    <View style={{ ...styles.card, ...styles.heroCard, backgroundColor: cardBackground(theme), borderColor: cardBorder(theme) }}>
      <View style={styles.heroHead}>
        <View style={styles.heroTitleWrap}>
          <Text size={17} style={styles.cardTitle}>{title}</Text>
          <Text size={11} color={theme['c-450']} style={styles.heroSubtitle}>{subtitle}</Text>
        </View>
        <TouchableOpacity
          activeOpacity={0.8}
          disabled={refreshDisabled}
          onPress={onRefresh}
          style={{ ...styles.refreshBtn, backgroundColor: tileBackground(theme), opacity: refreshDisabled ? 0.5 : 1 }}
        >
          <Icon name='refresh' size={17} color={theme['c-450']} />
        </TouchableOpacity>
      </View>

      <View style={styles.statsGrid}>
        {
          stats.map(stat => {
            const color = stat.tone === 'warning'
              ? WARN_COLOR
              : stat.tone === 'primary' ? theme['c-primary'] : theme['c-font']
            return (
              <View key={stat.key} style={styles.statCell}>
                <View style={{ ...styles.statTile, backgroundColor: tileBackground(theme) }}>
                  <Text size={19} color={color} style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>{stat.value}</Text>
                  <Text size={10} color={theme['c-450']} style={styles.statLabel} numberOfLines={1}>{stat.label}</Text>
                </View>
              </View>
            )
          })
        }
      </View>

      {
        scanning
          ? <ProgressLine label='正在体检曲库' done={progress.done} total={progress.total} />
          : null
      }
    </View>
  )
})

/** 信息行：左边标题/说明，右边数字 */
export const InfoLine = memo(({ label, desc, value, tone }: {
  label: string
  desc?: string
  value: string | number
  tone?: 'warning' | 'primary'
}) => {
  const theme = useTheme()
  const color = tone === 'warning' ? WARN_COLOR : tone === 'primary' ? theme['c-primary'] : theme['c-font']
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoWrap}>
        <Text size={13.5}>{label}</Text>
        {desc ? <Text size={10} color={theme['c-450']} style={styles.infoDesc}>{desc}</Text> : null}
      </View>
      <Text size={19} color={color} style={styles.infoValue}>{value}</Text>
    </View>
  )
})

/** 进度条：done / total + 百分比 */
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
        <Text size={11} color={theme['c-450']}>{label} {done} / {total}</Text>
        <Text size={11} color={theme['c-450']}>{total ? `${percent}%` : ''}</Text>
      </View>
      <View style={{ ...styles.progressTrack, backgroundColor: dividerColor(theme) }}>
        <View style={{
          ...styles.progressBar,
          width: `${percent}%`,
          backgroundColor: theme['c-primary'],
        }} />
      </View>
    </View>
  )
})

/** 主按钮（主色实心） */
export const PrimaryButton = memo(({ label, icon, disabled, onPress }: {
  label: string
  icon: string
  disabled?: boolean
  onPress: () => void
}) => {
  const theme = useTheme()
  const onPrimary = contrastOn(theme['c-primary'])
  const color = disabled ? theme['c-450'] : onPrimary
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      disabled={disabled}
      onPress={onPress}
      style={{
        ...styles.primaryBtn,
        backgroundColor: disabled ? tileBackground(theme) : theme['c-primary'],
      }}
    >
      <Icon name={icon} size={15} color={color} />
      <Text size={13} color={color} style={styles.btnText}>{label}</Text>
    </TouchableOpacity>
  )
})

/** 次要按钮（描边/浅底），用于「停止」「移除」这类危险或辅助操作 */
export const SecondaryButton = memo(({ label, icon, disabled, danger, onPress }: {
  label: string
  icon: string
  disabled?: boolean
  danger?: boolean
  onPress: () => void
}) => {
  const theme = useTheme()
  const color = danger ? WARN_COLOR : theme['c-font']
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      disabled={disabled}
      onPress={onPress}
      style={{
        ...styles.primaryBtn,
        ...styles.secondaryBtn,
        backgroundColor: tileBackground(theme),
        borderColor: dividerColor(theme),
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Icon name={icon} size={15} color={color} />
      <Text size={13} color={color} style={styles.btnText}>{label}</Text>
    </TouchableOpacity>
  )
})

/** 按钮行：主操作 + 停止（运行中）/ 附加操作 */
export const ButtonRow = memo(({ children }: { children: React.ReactNode }) => (
  <View style={styles.btnRow}>{children}</View>
))

export interface SummaryChip {
  key: string
  label: string
  value: string | number
  tone?: 'warning' | 'primary' | 'muted'
}

/** 跑完以后的一排小 chip：写入 N / 未找到 N … */
export const SummaryChips = memo(({ chips }: { chips: SummaryChip[] }) => {
  const theme = useTheme()
  return (
    <View style={styles.chips}>
      {
        chips.map(chip => {
          const color = chip.tone === 'warning'
            ? WARN_COLOR
            : chip.tone === 'primary' ? theme['c-primary'] : theme['c-450']
          return (
            <View key={chip.key} style={{ ...styles.chip, backgroundColor: tileBackground(theme), borderColor: dividerColor(theme) }}>
              <Text
                size={10.5}
                color={color}
                style={{
                  includeFontPadding: false,
                  textAlignVertical: 'center',
                  lineHeight: setSpText(12),
                }}
              >{chip.label} {chip.value}</Text>
            </View>
          )
        })
      }
    </View>
  )
})

/** 空态：一排居中提示，别让卡片里空荡荡的 */
export const EmptyState = memo(({ text, icon = 'check-circle-outline' }: { text: string, icon?: string }) => {
  const theme = useTheme()
  return (
    <View style={styles.empty}>
      <Icon name={icon} size={18} color={theme['c-450']} />
      <Text size={12} color={theme['c-450']} style={styles.emptyText}>{text}</Text>
    </View>
  )
})

/** 预览行缩略图：曲库地址可用就直接显示，否则抽文件内嵌封面，失败落到首字占位块 */
const CoverThumb = memo(({ item }: { item: LX.Music.MusicInfoLocal }) => {
  const [uri, setUri] = useState('')
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    setFailed(false)
    setUri('')
    void (async() => {
      const stored = item.meta.picUrl ?? ''
      // 曲库里已经是可用地址（网络 / 存在的缓存文件）就直接用，省一次开文件
      if (stored && await isCoverUsable(stored).catch(() => false)) {
        if (alive) setUri(stored)
        return
      }
      const pic = await readEmbeddedCover(item).catch(() => '')
      if (alive) setUri(pic)
    })()
    return () => { alive = false }
  }, [item])

  const size = 36
  const radius = 8
  if (!uri || failed) {
    return (
      <View style={styles.thumbWrap}>
        <CoverPlaceholder name={cleanSongName(item.name, item.singer)} size={size} radius={radius} />
      </View>
    )
  }
  return (
    <View style={styles.thumbWrap}>
      <Image url={uri} style={{ width: size, height: size, borderRadius: radius }} onError={() => { setFailed(true) }} />
    </View>
  )
})

export interface PreviewRow {
  key: string
  item: LX.Music.MusicInfoLocal
  title: string
  sub?: string
  /** 右侧状态标签（如「将改名」「冲突」「SAF 跳过」） */
  tags?: string
  tagTone?: 'primary' | 'warning' | 'muted' | 'success' | 'danger'
}

/** 待处理列表：最多传 30 条进来，太多会把设置页拉得很长；列表本身可滚动 */
export const PreviewList = memo(({ rows }: { rows: PreviewRow[] }) => {
  const theme = useTheme()
  return (
    <ScrollView
      style={styles.list}
      nestedScrollEnabled
      showsVerticalScrollIndicator={false}
    >
      {
        rows.map((row, index) => (
          <View
            key={row.key}
            style={{
              ...styles.listRow,
              borderTopWidth: index > 0 ? StyleSheet.hairlineWidth : 0,
              borderTopColor: dividerColor(theme),
            }}
          >
            <CoverThumb item={row.item} />
            <View style={styles.listInfo}>
              <Text size={12.5} numberOfLines={1} style={styles.listTitle}>{row.title}</Text>
              {row.sub ? <Text size={10} color={theme['c-450']} numberOfLines={1} style={styles.listSub}>{row.sub}</Text> : null}
            </View>
            {row.tags ? <Tag label={row.tags} size='sm' tone={row.tagTone ?? 'muted'} style={styles.listTags} /> : null}
          </View>
        ))
      }
    </ScrollView>
  )
})

/** 结果导出按钮组：复制到剪贴板 / 导出日志文件（批量任务汇总用） */
export const ReportButtons = memo(({ getTitle, getLines, disabled }: {
  /** 导出文件标题 */
  getTitle: () => string
  /** 清单行（每行一条） */
  getLines: () => string[]
  disabled?: boolean
}) => {
  const [exporting, setExporting] = useState(false)

  const handleCopy = () => {
    copyReport(getLines().join('\n'))
  }

  const handleExport = async() => {
    if (exporting) return
    setExporting(true)
    try {
      await exportReport(getTitle(), getLines())
    } finally {
      setExporting(false)
    }
  }

  return (
    <ButtonRow>
      <SecondaryButton
        label='复制结果'
        icon='content-copy'
        disabled={disabled === true || exporting}
        onPress={handleCopy}
      />
      <SecondaryButton
        label={exporting ? '导出中…' : '导出日志'}
        icon='file-export-outline'
        disabled={disabled === true || exporting}
        onPress={() => { void handleExport() }}
      />
    </ButtonRow>
  )
})

const styles = createStyle({
  card: {
    borderRadius: 16,
    borderWidth: 0.5,
    marginBottom: 14,
    paddingTop: 14,
    paddingBottom: 12,
    overflow: 'hidden',
  },
  heroCard: {
    paddingBottom: 6,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingLeft: 14,
    paddingRight: 12,
    paddingBottom: 10,
  },
  cardTitleWrap: {
    flexGrow: 1,
    flexShrink: 1,
  },
  cardTitle: {
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  cardDesc: {
    marginTop: 3,
    lineHeight: 14,
  },
  heroHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 12,
    paddingBottom: 12,
  },
  heroTitleWrap: {
    flexGrow: 1,
    flexShrink: 1,
  },
  heroSubtitle: {
    marginTop: 3,
  },
  refreshBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    marginLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingLeft: 8,
    paddingRight: 8,
  },
  statCell: {
    width: '33.33%',
    paddingLeft: 4,
    paddingRight: 4,
    paddingBottom: 8,
  },
  statTile: {
    borderRadius: 12,
    paddingLeft: 10,
    paddingRight: 8,
    paddingTop: 8,
    paddingBottom: 8,
  },
  statValue: {
    fontWeight: '700',
  },
  statLabel: {
    marginTop: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 14,
    paddingRight: 14,
    paddingTop: 4,
    paddingBottom: 10,
  },
  infoWrap: {
    flexGrow: 1,
    flexShrink: 1,
  },
  infoDesc: {
    marginTop: 3,
    lineHeight: 14,
  },
  infoValue: {
    fontWeight: '700',
    marginLeft: 10,
  },
  progressWrap: {
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 2,
    paddingBottom: 12,
  },
  progressText: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 7,
  },
  progressTrack: {
    height: 5,
    borderRadius: 2.5,
    overflow: 'hidden',
  },
  progressBar: {
    height: 5,
    borderRadius: 2.5,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 14,
    paddingRight: 14,
    paddingBottom: 6,
  },
  primaryBtn: {
    flexGrow: 1,
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 38,
    borderRadius: 19,
    marginBottom: 8,
  },
  secondaryBtn: {
    borderWidth: 0.5,
    marginLeft: 8,
  },
  btnText: {
    marginLeft: 6,
    fontWeight: '600',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingLeft: 12,
    paddingRight: 12,
    paddingBottom: 6,
  },
  chip: {
    height: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    borderWidth: 0.5,
    paddingLeft: 9,
    paddingRight: 9,
    marginRight: 6,
    marginBottom: 6,
    flexShrink: 0,
  },
  empty: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 12,
    paddingBottom: 16,
    paddingLeft: 14,
    paddingRight: 14,
  },
  emptyText: {
    marginLeft: 8,
  },
  thumbWrap: {
    width: 36,
    height: 36,
    marginRight: 10,
    borderRadius: 8,
    overflow: 'hidden',
  },
  list: {
    maxHeight: 224,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 14,
    paddingRight: 14,
    paddingTop: 7,
    paddingBottom: 7,
  },
  listInfo: {
    flexGrow: 1,
    flexShrink: 1,
  },
  listTitle: {
    flexShrink: 1,
  },
  listSub: {
    marginTop: 2,
  },
  listTags: {
    flexShrink: 0,
    marginLeft: 8,
    maxWidth: 120,
  },
})
