import { useCallback } from 'react'
import Text from '@/components/common/Text'
import { View, TouchableOpacity, ScrollView } from 'react-native'
import { confirmDialog, createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
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
const ListItem = ({ item, activeId, onRemove, onChangeAllowShowUpdateAlert }: {
  item: LX.UserApi.UserApiInfo
  activeId: string
  onRemove: (id: string, name: string) => void
  onChangeAllowShowUpdateAlert: (id: string, enabled: boolean) => void
}) => {
  const theme = useTheme()
  const t = useI18n()
  const active = activeId === item.id

  const changeAllowShowUpdateAlert = (check: boolean) => {
    onChangeAllowShowUpdateAlert(item.id, check)
  }
  const handleRemove = () => {
    onRemove(item.id, item.name)
  }

  return (
    <View style={{
      ...styles.card,
      backgroundColor: active ? theme['c-primary-alpha-800'] : theme['c-primary-alpha-900'],
      borderColor: active ? theme['c-primary-alpha-400'] : theme['c-primary-alpha-700'],
    }}>
      <TouchableOpacity style={styles.main} activeOpacity={0.7} onPress={() => { setApiSource(item.id) }}>
        <View style={{ ...styles.iconWrap, backgroundColor: active ? theme['c-primary-alpha-600'] : theme['c-primary-alpha-800'] }}>
          <Icon name='script-text-outline' size={18} color={active ? '#FFFFFF' : theme['c-primary-light-200']} />
        </View>
        <View style={styles.info}>
          <View style={styles.titleRow}>
            <Text size={15} numberOfLines={1} style={styles.name}>{item.name}</Text>
            {
              item.version
                ? (
                  <View style={{ ...styles.tag, backgroundColor: theme['c-primary-alpha-700'] }}>
                    <Text size={9} color={theme['c-primary-light-200']}>{formatVersionName(item.version)}</Text>
                  </View>
                  )
                : null
            }
            {
              active
                ? <Icon name='check-circle' size={16} color={theme['c-primary']} style={styles.check} />
                : null
            }
          </View>
          {
            item.description || item.author
              ? <Text size={11} color={theme['c-450']} numberOfLines={2} style={styles.desc}>{item.description || item.author}</Text>
              : null
          }
        </View>
      </TouchableOpacity>

      <View style={{ ...styles.footer, borderTopColor: theme['c-primary-alpha-800'] }}>
        <CheckBox
          check={item.allowShowUpdateAlert}
          label={t('user_api_allow_show_update_alert')}
          onChange={changeAllowShowUpdateAlert}
          size={0.75}
        />
        <TouchableOpacity
          style={styles.del}
          onPress={handleRemove}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Icon name='trash-can-outline' size={15} color={theme['c-400']} />
        </TouchableOpacity>
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
  const theme = useTheme()
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

  return (
    <ScrollView style={styles.scrollView} keyboardShouldPersistTaps={'always'}>
      <View onStartShouldSetResponder={() => true}>
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
            : <Text style={styles.tipText} color={theme['c-font-label']}>{t('user_api_empty')}</Text>
        }
      </View>
    </ScrollView>
  )
}


const styles = createStyle({
  scrollView: {
    paddingHorizontal: 7,
    flexGrow: 0,
  },
  list: {
    paddingBottom: 15,
    flexDirection: 'column',
  },
  card: {
    marginLeft: 14,
    marginRight: 14,
    marginTop: 10,
    paddingLeft: 12,
    paddingRight: 12,
    paddingTop: 12,
    borderRadius: 18,
    borderWidth: 0.5,
    overflow: 'hidden',
  },
  main: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 13,
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
  name: {
    flexShrink: 1,
    fontWeight: '600',
  },
  tag: {
    marginLeft: 6,
    paddingLeft: 5,
    paddingRight: 5,
    paddingTop: 1,
    paddingBottom: 1,
    borderRadius: 4,
  },
  check: {
    marginLeft: 6,
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
    paddingTop: 6,
    borderTopWidth: 0.5,
  },
  del: {
    width: 34,
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // btns: {
  //   padding: 5,
  // },
  btn: {
    padding: 10,
    // backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  tipText: {
    textAlign: 'center',
    marginTop: 25,
    marginBottom: 15,
  },
})


