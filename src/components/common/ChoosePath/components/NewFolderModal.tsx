import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { KeyboardAvoidingView, Modal, Platform, StyleSheet, TouchableOpacity, View } from 'react-native'

import Input, { type InputType } from '@/components/common/Input'
import Text from '@/components/common/Text'
import CapsuleButton from '@/components/common/CapsuleButton'
import CapsuleIconButton from '@/components/common/CapsuleIconButton'
import { Icon } from '@/components/common/Icon'
import { useSheetPalette } from '@/components/common/ActionSheet/palette'
import { useKeyboard, useUnmounted, useWindowSize } from '@/utils/hooks'
import { createStyle, toast } from '@/utils/tools'
import { mkdir } from '@/utils/fs'
import type { PathItem } from './ListItem'

const filterFileName = /[\\/:*?#"<>|]/

export interface NewFolderType {
  show: (path: string) => void
}

/** 新建文件夹：统一底部 Sheet */
export default forwardRef<NewFolderType, { onRefreshDir: (dir: string) => Promise<PathItem[]> }>(({ onRefreshDir }, ref) => {
  const palette = useSheetPalette()
  const { keyboardShown, keyboardHeight } = useKeyboard()
  const { height: windowHeight } = useWindowSize()
  const inputRef = useRef<InputType>(null)
  const pathRef = useRef('')
  const [visible, setVisible] = useState(false)
  const [name, setName] = useState('')
  const isUnmounted = useUnmounted()

  useImperativeHandle(ref, () => ({
    show(path) {
      pathRef.current = path
      setName('')
      setVisible(true)
      setTimeout(() => { inputRef.current?.focus() }, 280)
    },
  }))

  const close = () => { setVisible(false) }

  const confirm = () => {
    const text = name.trim()
    if (!text) return
    if (filterFileName.test(text)) {
      toast(global.i18n.t('create_new_folder_error_tip'), 'long')
      return
    }
    const newPath = `${pathRef.current}/${text}`
    void mkdir(newPath).then(() => {
      if (isUnmounted.current) return
      void onRefreshDir(pathRef.current).then((list) => {
        const target = list.find(item => item.name === text)
        if (target) void onRefreshDir(target.path)
      })
      close()
    }).catch((err: any) => {
      toast('Create failed: ' + (err.message as string))
    })
  }

  const keyboardSpace = keyboardShown ? keyboardHeight : 0

  return (
    <Modal visible={visible} transparent statusBarTranslucent animationType='fade' onRequestClose={close}>
      <KeyboardAvoidingView style={styles.mask} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={close} />
        <View style={{ ...styles.sheet, marginBottom: keyboardSpace, maxHeight: Math.min(windowHeight * 0.85, 420), backgroundColor: palette.bg, borderColor: palette.border }}>
          <View style={[styles.grabber, { backgroundColor: palette.border }]} />
          <View style={styles.head}>
            <View style={[styles.headIcon, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <Icon name='folder-plus-outline' size={20} color={palette.primary} />
            </View>
            <View style={styles.headInfo}>
              <Text size={17} color={palette.text} style={styles.title}>{global.i18n.t('create_new_folder')}</Text>
              <Text size={11} color={palette.textSecondary} numberOfLines={1}>在当前目录下创建</Text>
            </View>
            <CapsuleIconButton icon='close' label='关闭' onPress={close} />
          </View>
          <Input
            ref={inputRef}
            placeholder={global.i18n.t('create_new_folder_tip')}
            value={name}
            onChangeText={setName}
            onSubmitEditing={confirm}
            style={{ ...styles.input, backgroundColor: palette.card, borderColor: palette.border }}
          />
          <View style={styles.btnRow}>
            <CapsuleButton icon='close' label='取消' primary={false} onPress={close} />
            <View style={{ width: 10 }} />
            <CapsuleButton icon='folder-plus' label='创建' onPress={confirm} disabled={!name.trim().length} />
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
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  headIcon: { width: 40, height: 40, borderRadius: 14, borderWidth: 0.5, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  headInfo: { flex: 1, minWidth: 0 },
  title: { fontWeight: '700' },
  input: { height: 48, borderRadius: 14, borderWidth: 0.5, paddingLeft: 14, paddingRight: 14 },
  btnRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 18 },
})
