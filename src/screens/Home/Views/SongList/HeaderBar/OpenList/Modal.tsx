import { useRef, useImperativeHandle, forwardRef, useState, useCallback } from 'react'
import { Modal, TouchableOpacity, View, ScrollView, StyleSheet, Keyboard } from 'react-native'

import Text from '@/components/common/Text'
import Input, { type InputType } from '@/components/common/Input'
import { Icon } from '@/components/common/Icon'
import { createStyle } from '@/utils/tools'
import { setSpText } from '@/utils/pixelRatio'
import { useSheetPalette } from '@/components/common/ActionSheet/palette'
import { contrastOn } from '@/theme/solid'
import { useKeyboard, useWindowSize } from '@/utils/hooks'
import { useI18n } from '@/lang'
import { useSettingValue } from '@/store/setting/hook'
import { type Source } from '@/store/songlist/state'

export interface ModalProps {
  onOpenId: (id: string) => void
}
export interface ModalType {
  show: (source: Source) => void
}

/** 各音源的歌单链接示例：让用户知道「长的分享链接」和「纯 ID」都能用 */
const SOURCE_EXAMPLES: Record<LX.OnlineSource, string> = {
  kw: 'https://www.kuwo.cn/playlist_detail/2886046289',
  kg: 'https://www.kugou.com/yy/special/single/1234567.html',
  tx: 'https://y.qq.com/n/ryqq/playlist/7261451296',
  wy: 'https://music.163.com/#/playlist?id=123456789',
  mg: 'https://music.migu.cn/v3/music/playlist/2323423',
}

/**
 * 打开歌单弹窗（Material You 卡片）。
 *
 * 深色/浅色都走 ActionSheet 的 palette：
 *   黑 50% 遮罩 → 圆角 24 卡片（主题底 + 0.5 描边 + 阴影）
 *   → 图标头 + 标题 + 「支持分享链接 / 歌单 ID」
 *   → 48~52 高的输入框（主色淡底，聚焦时描边变主色）
 *   → 示例格式 + 两行说明
 *   → 等宽的 取消 / 打开 按钮（打开带链接图标，禁用态明显变淡）
 * 键盘弹起时给底部让出键盘高度，卡片始终完整可见。
 */
export default forwardRef<ModalType, ModalProps>(({ onOpenId }, ref) => {
  const palette = useSheetPalette()
  const t = useI18n()
  const { keyboardShown, keyboardHeight } = useKeyboard()
  const { height: windowHeight } = useWindowSize()
  const sourceNameType = useSettingValue('common.sourceNameType')
  const inputRef = useRef<InputType>(null)
  const [visible, setVisible] = useState(false)
  const [focused, setFocused] = useState(false)
  const [source, setSource] = useState<LX.OnlineSource>('wy')
  const [text, setText] = useState('')
  const onPrimary = contrastOn(palette.primary)
  const canOpen = text.trim().length > 0
  const sourceLabel = t(`source_${sourceNameType}_${source}` as 'source_alias_kw')
  const example = SOURCE_EXAMPLES[source] ?? SOURCE_EXAMPLES.wy
  /** 键盘弹起时占掉的高度：给底部留出来，卡片整体上移 */
  const keyboardSpace = keyboardShown ? keyboardHeight : 0

  useImperativeHandle(ref, () => ({
    show(source) {
      setSource(source)
      setText('')
      setFocused(false)
      setVisible(true)
      setTimeout(() => { inputRef.current?.focus() }, 280)
    },
  }))

  const handleClose = useCallback(() => {
    Keyboard.dismiss()
    setVisible(false)
  }, [])

  const handleConfirm = useCallback(() => {
    let id = text.trim()
    if (!id.length) return
    if (id.length > 500) id = id.substring(0, 500)
    Keyboard.dismiss()
    setVisible(false)
    onOpenId(id)
  }, [text, onOpenId])

  return (
    <Modal visible={visible} transparent statusBarTranslucent animationType='fade' onRequestClose={handleClose}>
      {/* 遮罩单独一层：卡片里的输入框/按钮不会被 responder 抢走 */}
      <TouchableOpacity
        style={{ ...StyleSheet.absoluteFillObject, backgroundColor: palette.scrim }}
        activeOpacity={1}
        onPress={handleClose}
      />
      <View style={{ ...styles.maskCenter, paddingBottom: keyboardSpace }} pointerEvents='box-none'>
        <View style={{
          ...styles.card,
          // 键盘弹起/横屏这种矮窗口里卡片自动收缩，内容在卡片内滚动，保证输入框和按钮始终可见
          maxHeight: Math.max(windowHeight - keyboardSpace - 32, 168),
          backgroundColor: palette.bg,
          borderColor: palette.border,
        }}>
          {/* 头部：图标 + 标题 + 说明 */}
          <View style={styles.head}>
            <View style={{ ...styles.iconWrap, backgroundColor: palette.card, borderColor: palette.border }}>
              <Icon name='link-variant' size={22} color={palette.primary} />
            </View>
            <View style={styles.headText}>
              <Text size={17} color={palette.text} numberOfLines={1} style={styles.title}>打开歌单</Text>
              <Text size={11.5} color={palette.textSecondary} numberOfLines={1} style={styles.subtitle}>支持分享链接 / 歌单 ID</Text>
            </View>
            <TouchableOpacity
              style={{ ...styles.closeBtn, backgroundColor: palette.card, borderColor: palette.border }}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={handleClose}
            >
              <Icon name='close' size={16} color={palette.icon} />
            </TouchableOpacity>
          </View>

          {/* 输入框 + 说明：窗口太矮时这部分可以滚，头部和按钮固定 */}
          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps='always'
            showsVerticalScrollIndicator={false}
          >
            {/* 输入框：聚焦时描边变主色（Input 透传 onFocus/onBlur，用 state 控制样式） */}
            <Input
              ref={inputRef}
              placeholder='粘贴分享链接，或输入歌单 ID'
              value={text}
              onChangeText={setText}
              onFocus={() => { setFocused(true) }}
              onBlur={() => { setFocused(false) }}
              clearBtn={canOpen}
              style={{
                ...styles.input,
                backgroundColor: palette.card,
                borderColor: focused ? palette.primary : palette.border,
                borderWidth: focused ? 1 : 0.5,
              }}
            />

            {/* 两行说明：按当前音源给示例格式 + 使用限制 */}
            <View style={{ ...styles.hintCard, backgroundColor: palette.card, borderColor: palette.border }}>
              <Text size={10.5} color={palette.textSecondary} numberOfLines={2} style={styles.example}>
                示例（{sourceLabel}）：{example}
              </Text>
              <Text size={10.5} color={palette.textSecondary} style={styles.tip}>
                歌单需要与当前音源一致，不支持跨源打开；部分歌单需要登录、公开主页或歌单码才能打开。
              </Text>
            </View>
          </ScrollView>

          {/* 底部按钮：等宽，主按钮带图标，禁用态明显变淡 */}
          <View style={styles.btnRow}>
            <TouchableOpacity
              style={{ ...styles.btn, backgroundColor: palette.card, borderColor: palette.border, borderWidth: 0.5 }}
              activeOpacity={0.7}
              onPress={handleClose}
            >
              <Text size={14} color={palette.text} style={styles.btnText}>取消</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{
                ...styles.btn,
                backgroundColor: palette.primary,
                opacity: canOpen ? 1 : 0.4,
              }}
              activeOpacity={0.8}
              disabled={!canOpen}
              onPress={handleConfirm}
            >
              <Icon name='link-variant' size={16} color={onPrimary} />
              <Text size={14} color={onPrimary} style={styles.confirmText}>打开</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
})

const styles = createStyle({
  maskCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 24,
    paddingRight: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 24,
    borderWidth: 0.5,
    paddingLeft: 20,
    paddingRight: 20,
    paddingTop: 20,
    paddingBottom: 20,
    elevation: 18,
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: 16,
    borderWidth: 0.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headText: {
    flexGrow: 1,
    flexShrink: 1,
  },
  title: {
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  subtitle: {
    marginTop: 4,
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
  body: {
    flexShrink: 1,
    minHeight: 0,
  },
  bodyContent: {
    paddingBottom: 2,
  },
  input: {
    width: '100%',
    height: 50,
    borderRadius: 14,
    paddingLeft: 14,
    paddingRight: 10,
  },
  hintCard: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 0.5,
    paddingLeft: 12,
    paddingRight: 12,
    paddingTop: 10,
    paddingBottom: 10,
  },
  example: {
    lineHeight: 16,
  },
  tip: {
    marginTop: 6,
    lineHeight: 16,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  btn: {
    flex: 1,
    height: 46,
    borderRadius: 23,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnText: {
    fontWeight: '600',
    includeFontPadding: false,
    textAlignVertical: 'center',
    lineHeight: setSpText(16),
  },
  confirmText: {
    marginLeft: 6,
    fontWeight: '600',
    includeFontPadding: false,
    textAlignVertical: 'center',
    lineHeight: setSpText(16),
  },
})
