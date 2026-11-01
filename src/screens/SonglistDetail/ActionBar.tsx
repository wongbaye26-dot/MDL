import { memo, useRef } from 'react'
import { View, TouchableOpacity } from 'react-native'

import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { contrastOn } from '@/theme/solid'
import { Icon } from '@/components/common/Icon'
import Text from '@/components/common/Text'
import { handleCollect, handlePlay } from './listAction'
import songlistState from '@/store/songlist/state'
import { useI18n } from '@/lang'
import { useListInfo } from './state'
import DownloadQualityModal, { type DownloadQualityModalType } from '@/components/DownloadQualityModal'

/**
 * 歌单详情的操作条。
 * 和下载中心同一套胶囊：播放全部 = 主色实心，收藏/下载 = 主题色淡底幽灵胶囊，
 * 返回 = 纯文字。之前是四个等分的红字按钮，和全站都不搭。
 */
export default memo(() => {
  const theme = useTheme()
  const t = useI18n()
  const info = useListInfo()
  const downloadModalRef = useRef<DownloadQualityModalType>(null)
  const onPrimary = contrastOn(theme['c-primary'])

  const handlePlayAll = () => {
    if (!songlistState.listDetailInfo.info.name) return
    void handlePlay(info.id, info.source, songlistState.listDetailInfo.list)
  }

  const handleDownloadAll = () => {
    const musicInfos = songlistState.listDetailInfo.list
      .filter((musicInfo): musicInfo is LX.Music.MusicInfoOnline => musicInfo.source !== 'local')
    if (!musicInfos.length) return
    downloadModalRef.current?.show({ musicInfos, title: '下载歌单全部歌曲' })
  }

  const handleCollection = () => {
    if (!songlistState.listDetailInfo.info.name) return
    void handleCollect(info.id, info.source, songlistState.listDetailInfo.info.name || info.name)
  }

  const ghost = {
    ...styles.pill,
    backgroundColor: theme['c-primary-alpha-900'],
    borderWidth: 0.5,
    borderColor: theme['c-primary-alpha-700'],
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={handlePlayAll}
        style={{ ...styles.pill, backgroundColor: theme['c-primary'] }}
      >
        <Icon name='play' size={13} color={onPrimary} />
        <Text size={12} color={onPrimary} style={styles.pillText}>{t('play_all')}</Text>
      </TouchableOpacity>

      <TouchableOpacity activeOpacity={0.8} onPress={handleCollection} style={ghost}>
        <Icon name='heart-outline' size={14} color={theme['c-primary']} />
        <Text size={12} color={theme['c-primary']} style={styles.pillText}>{t('collect_songlist')}</Text>
      </TouchableOpacity>

      <TouchableOpacity activeOpacity={0.8} onPress={handleDownloadAll} style={ghost}>
        <Icon name='download-2' size={14} color={theme['c-primary']} />
        <Text size={12} color={theme['c-primary']} style={styles.pillText}>{t('download_all')}</Text>
      </TouchableOpacity>

      <DownloadQualityModal ref={downloadModalRef} />
    </View>
  )
})

const styles = createStyle({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    flexGrow: 0,
    flexShrink: 0,
    paddingLeft: 16,
    paddingRight: 16,
    paddingBottom: 12,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 32,
    paddingLeft: 12,
    paddingRight: 13,
    borderRadius: 16,
    marginRight: 8,
  },
  pillText: {
    marginLeft: 5,
    fontWeight: '600',
  },
  textBtn: {
    height: 32,
    justifyContent: 'center',
    paddingLeft: 4,
    paddingRight: 4,
  },
})
