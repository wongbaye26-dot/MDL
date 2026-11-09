import { useRef, useState } from 'react'
import { KeyboardAvoidingView, Modal, Platform, StyleSheet, TouchableOpacity, View } from 'react-native'

import Text from '@/components/common/Text'
import Input, { type InputType } from '@/components/common/Input'
import CapsuleButton from '@/components/common/CapsuleButton'
import CapsuleIconButton from '@/components/common/CapsuleIconButton'
import { Icon } from '@/components/common/Icon'
import { useSheetPalette } from '@/components/common/ActionSheet/palette'
import { useKeyboard, useWindowSize } from '@/utils/hooks'
import { confirmDialog, createStyle } from '@/utils/tools'
import { useI18n } from '@/lang'
import { createUserList } from '@/core/list'
import listState from '@/store/list/state'

/** 新建歌单：底部 Sheet 输入，替换旧的内嵌 4dp 圆角输入框 */
export default ({ isEdit, onHide }: { isEdit: boolean, onHide: () => void }) => {
  const t = useI18n()
  const palette = useSheetPalette()
  const { keyboardShown, keyboardHeight } = useKeyboard()
  const { height: windowHeight } = useWindowSize()
  const inputRef = useRef<InputType>(null)
  const [text, setText] = useState('')

  if (!isEdit) return null

  const close = () => { onHide() }

  const submit = async() => {
    const name = text.trim()
    if (!name.length) return
    if (listState.userList.some(l => l.name === name) && !(await confirmDialog({ message: global.i18n.t('list_duplicate_tip') }))) return
    onHide()
    void createUserList(listState.userList.length, [{ id: `userlist_${Date.now()}`, name, locationUpdateTime: null }])
  }

  const keyboardSpace = keyboardShown ? keyboardHeight : 0

  return (
    <Modal visible transparent statusBarTranslucent animationType='fade' onRequestClose={close} onShow={() => { setTimeout(() => { inputRef.current?.focus() }, 100) }}>
      <KeyboardAvoidingView style={styles.mask} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={close} />
        <View style={{ ...styles.sheet, marginBottom: keyboardSpace, maxHeight: Math.min(windowHeight * 0.85, 460), backgroundColor: palette.bg, borderColor: palette.border }}>
          <View style={[styles.grabber, { backgroundColor: palette.border }]} />
          <View style={styles.head}>
            <View style={[styles.headIcon, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <Icon name='playlist-plus' size={20} color={palette.primary} />
            </View>
            <View style={styles.headInfo}>
              <Text size={17} color={palette.text} style={styles.title}>新建歌单</Text>
              <Text size={11} color={palette.textSecondary}>给新歌单起一个名字</Text>
            </View>
            <CapsuleIconButton icon='close' label='关闭' onPress={close} />
          </View>
          <Input
            ref={inputRef}
            placeholder={t('list_create_input_placeholder')}
            value={text}
            onChangeText={setText}
            onSubmitEditing={() => { void submit() }}
            style={{ ...styles.input, backgroundColor: palette.card, borderColor: palette.border }}
          />
          <View style={styles.btnRow}>
            <CapsuleButton icon='close' label='取消' primary={false} onPress={close} />
            <View style={{ width: 10 }} />
            <CapsuleButton icon='plus' label='创建' onPress={() => { void submit() }} disabled={!text.trim().length} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

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
