import { useCallback } from 'react'
import { View, TouchableOpacity } from 'react-native'

import Text from '@/components/common/Text'
import { confirmDialog, createStyle } from '@/utils/tools'
import { useSheetPalette } from '@/components/common/ActionSheet/palette'
import { contrastOn } from '@/theme/solid'
import { useI18n } from '@/lang'
import { useUserApiList, state as userApiState } from '@/store/userApi'
import { useSettingValue } from '@/store/setting/hook'
import { removeUserApi, setUserApiAllowShowUpdateAlert } from '@/core/userApi'
import CheckBox from '@/components/common/CheckBox'
import { Icon } from '@/components/common/Icon'
import settingState from '@/store/setting/state'
import apiSourceInfo from '@/utils/musicSdk/api-source-info'
import { setApiSource } from '@/core/apiSource'

const formatVersionName = (version: string) => {
  return /^\d/.test(version) ? `v${version}` : version
}

/**
 * 单个自定义源的卡片。
 *
 * Material You 卡片语言（和 ActionSheet / 设置页卡片一致）：
 * 圆角 16、主色淡底 + 细描边；当前启用的源用主色描边 + 「当前启用」chip 高亮，
 * 右侧有启用 / 删除操作，底部是「允许显示更新弹窗」开关。
 */
const ListItem = ({ item, activeId, onRemove, onChangeAllowShowUpdateAlert }: {
  item: LX.UserApi.UserApiInfo
  activeId: string
  onRemove: (id: string, name: string) => void
  onChangeAllowShowUpdateAlert: (id: string, enabled: boolean) => void
}) => {
  const palette = useSheetPalette()
  const t = useI18n()
  const active = activeId === item.id
  const onPrimary = contrastOn(palette.primary)

  const changeAllowShowUpdateAlert = (check: boolean) => {
    onChangeAllowShowUpdateAlert(item.id, check)
  }
  const handleRemove = () => {
    onRemove(item.id, item.name)
  }
  const handleEnable = () => {
    if (!active) setApiSource(item.id)
  }

  return (
    <View style={{
      ...styles.card,
      backgroundColor: palette.card,
      borderColor: active ? palette.primary : palette.border,
      borderWidth: active ? 1 : 0.5,
    }}>
      <TouchableOpacity style={styles.main} activeOpacity={0.7} onPress={handleEnable}>
        <View style={{ ...styles.iconWrap, backgroundColor: palette.bg, borderColor: palette.border }}>
          <Icon name='script-text-outline' size={18} color={active ? palette.primary : palette.textSecondary} />
        </View>
        <View style={styles.info}>
          <View style={styles.titleRow}>
            <View style={styles.nameWrap}>
              <Text size={15} numberOfLines={1} color={palette.text} style={styles.name}>{item.name}</Text>
            </View>
            {
              item.version
                ? (
                  <View style={{ ...styles.versionTag, backgroundColor: palette.bg }}>
                    <Text size={9} color={palette.textSecondary}>{formatVersionName(item.version)}</Text>
                  </View>
                  )
                : null
            }
            {
              active
                ? (
                  <View style={{ ...styles.activeTag, backgroundColor: palette.primary }}>
                    <Text size={9} color={onPrimary}>当前启用</Text>
                  </View>
                  )
                : null
            }
          </View>
          {
            item.description || item.author
              ? <Text size={11} color={palette.textSecondary} numberOfLines={2} style={styles.desc}>{item.description || item.author}</Text>
              : null
          }
        </View>
      </TouchableOpacity>

      <View style={{ ...styles.footer, borderTopColor: palette.border }}>
        <CheckBox
          check={item.allowShowUpdateAlert}
          label={t('user_api_allow_show_update_alert')}
          onChange={changeAllowShowUpdateAlert}
          size={0.75}
        />
        <View style={styles.actions}>
          {
            active
              ? null
              : (
                <TouchableOpacity
                  style={{ ...styles.enableBtn, backgroundColor: palette.primary }}
                  activeOpacity={0.8}
                  onPress={handleEnable}
                >
                  <Text size={11} color={onPrimary} style={styles.enableText}>启用</Text>
                </TouchableOpacity>
                )
          }
          <TouchableOpacity
            style={styles.del}
            onPress={handleRemove}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon name='trash-can-outline' size={16} color={palette.danger} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}

export interface UserApiEditModalProps {
  onSave: (rules: string) => void
  // onSourceChange: SourceSelectorProps['onSourceChange']
}
export interface UserApiEditModalType {
  show: (rules: string) => void
}


export default () => {
  const userApiList = useUserApiList()
  const apiSource = useSettingValue('common.apiSource')
  const palette = useSheetPalette()
  const t = useI18n()

  const handleRemove = useCallback(async(id: string, name: string) => {
    const confirm = await confirmDialog({
      message: global.i18n.t('user_api_remove_tip', { name }),
      cancelButtonText: global.i18n.t('cancel_button_text_2'),
      confirmButtonText: global.i18n.t('confirm_button_text'),
      bgClose: false,
    })
    if (!confirm) return
    void removeUserApi([id]).finally(() => {
      if (settingState.setting['common.apiSource'] == id) {
        let backApiId = apiSourceInfo.find(api => !api.disabled)?.id
        if (!backApiId) backApiId = userApiState.list[0]?.id
        setApiSource(backApiId ?? '')
      }
    })
  }, [])
  const handleChangeAllowShowUpdateAlert = useCallback((id: string, enabled: boolean) => {
    void setUserApiAllowShowUpdateAlert(id, enabled)
  }, [])

  // 列表本体不自己滚动：外层弹窗卡片的 ScrollView 负责滚动
  return (
    <View>
      {
        userApiList.length
          ? userApiList.map((item) => {
            return (
            <ListItem
              key={item.id}
              item={item}
              activeId={apiSource}
              onRemove={handleRemove}
              onChangeAllowShowUpdateAlert={handleChangeAllowShowUpdateAlert}
            />
            )
          })
          : (
            <View style={{ ...styles.empty, backgroundColor: palette.card, borderColor: palette.border }}>
              <View style={{ ...styles.emptyIcon, backgroundColor: palette.bg, borderColor: palette.border }}>
                <Icon name='script-text-outline' size={22} color={palette.textSecondary} />
              </View>
              <Text size={13} color={palette.text} style={styles.emptyTitle}>{t('user_api_empty')}</Text>
              <Text size={11} color={palette.textSecondary} style={styles.emptyTip}>
                点上方「导入」添加 LX Music 格式的自定义源脚本
              </Text>
            </View>
            )
      }
    </View>
  )
}


const styles = createStyle({
  card: {
    marginTop: 10,
    paddingLeft: 12,
    paddingRight: 12,
    paddingTop: 12,
    borderRadius: 16,
    overflow: 'hidden',
  },
  main: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 13,
    borderWidth: 0.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  info: {
    flexGrow: 1,
    flexShrink: 1,
  },
  titleRow: {
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
  versionTag: {
    flexShrink: 0,
    marginLeft: 6,
    paddingLeft: 5,
    paddingRight: 5,
    paddingTop: 1,
    paddingBottom: 1,
    borderRadius: 5,
  },
  activeTag: {
    flexShrink: 0,
    marginLeft: 6,
    paddingLeft: 6,
    paddingRight: 6,
    paddingTop: 1,
    paddingBottom: 1,
    borderRadius: 5,
  },
  desc: {
    marginTop: 5,
    lineHeight: 16,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 0.5,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  enableBtn: {
    height: 28,
    paddingLeft: 12,
    paddingRight: 12,
    borderRadius: 14,
    justifyContent: 'center',
    marginRight: 4,
  },
  enableText: {
    fontWeight: '600',
  },
  del: {
    width: 34,
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },
  empty: {
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 0.5,
    paddingTop: 24,
    paddingBottom: 24,
    alignItems: 'center',
  },
  emptyIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    borderWidth: 0.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    marginTop: 12,
    fontWeight: '600',
  },
  emptyTip: {
    marginTop: 6,
    textAlign: 'center',
  },
})
