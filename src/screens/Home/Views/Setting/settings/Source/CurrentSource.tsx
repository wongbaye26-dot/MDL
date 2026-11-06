import { memo } from 'react'
import { TouchableOpacity, View } from 'react-native'

import Section from '../../components/Section'
import Button from '../../components/Button'
import Text from '@/components/common/Text'
import Tag from '@/components/common/Tag'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { useSettingValue } from '@/store/setting/hook'
import { useStatus, useUserApiList } from '@/store/userApi'
import apiSourceInfo from '@/utils/musicSdk/api-source-info'
import { setApiSource } from '@/core/apiSource'
import { createStyle, openUrl } from '@/utils/tools'
import { formatVersion } from './helpers'

/**
 * 「当前音源」状态卡：初始化状态、名称、版本、作者、说明、主页与重新初始化。
 * 音源切换在下面的自定义源列表里完成，这块只展示当前启用的那个源。
 */
export default memo(() => {
  const t = useI18n()
  const theme = useTheme()
  const activeId = useSettingValue('common.apiSource')
  const userApiList = useUserApiList()
  const apiStatus = useStatus()

  const activeApi = userApiList.find(api => api.id === activeId)
  const builtinApi = apiSourceInfo.find(api => api.id === activeId)
  const name = activeApi?.name ?? builtinApi?.name ?? (activeId || t('setting_source_builtin'))

  const statusText = apiStatus.status
    ? t('setting_basic_source_status_success')
    : apiStatus.message === 'initing'
      ? t('setting_basic_source_status_initing')
      : t('setting_basic_source_status_failed')
  const statusColor = apiStatus.status
    ? '#10B981'
    : apiStatus.message === 'initing' ? '#F59E0B' : '#EF4444'

  const handleReinit = () => {
    if (!activeId) return
    setApiSource(activeId)
  }

  const handleOpenHomepage = () => {
    const homepage = activeApi?.homepage
    if (homepage) void openUrl(homepage)
  }

  return (
    <Section title={t('setting_source_current')} icon='script-text-outline'>
      <View style={styles.content}>
        <View style={styles.head}>
          <View style={{ ...styles.iconWrap, backgroundColor: theme['c-primary-alpha-800'], borderColor: theme['c-primary-alpha-600'] }}>
            <Icon name='script-text-outline' size={20} color={theme['c-primary']} />
          </View>
          <View style={styles.headInfo}>
            <View style={styles.nameRow}>
              <View style={styles.nameWrap}>
                <Text size={16} numberOfLines={1} style={styles.name}>{name}</Text>
              </View>
              {activeApi?.version ? <Tag label={formatVersion(activeApi.version)} size='sm' tone='muted' style={styles.tag} /> : null}
            </View>
            <View style={styles.statusRow}>
              <View style={{ ...styles.dot, backgroundColor: statusColor }} />
              <Text size={11} color={theme['c-450']}>{statusText}</Text>
              {
                activeApi?.author
                  ? <Text size={11} color={theme['c-450']} numberOfLines={1} style={styles.author}>· {activeApi.author}</Text>
                  : null
              }
            </View>
          </View>
          {
            activeId
              ? <Button onPress={handleReinit}>{t('setting_source_reinit')}</Button>
              : null
          }
        </View>

        {
          activeApi
            ? (
              <>
                {
                  activeApi.description
                    ? <Text size={12} color={theme['c-450']} style={styles.desc}>{activeApi.description}</Text>
                    : null
                }
                <View style={styles.rows}>
                  <View style={styles.row}>
                    <Text size={11} color={theme['c-400']} style={styles.rowLabel}>{t('setting_source_version')}</Text>
                    <Text size={11} numberOfLines={1} style={styles.rowValue}>{activeApi.version ? formatVersion(activeApi.version) : '-'}</Text>
                  </View>
                  <View style={styles.row}>
                    <Text size={11} color={theme['c-400']} style={styles.rowLabel}>{t('setting_source_author')}</Text>
                    <Text size={11} numberOfLines={1} style={styles.rowValue}>{activeApi.author || '-'}</Text>
                  </View>
                  <TouchableOpacity style={styles.row} activeOpacity={0.7} onPress={handleOpenHomepage}>
                    <Text size={11} color={theme['c-400']} style={styles.rowLabel}>{t('setting_source_homepage')}</Text>
                    <Text size={11} numberOfLines={1} color={activeApi.homepage ? theme['c-primary'] : theme['c-450']} style={styles.rowValue}>{activeApi.homepage || t('setting_source_no_homepage')}</Text>
                  </TouchableOpacity>
                </View>
              </>
              )
            : (
              <Text size={11.5} color={theme['c-450']} style={styles.desc}>
                {t('setting_source_builtin_tip')}
              </Text>
              )
        }

      </View>
    </Section>
  )
})

const styles = createStyle({
  tag: {
    marginLeft: 6,
  },
  content: {
    paddingLeft: 14,
    paddingRight: 14,
    paddingTop: 12,
    paddingBottom: 4,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 0.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headInfo: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nameWrap: {
    flexGrow: 0,
    flexShrink: 1,
    minWidth: 0,
  },
  name: {
    fontWeight: '700',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  author: {
    marginLeft: 4,
    flexShrink: 1,
  },
  desc: {
    marginTop: 10,
    lineHeight: 17,
  },
  rows: {
    marginTop: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  rowLabel: {
    width: 46,
    flexShrink: 0,
  },
  rowValue: {
    flexGrow: 1,
    flexShrink: 1,
  },
})
