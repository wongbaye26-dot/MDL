import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native'

import Input, { type InputType } from '@/components/common/Input'
import Text from '@/components/common/Text'
import CapsuleButton from '@/components/common/CapsuleButton'
import CapsuleIconButton from '@/components/common/CapsuleIconButton'
import { Icon } from '@/components/common/Icon'
import { useSheetPalette } from '@/components/common/ActionSheet/palette'
import { useKeyboard, useUnmounted, useWindowSize } from '@/utils/hooks'
import { createStyle, toast } from '@/utils/tools'
import { getManagedFolders, stat, removeManagedFolder, selectManagedFolder } from '@/utils/fs'
import { getOpenStoragePath, saveOpenStoragePath } from '@/utils/data'
import type { PathItem } from './ListItem'

const filterFileName = /[\\:*?#"<>|]/

export interface OpenDirModalType {
  show: (paths: string[]) => void
}

/** 打开存储位置：统一底部 Sheet，替换旧 ConfirmAlert + 旧 Button */
export default forwardRef<OpenDirModalType, { onOpenDir: (dir: string) => Promise<PathItem[]> }>(({ onOpenDir }, ref) => {
  const palette = useSheetPalette()
  const { keyboardShown, keyboardHeight } = useKeyboard()
  const { height: windowHeight } = useWindowSize()
  const inputRef = useRef<InputType>(null)
  const [visible, setVisible] = useState(false)
  const [paths, setPaths] = useState<string[]>([])
  const [contentPaths, setContentPaths] = useState<string[]>([])
  const [text, setText] = useState('')
  const isUnmounted = useUnmounted()

  useImperativeHandle(ref, () => ({
    show(storagePaths) {
      setPaths(storagePaths)
      setText('')
      setVisible(true)
      void getManagedFolders().then(dirs => { if (!isUnmounted.current) setContentPaths(dirs) })
      void getOpenStoragePath().then(path => { if (path) setText(path) })
    },
  }))

  const close = () => { setVisible(false) }

  const handleConfirm = async() => {
    const target = text.trim()
    if (target) {
      if (!target.startsWith('content://') && (!target.startsWith('/') || filterFileName.test(target))) {
        toast(global.i18n.t('open_storage_error_tip'), 'long')
        return
      }
      try {
        if (!(await stat(target)).canRead) {
          toast('Permission denied', 'long')
          return
        }
      } catch (err: any) {
        toast('Open failed: ' + err.message, 'long')
        return
      }
      void onOpenDir(target)
    }
    void saveOpenStoragePath(target)
    close()
  }

  const removeSelectStoragePath = async(path: string) => {
    await removeManagedFolder(path)
    const dirs = await getManagedFolders()
    if (!isUnmounted.current) setContentPaths(dirs)
  }

  const handleSelectStorage = () => {
    void selectManagedFolder(true).then((dir) => {
      if (!dir || isUnmounted.current) return
      void onOpenDir(dir.path)
      close()
    }).catch((err) => {
      toast(global.i18n.t('open_storage_select_managed_folder_failed_tip', { msg: err.message }))
    })
  }

  const keyboardSpace = keyboardShown ? keyboardHeight : 0
  const PathRow = ({ path, removable }: { path: string, removable?: boolean }) => (
    <View style={styles.row}>
      <TouchableOpacity style={styles.rowMain} activeOpacity={0.7} onPress={() => { setText(path) }}>
        <View style={[styles.rowIcon, { backgroundColor: palette.card }]}>
          <Icon name='folder-outline' size={18} color={palette.primary} />
        </View>
        <Text size={12} color={palette.text} numberOfLines={2} style={styles.rowText}>{path}</Text>
      </TouchableOpacity>
      {removable
        ? (
          <TouchableOpacity onPress={() => { void removeSelectStoragePath(path) }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Icon name='close-circle' size={18} color={palette.textSecondary} />
          </TouchableOpacity>
          )
        : null}
    </View>
  )

  return (
    <Modal visible={visible} transparent statusBarTranslucent animationType='fade' onRequestClose={close}>
      <KeyboardAvoidingView style={styles.mask} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={close} />
        <View style={{ ...styles.sheet, marginBottom: keyboardSpace, maxHeight: Math.min(windowHeight * 0.9, 760), backgroundColor: palette.bg, borderColor: palette.border }}>
          <View style={[styles.grabber, { backgroundColor: palette.border }]} />
          <View style={styles.head}>
            <View style={[styles.headIcon, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <Icon name='sd-card' size={20} color={palette.primary} />
            </View>
            <View style={styles.headInfo}>
              <Text size={17} color={palette.text} numberOfLines={1} style={styles.title}>
                {paths.length > 1 ? global.i18n.t('open_storage_title') : global.i18n.t('open_storage_not_found_title')}
              </Text>
              <Text size={11} color={palette.textSecondary} numberOfLines={1}>选择或输入可读取的目录</Text>
            </View>
            <CapsuleIconButton icon='close' label='关闭' onPress={close} />
          </View>
          <ScrollView keyboardShouldPersistTaps='always' showsVerticalScrollIndicator={false}>
            <Input
              ref={inputRef}
              placeholder={global.i18n.t('open_storage_tip')}
              value={text}
              onChangeText={setText}
              multiline
              numberOfLines={3}
              textAlignVertical='top'
              style={{ ...styles.input, backgroundColor: palette.card, borderColor: palette.border }}
            />
            <Text size={11} color={palette.textSecondary} style={styles.sectionTitle}>系统存储</Text>
            {paths.map(path => <PathRow key={path} path={path} />)}
            {contentPaths.length
              ? (
                <>
                  <Text size={11} color={palette.textSecondary} style={styles.sectionTitle}>已保存的目录</Text>
                  {contentPaths.map(path => <PathRow key={path} path={path} removable />)}
                </>
                )
              : null}
            <Text size={11} color={palette.textSecondary} style={styles.tip}>{global.i18n.t('open_storage_select_path_tip')}</Text>
          </ScrollView>
          <View style={styles.btnRow}>
            <CapsuleButton icon='folder-open-outline' label={global.i18n.t('open_storage_select_path')} primary={false} onPress={handleSelectStorage} />
            <View style={{ flex: 1 }} />
            <CapsuleButton icon='close' label='取消' primary={false} onPress={close} />
            <View style={{ width: 8 }} />
            <CapsuleButton icon='check' label='打开' onPress={() => { void handleConfirm() }} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
})

const styles = createStyle({
  mask: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { width: '100%', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 0.5, paddingLeft: 20, paddingRight: 20, paddingTop: 8, paddingBottom: 24 },
  grabber: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  headIcon: { width: 40, height: 40, borderRadius: 14, borderWidth: 0.5, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  headInfo: { flex: 1, minWidth: 0 },
  title: { fontWeight: '700' },
  input: { minHeight: 72, borderRadius: 14, borderWidth: 0.5, paddingLeft: 14, paddingRight: 14, paddingTop: 10, paddingBottom: 10 },
  sectionTitle: { marginTop: 14, marginBottom: 2 },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 48, borderBottomWidth: 0.5, borderBottomColor: 'rgba(128,128,128,0.16)' },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0 },
  rowIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  rowText: { flex: 1, minWidth: 0 },
  tip: { marginTop: 12, lineHeight: 16 },
  btnRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16 },
})
