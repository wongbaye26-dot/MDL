import { View } from 'react-native'

import { createStyle } from '@/utils/tools'
import { useStatusbarHeight } from '@/store/common/hook'
import { useHorizontalMode } from '@/utils/hooks'
import Text from '@/components/common/Text'
import { SETTINGS_HEADER_COMPACT_H, SETTINGS_HEADER_H } from '../Setting/components/headerMetrics'
import Setting from '../Setting'
import { Space, Type } from '@/theme/designTokens'
import CapsuleIconButton from '@/components/common/CapsuleIconButton'

/**
 * 「我的」Tab = 设置页。
 *
 * 按 DESIGN-SYSTEM：简洁的 Settings 页头，不放品牌 logo / 呼吸光晕 / slogan / 大玻璃，
 * 只保留标题与合理的顶部留白；设置列表本身就是页面主体。
 */
export default () => {
  const statusBarHeight = useStatusbarHeight()
  const compact = useHorizontalMode()
  const headerH = compact ? SETTINGS_HEADER_COMPACT_H : SETTINGS_HEADER_H

  return (
    <View style={styles.container}>
      <View style={{
        ...styles.header,
        height: statusBarHeight + headerH,
        paddingTop: statusBarHeight,
      }}>
        <Text size={compact ? 19 : Type.pageTitle.fontSize} style={styles.title}>设置</Text>
        <View style={styles.headerActions}>
          <CapsuleIconButton icon='music-box-multiple-outline' label='音源管理' onPress={() => { global.state_event.settingsDeepScreenRequested('sourcesearch') }} />
          <CapsuleIconButton icon='tools' label='曲库工具' onPress={() => { global.state_event.settingsDeepScreenRequested('library') }} />
          <CapsuleIconButton icon='download-2' label='下载管理' onPress={() => { global.state_event.settingsDeepScreenRequested('download') }} />
        </View>
      </View>
      <View style={styles.setting}>
        <Setting />
      </View>
    </View>
  )
}

const styles = createStyle({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: Space.lg,
    paddingRight: Space.lg,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
  },

  title: {
    ...Type.pageTitle,
    flexShrink: 0,
  },
  setting: {
    flex: 1,
  },
})
