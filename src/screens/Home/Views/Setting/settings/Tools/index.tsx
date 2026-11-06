import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { View } from 'react-native'

import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { formatSize } from '@/core/download/utils'
import { createStyle, toast } from '@/utils/tools'
import { buildHealthReport, createEmptyHealth, scanLibraryHealth, type LibraryHealth } from './health'
import { isToolsBusy } from './taskLock'
import { Card, HeroCard, ReportButtons, type HeroStat } from './parts'
import BatchRepairSection from './BatchRepairSection'
import CoverFixSection from './CoverFixSection'
import TagScrapeSection from './TagScrapeSection'
import LyricFixSection from './LyricFixSection'
import InvalidEntriesSection from './InvalidEntriesSection'
import HiddenSection from './HiddenSection'
import RecycleSection from './RecycleSection'
import DatabaseSelfCheckSection from './DatabaseSelfCheckSection'
import DuplicateSection from './DuplicateSection'
import RenameSection from './RenameSection'

/**
 * 音乐工具：曲库体检 + 批量补封面 / 刮削标签 / 补歌词 / 清理无效条目。
 *
 * 体检只扫一遍，结果直接分发给下面的分区卡片；任一区块跑完（改过曲库）后
 * 父级 refreshToken +1，触发重新体检，所以统计数字和待处理列表总能跟上。
 */
export default memo(() => {
  const theme = useTheme()
  const [health, setHealth] = useState<LibraryHealth>(createEmptyHealth)
  const [scanning, setScanning] = useState(true)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [refreshToken, setRefreshToken] = useState(0)

  const aliveRef = useRef(true)
  const scanningRef = useRef(false)

  useEffect(() => {
    aliveRef.current = true
    return () => { aliveRef.current = false }
  }, [])

  const scan = useCallback(async() => {
    // 批量任务运行中不重新体检：任务会持续改曲库，扫出来的数字马上作废，还白占 IO
    if (isToolsBusy()) {
      toast('批量任务进行中，完成后再重新体检')
      return
    }
    if (scanningRef.current) return
    scanningRef.current = true
    setScanning(true)
    try {
      const result = await scanLibraryHealth({
        onProgress: setProgress,
        isAlive: () => aliveRef.current,
      })
      if (!aliveRef.current || !result) return
      setHealth(result)
    } finally {
      scanningRef.current = false
      if (aliveRef.current) setScanning(false)
    }
  }, [])

  useEffect(() => {
    void scan()
  }, [scan, refreshToken])

  const handleChanged = useCallback(() => {
    setRefreshToken(token => token + 1)
  }, [])

  // 首次进入、还没有任何体检结果时显示占位符，避免先闪一排 0
  const firstScan = scanning && health.total === 0
  const count = (value: number) => firstScan ? '—' : value
  const stats: HeroStat[] = [
    { key: 'total', label: '总歌曲', value: count(health.total) },
    { key: 'size', label: '总大小', value: firstScan ? '—' : formatSize(health.totalSize), tone: 'muted' },
    {
      key: 'missingCover',
      label: '缺封面',
      value: count(health.missingCovers.length),
      tone: health.missingCovers.length ? 'warning' : 'primary',
    },
    {
      key: 'tag',
      label: '标签待补',
      value: count(health.tagIncomplete.length),
      tone: health.tagIncomplete.length ? 'warning' : 'primary',
    },
    {
      key: 'lyric',
      label: '缺歌词',
      value: count(health.missingLyrics.length),
      tone: health.missingLyrics.length ? 'warning' : 'primary',
    },
    {
      key: 'invalid',
      label: '无效条目',
      value: count(health.invalid.length),
      tone: health.invalid.length ? 'warning' : 'primary',
    },
    {
      key: 'duplicate',
      label: '重复多余',
      value: count(health.duplicateExtras),
      tone: health.duplicateExtras ? 'warning' : 'primary',
    },
    {
      key: 'lowBitrate',
      label: '低码率',
      value: count(health.lowBitrate.length),
      tone: health.lowBitrate.length ? 'warning' : 'primary',
    },
    {
      key: 'duration',
      label: '时长异常',
      value: count(health.durationAbnormal.length),
      tone: health.durationAbnormal.length ? 'warning' : 'primary',
    },
  ]

  const subtitle = scanning
    ? '正在扫描本地曲库…'
    : `最近一次体检：共 ${health.total} 首 · ${formatSize(health.totalSize)}`

  return (
    <View>
      <HeroCard
        title='曲库体检'
        subtitle={subtitle}
        stats={stats}
        scanning={scanning}
        progress={progress}
        onRefresh={() => { void scan() }}
        refreshDisabled={scanning}
      />

      <BatchRepairSection health={health} scanning={scanning} onChanged={handleChanged} />
      <CoverFixSection health={health} scanning={scanning} onChanged={handleChanged} />
      <TagScrapeSection health={health} scanning={scanning} onChanged={handleChanged} />
      <LyricFixSection health={health} scanning={scanning} onChanged={handleChanged} />
      <InvalidEntriesSection health={health} scanning={scanning} onChanged={handleChanged} />
      <HiddenSection />
      <RecycleSection />
      <DatabaseSelfCheckSection />
      <DuplicateSection health={health} scanning={scanning} onChanged={handleChanged} />
      <RenameSection health={health} scanning={scanning} onChanged={handleChanged} />

      <Card title='体检报告' desc='把当前统计与待处理清单复制 / 导出成文本，方便反馈问题'>
        <ReportButtons
          getTitle={() => '曲库体检报告'}
          getLines={() => buildHealthReport(health)}
          disabled={firstScan}
        />
      </Card>

      <Card title='说明'>
        <View style={styles.textBlock}>
          <Text size={11.5} color={theme['c-450']} style={styles.paragraph}>
            「缺封面」按能不能真的显示来算：先看文件里的内嵌封面，再看曲库里记的地址是否可用；
            系统相册接口给的 albumart 地址在没有封面的专辑上也会生成，所以不算有效封面。
          </Text>
          <Text size={11.5} color={theme['c-450']} style={styles.paragraph}>
            补封面会先抽文件内嵌的封面，确实没有才用「歌名 + 歌手」联网搜；找到的图会尽量写进音频文件，
            目录不允许改写时只记在曲库里给本应用使用。
          </Text>
          <Text size={11.5} color={theme['c-450']} style={styles.paragraph}>
            刮削标签会先核对歌名和歌手，对不上就不写（宁可不补，也不写错）；写不进文件时只更新曲库。
          </Text>
          <Text size={11.5} color={theme['c-450']} style={styles.paragraph}>
            歌词只检测真实路径文件旁边的同名 .lrc（SAF content:// 条目无法判断同目录，已跳过），
            补全时会先读文件内嵌歌词 / 缓存，再联网搜索，找到后写成同名 .lrc。
          </Text>
          <Text size={11.5} color={theme['c-450']} style={styles.paragraph}>
            无效条目是曲库里记录的文件已经不存在的歌：「从曲库移除」只会删掉曲库记录，不会删除磁盘文件。
          </Text>
          <Text size={11.5} color={theme['c-450']} style={styles.paragraph}>
            一键修复会按「补封面 → 刮削标签 → 补歌词」的顺序处理所有待修复内容，串行执行避免真机 IO 互相拖慢；
            跑完可以把失败清单复制或导出日志。
          </Text>
          <Text size={11.5} color={theme['c-450']} style={styles.paragraph}>
            重复歌曲只从曲库移除多余记录（每组保留体积最大的一首），不会删除磁盘文件；
            批量重命名先预览再执行，支持 {'{歌名}'} {'{歌手}'} {'{专辑}'} 占位符。
          </Text>
          <Text size={11.5} color={theme['c-450']} style={styles.lastParagraph}>
            批量任务同一时间只会跑一个；处理过程可以随时停止，已完成的结果会保留。
          </Text>
        </View>
      </Card>
    </View>
  )
})

const styles = createStyle({
  textBlock: {
    paddingLeft: 14,
    paddingRight: 14,
    paddingTop: 2,
  },
  paragraph: {
    lineHeight: 18,
    marginBottom: 8,
  },
  lastParagraph: {
    lineHeight: 18,
    marginBottom: 4,
  },
})
