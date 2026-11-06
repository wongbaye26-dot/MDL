import { memo, useCallback, useEffect, useState } from 'react'
import { TouchableOpacity, View } from 'react-native'

import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { cleanSongName } from '@/utils/songName'
import { confirmDialog, createStyle, toast } from '@/utils/tools'
import {
  emptyRecycleBin,
  getRecycleStats,
  loadRecycleBin,
  restoreRecycleItem,
  type RecycleItem,
} from '@/core/localMusic/recycle'
import { ButtonRow, Card, EmptyState, InfoLine, SecondaryButton } from './parts'

const formatSize = (bytes: number) => {
  if (!bytes) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

/**
 * 回收站（D-19 补）：批量「删文件」移入这里，可恢复或清空。
 * 恢复只把文件放回原路径，不会自动写曲库；重新扫描目录后回到本地音乐。
 */
export default memo(() => {
  const theme = useTheme()
  const [items, setItems] = useState<RecycleItem[]>([])
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async() => {
    setItems(await loadRecycleBin())
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  const stats = getRecycleStats(items)

  const restoreOne = useCallback((item: RecycleItem) => {
    if (busy) return
    setBusy(true)
    void restoreRecycleItem(item).then(async result => {
      toast(result.ok ? '已恢复到原路径，重新扫描目录后可回到曲库' : `恢复失败：${result.error ?? '未知错误'}`)
      await refresh()
    }).finally(() => { setBusy(false) })
  }, [busy, refresh])

  const restoreAll = useCallback(() => {
    if (busy || !items.length) return
    void confirmDialog({
      title: '恢复全部文件',
      message: `把 ${items.length} 个文件恢复到原路径？重新扫描目录后它们会回到本地音乐。`,
      confirmButtonText: '全部恢复',
    }).then(confirmed => {
      if (!confirmed) return
      setBusy(true)
      void (async() => {
        let ok = 0
        let failed = 0
        for (const item of items) {
          const result = await restoreRecycleItem(item)
          if (result.ok) ok += 1
          else failed += 1
        }
        toast(failed ? `已恢复 ${ok} 个，${failed} 个失败` : `已恢复 ${ok} 个文件`)
        await refresh()
      })().finally(() => { setBusy(false) })
    })
  }, [busy, items, refresh])

  const clearAll = useCallback(() => {
    if (busy || !items.length) return
    void confirmDialog({
      title: '清空回收站',
      message: `永久删除 ${items.length} 个文件（${formatSize(stats.size)}）？此操作无法撤销。`,
      confirmButtonText: '永久删除',
      danger: true,
    }).then(confirmed => {
      if (!confirmed) return
      setBusy(true)
      void emptyRecycleBin().then(async removed => {
        toast(`已永久删除 ${removed} 个文件`)
        await refresh()
      }).finally(() => { setBusy(false) })
    })
  }, [busy, items.length, stats.size, refresh])

  return (
    <Card title='回收站' desc='批量「删文件」会先移到这里，可恢复或永久清空'>
      <InfoLine
        label='已删除文件'
        desc={items.length ? `占用 ${formatSize(stats.size)}，恢复后需重新扫描目录` : '回收站是空的'}
        value={items.length}
        tone={items.length ? 'warning' : undefined}
      />
      {
        !items.length
          ? <EmptyState text='回收站是空的' icon='delete-outline' />
          : (
            <View style={styles.list}>
              {
                items.slice(0, 20).map(item => (
                  <View key={`${item.id}_${item.deletedAt}`} style={styles.row}>
                    <View style={styles.info}>
                      <Text size={12} numberOfLines={1}>{cleanSongName(item.name, item.singer)}</Text>
                      <Text size={9.5} color={theme['c-450']} numberOfLines={1} style={styles.sub}>
                        {`${formatSize(item.size)} · ${new Date(item.deletedAt).toLocaleDateString()}`}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => { restoreOne(item) }} disabled={busy} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Text size={11} color={theme['c-primary']}>恢复</Text>
                    </TouchableOpacity>
                  </View>
                ))
              }
              {items.length > 20 ? <Text size={10} color={theme['c-450']} style={styles.more}>{`还有 ${items.length - 20} 个未显示`}</Text> : null}
            </View>
            )
      }
      {
        items.length
          ? (
            <ButtonRow>
              <SecondaryButton label='全部恢复' icon='restore' disabled={busy} onPress={restoreAll} />
              <SecondaryButton label='清空回收站' icon='delete-forever-outline' danger disabled={busy} onPress={clearAll} />
            </ButtonRow>
            )
          : null
      }
    </Card>
  )
})

const styles = createStyle({
  list: {
    paddingLeft: 14,
    paddingRight: 14,
    paddingTop: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  info: {
    flex: 1,
    marginRight: 10,
  },
  sub: {
    marginTop: 2,
  },
  more: {
    marginTop: 4,
    marginBottom: 8,
  },
})
