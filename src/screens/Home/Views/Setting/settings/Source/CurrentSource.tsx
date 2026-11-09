import { memo } from 'react'
import { View } from 'react-native'
import { Group, ActionRow } from '../../components/ui'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { getOnPrimary } from '@/theme/designTokens'
import { createStyle, openUrl } from '@/utils/tools'
import { useI18n } from '@/lang'
import { useSettingValue } from '@/store/setting/hook'
import { useStatus, useUserApiList } from '@/store/userApi'
import apiSourceInfo from '@/utils/musicSdk/api-source-info'
import { setApiSource } from '@/core/apiSource'
import { formatVersion } from './helpers'

export default memo(() => {
  const t = useI18n()
  const activeId = useSettingValue('common.apiSource')
  const userApiList = useUserApiList()
  const apiStatus = useStatus()
  const theme = useTheme()
  const onPrimary = getOnPrimary(theme)
  const activeApi = userApiList.find(api => api.id === activeId)
  const builtinApi = apiSourceInfo.find(api => api.id === activeId)
  const name = activeApi?.name ?? builtinApi?.name ?? (activeId || t('setting_source_builtin'))
  const statusText = apiStatus.status
    ? t('setting_basic_source_status_success')
    : apiStatus.message === 'initing' ? t('setting_basic_source_status_initing') : t('setting_basic_source_status_failed')
  return (
    <Group title={t('setting_source_current')} icon='script-text-outline'>
      {/* 当前音源突出显示：主色描边卡片 + 品牌图标 + 当前标签 */}
      <View style={[styles.currentCard, { backgroundColor: theme['c-primary-alpha-900'], borderColor: theme['c-primary-alpha-600'] }]}>
        <View style={[styles.currentIcon, { backgroundColor: theme['c-primary'] }]}>
          <Icon name='music-box-multiple-outline' size={22} color={onPrimary} />
        </View>
        <View style={styles.currentInfo}>
          <View style={styles.currentNameRow}>
            <Text size={16} numberOfLines={1} style={styles.currentName}>{name}</Text>
            <View style={[styles.currentTag, { backgroundColor: theme['c-primary'] }]}>
              <Text size={10} color={onPrimary} style={styles.currentTagText}>当前</Text>
            </View>
          </View>
          <Text size={11} color={theme['c-450']} numberOfLines={1} style={styles.currentStatus}>
            {`${statusText}${activeApi?.author ? ` · ${activeApi.author}` : ''}${activeApi?.version ? ` · ${formatVersion(activeApi.version)}` : ''}`}
          </Text>
        </View>
      </View>
      {activeId ? <ActionRow title={t('setting_source_reinit')} desc='重新执行音源初始化脚本' action='重新初始化' onPress={() => { setApiSource(activeId) }} /> : null}
      {activeApi?.homepage ? <ActionRow title='音源主页' action='打开' onPress={() => { void openUrl(activeApi.homepage) }} /> : null}
    </Group>
  )
})

const styles = createStyle({
  currentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 14,
    marginRight: 14,
    marginTop: 8,
    marginBottom: 12,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
  },
  currentIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  currentInfo: { flex: 1, minWidth: 0 },
  currentNameRow: { flexDirection: 'row', alignItems: 'center' },
  currentName: { flexShrink: 1, fontWeight: '700' },
  currentTag: {
    marginLeft: 8,
    paddingLeft: 8,
    paddingRight: 8,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentTagText: { fontWeight: '700' },
  currentStatus: { marginTop: 3 },
})
