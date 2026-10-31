import { memo, useCallback, useMemo, useRef } from 'react'

import { View } from 'react-native'

import SubTitle from '../../components/SubTitle'
import ChoiceItem from '../../components/ChoiceItem'
import { createStyle } from '@/utils/tools'
import { setApiSource } from '@/core/apiSource'
import { useI18n } from '@/lang'
import apiSourceInfo from '@/utils/musicSdk/api-source-info'
import { useSettingValue } from '@/store/setting/hook'
import { useStatus, useUserApiList } from '@/store/userApi'
import Button from '../../components/Button'
import UserApiEditModal, { type UserApiEditModalType } from './UserApiEditModal'

const apiSourceList = apiSourceInfo.map(api => ({
  id: api.id,
  name: api.name,
  disabled: api.disabled,
}))

export default memo(() => {
  const t = useI18n()
  const apiSourceSetting = useSettingValue('common.apiSource')
  const list = useMemo(() => apiSourceList.map(s => ({
    // @ts-expect-error
    name: t(`setting_basic_source_${s.id}`) || s.name,
    id: s.id,
  })), [t])

  const setApiSourceId = useCallback((id: string) => {
    setApiSource(id)
  }, [])

  const userApiListRaw = useUserApiList()
  const apiStatus = useStatus()
  const userApiList = useMemo(() => {
    const getApiStatus = () => {
      let status
      if (apiStatus.status) status = t('setting_basic_source_status_success')
      else if (apiStatus.message == 'initing') status = t('setting_basic_source_status_initing')
      else status = t('setting_basic_source_status_failed')

      return status
    }
    return userApiListRaw.map(api => {
      const statusLabel = api.id == apiSourceSetting ? getApiStatus() : ''
      return {
        id: api.id,
        name: api.name,
        desc: [/^\d/.test(api.version) ? `v${api.version}` : api.version, statusLabel].filter(Boolean).join(' · '),
      }
    })
  }, [userApiListRaw, apiStatus, apiSourceSetting, t])

  const modalRef = useRef<UserApiEditModalType>(null)
  const handleShow = () => {
    modalRef.current?.show()
  }

  return (
    <SubTitle title={t('setting_basic_source')}>
      <View style={styles.list}>
        {
          list.map(({ id, name }) => (
            <ChoiceItem
              key={id}
              label={name}
              active={apiSourceSetting == id}
              onPress={() => { setApiSourceId(id) }}
            />
          ))
        }
        {
          userApiList.map(({ id, name, desc }) => (
            <ChoiceItem
              key={id}
              label={name}
              desc={desc}
              active={apiSourceSetting == id}
              onPress={() => { setApiSourceId(id) }}
            />
          ))
        }
      </View>
      <View style={styles.btn}>
        <Button onPress={handleShow}>{t('setting_basic_source_user_api_btn')}</Button>
      </View>
      <UserApiEditModal ref={modalRef} />
    </SubTitle>
  )
})

const styles = createStyle({
  list: {
    marginLeft: -14,
    marginRight: -14,
    marginBottom: 6,
  },
  btn: {
    marginTop: 4,
    flexDirection: 'row',
  },
})
