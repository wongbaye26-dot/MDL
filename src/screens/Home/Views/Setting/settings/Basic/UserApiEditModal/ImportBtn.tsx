import { useRef, useState } from 'react'
import { Modal, StyleSheet, TouchableOpacity, View } from 'react-native'

import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import CapsuleIconButton from '@/components/common/CapsuleIconButton'
import AddSourceIcon from '@/components/common/AddSourceIcon'
import { useSheetPalette } from '@/components/common/ActionSheet/palette'
import { useI18n } from '@/lang'
import ScriptImportExport, { type ScriptImportExportType } from './ScriptImportExport'
import ScriptImportOnline, { type ScriptImportOnlineType } from './ScriptImportOnline'
import { state } from '@/store/userApi'
import { createStyle, tipDialog } from '@/utils/tools'

interface BtnProps {
  btnStyle?: object
  color?: string
  iconOnly?: boolean
}

/** 音源导入入口：点击后弹出「本地导入 / 在线导入」两张卡片 */
export default ({ btnStyle, color = '#FFFFFF', iconOnly = false }: BtnProps) => {
  const t = useI18n()
  const palette = useSheetPalette()
  const scriptImportExportRef = useRef<ScriptImportExportType>(null)
  const scriptImportOnlineRef = useRef<ScriptImportOnlineType>(null)
  const [visible, setVisible] = useState(false)

  const open = (action: 'local' | 'online') => {
    if (state.list.length > 20) {
      setVisible(false)
      void tipDialog({ message: t('user_api_max_tip'), btnText: t('ok') })
      return
    }
    setVisible(false)
    // 等 Sheet 开始退场再打开下一层，避免两个 Modal 同帧叠加
    setTimeout(() => {
      if (action === 'local') scriptImportExportRef.current?.import()
      else scriptImportOnlineRef.current?.show()
    }, 180)
  }

  const Card = ({ icon, title, desc, onPress }: { icon: string, title: string, desc: string, onPress: () => void }) => (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}
      activeOpacity={0.75}
      onPress={onPress}
      accessibilityRole='button'
      accessibilityLabel={title}
    >
      <View style={[styles.cardIcon, { backgroundColor: palette.bg }]}>
        <Icon name={icon} size={24} color={palette.primary} />
      </View>
      <Text size={14} color={palette.text} style={styles.cardTitle}>{title}</Text>
      <Text size={10.5} color={palette.textSecondary} numberOfLines={2} style={styles.cardDesc}>{desc}</Text>
    </TouchableOpacity>
  )

  return (
    <>
      <TouchableOpacity
        style={btnStyle}
        activeOpacity={0.8}
        onPress={() => { setVisible(true) }}
        accessibilityRole='button'
        accessibilityLabel={t('user_api_btn_import')}
      >
        {iconOnly
          ? <AddSourceIcon size={19} color={color} />
          : <Text size={14} color={color} style={{ fontWeight: '600' }}>{t('user_api_btn_import')}</Text>}
      </TouchableOpacity>
      <Modal visible={visible} transparent statusBarTranslucent animationType='fade' onRequestClose={() => { setVisible(false) }}>
        <View style={styles.mask}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => { setVisible(false) }} />
          <View style={[styles.sheet, { backgroundColor: palette.bg, borderColor: palette.border }]}>
            <View style={[styles.grabber, { backgroundColor: palette.border }]} />
            <View style={styles.head}>
              <View style={[styles.headIcon, { backgroundColor: palette.card, borderColor: palette.border }]}>
                <Icon name='tray-arrow-down' size={20} color={palette.primary} />
              </View>
              <View style={styles.headInfo}>
                <Text size={17} color={palette.text} numberOfLines={1} style={styles.title}>{t('user_api_btn_import')}</Text>
                <Text size={11} color={palette.textSecondary}>选择脚本来源</Text>
              </View>
              <CapsuleIconButton icon='close' label='关闭' onPress={() => { setVisible(false) }} />
            </View>
            <View style={styles.cards}>
              <Card icon='file-import-outline' title={t('user_api_btn_import_local')} desc='从本地选择 .js 脚本文件导入' onPress={() => { open('local') }} />
              <Card icon='cloud-download-outline' title={t('user_api_btn_import_online')} desc='粘贴 http(s) 脚本地址在线导入' onPress={() => { open('online') }} />
            </View>
            <Text size={10.5} color={palette.textSecondary} style={styles.tip}>
              最多支持 20 个自定义源；脚本来自第三方，请只导入你信任的来源。
            </Text>
          </View>
        </View>
      </Modal>
      <ScriptImportExport ref={scriptImportExportRef} />
      <ScriptImportOnline ref={scriptImportOnlineRef} />
    </>
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
  cards: { flexDirection: 'row', gap: 12 },
  card: { flex: 1, minHeight: 128, borderRadius: 18, borderWidth: 0.5, padding: 14 },
  cardIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  cardTitle: { fontWeight: '600' },
  cardDesc: { marginTop: 4, lineHeight: 15 },
  tip: { marginTop: 14, lineHeight: 15 },
})
