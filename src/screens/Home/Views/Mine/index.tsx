import { View } from 'react-native'

import { createStyle } from '@/utils/tools'
import PageHeader, { HeaderButton } from '@/components/common/PageHeader'
import Setting from '../Setting'

/**
 * 「我的」Tab = 设置页。
 *
 * 按 DESIGN-SYSTEM：简洁的 Settings 页头，不放品牌 logo / 呼吸光晕 / slogan / 大玻璃，
 * 只保留标题与合理的顶部留白；设置列表本身就是页面主体。
 */
export default () => {
  return (
    <View style={styles.container}>
      <PageHeader
        title='设置'
        right={(
          <View style={styles.headerActions}>
            <HeaderButton icon='music-box-multiple-outline' onPress={() => { global.state_event.settingsDeepScreenRequested('sourcesearch') }} />
            <HeaderButton icon='tools' onPress={() => { global.state_event.settingsDeepScreenRequested('library') }} />
            <HeaderButton icon='download-2' onPress={() => { global.state_event.settingsDeepScreenRequested('download') }} />
          </View>
        )}
      />
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
  /** 页头右侧图标组：间距与本地音乐/排行榜/歌单广场统一为 8dp */
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  setting: {
    flex: 1,
  },
})
