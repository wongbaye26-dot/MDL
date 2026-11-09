import { memo, useCallback, useEffect, useRef } from 'react'
import { View } from 'react-native'

import Text from '@/components/common/Text'
import CapsuleIconButton from '@/components/common/CapsuleIconButton'
import { createStyle } from '@/utils/tools'
import { getExternalStoragePaths, stat } from '@/utils/fs'
import { useTheme } from '@/store/theme/hook'
import { useStatusbarHeight } from '@/store/common/hook'
import NewFolderModal, { type NewFolderType } from './NewFolderModal'
import OpenStorageModal, { type OpenDirModalType } from './OpenStorageModal'
import type { PathItem } from './ListItem'

export default memo(({
  title,
  path,
  onRefreshDir,
  onOpenDir,
}: {
  title: string
  path: string
  onRefreshDir: (dir: string) => Promise<PathItem[]>
  onOpenDir: (dir: string) => Promise<PathItem[]>
}) => {
  const theme = useTheme()
  const newFolderTypeRef = useRef<NewFolderType>(null)
  const openDirModalTypeRef = useRef<OpenDirModalType>(null)
  const storagePathsRef = useRef<string[]>([])
  const statusBarHeight = useStatusbarHeight()

  const checkExternalStoragePath = useCallback(() => {
    storagePathsRef.current = []
    void getExternalStoragePaths().then(async(storagePaths) => {
      for (const path of storagePaths) {
        try {
          if (!(await stat(path)).canRead) continue
        } catch { continue }
        storagePathsRef.current.push(path)
      }
    })
  }, [])
  useEffect(() => { checkExternalStoragePath() }, [checkExternalStoragePath])

  return (
    <>
      <View style={{
        ...styles.header,
        height: 56 + statusBarHeight,
        paddingTop: statusBarHeight,
        backgroundColor: theme['c-content-background'],
        borderBottomColor: theme['c-primary-alpha-700'],
      }} onStartShouldSetResponder={() => true}>
        <View style={styles.titleContent}>
          <Text size={20} color={theme['c-font']} numberOfLines={1} style={styles.title}>{title}</Text>
          <Text style={styles.subTitle} color={theme['c-450']} size={11} numberOfLines={1}>{path}</Text>
        </View>
        <View style={styles.actions}>
          <CapsuleIconButton icon='sd-card' label='存储位置' onPress={() => { openDirModalTypeRef.current?.show(storagePathsRef.current) }} />
          <CapsuleIconButton icon='folder-plus' label='新建文件夹' onPress={() => { newFolderTypeRef.current?.show(path) }} />
          <CapsuleIconButton icon='refresh' label='刷新' onPress={() => { void onRefreshDir(path); checkExternalStoragePath() }} />
        </View>
      </View>
      <OpenStorageModal ref={openDirModalTypeRef} onOpenDir={onOpenDir} />
      <NewFolderModal ref={newFolderTypeRef} onRefreshDir={onRefreshDir} />
    </>
  )
})

const styles = createStyle({
  header: {
    flexGrow: 0,
    flexShrink: 0,
    flexDirection: 'row',
    paddingLeft: 16,
    paddingRight: 12,
    alignItems: 'center',
    borderBottomWidth: 0.5,
    zIndex: 2,
  },
  titleContent: { flexGrow: 1, flexShrink: 1, minWidth: 0 },
  title: { fontWeight: '700' },
  subTitle: { marginTop: 1 },
  actions: { flexDirection: 'row', alignItems: 'center' },
})
