import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { InteractionManager, Modal, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native'

import Text from '@/components/common/Text'
import CapsuleButton from '@/components/common/CapsuleButton'
import CapsuleIconButton from '@/components/common/CapsuleIconButton'
import { Icon } from '@/components/common/Icon'
import { useSheetPalette } from '@/components/common/ActionSheet/palette'
import { useWindowSize } from '@/utils/hooks'
import { createStyle } from '@/utils/tools'
import { useI18n } from '@/lang'
import { getListMusics, setFetchingListStatus, updateListMusicPosition } from '@/core/list'
import { sortListMusicInfo } from './utils'

const fieldNames = ['name', 'singer', 'album', 'time', 'source'] as const
const fieldTypes = ['up', 'down', 'random'] as const
type FieldName = typeof fieldNames[number]
type FieldType = typeof fieldTypes[number]

export interface ListMusicSortType {
  show: (listInfo: LX.List.MyListInfo) => void
}

/** 歌曲排序：统一底部 Sheet，两段单选行替代旧 CheckBox 弹窗 */
export default forwardRef<ListMusicSortType, {}>((props, ref) => {
  const t = useI18n()
  const palette = useSheetPalette()
  const { height: windowHeight } = useWindowSize()
  const [visible, setVisible] = useState(false)
  const [title, setTitle] = useState('')
  const [name, setName] = useState<FieldName>()
  const [type, setType] = useState<FieldType>()
  const selectedListInfo = useRef<LX.List.MyListInfo | null>(null)

  useImperativeHandle(ref, () => ({
    show(listInfo) {
      selectedListInfo.current = listInfo
      setTitle(listInfo.name)
      setName(undefined)
      setType(undefined)
      setVisible(true)
    },
  }))

  const close = () => { setVisible(false) }

  const handleSort = async() => {
    if (!type || (!name && type !== 'random')) return
    const id = selectedListInfo.current?.id
    if (!id) return
    const list = [...(await getListMusics(id))]
    setFetchingListStatus(id, true)
    close()
    requestAnimationFrame(() => {
      void InteractionManager.runAfterInteractions(() => {
        const sorted = sortListMusicInfo(list, type, name!, global.i18n.locale)
        void updateListMusicPosition(id, 0, sorted.map(m => m.id))
        setFetchingListStatus(id, false)
      })
    })
  }

  const Option = ({ active, label, onPress, disabled }: { active: boolean, label: string, onPress: () => void, disabled?: boolean }) => (
    <TouchableOpacity
      style={[styles.option, disabled ? { opacity: 0.4 } : null]}
      activeOpacity={0.72}
      disabled={disabled}
      onPress={onPress}
      accessibilityRole='button'
      accessibilityState={{ selected: active }}
    >
      <Text size={14} color={active ? palette.primary : palette.text} style={styles.optionLabel}>{label}</Text>
      <Icon name={active ? 'radiobox-marked' : 'radiobox-blank'} size={20} color={active ? palette.primary : palette.textSecondary} />
    </TouchableOpacity>
  )

  return (
    <Modal visible={visible} transparent statusBarTranslucent animationType='fade' onRequestClose={close}>
      <View style={styles.mask}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={close} />
        <View style={{ ...styles.sheet, maxHeight: Math.min(windowHeight * 0.88, 720), backgroundColor: palette.bg, borderColor: palette.border }}>
          <View style={[styles.grabber, { backgroundColor: palette.border }]} />
          <View style={styles.head}>
            <View style={[styles.headIcon, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <Icon name='sort-variant' size={20} color={palette.primary} />
            </View>
            <View style={styles.headInfo}>
              <Text size={17} color={palette.text} numberOfLines={1} style={styles.title}>排序</Text>
              <Text size={11} color={palette.textSecondary} numberOfLines={1}>{title}</Text>
            </View>
            <CapsuleIconButton icon='close' label='关闭' onPress={close} />
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text size={11} color={palette.textSecondary} style={styles.sectionTitle}>{t('list_sort_modal_by_field')}</Text>
            {fieldNames.map(item => (
              <Option key={item} label={t(`list_sort_modal_by_${item}`)} active={name === item} disabled={type === 'random'} onPress={() => { setName(item) }} />
            ))}
            <Text size={11} color={palette.textSecondary} style={styles.sectionTitle}>{t('list_sort_modal_by_type')}</Text>
            {fieldTypes.map(item => (
              <Option key={item} label={t(`list_sort_modal_by_${item}`)} active={type === item} onPress={() => { setType(item) }} />
            ))}
          </ScrollView>
          <View style={styles.btnRow}>
            <CapsuleButton icon='close' label='取消' primary={false} onPress={close} />
            <View style={{ width: 10 }} />
            <CapsuleButton icon='sort' label='排序' onPress={() => { void handleSort() }} disabled={!type || (!name && type !== 'random')} />
          </View>
        </View>
      </View>
    </Modal>
  )
})

const styles = createStyle({
  mask: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { width: '100%', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 0.5, paddingLeft: 20, paddingRight: 20, paddingTop: 8, paddingBottom: 24 },
  grabber: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  headIcon: { width: 40, height: 40, borderRadius: 14, borderWidth: 0.5, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  headInfo: { flex: 1, minWidth: 0 },
  title: { fontWeight: '700' },
  sectionTitle: { marginTop: 14, marginBottom: 4 },
  option: { flexDirection: 'row', alignItems: 'center', height: 44, borderBottomWidth: 0.5, borderBottomColor: 'rgba(128,128,128,0.16)' },
  optionLabel: { flex: 1 },
  btnRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 18 },
})
