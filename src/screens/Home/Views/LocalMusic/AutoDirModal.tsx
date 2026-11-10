/**
 * 「自动识别有音乐的文件夹」选择弹窗。
 *
 * 扫描手机存储，把直接含有音频文件的目录列出来，勾选后加入额外扫描目录。
 */
import { memo, useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, FlatList, Modal, TouchableOpacity, View } from 'react-native'

import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { createStyle, toast } from '@/utils/tools'
import { contrastOn } from '@/theme/solid'
import { formatSize } from '@/core/download/utils'
import { discoverMusicDirs, type FoundMusicDir } from '@/core/localMusic/discoverDirs'

interface Props {
  visible: boolean
  /** 已在扫描目录里的路径，界面上标「已添加」 */
  existing: string[]
  onClose: () => void
  onConfirm: (dirs: FoundMusicDir[]) => void
}

export default memo(({ visible, existing, onClose, onConfirm }: Props) => {
  const theme = useTheme()
  const [loading, setLoading] = useState(false)
  const [visited, setVisited] = useState(0)
  const [list, setList] = useState<FoundMusicDir[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [scanned, setScanned] = useState(false)

  const startScan = useCallback(async() => {
    setLoading(true)
    setScanned(false)
    setList([])
    setSelected(new Set())
    try {
      const dirs = await discoverMusicDirs({ onProgress: setVisited })
      setList(dirs)
    } catch {
      toast('扫描失败，换个方式手动添加试试')
    } finally {
      setLoading(false)
      setScanned(true)
    }
  }, [])

  useEffect(() => {
    if (!visible) return
    void startScan()
  }, [visible, startScan])

  const toggle = useCallback((path: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }, [])

  const handleConfirm = useCallback(() => {
    const picked = list.filter(item => selected.has(item.path))
    if (!picked.length) {
      toast('先勾选至少一个文件夹')
      return
    }
    onConfirm(picked)
  }, [list, selected, onConfirm])

  const renderItem = ({ item }: { item: FoundMusicDir }) => {
    const added = existing.includes(item.path)
    const checked = selected.has(item.path)
    return (
      <TouchableOpacity
        style={styles.row}
        activeOpacity={0.75}
        onPress={() => {
          if (added) {
            toast('这个文件夹已经在扫描列表里了')
            return
          }
          toggle(item.path)
        }}
      >
        <View style={[styles.check, { borderColor: checked ? theme['c-primary'] : theme['c-350'] }]}>
          {
            checked
              ? <Icon name='check' size={13} color={theme['c-primary']} />
              : null
          }
        </View>
        <View style={styles.info}>
          <Text size={14} color={theme['c-100']} numberOfLines={1}>{item.name}</Text>
          <Text size={11} color={theme['c-450']} numberOfLines={1}>{item.path}</Text>
        </View>
        <Text size={11} color={added ? theme['c-primary'] : theme['c-450']}>
          {added ? '已添加' : `${item.count} 首 · ${formatSize(item.size)}`}
        </Text>
      </TouchableOpacity>
    )
  }

  return (
    <Modal visible={visible} transparent animationType='slide' onRequestClose={onClose}>
      <View style={styles.mask}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: theme['c-content-background'] }]}>
          <View style={styles.head}>
            <View style={styles.headInfo}>
              <Text size={16} color={theme['c-100']}>自动识别音乐文件夹</Text>
              <Text size={11} color={theme['c-450']}>
                {loading ? `正在扫描手机存储…已看 ${visited} 个条目` : `找到 ${list.length} 个有音乐的文件夹`}
              </Text>
            </View>
            <TouchableOpacity style={[styles.close, { backgroundColor: theme['c-primary-alpha-900'] }]} onPress={onClose}>
              <Icon name='close' size={16} color={theme['c-100']} />
            </TouchableOpacity>
          </View>
          {
            loading
              ? (
                <View style={styles.loading}>
                  <ActivityIndicator color={theme['c-primary']} />
                  <Text size={12} color={theme['c-450']} style={{ marginTop: 10 }}>第一次扫描可能需要几秒</Text>
                </View>
                )
              : (
                <FlatList
                  data={list}
                  keyExtractor={item => item.path}
                  renderItem={renderItem}
                  style={styles.list}
                  ListEmptyComponent={(
                    <Text size={12} color={theme['c-450']} style={styles.empty}>
                      {scanned ? '没找到有音乐的文件夹，可以手动选一个目录' : ''}
                    </Text>
                  )}
                />
                )
          }
          <View style={styles.footer}>
            <TouchableOpacity style={[styles.ghost, { borderColor: theme['c-350'] }]} onPress={() => { void startScan() }}>
              <Icon name='refresh' size={14} color={theme['c-100']} />
              <Text size={13} color={theme['c-100']} style={{ marginLeft: 6 }}>重新扫描</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.primary, { backgroundColor: theme['c-primary'] }]}
              onPress={handleConfirm}
            >
              <Text size={13} color={contrastOn(theme['c-primary'])}>
                {selected.size ? `添加 ${selected.size} 个文件夹` : '添加选中文件夹'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
})

const styles = createStyle({
  mask: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { maxHeight: '78%', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 16, paddingBottom: 22 },
  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18 },
  headInfo: { flex: 1 },
  close: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  loading: { paddingVertical: 56, alignItems: 'center' },
  list: { paddingHorizontal: 14, marginTop: 12 },
  empty: { textAlign: 'center', paddingVertical: 40 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 4 },
  check: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.4, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  info: { flex: 1, paddingRight: 10 },
  footer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginTop: 10 },
  ghost: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, marginRight: 10 },
  primary: { flex: 1, alignItems: 'center', borderRadius: 20, paddingVertical: 11 },
})
