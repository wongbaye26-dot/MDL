import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { KeyboardAvoidingView, Modal, Platform, StyleSheet, TouchableOpacity, View } from 'react-native'

import Text from '@/components/common/Text'
import Input, { type InputType } from '@/components/common/Input'
import CapsuleIconButton from '@/components/common/CapsuleIconButton'
import CapsuleButton from '@/components/common/CapsuleButton'
import { Icon } from '@/components/common/Icon'
import { useSheetPalette } from '@/components/common/ActionSheet/palette'
import { createUserList, updateUserList } from '@/core/list'
import { confirmDialog, createStyle } from '@/utils/tools'
import { useKeyboard, useWindowSize } from '@/utils/hooks'
import listState from '@/store/list/state'

export interface ListNameEditType {
  showCreate: (position: number) => void
  show: (listInfo: LX.List.UserListInfo) => void
}

/**
 * 新建/重命名歌单：与「打开歌单」同款底部 Sheet，
 * 输入框 + 取消/创建按钮，不再使用旧的居中确认弹窗。
 */
export default forwardRef<ListNameEditType, {}>((props, ref) => {
  const palette = useSheetPalette()
  const { keyboardShown, keyboardHeight } = useKeyboard()
  const { height: windowHeight } = useWindowSize()
  const inputRef = useRef<InputType>(null)
  const [visible, setVisible] = useState(false)
  const [name, setName] = useState('')
  const [position, setPosition] = useState(0)
  const selectedListInfo = useRef<LX.List.UserListInfo | null>(null)
  const isRename = position === -1

  const close = () => {
    setVisible(false)
  }

  useImperativeHandle(ref, () => ({
    showCreate(position) {
      setPosition(position)
      selectedListInfo.current = null
      setName('')
      setVisible(true)
      setTimeout(() => { inputRef.current?.focus() }, 280)
    },
    show(listInfo) {
      setPosition(-1)
      selectedListInfo.current = listInfo
      setName(listInfo.name ?? '')
      setVisible(true)
      setTimeout(() => { inputRef.current?.focus() }, 280)
    },
  }))

  const handleConfirm = () => {
    let next = name.trim()
    if (!next.length) return
    if (next.length > 100) next = next.substring(0, 100)
    if (isRename) {
      const item = selectedListInfo.current
      if (item) void updateUserList([{ ...item, name: next }])
      close()
      return
    }
    if (listState.userList.some(l => l.name === next)) {
      void confirmDialog({ message: global.i18n.t('list_duplicate_tip') }).then(confirmed => {
        if (confirmed) create()
      })
      return
    }
    create()
  }

  const create = () => {
    const now = Date.now()
    void createUserList(position, [{ id: `userlist_${now}`, name: name.trim(), locationUpdateTime: now }])
    close()
  }

  const keyboardSpace = keyboardShown ? keyboardHeight : 0

  return (
    <Modal visible={visible} transparent statusBarTranslucent animationType='fade' onRequestClose={close}>
      <KeyboardAvoidingView
        style={styles.mask}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={close} />
        <View style={{ ...styles.sheet, marginBottom: keyboardSpace, maxHeight: Math.min(windowHeight * 0.85, 520), backgroundColor: palette.bg }}>
          <View style={[styles.grabber, { backgroundColor: palette.border }]} />
          <View style={styles.head}>
            <View style={[styles.headIcon, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <Icon name={isRename ? 'pencil-outline' : 'playlist-plus'} size={20} color={palette.primary} />
            </View>
            <View style={styles.headInfo}>
              <Text size={17} color={palette.text} numberOfLines={1} style={styles.title}>{isRename ? '重命名歌单' : '新建歌单'}</Text>
              <Text size={11} color={palette.textSecondary}>{isRename ? '修改当前歌单名称' : '给新歌单起一个名字'}</Text>
            </View>
            <CapsuleIconButton icon='close' label='关闭' onPress={close} />
          </View>
          <Input
            ref={inputRef}
            placeholder='歌单名称'
            value={name}
            onChangeText={setName}
            onSubmitEditing={handleConfirm}
            style={{ ...styles.input, backgroundColor: palette.card, borderColor: palette.border }}
          />
          <View style={styles.btnRow}>
            <CapsuleButton icon='close' label='取消' primary={false} onPress={close} />
            <View style={{ width: 10 }} />
            <CapsuleButton icon={isRename ? 'check' : 'plus'} label={isRename ? '保存' : '创建'} onPress={handleConfirm} disabled={!name.trim().length} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
})

const styles = createStyle({
  mask: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    width: '100%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingLeft: 20,
    paddingRight: 20,
    paddingTop: 8,
  },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  headIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: 0.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headInfo: { flex: 1, minWidth: 0 },
  title: { fontWeight: '700' },
  input: {
    height: 48,
    borderRadius: 14,
    borderWidth: 0.5,
    paddingLeft: 14,
    paddingRight: 14,
  },
  btnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 20,
  },
})
