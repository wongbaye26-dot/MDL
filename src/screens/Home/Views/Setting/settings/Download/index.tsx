import { memo, useMemo, useRef } from 'react'
import { View } from 'react-native'

import Section from '../../components/Section'
import SubTitle from '../../components/SubTitle'
import CheckBoxItem from '../../components/CheckBoxItem'
import Button from '../../components/Button'
import Chip from '@/components/common/Chip'
import Text from '@/components/common/Text'
import FileSelect, { type FileSelectType } from '@/components/common/FileSelect'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { createStyle } from '@/utils/tools'
import { updateSetting } from '@/core/common'
import { useSettingValue } from '@/store/setting/hook'
import { QUALITYS, QUALITY_LABEL, getDefaultSavePath } from '@/core/download/utils'
import { clearSavePathCache } from '@/core/download'

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

  const handleSelectPath = () => {
    fileSelectRef.current?.show({
      title: t('setting_download_save_path'),
      dirOnly: true,
      isPersist: true,
    }, (path) => {
      updateSetting({ 'download.savePath': path })
      clearSavePathCache()
    })
  }

  const handleResetPath = () => {
    updateSetting({ 'download.savePath': '' })
    clearSavePathCache()
  }

  return (
    <>
      <Section title='保存位置'>
        <View style={styles.pathRow}>
          <Text size={14}>{t('setting_download_save_path')}</Text>
          <Text size={11} color={theme['c-450']} numberOfLines={2} style={styles.pathText}>
            {savePath || `${t('setting_download_save_path_default')}: ${getDefaultSavePath()}`}
          </Text>
          <View style={styles.btnRow}>
            <Button onPress={handleSelectPath}>选择目录</Button>
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

      <Section title='下载'>
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

      <Section title='附加文件'>
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

      <Section title='边听边存'>
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
  pathRow: {
    paddingLeft: 14,
    paddingRight: 14,
    paddingTop: 12,
    paddingBottom: 12,
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
