import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native'

import Text from '@/components/common/Text'
import CapsuleButton from '@/components/common/CapsuleButton'
import CapsuleIconButton from '@/components/common/CapsuleIconButton'
import { Icon } from '@/components/common/Icon'
import { useSheetPalette } from '@/components/common/ActionSheet/palette'
import { useKeyboard, useUnmounted, useWindowSize } from '@/utils/hooks'
import { TEMP_FILE_PATH, createStyle, toast } from '@/utils/tools'
import {
  readMetadata,
  readPic,
  readLyric,
  writeMetadata,
  writePic,
  writeLyric,
} from '@/utils/localMediaMetadata'
import MetadataForm, { defaultData, type Metadata, type MetadataFormType } from './MetadataForm'
import { log } from '@/utils/log'
import { formatPlayTime2 } from '@/utils'
import { unlink } from '@/utils/fs'

export type { Metadata }

export interface MetadataEditType {
  show: (filePath: string) => void
}
export interface MetadataEditProps {
  onUpdate: (info: Metadata) => void
}

/** 歌曲信息编辑：统一底部 Sheet，表单在 Sheet 内滚动 */
export default forwardRef<MetadataEditType, MetadataEditProps>((props, ref) => {
  const palette = useSheetPalette()
  const { keyboardShown, keyboardHeight } = useKeyboard()
  const { height: windowHeight } = useWindowSize()
  const metadataFormRef = useRef<MetadataFormType>(null)
  const filePath = useRef<string>('')
  const metadata = useRef<Metadata>({ ...defaultData })
  const [visible, setVisible] = useState(false)
  const [processing, setProcessing] = useState(false)
  const isUnmounted = useUnmounted()

  const handleShow = (path: string) => {
    void Promise.all([
      readMetadata(path),
      readPic(path).catch(() => ''),
      readLyric(path, false).catch(() => ''),
    ]).then(async([_metadata, pic, lyric]) => {
      if (!_metadata) return
      if (isUnmounted.current) return
      metadata.current = {
        name: _metadata.name,
        singer: _metadata.singer,
        albumName: _metadata.albumName,
        pic,
        interval: formatPlayTime2(_metadata.interval),
        lyric,
      }
      requestAnimationFrame(() => {
        metadataFormRef.current?.setForm(path, metadata.current)
      })
    })
  }

  useImperativeHandle(ref, () => ({
    show(path) {
      filePath.current = path
      setVisible(true)
      requestAnimationFrame(() => { handleShow(path) })
    },
  }))

  const close = () => {
    if (processing) return
    setVisible(false)
  }

  const handleUpdate = async() => {
    if (!metadataFormRef.current) return
    const _metadata = metadataFormRef.current.getForm()
    if (!_metadata.name) {
      toast(global.i18n.t('metadata_edit_modal_tip'), 'long')
      return
    }
    setProcessing(true)
    let isUpdated = false
    try {
      if (
        _metadata.name != metadata.current.name ||
        _metadata.singer != metadata.current.singer ||
        _metadata.albumName != metadata.current.albumName
      ) {
        isUpdated ||= true
        await writeMetadata(filePath.current, {
          name: _metadata.name,
          singer: _metadata.singer,
          albumName: _metadata.albumName,
        })
      }
      if (_metadata.pic != metadata.current.pic) {
        isUpdated ||= true
        await writePic(filePath.current, _metadata.pic)
        if (_metadata.pic.startsWith(TEMP_FILE_PATH)) void unlink(_metadata.pic)
      }
      if (_metadata.lyric != metadata.current.lyric) {
        isUpdated ||= true
        await writeLyric(filePath.current, _metadata.lyric)
      }
    } catch (err: any) {
      log.error(`save (${filePath.current}) metadata failed: \n${err.message}`)
      toast(global.i18n.t('metadata_edit_modal_failed'), 'long')
      return
    } finally {
      setProcessing(false)
    }
    if (isUpdated) toast(global.i18n.t('metadata_edit_modal_success'), 'long')
    setVisible(false)
    props.onUpdate(_metadata)
  }

  const keyboardSpace = keyboardShown ? keyboardHeight : 0

  return (
    <Modal visible={visible} transparent statusBarTranslucent animationType='fade' onRequestClose={close}>
      <KeyboardAvoidingView style={styles.mask} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={close} />
        <View style={{
          ...styles.sheet,
          marginBottom: keyboardSpace,
          maxHeight: Math.min(windowHeight * 0.92, 820),
          backgroundColor: palette.bg,
          borderColor: palette.border,
        }}>
          <View style={[styles.grabber, { backgroundColor: palette.border }]} />
          <View style={styles.head}>
            <View style={[styles.headIcon, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <Icon name='tag-edit-outline' size={20} color={palette.primary} />
            </View>
            <View style={styles.headInfo}>
              <Text size={17} color={palette.text} numberOfLines={1} style={styles.title}>{global.i18n.t('metadata_edit_modal_title')}</Text>
              <Text size={11} color={palette.textSecondary} numberOfLines={1}>修改歌曲标签、封面与歌词</Text>
            </View>
            <CapsuleIconButton icon='close' label='关闭' onPress={close} />
          </View>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps='always'
            showsVerticalScrollIndicator={false}
          >
            <MetadataForm ref={metadataFormRef} />
          </ScrollView>
          <View style={styles.btnRow}>
            <CapsuleButton icon='close' label='取消' primary={false} onPress={close} disabled={processing} />
            <View style={{ width: 10 }} />
            <CapsuleButton
              icon='check'
              label={processing ? global.i18n.t('metadata_edit_modal_processing') : global.i18n.t('metadata_edit_modal_confirm')}
              onPress={() => { void handleUpdate() }}
              disabled={processing}
            />
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
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  headIcon: { width: 40, height: 40, borderRadius: 14, borderWidth: 0.5, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  headInfo: { flex: 1, minWidth: 0 },
  title: { fontWeight: '700' },
  scroll: { flexGrow: 0, flexShrink: 1 },
  content: { paddingTop: 4 },
  btnRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16 },
})
