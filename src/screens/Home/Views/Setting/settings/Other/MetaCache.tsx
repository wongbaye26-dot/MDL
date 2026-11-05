import { memo, useState, useEffect } from 'react'
import { View } from 'react-native'

import SettingRow from '../../components/SettingRow'
import Button from '../../components/Button'
import { toast, createStyle } from '@/utils/tools'
import { useI18n } from '@/lang'
import { clearLyric, clearOtherSource, getMetaCache } from '@/utils/data'

/**
 * 歌曲信息缓存：和资源缓存同一套行语言，清理按钮放到标题下方一行。
 */
export default memo(() => {
  const t = useI18n()
  const [otherSourceCleaning, setOtherSourceCleaning] = useState(false)
  const [lyricCleaning, setLyricCleaning] = useState(false)
  const [cacheInfo, setCacheInfo] = useState<{
    otherSourceKeys: null | string[]
    lyricKeys: null | string[]
  }>({ otherSourceKeys: null, lyricKeys: null })

  const handleGetMetaCache = () => {
    void getMetaCache().then((info) => {
      setCacheInfo(info)
    })
  }

  const handleCleanOtherSourceCache = () => {
    if (!cacheInfo.otherSourceKeys?.length) return
    setOtherSourceCleaning(true)
    void clearOtherSource(cacheInfo.otherSourceKeys).then(() => {
      toast(t('setting_other_cache_clear_success_tip'))
    }).finally(() => {
      handleGetMetaCache()
      setOtherSourceCleaning(false)
    })
  }

  const handleCleanLyricKeysCache = () => {
    if (!cacheInfo.lyricKeys?.length) return
    setLyricCleaning(true)
    void clearLyric(cacheInfo.lyricKeys).then(() => {
      toast(t('setting_other_cache_clear_success_tip'))
    }).finally(() => {
      handleGetMetaCache()
      setLyricCleaning(false)
    })
  }

  useEffect(() => {
    handleGetMetaCache()
  }, [])

  const otherSourceNum = cacheInfo.otherSourceKeys == null ? t('setting_other_cache_getting') : String(cacheInfo.otherSourceKeys.length)
  const lyricNum = cacheInfo.lyricKeys == null ? t('setting_other_cache_getting') : String(cacheInfo.lyricKeys.length)

  return (
    <SettingRow
      icon='database-outline'
      title='歌曲信息缓存'
      desc={`${t('setting__other_other_source_label')}${otherSourceNum} · ${t('setting__other_lyric_raw_label')}${lyricNum}`}
    >
      <View style={styles.btns}>
        <Button disabled={otherSourceCleaning} onPress={handleCleanOtherSourceCache}>{t('setting__other_other_source_clear_btn')}</Button>
        <Button disabled={lyricCleaning} onPress={handleCleanLyricKeysCache}>{t('setting__other_lyric_raw_clear_btn')}</Button>
      </View>
    </SettingRow>
  )
})

const styles = createStyle({
  btns: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
    marginLeft: -10,
  },
})
