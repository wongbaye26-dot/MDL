import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AppState, Linking, TouchableOpacity, View } from 'react-native'

import Section from '../../components/Section'
import SubTitle from '../../components/SubTitle'
import CheckBoxItem from '../../components/CheckBoxItem'
import Button from '../../components/Button'
import Chip from '@/components/common/Chip'
import Text from '@/components/common/Text'
import FileSelect, { type FileSelectType } from '@/components/common/FileSelect'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { createStyle, toast } from '@/utils/tools'
import { updateSetting } from '@/core/common'
import { useSettingValue } from '@/store/setting/hook'
import { QUALITYS, QUALITY_LABEL, getDefaultSavePath, getFallbackSavePath, isSafPath } from '@/core/download/utils'
import { clearSavePathCache, ensureDir, migrateFallbackDownloads } from '@/core/download'
import { pickDirectory, canWriteTree, treeUriToDisplayPath } from '@/utils/directoryPicker'
import { isExternalStorageManager, openAllFilesAccessSettings } from '@/utils/nativeModules/utils'

const OptionRow = ({ label, options, value, onChange }: {
  label: string
  options: Array<{ value: string, label: string }>
  value: string
  onChange: (value: string) => void
}) => {
  return (
    <SubTitle title={label}>
      <View style={styles.optionList}>
        {
          options.map(option => (
            <View key={option.value} style={styles.chipWrap}>
              <Chip
                soft
                label={option.label}
                active={option.value === value}
                onPress={() => { onChange(option.value) }}
              />
            </View>
          ))
        }
      </View>
    </SubTitle>
  )
}

export default memo(() => {
  const t = useI18n()
  const theme = useTheme()
  const fileSelectRef = useRef<FileSelectType>(null)
  const savePath = useSettingValue('download.savePath')
  const quality = useSettingValue('download.quality')
  const fileName = useSettingValue('download.fileName')
  const maxDownloadNum = useSettingValue('download.maxDownloadNum')
  const isUseOtherSource = useSettingValue('download.isUseOtherSource')
  const isDownloadLyric = useSettingValue('download.isDownloadLyric')
  const isDownloadPic = useSettingValue('download.isDownloadPic')

  const [allFilesAccess, setAllFilesAccess] = useState(false)

  /** 检查「所有文件访问权限」，已授权时把私有目录里的旧下载迁回默认目录 */
  const checkAllFilesAccess = useCallback(async() => {
    const granted = await isExternalStorageManager()
    setAllFilesAccess(granted)
    if (!granted) return
    const moved = await migrateFallbackDownloads()
    if (moved > 0) {
      clearSavePathCache()
      toast(`已把 ${moved} 个文件迁回默认音乐目录`)
    }
  }, [])

  useEffect(() => {
    void checkAllFilesAccess()
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') void checkAllFilesAccess()
    })
    return () => { sub.remove() }
  }, [checkAllFilesAccess])

  /** 跳系统设置授予「所有文件访问权限」，授了才能直接写公共音乐目录 */
  const openAllFilesAccess = async() => {
    const ok = await openAllFilesAccessSettings()
    if (!ok) {
      try {
        await Linking.sendIntent('android.settings.MANAGE_APP_ALL_FILES_ACCESS_PERMISSION', [
          { key: 'package', value: 'cn.emomusic.mobile' },
        ])
      } catch { void Linking.openSettings() }
    }
  }
  const isWriteMetadata = useSettingValue('download.isWriteMetadata')
  const autoSaveWhilePlaying = useSettingValue('download.autoSaveWhilePlaying')

  const qualityOptions = useMemo(() => {
    const supported = new Set<LX.Quality>()
    const qualityList = global.lx.qualityList ?? {}
    for (const source of Object.keys(qualityList) as LX.Source[]) {
      for (const item of qualityList[source] ?? []) supported.add(item)
    }
    const list = QUALITYS.filter(item => supported.has(item))
    return (list.length ? list : (['320k', '128k'] as LX.Quality[])).map(item => ({ value: item, label: QUALITY_LABEL[item] ?? item }))
  }, [])

  const handleSelectPath = async() => {
    try {
      const picked = await pickDirectory()
      if (!picked) return
      // 公共目录在 Android 11+ 一律不可写，先探一下能不能真写进去
      if (await ensureDir(picked.path).catch(() => false)) {
        updateSetting({ 'download.savePath': picked.path })
        clearSavePathCache()
        toast(`保存目录已改为 ${picked.path}`)
        return
      }
      // 直接写不进去 → 用 SAF 授权（content:// 目录树），下载完由原生复制进去
      if (picked.treeUri && await canWriteTree(picked.treeUri)) {
        updateSetting({ 'download.savePath': picked.treeUri })
        clearSavePathCache()
        toast(`保存目录已改为 ${picked.path}\n（通过授权目录写入）`)
        return
      }
      toast(`这个目录系统不允许写入：\n${picked.path}\n\n可以选「应用专属目录」，或选音乐目录下新建的子文件夹`)
    } catch (e) {
      toast((e as Error)?.message ?? '选择目录失败')
    }
  }

  /** 切到两个「应用可写」的目录（公共目录在 Android 11+ 写不进去） */
  const handleUseAppDir = async(kind: 'external' | 'private') => {
    const path: string = kind === 'external' ? getFallbackSavePath() : getDefaultSavePath()
    const ok = await ensureDir(path).catch(() => false)
    if (!ok) {
      toast('这个目录不可用，换另一个试试')
      return
    }
    updateSetting({ 'download.savePath': path })
    clearSavePathCache()
    toast(`保存目录已改为 ${path}`)
  }

  const handleResetPath = () => {
    updateSetting({ 'download.savePath': '' })
    clearSavePathCache()
  }

  return (
    <>
      <Section title='保存位置' icon='folder-outline'>
        <View style={styles.pathRow}>
          <Text size={14}>{t('setting_download_save_path')}</Text>
          <Text size={11} color={theme['c-450']} numberOfLines={2} style={styles.pathText}>
            {savePath
              ? (isSafPath(savePath) ? `${treeUriToDisplayPath(savePath)}（授权目录）` : savePath)
              : `${t('setting_download_save_path_default')}: ${getDefaultSavePath()}`}
          </Text>
          {!allFilesAccess && !savePath
            ? (
              <Text size={10} color={theme['c-450']} style={styles.pathWarn}>
                未授予「所有文件访问权限」时，下载会落到 Android/data 私有目录，文件管理器里找不到
              </Text>
              )
            : null}
          <View style={styles.btnRow}>
            <Button onPress={handleSelectPath}>选择目录</Button>
            <Button onPress={() => { void handleUseAppDir('external') }}>应用专属目录</Button>
            {savePath ? <Button onPress={handleResetPath}>恢复默认</Button> : null}
          </View>
        </View>
        <OptionRow
          label={t('setting_download_file_name')}
          options={[
            { value: '歌名 - 歌手', label: '歌名 - 歌手' },
            { value: '歌手 - 歌名', label: '歌手 - 歌名' },
            { value: '歌名', label: '歌名' },
          ]}
          value={fileName}
          onChange={value => { updateSetting({ 'download.fileName': value as LX.AppSetting['download.fileName'] }) }}
        />
      </Section>

      <Section title='下载' icon='download'>
        <OptionRow
          label={t('setting_download_quality')}
          options={qualityOptions}
          value={quality}
          onChange={value => { updateSetting({ 'download.quality': value as LX.Quality }) }}
        />
        <OptionRow
          label={t('setting_download_max_num')}
          options={[1, 2, 3, 5].map(num => ({ value: String(num), label: `${num} 个` }))}
          value={String(maxDownloadNum)}
          onChange={value => { updateSetting({ 'download.maxDownloadNum': Number(value) }) }}
        />
        <CheckBoxItem
          check={isUseOtherSource}
          label={t('setting_download_use_other_source')}
          onChange={check => { updateSetting({ 'download.isUseOtherSource': check }) }}
        />
      </Section>

      <Section title='存储权限' icon='shield-key-outline'>
        <TouchableOpacity style={styles.permRow} activeOpacity={0.7} onPress={openAllFilesAccess}>
          <View style={styles.permInfo}>
            <Text size={14}>所有文件访问权限</Text>
            <Text size={10} color={theme['c-450']} style={styles.permDesc}>
              {allFilesAccess
                ? '已授权，下载会直接保存到公共音乐目录，其他播放器可扫描'
                : '没有它，歌曲只能存到 Android/data 私有目录，文件管理器里找不到'}
            </Text>
          </View>
          <Text size={12} color={theme['c-primary']}>{allFilesAccess ? '已授权' : '去授权'}</Text>
        </TouchableOpacity>
      </Section>

      <Section title='附加文件' icon='file-music-outline'>
        <CheckBoxItem
          check={isDownloadLyric}
          label={t('setting_download_lyric')}
          onChange={check => { updateSetting({ 'download.isDownloadLyric': check }) }}
        />
        <CheckBoxItem
          check={isDownloadPic}
          label={t('setting_download_pic')}
          onChange={check => { updateSetting({ 'download.isDownloadPic': check }) }}
        />
        <CheckBoxItem
          check={isWriteMetadata}
          label={t('setting_download_metadata')}
          onChange={check => { updateSetting({ 'download.isWriteMetadata': check }) }}
        />
      </Section>

      <Section title='边听边存' icon='playlist-plus'>
        <CheckBoxItem
          check={autoSaveWhilePlaying}
          label='播放时自动保存'
          onChange={check => { updateSetting({ 'download.autoSaveWhilePlaying': check }) }}
        >
          <Text size={11} color={theme['c-450']} style={styles.tipText}>
            播放的歌曲会自动加入下载队列并保存到下载目录，音质取上面的「下载音质」，已保存过的不会重复下载。
          </Text>
        </CheckBoxItem>
      </Section>

      <Text size={11} color={theme['c-400']} style={styles.tip}>{t('setting_download_tip')}</Text>
      <FileSelect ref={fileSelectRef} />
    </>
  )
})

const styles = createStyle({
  permRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 14,
    paddingRight: 14,
    paddingTop: 12,
    paddingBottom: 12,
  },
  permInfo: {
    flexGrow: 1,
    flexShrink: 1,
    marginRight: 12,
  },
  permDesc: {
    marginTop: 3,
    lineHeight: 15,
  },
  pathRow: {
    paddingLeft: 14,
    paddingRight: 14,
    paddingTop: 12,
    paddingBottom: 12,
  },
  pathWarn: {
    marginTop: 4,
    lineHeight: 15,
  },
  pathText: {
    marginTop: 6,
  },
  btnRow: {
    flexDirection: 'row',
    marginTop: 10,
  },
  optionList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chipWrap: {
    marginBottom: 8,
  },
  tipText: {
    lineHeight: 16,
  },
  tip: {
    paddingLeft: 4,
    paddingRight: 4,
    lineHeight: 16,
    marginBottom: 20,
  },
})
