import { memo, useMemo, useRef } from 'react'
import { View, TouchableOpacity } from 'react-native'
import Section from '../../components/Section'
import CheckBoxItem from '../../components/CheckBoxItem'
import Text from '@/components/common/Text'
import Button from '@/components/common/Button'
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
  const theme = useTheme()

  return (
    <View style={styles.optionRow}>
      <Text size={13} style={styles.optionLabel}>{label}</Text>
      <View style={styles.optionList}>
        {
          options.map(option => (
            <TouchableOpacity
              key={option.value}
              style={{
                ...styles.optionBtn,
                backgroundColor: option.value === value ? theme['c-primary'] : theme['c-primary-alpha-100'],
              }}
              onPress={() => { onChange(option.value) }}
            >
              <Text size={12} color={option.value === value ? theme['c-button-font'] : theme['c-font']}>{option.label}</Text>
            </TouchableOpacity>
          ))
        }
      </View>
    </View>
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
    <Section title={t('setting_download')}>
      <View style={styles.item}>
        <Text size={13}>{t('setting_download_save_path')}</Text>
        <Text size={11} color={theme['c-450']} numberOfLines={2} style={styles.pathText}>
          {savePath || `${t('setting_download_save_path_default')}: ${getDefaultSavePath()}`}
        </Text>
        <View style={styles.btnRow}>
          <Button style={styles.smallBtn} onPress={handleSelectPath}>
            <Text size={12} color={theme['c-button-font']}>选择目录</Text>
          </Button>
          {savePath ? (
            <Button style={{ ...styles.smallBtn, backgroundColor: theme['c-primary-alpha-200'] }} onPress={handleResetPath}>
              <Text size={12} color={theme['c-font']}>恢复默认</Text>
            </Button>
          ) : null}
        </View>
      </View>
      <OptionRow
        label={t('setting_download_quality')}
        options={qualityOptions}
        value={quality}
        onChange={value => { updateSetting({ 'download.quality': value as LX.Quality }) }}
      />
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
      <OptionRow
        label={t('setting_download_max_num')}
        options={[1, 2, 3, 5].map(num => ({ value: String(num), label: String(num) }))}
        value={String(maxDownloadNum)}
        onChange={value => { updateSetting({ 'download.maxDownloadNum': Number(value) }) }}
      />
      <CheckBoxItem
        check={isUseOtherSource}
        label={t('setting_download_use_other_source')}
        onChange={check => { updateSetting({ 'download.isUseOtherSource': check }) }}
      />
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
      <Text size={11} color={theme['c-400']} style={styles.tip}>{t('setting_download_tip')}</Text>
      <FileSelect ref={fileSelectRef} />
    </Section>
  )
})

const styles = createStyle({
  item: {
    paddingLeft: 25,
    marginTop: 5,
    marginBottom: 10,
  },
  pathText: {
    marginTop: 4,
    marginRight: 15,
  },
  btnRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  smallBtn: {
    paddingLeft: 12,
    paddingRight: 12,
    paddingTop: 6,
    paddingBottom: 6,
    borderRadius: 4,
    marginRight: 10,
  },
  optionRow: {
    paddingLeft: 25,
    marginTop: 5,
    marginBottom: 10,
    marginRight: 15,
  },
  optionLabel: {
    marginBottom: 6,
  },
  optionList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  optionBtn: {
    paddingLeft: 10,
    paddingRight: 10,
    paddingTop: 5,
    paddingBottom: 5,
    borderRadius: 4,
    marginRight: 8,
    marginBottom: 6,
  },
  tip: {
    paddingLeft: 25,
    paddingRight: 15,
    marginTop: 5,
    lineHeight: 16,
  },
})
