import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { KeyboardAvoidingView, Modal, Platform, StyleSheet, TouchableOpacity, View } from 'react-native'

import Text from '@/components/common/Text'
import Input, { type InputType } from '@/components/common/Input'
import CapsuleButton from '@/components/common/CapsuleButton'
import CapsuleIconButton from '@/components/common/CapsuleIconButton'
import { Icon } from '@/components/common/Icon'
import { useSheetPalette } from '@/components/common/ActionSheet/palette'
import { useKeyboard, useWindowSize } from '@/utils/hooks'
import { useI18n } from '@/lang'
import { createStyle } from '@/utils/tools'

export interface SelectInfo {
  musicInfo: LX.Music.MusicInfo
  selectedList: LX.Music.MusicInfo[]
  index: number
  listId: string
  single: boolean
}

interface MusicPositionModalProps {
  onUpdatePosition: (info: SelectInfo, position: number) => void
}
export interface MusicPositionModalType {
  show: (listInfo: SelectInfo) => void
}

/** 调整播放位置：统一底部 Sheet */
export default forwardRef<MusicPositionModalType, MusicPositionModalProps>(({ onUpdatePosition }, ref) => {
  const t = useI18n()
  const palette = useSheetPalette()
  const { keyboardShown, keyboardHeight } = useKeyboard()
  const { height: windowHeight } = useWindowSize()
  const inputRef = useRef<InputType>(null)
  const [visible, setVisible] = useState(false)
  const [text, setText] = useState('')
  const [title, setTitle] = useState('')
  const selectedInfo = useRef<SelectInfo | null>(null)

  useImperativeHandle(ref, () => ({
    show(info) {
      selectedInfo.current = info
      setTitle(info.selectedList.length
        ? t('change_position_music_multi_title', { num: info.selectedList.length })
        : t('change_position_music_title', { name: info.musicInfo.name }))
      setText('')
      setVisible(true)
      setTimeout(() => { inputRef.current?.focus() }, 280)
    },
  }))

  const close = () => { setVisible(false) }

  const confirm = () => {
    const matched = /^[1-9]\d*/.exec(text.trim())
    const num = matched ? parseInt(matched[0]) : 0
    if (!num || !selectedInfo.current) return
    setVisible(false)
    onUpdatePosition(selectedInfo.current, num - 1)
  }

  const keyboardSpace = keyboardShown ? keyboardHeight : 0

  return (
    <Modal visible={visible} transparent statusBarTranslucent animationType='fade' onRequestClose={close}>
      <KeyboardAvoidingView style={styles.mask} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={close} />
        <View style={{ ...styles.sheet, marginBottom: keyboardSpace, maxHeight: Math.min(windowHeight * 0.85, 460), backgroundColor: palette.bg, borderColor: palette.border }}>
          <View style={[styles.grabber, { backgroundColor: palette.border }]} />
          <View style={styles.head}>
            <View style={[styles.headIcon, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <Icon name='playlist-play' size={20} color={palette.primary} />
            </View>
            <View style={styles.headInfo}>
              <Text size={17} color={palette.text} numberOfLines={1} style={styles.title}>{t('change_position')}</Text>
              <Text size={11} color={palette.textSecondary} numberOfLines={2}>{title}</Text>
            </View>
            <CapsuleIconButton icon='close' label='关闭' onPress={close} />
          </View>
          <Input
            ref={inputRef}
            placeholder={t('change_position_tip')}
            value={text}
            onChangeText={setText}
            onSubmitEditing={confirm}
            keyboardType='number-pad'
            style={{ ...styles.input, backgroundColor: palette.card, borderColor: palette.border }}
          />
          <Text size={11} color={palette.textSecondary} style={styles.hint}>输入从 1 开始的目标位置</Text>
          <View style={styles.btnRow}>
            <CapsuleButton icon='close' label='取消' primary={false} onPress={close} />
            <View style={{ width: 10 }} />
            <CapsuleButton icon='check' label='确定' onPress={confirm} disabled={!text.trim().length} />
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
  hint: { marginTop: 8 },
  btnRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 18 },
})
