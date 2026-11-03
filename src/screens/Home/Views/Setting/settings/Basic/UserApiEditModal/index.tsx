import { useImperativeHandle, forwardRef, useState } from 'react'
import { Modal, TouchableOpacity, View, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native'

import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { createStyle, openUrl } from '@/utils/tools'
import { useSheetPalette } from '@/components/common/ActionSheet/palette'
import { contrastOn } from '@/theme/solid'
import { useI18n } from '@/lang'
import { useWindowSize } from '@/utils/hooks'
import List from './List'
import ImportBtn from './ImportBtn'

export interface UserApiEditModalType {
  show: () => void
}

/**
 * 自定义源管理弹窗。
 *
 * 视觉与 ActionSheet 统一：黑 50% 遮罩、圆角 24 的 Material You 卡片、
 * 主题底色 + 主色淡底卡片 + 主色按钮。顶部是说明 + 导入入口，中间自定义源列表，
 * 下面是说明 / FAQ 卡片和关闭按钮。
 */
export default forwardRef<UserApiEditModalType, {}>((props, ref) => {
  const [visible, setVisible] = useState(false)
  const palette = useSheetPalette()
  const t = useI18n()
  const { height: windowHeight } = useWindowSize()
  const onPrimary = contrastOn(palette.primary)

  useImperativeHandle(ref, () => ({
    show() {
      setVisible(true)
    },
  }))

  const handleCancel = () => {
    setVisible(false)
  }

  const openFAQPage = () => {
    void openUrl('https://lyswhut.github.io/lx-music-doc/mobile/custom-source')
  }

  if (!visible) return null

  return (
    <Modal visible transparent statusBarTranslucent animationType='fade' onRequestClose={handleCancel}>
      <KeyboardAvoidingView
        style={styles.mask}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* 遮罩单独一层：这样卡片里可以正常滚动列表，不会被 responder 抢走手势 */}
        <TouchableOpacity
          style={{ ...StyleSheet.absoluteFillObject, backgroundColor: palette.scrim }}
          activeOpacity={1}
          onPress={handleCancel}
        />
        <View style={styles.maskCenter} pointerEvents='box-none'>
          <View style={{ ...styles.card, maxHeight: Math.min(windowHeight * 0.84, 680), backgroundColor: palette.bg }}>
            {/* 头部：图标 + 标题 + 说明 + 关闭 */}
            <View style={styles.head}>
              <View style={{ ...styles.headIcon, backgroundColor: palette.card, borderColor: palette.border }}>
                <Icon name='script-text-outline' size={20} color={palette.primary} />
              </View>
              <View style={styles.headInfo}>
                <Text size={16} color={palette.text} numberOfLines={1} style={styles.title}>{t('user_api_title')}</Text>
                <Text size={11} color={palette.textSecondary} numberOfLines={2} style={styles.subtitle}>导入 LX Music 格式的自定义源脚本</Text>
              </View>
              <TouchableOpacity
                style={{ ...styles.closeBtn, backgroundColor: palette.card, borderColor: palette.border }}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                onPress={handleCancel}
              >
                <Icon name='close' size={16} color={palette.icon} />
              </TouchableOpacity>
            </View>

            {/* 顶部说明 + 导入按钮（固定，不随列表滚动） */}
            <View style={{ ...styles.importCard, backgroundColor: palette.card, borderColor: palette.border }}>
              <Text size={11} color={palette.textSecondary} style={styles.importTip}>
                支持在线链接导入，或从本地选择 .js 脚本文件
              </Text>
              <ImportBtn
                btnStyle={{ ...styles.importBtn, backgroundColor: palette.primary }}
                color={onPrimary}
              />
            </View>

            {/* 中间内容滚动（头部 / 导入区 / 底部按钮固定），超高时只滚列表和说明 */}
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps='always'
              showsVerticalScrollIndicator={false}
            >
              {/* 自定义源列表（卡片式） */}
              <List />

              {/* 说明 / FAQ */}
              <View style={{ ...styles.tips, backgroundColor: palette.card, borderColor: palette.border }}>
                <Text size={11.5} color={palette.textSecondary} style={styles.tipsText}>
                  {t('user_api_readme')}
                </Text>
                <TouchableOpacity onPress={openFAQPage} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                  <Text size={11.5} color={palette.primary} style={styles.faqText}>FAQ</Text>
                </TouchableOpacity>
                <Text size={11.5} color={palette.textSecondary} style={styles.tipsText}>
                  {t('user_api_note')}
                </Text>
              </View>
            </ScrollView>

            {/* 底部按钮 */}
            <View style={styles.btnRow}>
              <TouchableOpacity
                style={{ ...styles.closeFull, backgroundColor: palette.card, borderColor: palette.border }}
                activeOpacity={0.8}
                onPress={handleCancel}
              >
                <Text size={14} color={palette.text} style={styles.closeText}>{t('close')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
})


const styles = createStyle({
  mask: {
    flex: 1,
  },
  maskCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 20,
    paddingRight: 20,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    borderRadius: 24,
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 16,
    paddingBottom: 14,
    elevation: 18,
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: 0.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headInfo: {
    flexGrow: 1,
    flexShrink: 1,
  },
  title: {
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  subtitle: {
    marginTop: 3,
    lineHeight: 15,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 0.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  scroll: {
    flexShrink: 1,
    minHeight: 0,
  },
  scrollContent: {
    paddingBottom: 2,
  },
  importCard: {
    marginTop: 14,
    borderRadius: 16,
    borderWidth: 0.5,
    paddingLeft: 12,
    paddingRight: 12,
    paddingTop: 12,
    paddingBottom: 12,
  },
  importTip: {
    marginBottom: 10,
    lineHeight: 16,
  },
  importBtn: {
    height: 42,
    borderRadius: 21,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tips: {
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 0.5,
    paddingLeft: 12,
    paddingRight: 12,
    paddingTop: 10,
    paddingBottom: 10,
  },
  tipsText: {
    lineHeight: 17,
  },
  faqText: {
    lineHeight: 17,
    fontWeight: '600',
  },
  btnRow: {
    marginTop: 14,
  },
  closeFull: {
    height: 44,
    borderRadius: 22,
    borderWidth: 0.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: {
    fontWeight: '600',
  },
})
