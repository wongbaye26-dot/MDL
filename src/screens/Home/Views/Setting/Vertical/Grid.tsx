import { memo } from 'react'
import { View, TouchableOpacity } from 'react-native'

import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { useSettingValue } from '@/store/setting/hook'
import { useStatus, useUserApiList } from '@/store/userApi'
import { createStyle } from '@/utils/tools'
import { QUALITY_LABEL } from '@/core/download/utils'
import { SETTING_SCREENS, type SettingScreenIds } from '../Main'

/** 每个分组的图标与主题色（和首页大卡的配色保持一致） */
const META: Record<SettingScreenIds, { icon: string, color: string }> = {
  source: { icon: 'script-text-outline', color: '#6366F1' },
  basic: { icon: 'setting', color: '#8B5CF6' },
  player: { icon: 'play', color: '#EC4899' },
  download: { icon: 'download-2', color: '#F59E0B' },
  searchlist: { icon: 'search-2', color: '#3B82F6' },
  tools: { icon: 'wrench', color: '#F97316' },
  other: { icon: 'slider', color: '#64748B' },
  about: { icon: 'help', color: '#10B981' },
}

// 存储里的语言值是 zh_cn 这种下划线写法，映射表用的是连字符，取之前统一一下
const LANG_LABEL: Record<string, string> = {
  'zh-cn': '简体中文',
  'zh-tw': '繁體中文',
  'en-us': 'English',
}

const onOff = (value: boolean | undefined) => value ? '开' : '关'

const Tile = memo(({ id, title, preview, onPress }: {
  id: SettingScreenIds
  title: string
  preview: string
  onPress: (id: SettingScreenIds) => void
}) => {
  const theme = useTheme()
  const meta = META[id]

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      style={{
        ...styles.tile,
        backgroundColor: theme['c-primary-alpha-900'],
        borderColor: theme['c-primary-alpha-800'],
      }}
      onPress={() => { onPress(id) }}
    >
      <View style={{ ...styles.iconWrap, backgroundColor: `${meta.color}2E` }}>
        <Icon name={meta.icon} size={18} color={meta.color} />
      </View>
      <Text size={14} style={styles.title} numberOfLines={1}>{title}</Text>
      <Text size={11} color={theme['c-450']} numberOfLines={2} style={styles.preview}>{preview}</Text>
    </TouchableOpacity>
  )
})

export default ({ onPress }: { onPress: (id: SettingScreenIds) => void }) => {
  const theme = useTheme()
  const t = useI18n()

  const langId = useSettingValue('common.langId')
  const apiSource = useSettingValue('common.apiSource')
  const userApiList = useUserApiList()
  const apiStatus = useStatus()
  const playQuality = useSettingValue('player.playQuality')
  const wordByWord = useSettingValue('player.isWordByWordLyric')
  const showHistory = useSettingValue('search.isShowHistorySearch')
  const showHot = useSettingValue('search.isShowHotSearch')
  const showAlbumName = useSettingValue('list.isShowAlbumName')
  const showInterval = useSettingValue('list.isShowInterval')
  const downloadQuality = useSettingValue('download.quality')
  const maxDownloadNum = useSettingValue('download.maxDownloadNum')
  const autoSave = useSettingValue('download.autoSaveWhilePlaying')

  const activeUserApi = userApiList.find(api => api.id === apiSource)
  const sourceStatus = apiStatus.status
    ? t('setting_basic_source_status_success')
    : apiStatus.message === 'initing'
      ? t('setting_basic_source_status_initing')
      : t('setting_basic_source_status_failed')
  const sourcePreview = activeUserApi
    ? `${activeUserApi.name} · ${sourceStatus}`
    : apiSource
      ? `${apiSource} · ${sourceStatus}`
      : t('setting_source_summary_none')

  const previews: Record<SettingScreenIds, string> = {
    source: sourcePreview,
    basic: `${theme.name || 'Emo'} · ${LANG_LABEL[(langId ?? 'zh-cn').replace('_', '-')] ?? langId ?? ''}`,
    player: `${QUALITY_LABEL[playQuality] ?? playQuality} · 逐字歌词${onOff(wordByWord)}`,
    download: `${QUALITY_LABEL[downloadQuality] ?? downloadQuality} · 并发 ${maxDownloadNum ?? 3}${autoSave ? ' · 边听边存' : ''}`,
    searchlist: `历史${onOff(showHistory)} · 热搜${onOff(showHot)} · 专辑名${onOff(showAlbumName)} · 间隔${onOff(showInterval)}`,
    tools: '批量补封面 · 写标签',
    other: '缓存管理 · 权限 · 日志',
    about: `v${process.versions.app}`,
  }

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {
          SETTING_SCREENS.map(id => (
            <Tile
              key={id}
              id={id}
              title={t(`setting_${id}` as 'setting_basic')}
              preview={previews[id]}
              onPress={onPress}
            />
          ))
        }
      </View>
    </View>
  )
}

const styles = createStyle({
  container: {
    paddingLeft: 16,
    paddingRight: 16,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  tile: {
    width: '48.6%',
    minHeight: 112,
    borderRadius: 18,
    borderWidth: 0.5,
    paddingLeft: 13,
    paddingRight: 13,
    paddingTop: 12,
    paddingBottom: 12,
    marginBottom: 10,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontWeight: '600',
    marginTop: 9,
  },
  preview: {
    marginTop: 4,
    lineHeight: 15,
  },
})
