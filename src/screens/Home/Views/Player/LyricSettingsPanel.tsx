import { memo } from 'react'
import { Modal, ScrollView, TouchableOpacity, View } from 'react-native'

import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import LyricSize from '@/screens/Home/Views/Setting/settings/Player/LyricSize'
import LyricAlign from '@/screens/Home/Views/Setting/settings/Player/LyricAlign'
import IsWordByWordLyric from '@/screens/Home/Views/Setting/settings/Player/IsWordByWordLyric'
import IsSingleLineLyric from '@/screens/Home/Views/Setting/settings/Player/IsSingleLineLyric'
import IsShowLyricTranslation from '@/screens/Home/Views/Setting/settings/Player/IsShowLyricTranslation'
import IsShowLyricRoma from '@/screens/Home/Views/Setting/settings/Player/IsShowLyricRoma'
import IsAutoJyutping from '@/screens/Home/Views/Setting/settings/Player/IsAutoJyutping'
import IsS2T from '@/screens/Home/Views/Setting/settings/Player/IsS2T'

/**
 * 播放器「歌词设置」页。
 *
 * 需求：歌词页只保留**一个**设置按键，所有歌词相关开关收敛到这里。
 * 复用设置页的同一批组件，避免出现「设置页能改、播放器里另一套」的第二套规则：
 * - 字号、对齐（本次新增，字号已持久化）；
 * - 逐字 / 单行 / 翻译 / 罗马音 / 自动粤拼 / 简繁转换（原先散落或未挂载）。
 */
export default memo(({ visible, onClose }: { visible: boolean, onClose: () => void }) => {
  const theme = useTheme()
  return (
    <Modal
      visible={visible}
      transparent
      animationType='slide'
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        {/* 点遮罩关闭；sheet 自身不铺满，保持「弹出菜单」而不是全屏页 */}
        <TouchableOpacity style={styles.backdropTouch} activeOpacity={1} onPress={onClose} accessibilityRole='button' accessibilityLabel='关闭歌词设置' />
        <View style={[styles.sheet, { backgroundColor: theme['c-content-background'] }]}>
        <View style={[styles.header, { borderBottomColor: theme['c-primary-alpha-700'] }]}>
          <Text size={17} style={styles.title}>歌词设置</Text>
          <TouchableOpacity
            style={styles.closeBtn}
            activeOpacity={0.7}
            onPress={onClose}
            accessibilityRole='button'
            accessibilityLabel='关闭歌词设置'
          >
            <Icon name='close' size={22} color={theme['c-font']} />
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          <Text size={11} color={theme['c-450']} style={styles.hint}>以下设置与「设置 → 播放设置 → 歌词」是同一份，修改立即生效</Text>

          <View style={[styles.card, { backgroundColor: theme['c-primary-alpha-900'] }]}>
            <LyricSize />
            <View style={[styles.divider, { backgroundColor: theme['c-primary-alpha-700'] }]} />
            <LyricAlign />
          </View>

          <View style={[styles.card, { backgroundColor: theme['c-primary-alpha-900'] }]}>
            <IsWordByWordLyric />
            <View style={[styles.divider, { backgroundColor: theme['c-primary-alpha-700'] }]} />
            <IsSingleLineLyric />
            <View style={[styles.divider, { backgroundColor: theme['c-primary-alpha-700'] }]} />
            <IsShowLyricTranslation />
            <View style={[styles.divider, { backgroundColor: theme['c-primary-alpha-700'] }]} />
            <IsShowLyricRoma />
            <View style={[styles.divider, { backgroundColor: theme['c-primary-alpha-700'] }]} />
            <IsAutoJyutping />
            <View style={[styles.divider, { backgroundColor: theme['c-primary-alpha-700'] }]} />
            <IsS2T />
          </View>

          <Text size={11} color={theme['c-450']} style={styles.footer}>
            逐字显示依赖歌词源提供逐字时间轴；没有时间轴时按整行高亮，不会伪造逐字进度。
          </Text>
        </ScrollView>
        </View>
      </View>
    </Modal>
  )
})

const styles = createStyle({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  backdropTouch: {
    flex: 1,
  },
  sheet: {
    maxHeight: '82%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    paddingBottom: 18,
  },
  header: {
    height: 56,
    paddingLeft: 16,
    paddingRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 0.5,
  },
  title: {
    fontWeight: '600',
  },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flexGrow: 0,
    flexShrink: 1,
  },
  bodyContent: {
    padding: 16,
    paddingBottom: 40,
  },
  hint: {
    marginBottom: 12,
    lineHeight: 17,
  },
  card: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 16,
  },
  divider: {
    height: 0.5,
    marginLeft: 16,
  },
  footer: {
    lineHeight: 17,
  },
})
