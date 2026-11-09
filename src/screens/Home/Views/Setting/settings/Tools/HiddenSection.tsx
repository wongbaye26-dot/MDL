import { memo, useCallback, useEffect, useState } from 'react'
import { TouchableOpacity, View } from 'react-native'

import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { getLocalMusicList } from '@/core/localMusic'
import { clearHidden, unhideFolder, unhideSong, useHidden } from '@/core/localMusic/hidden'
import { confirmDialog, createStyle, toast } from '@/utils/tools'
import { Card, InfoLine } from './parts'

/**
 * 隐藏内容（W3 / D-11）。
 *
 * 展示本地音乐里被隐藏的歌曲 / 文件夹，并提供单条恢复与全部恢复。
 * 隐藏不删曲库、不删文件，只是列表派生层过滤。
 */
export default memo(() => {
  const theme = useTheme()
  const hidden = useHidden()
  const [names, setNames] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!hidden.ids.length) {
      setNames({})
      return
    }
    void getLocalMusicList().then(list => {
      const map: Record<string, string> = {}
      for (const item of list) {
        if (!hidden.ids.includes(item.id)) continue
        map[item.id] = `${item.name}${item.singer ? ` - ${item.singer}` : ''}`
      }
      setNames(map)
    })
  }, [hidden.ids])

  const restoreSong = useCallback((id: string) => {
    void unhideSong(id).then(() => { toast('已恢复到本地音乐') })
  }, [])

  const restoreFolder = useCallback((folder: string) => {
    void unhideFolder(folder).then(() => { toast('已恢复该文件夹') })
  }, [])

  const restoreAll = useCallback(() => {
    void confirmDialog({
      title: '恢复全部隐藏内容',
      message: `恢复 ${hidden.ids.length} 首歌和 ${hidden.folders.length} 个文件夹？恢复后会重新出现在本地音乐列表。`,
      confirmButtonText: '全部恢复',
    }).then(confirmed => {
      if (!confirmed) return
      void clearHidden().then(() => { toast('已恢复全部隐藏内容') })
    })
  }, [hidden.ids.length, hidden.folders.length])

  const total = hidden.ids.length + hidden.folders.length

  return (
    <Card title='隐藏内容' desc='隐藏的歌曲/文件夹不会出现在本地音乐列表，不删除文件和曲库记录'>
      <InfoLine
        label='已隐藏'
        desc={total ? '可在下面单条恢复，或一次性全部恢复' : '没有被隐藏的歌曲或文件夹'}
        value={total}
        tone={total ? 'warning' : undefined}
      />
      {
        !total
          ? null
          : (
            <View style={styles.list}>
              {
                hidden.ids.map(id => (
                  <View key={id} style={styles.row}>
                    <Icon name='eye-off-outline' size={14} color={theme['c-450']} />
                    <Text size={12} numberOfLines={1} style={styles.label}>{names[id] ?? id}</Text>
                    <TouchableOpacity onPress={() => { restoreSong(id) }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Text size={11} color={theme['c-primary']}>恢复</Text>
                    </TouchableOpacity>
                  </View>
                ))
              }
              {
                hidden.folders.map(folder => (
                  <View key={folder} style={styles.row}>
                    <Icon name='folder-eye-outline' size={14} color={theme['c-450']} />
                    <Text size={12} numberOfLines={1} style={styles.label}>{folder}</Text>
                    <TouchableOpacity onPress={() => { restoreFolder(folder) }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Text size={11} color={theme['c-primary']}>恢复</Text>
                    </TouchableOpacity>
                  </View>
                ))
              }
              <TouchableOpacity
                style={[styles.restoreAll, { backgroundColor: theme['c-primary-alpha-900'] }]}
                activeOpacity={0.75}
                onPress={restoreAll}
              >
                <Icon name='eye-outline' size={14} color={theme['c-primary']} />
                <Text size={12} color={theme['c-primary']} style={styles.restoreAllText}>全部恢复</Text>
              </TouchableOpacity>
            </View>
            )
      }
    </Card>
  )
})

const styles = createStyle({
  list: {
    paddingLeft: 14,
    paddingRight: 14,
    paddingTop: 4,
    paddingBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
  },
  label: {
    flex: 1,
    marginLeft: 8,
    marginRight: 10,
  },
  restoreAll: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 36,
    borderRadius: 18,
    marginTop: 8,
  },
  restoreAllText: {
    marginLeft: 5,
  },
})
