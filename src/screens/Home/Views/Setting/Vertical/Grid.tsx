import { memo } from 'react'
import { View, TouchableOpacity } from 'react-native'

import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import Section from '../components/Section'
import SettingRow from '../components/SettingRow'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { useSettingValue } from '@/store/setting/hook'
import { useStatus, useUserApiList } from '@/store/userApi'
import { createStyle } from '@/utils/tools'
import { QUALITY_LABEL } from '@/core/download/utils'
import { type SettingScreenIds } from '../Main'
import { SCREEN_META, SCREEN_GROUPS } from '../components/screenMeta'
import { getCardBackground, getCardBorder, getCardShadow } from '../components/surfaces'

// 存储里的语言值是 zh_cn 这种下划线写法，映射表用的是连字符，取之前统一一下
const LANG_LABEL: Record<string, string> = {
  'zh-cn': '简体中文',
  'zh-tw': '繁體中文',
  'en-us': 'English',
}

const onOff = (value: boolean | undefined) => value ? '开' : '关'

/**
 * 设置首页「播放与下载」的入口卡：图标 + 标题 + 实时摘要 + 右箭头。
 * 和下面列表行的区别只是并排展示，点击后的跳转/入口完全不变。
 */
const NavCard = memo(({ id, title, preview, onPress }: {
  id: SettingScreenIds
  title: string
  preview: string
  onPress: (id: SettingScreenIds) => void
}) => {
  const theme = useTheme()
  const meta = SCREEN_META[id]

  return (
    <TouchableOpacity
      style={{
        ...styles.navCard,
        backgroundColor: getCardBackground(theme),
        borderColor: getCardBorder(theme),
        ...getCardShadow(theme),
      }}
      activeOpacity={0.72}
      onPress={() => { onPress(id) }}
    >
      <View style={[styles.navIcon, { backgroundColor: `${meta.color}24` }]}>
        <Icon name={meta.icon} size={21} color={meta.color} />
      </View>
      <View style={styles.navText}>
        <Text size={15.5} numberOfLines={1} style={styles.navTitle}>{title}</Text>
        <Text size={9.5} color={theme['c-450']} numberOfLines={1} style={styles.navPreview}>{preview}</Text>
      </View>
      <Icon name='chevron-right' size={15} color={theme['c-350']} />
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
    playback: `${QUALITY_LABEL[playQuality] ?? playQuality} · 淡入淡出 · 缓存`,
    lyric: '逐字 · 翻译 · 蓝牙歌词',
    appearance: `${theme.name || 'Emo'} · ${LANG_LABEL[(langId ?? 'zh-cn').replace('_', '-')] ?? langId ?? ''} · 动效`,
    library: '曲库体检 · 封面 · 标签 · 重命名',
    sourcesearch: `${sourcePreview} · 历史${onOff(showHistory)} · 热搜${onOff(showHot)}`,
    download: `${QUALITY_LABEL[downloadQuality] ?? downloadQuality} · ${maxDownloadNum ?? 3}并发${autoSave ? ' · 边听边存' : ''}`,
    system: '权限 · 电池优化 · 自启动',
    misc: `v${process.versions.app} · 缓存 · 日志 · 关于`,
  }

  return (
    <View style={styles.container}>
      {
        SCREEN_GROUPS.map((group, groupIndex) => (
          <Section
            key={group.title}
            title={group.title}
            icon={group.icon}
            color={group.color}
            card={groupIndex !== 0}
          >
            {
              groupIndex === 0
                ? (
                  <View style={styles.dualRow}>
                    {group.ids.map(id => (
                      <NavCard
                        key={id}
                        id={id}
                        title={t(`setting_${id}` as 'setting_basic')}
                        preview={previews[id]}
                        onPress={onPress}
                      />
                    ))}
                  </View>
                  )
                : group.ids.map(id => {
                  const meta = SCREEN_META[id]
                  return (
                    <SettingRow
                      key={id}
                      icon={meta.icon}
                      color={meta.color}
                      title={t(`setting_${id}` as 'setting_basic')}
                      desc={previews[id]}
                      onPress={() => { onPress(id) }}
                    />
                  )
                })
            }
          </Section>
        ))
      }
    </View>
  )
}

const styles = createStyle({
  container: {
    paddingLeft: 18,
    paddingRight: 18,
    paddingTop: 0,
  },
  dualRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  navCard: {
    width: '48.4%',
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 0.5,
    paddingLeft: 12,
    paddingRight: 8,
    paddingTop: 8,
    paddingBottom: 8,
  },
  navIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  navText: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  navTitle: {
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  navPreview: {
    marginTop: 4,
    lineHeight: 15,
  },
})
