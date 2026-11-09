import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { KeyboardAvoidingView, Modal, Platform, StyleSheet, TouchableOpacity, View } from 'react-native'

import Text from '@/components/common/Text'
import Input, { type InputType } from '@/components/common/Input'
import CapsuleIconButton from '@/components/common/CapsuleIconButton'
import CapsuleButton from '@/components/common/CapsuleButton'
import { Icon } from '@/components/common/Icon'
import { useSheetPalette } from '@/components/common/ActionSheet/palette'
import { useKeyboard, useWindowSize } from '@/utils/hooks'
import { createStyle, toast } from '@/utils/tools'
import { useI18n } from '@/lang'
import { httpFetch } from '@/utils/request'
import { handleImportScript } from './action'

export interface ScriptImportOnlineType {
  show: () => void
}

/** 在线导入音源脚本：与新建歌单/打开歌单同款底部 Sheet */
export default forwardRef<ScriptImportOnlineType, {}>((props, ref) => {
  const t = useI18n()
  const palette = useSheetPalette()
  const { keyboardShown, keyboardHeight } = useKeyboard()
  const { height: windowHeight } = useWindowSize()
  const inputRef = useRef<InputType>(null)
  const [visible, setVisible] = useState(false)
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)

  useImperativeHandle(ref, () => ({
    show() {
      setUrl('')
      setLoading(false)
      setVisible(true)
      setTimeout(() => { inputRef.current?.focus() }, 280)
    },
  }))

  const close = () => {
    if (loading) return
    setVisible(false)
  }

  const handleImport = async() => {
    let target = url.trim()
    if (!/^https?:\/\//.test(target)) {
      target = ''
      setUrl('')
    }
    if (!target.length) return
    setLoading(true)
    let script: string
    try {
      script = await httpFetch(target).promise.then(resp => resp.body) as string
    } catch (err: any) {
      toast(t('user_api_import_failed_tip', { message: err.message }), 'long')
      return
    } finally {
      setLoading(false)
    }
    if (script.length > 9_000_000) {
      toast(t('user_api_import_failed_tip', { message: 'Too large script' }), 'long')
      return
    }
    void handleImportScript(script, target)
    setVisible(false)
  }

  const keyboardSpace = keyboardShown ? keyboardHeight : 0

  return (
    <Modal visible={visible} transparent statusBarTranslucent animationType='fade' onRequestClose={close}>
      <KeyboardAvoidingView style={styles.mask} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={close} />
        <View style={{ ...styles.sheet, marginBottom: keyboardSpace, maxHeight: Math.min(windowHeight * 0.85, 560), backgroundColor: palette.bg, borderColor: palette.border }}>
          <View style={[styles.grabber, { backgroundColor: palette.border }]} />
          <View style={styles.head}>
            <View style={[styles.headIcon, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <Icon name='cloud-download-outline' size={20} color={palette.primary} />
            </View>
            <View style={styles.headInfo}>
              <Text size={17} color={palette.text} numberOfLines={1} style={styles.title}>{t('user_api_btn_import_online')}</Text>
              <Text size={11} color={palette.textSecondary} numberOfLines={1}>粘贴在线 .js 脚本地址</Text>
            </View>
            <CapsuleIconButton icon='close' label='关闭' onPress={close} />
          </View>
          <Input
            ref={inputRef}
            placeholder={t('user_api_btn_import_online_input_tip')}
            value={url}
            onChangeText={setUrl}
            onSubmitEditing={() => { void handleImport() }}
            style={{ ...styles.input, backgroundColor: palette.card, borderColor: palette.border }}
          />
          <Text size={11} color={palette.textSecondary} style={styles.hint}>
            仅支持 http(s) 开头的脚本直链；导入后可在自定义源列表启用。
          </Text>
          <View style={styles.btnRow}>
            <CapsuleButton icon='close' label='取消' primary={false} onPress={close} />
            <View style={{ width: 10 }} />
            <CapsuleButton
              icon='cloud-download-outline'
              label={loading ? '导入中…' : '导入'}
              onPress={() => { void handleImport() }}
              disabled={loading || !url.trim().length}
            />
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
    borderWidth: 0.5,
    paddingLeft: 20,
    paddingRight: 20,
    paddingTop: 8,
    paddingBottom: 24,
  },
  grabber: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  headIcon: { width: 40, height: 40, borderRadius: 14, borderWidth: 0.5, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  headInfo: { flex: 1, minWidth: 0 },
  title: { fontWeight: '700' },
  input: { height: 48, borderRadius: 14, borderWidth: 0.5, paddingLeft: 14, paddingRight: 14 },
  hint: { marginTop: 8, lineHeight: 15 },
  btnRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 18 },
})
