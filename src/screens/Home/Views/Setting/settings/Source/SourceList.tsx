import { useCallback, useState } from 'react'
import { TouchableOpacity, View } from 'react-native'

import Section from '../../components/Section'
import Text from '@/components/common/Text'
import Tag from '@/components/common/Tag'
import { Icon } from '@/components/common/Icon'
import CheckBox from '@/components/common/CheckBox'
import Chip from '@/components/common/Chip'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { useSettingValue } from '@/store/setting/hook'
import { useUserApiList, state as userApiState } from '@/store/userApi'
import { removeUserApi, setUserApiAllowShowUpdateAlert } from '@/core/userApi'
import { setApiSource } from '@/core/apiSource'
import { confirmDialog, createStyle, openUrl, toast } from '@/utils/tools'
import apiSourceInfo from '@/utils/musicSdk/api-source-info'
import settingState from '@/store/setting/state'
import ImportBtn from '../Basic/UserApiEditModal/ImportBtn'
import { checkUserApiUpdate } from './updateCheck'
import { useQualityList, useSourcePageState, type UpdateCheckInfo } from './state'
import { formatTime, formatVersion, qualityLabel, sortQualitys } from './helpers'

/** 更新检查结果的文案与颜色 */
const useUpdateCheckLabel = () => {
  const t = useI18n()
  return (info: UpdateCheckInfo | undefined): { text: string, color: 'normal' | 'error' | 'success' } | null => {
    if (!info) return null
    switch (info.status) {
      case 'checking':
        return { text: t('setting_source_checking'), color: 'normal' }
      case 'new':
        return { text: t('setting_source_update_new', { version: info.latestVersion ?? '' }), color: 'error' }
      case 'latest':
        return { text: t('setting_source_update_latest'), color: 'success' }
      case 'unavailable':
        return { text: t('setting_source_update_unavailable'), color: 'normal' }
      case 'failed':
      default:
        return { text: t('setting_source_update_failed'), color: 'error' }
    }
  }
}

const ListItem = ({
  item,
  active,
  checking,
  updateInfo,
  onEnable,
  onDisable,
  onRemove,
  onCheckUpdate,
  onChangeAllowShowUpdateAlert,
}: {
  item: LX.UserApi.UserApiInfo
  active: boolean
  checking: boolean
  updateInfo: UpdateCheckInfo | undefined
  onEnable: (item: LX.UserApi.UserApiInfo) => void
  onDisable: () => void
  onRemove: (item: LX.UserApi.UserApiInfo) => void
  onCheckUpdate: (item: LX.UserApi.UserApiInfo) => void
  onChangeAllowShowUpdateAlert: (id: string, enabled: boolean) => void
}) => {
  const t = useI18n()
  const theme = useTheme()
  const qualityList = useQualityList()
  const getUpdateCheckLabel = useUpdateCheckLabel()

  // 当前启用的源用实时音质矩阵，其它源用上次初始化时缓存下来的矩阵。
  // 注意要先按音质去重再排序：矩阵是「每个音源 → 它的音质数组」，
  // 直接 flat 会把 6 个音源都支持的 Hi-Res 重复 6 次，排序后切片就变成一排一样的 Hi-Res。
  const matrix = active ? qualityList : item.qualitys
  const qualitys = sortQualitys(Array.from(new Set(matrix
    ? Object.values(matrix).filter((item): item is LX.Quality[] => Array.isArray(item)).flat()
    : [])))
  const updateLabel = getUpdateCheckLabel(updateInfo)
  const lastCheckAt = updateInfo?.checkedAt ?? item.lastCheckAt
  const updateColor = updateLabel?.color === 'error'
    ? '#EF4444'
    : updateLabel?.color === 'success' ? '#10B981' : theme['c-450']

  const handleOpenHomepage = () => {
    if (item.homepage) void openUrl(item.homepage)
  }
  const subLine = [item.author, item.description].filter(Boolean).join(' · ')

  return (
    <View style={styles.item}>
      <View style={styles.head}>
        <View style={{ ...styles.iconWrap, backgroundColor: theme['c-primary-alpha-800'], borderColor: theme['c-primary-alpha-600'] }}>
          <Icon name='script-text-outline' size={18} color={active ? theme['c-primary'] : theme['c-450']} />
        </View>
        <View style={styles.headInfo}>
          <View style={styles.nameRow}>
            <View style={styles.nameWrap}>
              <Text size={14.5} numberOfLines={1} style={styles.name}>{item.name}</Text>
            </View>
            {item.version ? <Tag label={formatVersion(item.version)} size='sm' tone='muted' style={styles.version} /> : null}
            {active ? <Tag label={t('setting_source_current_tag')} size='sm' bg={theme['c-primary']} color='#FFFFFF' style={styles.activeTag} /> : null}
          </View>
          <Text size={10.5} color={theme['c-450']} numberOfLines={1} style={styles.subLine}>
            {subLine.length ? subLine : item.id}
          </Text>
        </View>
        {
          active
            ? (
              <TouchableOpacity
                style={{ ...styles.enableBtn, backgroundColor: 'transparent', borderColor: theme['c-primary-alpha-600'] }}
                activeOpacity={0.8}
                onPress={onDisable}
              >
                <Text size={11} color={theme['c-450']} style={styles.enableText}>{t('setting_source_disable')}</Text>
              </TouchableOpacity>
              )
            : (
              <TouchableOpacity
                style={{ ...styles.enableBtn, backgroundColor: theme['c-primary-alpha-800'], borderColor: theme['c-primary-alpha-600'] }}
                activeOpacity={0.8}
                onPress={() => { onEnable(item) }}
              >
                <Text size={11} color={theme['c-primary']} style={styles.enableText}>{t('setting_source_enable')}</Text>
              </TouchableOpacity>
              )
        }
      </View>

      {/* 音质矩阵（来自初始化上报，切换源后自动缓存） */}
      <View style={styles.qualityRow}>
        {
          qualitys.length
            ? (
                qualitys.slice(0, 5).map(quality => (
                  <View key={quality} style={styles.chip}>
                    <Chip size='sm' soft label={qualityLabel(quality)} />
                  </View>
                ))
              )
            : <Text size={10} color={theme['c-400']}>{t('setting_source_quality_pending')}</Text>
        }
      </View>

      {/* 主页 / 检查更新 */}
      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.homepage} activeOpacity={0.7} onPress={handleOpenHomepage}>
          <Icon name='link' size={11} color={item.homepage ? theme['c-primary'] : theme['c-400']} />
          <Text size={10.5} numberOfLines={1} color={item.homepage ? theme['c-primary'] : theme['c-400']} style={styles.homepageText}>
            {item.homepage || t('setting_source_no_homepage')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.checkBtn}
          activeOpacity={0.7}
          disabled={checking}
          onPress={() => { onCheckUpdate(item) }}
        >
          <Icon name='refresh' size={11} color={checking ? theme['c-400'] : theme['c-primary']} />
          <Text size={10.5} color={checking ? theme['c-400'] : theme['c-primary']} style={styles.checkText}>
            {checking ? t('setting_source_checking') : t('setting_source_check_update')}
          </Text>
        </TouchableOpacity>
      </View>
      {
        (updateLabel != null || lastCheckAt != null)
          ? (
            <View style={styles.updateRow}>
              {updateLabel ? <Text size={10.5} color={updateColor} numberOfLines={2} style={styles.updateText}>{updateLabel.text}</Text> : null}
              {lastCheckAt ? <Text size={10} color={theme['c-400']} style={styles.lastCheck}>{t('setting_source_update_last', { time: formatTime(lastCheckAt) })}</Text> : null}
            </View>
            )
          : null
      }

      <View style={{ ...styles.footer, borderTopColor: theme['c-primary-alpha-700'] }}>
        <CheckBox
          check={item.allowShowUpdateAlert}
          label={t('user_api_allow_show_update_alert')}
          onChange={check => { onChangeAllowShowUpdateAlert(item.id, check) }}
          size={0.7}
        />
        <TouchableOpacity style={styles.del} onPress={() => { onRemove(item) }} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <Icon name='trash-can-outline' size={16} color={theme['c-400']} />
        </TouchableOpacity>
      </View>
    </View>
  )
}

/**
 * 自定义源列表：启用 / 停用、删除、允许更新弹窗开关、检查更新，以及导入入口。
 */
export default () => {
  const t = useI18n()
  const theme = useTheme()
  const activeId = useSettingValue('common.apiSource')
  const userApiList = useUserApiList()
  const pageState = useSourcePageState()
  const [checkingId, setCheckingId] = useState('')

  const handleEnable = useCallback((item: LX.UserApi.UserApiInfo) => {
    setApiSource(item.id)
  }, [])

  /** 「停用」当前源：切换到其它可用的音源（内置源优先，其次其它自定义源） */
  const handleDisable = useCallback(() => {
    const nextApiId = apiSourceInfo.find(api => !api.disabled)?.id ??
      userApiList.find(api => api.id !== activeId)?.id
    if (!nextApiId) {
      toast(t('setting_source_disable_tip'), 'long')
      return
    }
    setApiSource(nextApiId)
  }, [activeId, userApiList, t])

  const handleRemove = useCallback(async(item: LX.UserApi.UserApiInfo) => {
    const confirm = await confirmDialog({
      message: t('user_api_remove_tip', { name: item.name }),
      cancelButtonText: t('cancel_button_text_2'),
      confirmButtonText: t('confirm_button_text'),
      bgClose: false,
    })
    if (!confirm) return
    void removeUserApi([item.id]).finally(() => {
      if (settingState.setting['common.apiSource'] == item.id) {
        let backApiId = apiSourceInfo.find(api => !api.disabled)?.id
        if (!backApiId) backApiId = userApiState.list[0]?.id
        setApiSource(backApiId ?? '')
      }
    })
  }, [t])

  const handleCheckUpdate = useCallback(async(item: LX.UserApi.UserApiInfo) => {
    if (checkingId) return
    setCheckingId(item.id)
    try {
      await checkUserApiUpdate(item)
    } finally {
      setCheckingId('')
    }
  }, [checkingId])

  const handleChangeAllowShowUpdateAlert = useCallback((id: string, enabled: boolean) => {
    void setUserApiAllowShowUpdateAlert(id, enabled)
  }, [])

  return (
    <Section title={t('setting_source_user_list')} icon='playlist-music'>
      {/* Section 会在多个顶层子元素之间插分隔线，这里整体包一层、自己控制列表分隔 */}
      <View>
        <View style={{ ...styles.importRow, borderBottomColor: theme['c-primary-alpha-700'] }}>
          <Text size={10.5} color={theme['c-450']} style={styles.importTip}>{t('setting_source_import_tip')}</Text>
          <ImportBtn
            btnStyle={{ ...styles.importBtn, backgroundColor: theme['c-primary-alpha-700'] }}
            color={theme['c-primary-light-200']}
          />
        </View>
        {
          userApiList.length
            ? userApiList.map((item, index) => (
              <View key={item.id} style={index > 0 ? { borderTopWidth: 0.5, borderTopColor: theme['c-primary-alpha-700'] } : undefined}>
                <ListItem
                  item={item}
                  active={item.id === activeId}
                  checking={checkingId === item.id}
                  updateInfo={pageState.updateChecks[item.id]}
                  onEnable={handleEnable}
                  onDisable={handleDisable}
                  onRemove={handleRemove}
                  onCheckUpdate={handleCheckUpdate}
                  onChangeAllowShowUpdateAlert={handleChangeAllowShowUpdateAlert}
                />
              </View>
            ))
            : (
              <View style={styles.empty}>
                <Text size={12} color={theme['c-450']}>{t('setting_source_user_empty')}</Text>
              </View>
              )
        }
        <Text size={10} color={theme['c-400']} style={styles.note}>{t('user_api_note')}</Text>
      </View>
    </Section>
  )
}

const styles = createStyle({
  importRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 14,
    paddingRight: 14,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
  },
  importTip: {
    flexGrow: 1,
    flexShrink: 1,
    marginRight: 10,
    lineHeight: 15,
  },
  importBtn: {
    height: 34,
    borderRadius: 17,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 14,
    paddingRight: 14,
  },
  item: {
    paddingLeft: 14,
    paddingRight: 14,
    paddingTop: 12,
    paddingBottom: 10,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 13,
    borderWidth: 0.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
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
    fontWeight: '600',
  },
  version: {
    marginLeft: 6,
  },
  activeTag: {
    marginLeft: 6,
  },
  subLine: {
    marginTop: 3,
  },
  enableBtn: {
    flexShrink: 0,
    height: 28,
    paddingLeft: 12,
    paddingRight: 12,
    borderRadius: 14,
    borderWidth: 0.5,
    justifyContent: 'center',
    marginLeft: 8,
  },
  enableText: {
    fontWeight: '600',
  },
  qualityRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
  },
  chip: {
    marginBottom: 6,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  homepage: {
    flexGrow: 1,
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
  },
  homepageText: {
    flexGrow: 1,
    flexShrink: 1,
    marginLeft: 4,
  },
  checkBtn: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 10,
    paddingRight: 10,
    paddingTop: 5,
    paddingBottom: 5,
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  checkText: {
    marginLeft: 4,
    fontWeight: '600',
  },
  updateRow: {
    marginTop: 6,
  },
  updateText: {
    lineHeight: 15,
  },
  lastCheck: {
    marginTop: 2,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 0.5,
  },
  del: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  empty: {
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 16,
  },
  note: {
    paddingLeft: 14,
    paddingRight: 14,
    paddingTop: 8,
    paddingBottom: 10,
    lineHeight: 15,
  },
})
