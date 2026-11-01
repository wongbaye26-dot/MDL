import { memo } from 'react'
import { View, TouchableOpacity } from 'react-native'

import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { useSettingValue } from '@/store/setting/hook'
import { createStyle } from '@/utils/tools'
import { QUALITY_LABEL } from '@/core/download/utils'
import { SETTING_SCREENS, type SettingScreenIds } from '../Main'

/** 每个分组的图标与主题色（和首页大卡的配色保持一致） */
const META: Record<SettingScreenIds, { icon: string, color: string }> = {
  basic: { icon: 'setting', color: '#8B5CF6' },
  player: { icon: 'play', color: '#EC4899' },
  search: { icon: 'search-2', color: '#3B82F6' },
  list: { icon: 'list-order', color: '#14B8A6' },
  download: { icon: 'download-2', color: '#F59E0B' },
  other: { icon: 'slider', color: '#64748B' },
  about: { icon: 'help', color: '#10B981' },
}

const LANG_LABEL: Record<string, string> = {
  'zh-cn': '简体中文',
  'zh-tw': '繁體中文',
  'en-us': 'English',
}

const onOff = (value: boolean | undefined) => value ? '开' : '关'

const Tile = memo(({ id, title, preview, wide, onPress }: {
  id: SettingScreenIds
  title: string
  preview: string
  wide?: boolean
  onPress: (id: SettingScreenIds) => void
}) => {
  const theme = useTheme()
  const meta = META[id]

  if (wide) {
    return (
      <TouchableOpacity
        activeOpacity={0.75}
        style={{
          ...styles.tileWide,
          backgroundColor: theme['c-primary-alpha-900'],
          borderColor: theme['c-primary-alpha-800'],
        }}
        onPress={() => { onPress(id) }}
      >
        <View style={{ ...styles.iconWrap, backgroundColor: `${meta.color}2E` }}>
          <Icon name={meta.icon} size={18} color={meta.color} />
        </View>
        <View style={styles.wideText}>
          <Text size={14} style={styles.titleWide} numberOfLines={1}>{title}</Text>
          <Text size={11} color={theme['c-450']} numberOfLines={1} style={styles.previewWide}>{preview}</Text>
        </View>
        <Icon name='chevron-right' size={16} color={theme['c-400']} />
      </TouchableOpacity>
    )
  }

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
  const playQuality = useSettingValue('player.playQuality')
  const wordByWord = useSettingValue('player.isWordByWordLyric')
  const showHistory = useSettingValue('search.isShowHistorySearch')
  const showHot = useSettingValue('search.isShowHotSearch')
  const showAlbumName = useSettingValue('list.isShowAlbumName')
  const showInterval = useSettingValue('list.isShowInterval')
  const downloadQuality = useSettingValue('download.quality')
  const maxDownloadNum = useSettingValue('download.maxDownloadNum')
  const autoSave = useSettingValue('download.autoSaveWhilePlaying')

  const previews: Record<SettingScreenIds, string> = {
    basic: `${theme.name || 'EMO'} · ${LANG_LABEL[langId ?? 'zh-cn'] ?? langId ?? ''}`,
    player: `${QUALITY_LABEL[playQuality] ?? playQuality} · 逐字歌词${onOff(wordByWord)}`,
    search: `历史${onOff(showHistory)} · 热搜${onOff(showHot)}`,
    list: `专辑名${onOff(showAlbumName)} · 间隔${onOff(showInterval)}`,
    download: `${QUALITY_LABEL[downloadQuality] ?? downloadQuality} · 并发 ${maxDownloadNum ?? 3}${autoSave ? ' · 边听边存' : ''}`,
    other: '缓存管理 · 不感兴趣 · 日志',
    about: `v${process.versions.app}`,
  }

  const tiles = SETTING_SCREENS.slice(0, SETTING_SCREENS.length - 1)
  const last = SETTING_SCREENS[SETTING_SCREENS.length - 1]

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {
          tiles.map(id => (
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
      <Tile
        id={last}
        wide
        title={t(`setting_${last}` as 'setting_basic')}
        preview={previews[last]}
        onPress={onPress}
      />
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
    minHeight: 104,
    borderRadius: 18,
    borderWidth: 0.5,
    paddingLeft: 13,
    paddingRight: 13,
    paddingTop: 12,
    paddingBottom: 12,
    marginBottom: 10,
  },
  tileWide: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 0.5,
    paddingLeft: 13,
    paddingRight: 12,
    paddingTop: 12,
    paddingBottom: 12,
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
  titleWide: {
    fontWeight: '600',
  },
  previewWide: {
    marginTop: 3,
  },
  wideText: {
    flexGrow: 1,
    flexShrink: 1,
    marginLeft: 12,
    marginRight: 8,
  },
})
