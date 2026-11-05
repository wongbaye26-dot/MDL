import { memo, useState, useEffect } from 'react'
import { View } from 'react-native'

import SettingRow from '../../components/SettingRow'
import Button from '../../components/Button'
import { toast, resetNotificationPermissionCheck, confirmDialog, resetIgnoringBatteryOptimizationCheck, createStyle } from '@/utils/tools'
import { getAppCacheSize, clearAppCache } from '@/utils/nativeModules/cache'
import { getCacheSize, clearCache } from '@/plugins/player/utils'
import { sizeFormate } from '@/utils'
import { useI18n } from '@/lang'
import { clearMusicUrl } from '@/utils/data'

/**
 * 资源缓存：统一成设置页通用行（左图标 + 标题/描述 + 右侧清理按钮），
 * 不再是「裸文字 + 按钮」的写法。
 */
export default memo(() => {
  const t = useI18n()
  const [cleaning, setCleaning] = useState(false)
  const [cacheSize, setCacheSize] = useState<string | null>(null)

  const handleGetAppCacheSize = () => {
    void Promise.all([getAppCacheSize(), getCacheSize()]).then(([size, size2]) => {
      const count = size + size2
      setCacheSize(sizeFormate(count))
    })
  }

  const handleCleanCache = () => {
    if (cacheSize == null) return
    void confirmDialog({
      message: t('confirm_tip'),
      confirmButtonText: t('list_remove_tip_button'),
      danger: true,
    }).then(confirm => {
      if (!confirm) return
      setCleaning(true)
      void Promise.all([
        clearAppCache(),
        clearCache(),
        clearMusicUrl(),
        resetNotificationPermissionCheck(),
        resetIgnoringBatteryOptimizationCheck(),
      ]).then(() => {
        toast(t('setting_other_cache_clear_success_tip'))
      }).finally(() => {
        handleGetAppCacheSize()
        setCleaning(false)
      })
    })
  }

  useEffect(() => {
    handleGetAppCacheSize()
  }, [])

  return (
    <SettingRow
      icon='broom'
      title='资源缓存'
      desc={cacheSize == null ? t('setting_other_cache_getting') : `${t('setting_other_cache_size')}${cacheSize}`}
      right={<View style={styles.rightBtn}><Button disabled={cleaning} onPress={handleCleanCache}>{t('setting_other_cache_clear_btn')}</Button></View>}
    />
  )
})

const styles = createStyle({
  rightBtn: {
    // 抵消设置页 Button 自带的 marginRight，右侧留白和普通行一致
    marginRight: -10,
  },
})
