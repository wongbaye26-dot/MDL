import { memo } from 'react'
import { View, TouchableOpacity } from 'react-native'

import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import Section from '../components/Section'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { useSettingValue } from '@/store/setting/hook'
import { useStatus, useUserApiList } from '@/store/userApi'
import { createStyle } from '@/utils/tools'
import { QUALITY_LABEL } from '@/core/download/utils'
import { type SettingScreenIds } from '../Main'
import { SCREEN_META, SCREEN_GROUPS } from '../components/screenMeta'

// 存储里的语言值是 zh_cn 这种下划线写法，映射表用的是连字符，取之前统一一下
const LANG_LABEL: Record<string, string> = {
  'zh-cn': '简体中文',
  'zh-tw': '繁體中文',
  'en-us': 'English',
}

const onOff = (value: boolean | undefined) => value ? '开' : '关'

/**
 * 设置首页列表行：40dp 彩色圆角图标 + 标题 + 一行实时摘要 + 右侧 chevron。
 * 行高/左右内边距比 v3.8.2 放宽，整页按分组拆成 3 张 Section 卡，
 * 卡片圆角/描边/底色/组标题/分隔线全部复用子设置页的 Section 组件，视觉语言完全一致。
 */
const Row = memo(({ id, title, preview, onPress }: {
  id: SettingScreenIds
  title: string
  preview: string
  onPress: (id: SettingScreenIds) => void
}) => {
  const theme = useTheme()
  const meta = SCREEN_META[id]

  return (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={0.7}
      onPress={() => { onPress(id) }}
    >
      <View style={{ ...styles.iconWrap, backgroundColor: `${meta.color}2E` }}>
        <Icon name={meta.icon} size={20} color={meta.color} />
      </View>
      <View style={styles.info}>
        <Text size={15} numberOfLines={1} style={styles.title}>{title}</Text>
        <Text size={11} color={theme['c-450']} numberOfLines={1} style={styles.preview}>{preview}</Text>
      </View>
      <Icon name='chevron-right' size={18} color={theme['c-350']} />
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

  // 列表只给一行摘要，摘要保持实时、尽量精简
  const previews: Record<SettingScreenIds, string> = {
    player: `${QUALITY_LABEL[playQuality] ?? playQuality} · 逐字歌词${onOff(wordByWord)}`,
    download: `${QUALITY_LABEL[downloadQuality] ?? downloadQuality} · 并发 ${maxDownloadNum ?? 3}${autoSave ? ' · 边听边存' : ''}`,
    source: sourcePreview,
    searchlist: `历史${onOff(showHistory)} · 热搜${onOff(showHot)} · 专辑名${onOff(showAlbumName)}`,
    tools: '批量补封面 · 写标签 · 重命名',
    basic: `${theme.name || 'Emo'} · ${LANG_LABEL[(langId ?? 'zh-cn').replace('_', '-')] ?? langId ?? ''}`,
    other: '缓存管理 · 权限 · 日志',
    about: `v${process.versions.app}`,
  }

  return (
    <View style={styles.container}>
      {
        SCREEN_GROUPS.map(group => (
          <Section key={group.title} title={group.title}>
            {
              group.ids.map(id => (
                <Row
                  key={id}
                  id={id}
                  title={t(`setting_${id}` as 'setting_basic')}
                  preview={previews[id]}
                  onPress={onPress}
                />
              ))
            }
          </Section>
        ))
      }
    </View>
  )
}

const styles = createStyle({
  container: {
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 72,
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 14,
    paddingBottom: 14,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
    flexShrink: 0,
  },
  info: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    marginRight: 8,
  },
  title: {
    fontWeight: '600',
  },
  preview: {
    marginTop: 4,
    lineHeight: 15,
  },
})
