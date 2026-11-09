import { useCallback, useEffect, useMemo, useState } from 'react'
import { AppState, Linking, TouchableOpacity, View } from 'react-native'
import { Group, ToggleRow, ChoiceRow, ActionRow } from '../../components/ui'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { useSettingValue } from '@/store/setting/hook'
import { useI18n } from '@/lang'
import { createStyle, toast } from '@/utils/tools'
import { updateSetting } from '@/core/common'
import { QUALITYS, QUALITY_LABEL, getDefaultSavePath, getFallbackSavePath, isSafPath } from '@/core/download/utils'
import { clearSavePathCache, ensureDir, migrateFallbackDownloads } from '@/core/download'
import { pickDirectory, canWriteTree, treeUriToDisplayPath } from '@/utils/directoryPicker'
import { isExternalStorageManager, openAllFilesAccessSettings } from '@/utils/nativeModules/utils'
import { useQualityList } from '../Source/state'
import { Radius, Space, Type } from '@/theme/designTokens'

/** 下载管理（IA 第 6 组）；所有文件访问权限只在设置里出现一次 */
export default () => {
  const t = useI18n()
  const theme = useTheme()
  const savePath = useSettingValue('download.savePath')
  const qualityList = useQualityList()
  const [allFilesAccess, setAllFilesAccess] = useState(false)

  const checkAllFilesAccess = useCallback(async() => {
    const granted = await isExternalStorageManager()
    setAllFilesAccess(granted)
    if (!granted) return
    const moved = await migrateFallbackDownloads()
    if (moved > 0) { clearSavePathCache(); toast(`已把 ${moved} 个文件迁回默认音乐目录`) }
  }, [])

  useEffect(() => {
    void checkAllFilesAccess()
    const sub = AppState.addEventListener('change', state => { if (state === 'active') void checkAllFilesAccess() })
    return () => { sub.remove() }
  }, [checkAllFilesAccess])

  const qualityOptions = useMemo(() => {
    const supported = new Set<LX.Quality>()
    for (const source of Object.keys(qualityList) as LX.Source[]) {
      for (const item of qualityList[source] ?? []) supported.add(item)
    }
    const list = QUALITYS.filter(item => supported.has(item))
    return (list.length ? list : (['320k', '128k'] as LX.Quality[])).map(item => ({ value: item, label: QUALITY_LABEL[item] ?? item }))
  }, [qualityList])

  const selectPath = async() => {
    try {
      const picked = await pickDirectory()
      if (!picked) return
      if (await ensureDir(picked.path).catch(() => false)) {
        updateSetting({ 'download.savePath': picked.path }); clearSavePathCache(); toast(`保存目录已改为 ${picked.path}`); return
      }
      if (picked.treeUri && await canWriteTree(picked.treeUri)) {
        updateSetting({ 'download.savePath': picked.treeUri }); clearSavePathCache(); toast(`保存目录已改为 ${picked.path}`); return
      }
      toast(`这个目录系统不允许写入：\n${picked.path}`)
    } catch (e) { toast((e as Error)?.message ?? '选择目录失败') }
  }

  const useAppDir = async(kind: 'external' | 'private') => {
    const path = kind === 'external' ? getFallbackSavePath() : getDefaultSavePath()
    if (!await ensureDir(path).catch(() => false)) { toast('这个目录不可用，换另一个试试'); return }
    updateSetting({ 'download.savePath': path }); clearSavePathCache(); toast(`保存目录已改为 ${path}`)
  }

  const pathLabel = savePath
    ? (isSafPath(savePath) ? `${treeUriToDisplayPath(savePath)}（授权目录）` : savePath)
    : `${t('setting_download_save_path_default')}: ${getDefaultSavePath()}`

  return (
    <View>
      <Group title='下载管理'>
        <View style={styles.pathBlock}>
          <Text size={Type.rowTitle.fontSize} style={styles.pathTitle}>{t('setting_download_save_path')}</Text>
          <Text size={Type.rowDesc.fontSize} color={theme['c-450']} style={styles.pathDesc}>{pathLabel}</Text>
          <View style={styles.pathActions}>
            <TouchableOpacity style={[styles.pathBtn, { backgroundColor: theme['c-primary-alpha-900'] }]} onPress={() => { void selectPath() }}>
              <Text size={Type.button.fontSize} color={theme['c-primary']}>选择目录</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.pathBtn, { backgroundColor: theme['c-primary-alpha-900'] }]} onPress={() => { void useAppDir('external') }}>
              <Text size={Type.button.fontSize} color={theme['c-primary']}>应用专属目录</Text>
            </TouchableOpacity>
            {savePath ? (
              <TouchableOpacity style={[styles.pathBtn, { backgroundColor: theme['c-primary-alpha-900'] }]} onPress={() => { updateSetting({ 'download.savePath': '' }); clearSavePathCache() }}>
                <Text size={Type.button.fontSize} color={theme['c-450']}>恢复默认</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
        <ChoiceRow settingKey='download.fileName' title='文件名格式' options={[
          { value: '歌名 - 歌手', label: '歌名 - 歌手' },
          { value: '歌手 - 歌名', label: '歌手 - 歌名' },
          { value: '歌名', label: '歌名' },
        ]} />
        <ChoiceRow settingKey='download.quality' title='下载音质' options={qualityOptions} />
        <ChoiceRow settingKey='download.maxDownloadNum' title='同时下载数量' options={[1, 2, 3, 5].map(value => ({ value, label: `${value} 个` }))} />
        <ToggleRow settingKey='download.isUseOtherSource' title='使用其他音源' desc='当前音源没有该歌曲时自动换源' />
        <ToggleRow settingKey='download.autoSaveWhilePlaying' title='播放时自动保存' desc='边听边存' />
        <ToggleRow settingKey='download.isDownloadLyric' title='下载歌词' />
        <ToggleRow settingKey='download.isDownloadPic' title='下载封面' />
        <ToggleRow settingKey='download.isWriteMetadata' title='写入元数据' />
        <ActionRow
          title='所有文件访问权限'
          desc={allFilesAccess ? '已开启，可直接写入公共音乐目录' : '未开启时文件会落到应用私有目录'}
          action={allFilesAccess ? '已开启' : '去开启'}
          onPress={() => { void openAllFilesAccessSettings().then(ok => { if (!ok) void Linking.openSettings() }) }}
        />
      </Group>
    </View>
  )
}

const styles = createStyle({
  pathBlock: {
    paddingLeft: Space.lg,
    paddingRight: Space.lg,
    paddingTop: Space.md,
    paddingBottom: Space.md,
  },
  pathTitle: {
    ...Type.rowTitle,
  },
  pathDesc: {
    ...Type.rowDesc,
    marginTop: 2,
    lineHeight: 16,
  },
  pathActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Space.sm,
    marginTop: Space.sm,
  },
  pathBtn: {
    minHeight: 32,
    paddingLeft: Space.md,
    paddingRight: Space.md,
    borderRadius: Radius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
})
