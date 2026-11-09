import { memo } from 'react'
import { Group, ValueRow, ActionRow } from '../../components/ui'
import { useI18n } from '@/lang'
import { useSettingValue } from '@/store/setting/hook'
import { useStatus, useUserApiList } from '@/store/userApi'
import apiSourceInfo from '@/utils/musicSdk/api-source-info'
import { setApiSource } from '@/core/apiSource'
import { openUrl } from '@/utils/tools'
import { formatVersion } from './helpers'

export default memo(() => {
  const t = useI18n()
  const activeId = useSettingValue('common.apiSource')
  const userApiList = useUserApiList()
  const apiStatus = useStatus()
  const activeApi = userApiList.find(api => api.id === activeId)
  const builtinApi = apiSourceInfo.find(api => api.id === activeId)
  const name = activeApi?.name ?? builtinApi?.name ?? (activeId || t('setting_source_builtin'))
  const statusText = apiStatus.status
    ? t('setting_basic_source_status_success')
    : apiStatus.message === 'initing' ? t('setting_basic_source_status_initing') : t('setting_basic_source_status_failed')
  return (
    <Group title={t('setting_source_current')} icon='script-text-outline'>
      <ValueRow title={name} desc={`${statusText}${activeApi?.author ? ` · ${activeApi.author}` : ''}`} value={activeApi?.version ? formatVersion(activeApi.version) : undefined} />
      {activeId ? <ActionRow title={t('setting_source_reinit')} desc='重新执行音源初始化脚本' action='重新初始化' onPress={() => { setApiSource(activeId) }} /> : null}
      {activeApi?.homepage ? <ActionRow title='音源主页' action='打开' onPress={() => { void openUrl(activeApi.homepage) }} /> : null}
    </Group>
  )
})
