import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { View, TouchableOpacity } from 'react-native'
import Modal, { type ModalType } from '@/components/common/Modal'
import Text from '@/components/common/Text'
import Button from '@/components/common/Button'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { createStyle, toast } from '@/utils/tools'
import { addTasks } from '@/core/download'
import { QUALITYS, QUALITY_LABEL } from '@/core/download/utils'
import { updateSetting } from '@/core/common'
import settingState from '@/store/setting/state'

export interface DownloadQualityInfo {
  musicInfos: LX.Music.MusicInfoOnline[]
  listId?: string | null
  title?: string
}

export interface DownloadQualityModalType {
  show: (info: DownloadQualityInfo) => void
}

const getSupportedQualitys = (): LX.Quality[] => {
  const supported = new Set<LX.Quality>()
  const qualityList = global.lx.qualityList ?? {}
  for (const source of Object.keys(qualityList) as LX.Source[]) {
    for (const quality of qualityList[source] ?? []) supported.add(quality)
  }
  const list = QUALITYS.filter(quality => supported.has(quality))
  return list.length ? list : ['320k', '128k']
}

export default forwardRef<DownloadQualityModalType, {}>((props, ref) => {
  const theme = useTheme()
  const modalRef = useRef<ModalType>(null)
  const [visible, setVisible] = useState(false)
  const [qualitys, setQualitys] = useState<LX.Quality[]>(['320k', '128k'])
  const [quality, setQuality] = useState<LX.Quality>(settingState.setting['download.quality'])
  const infoRef = useRef<DownloadQualityInfo>({ musicInfos: [] })

  useImperativeHandle(ref, () => ({
    show(info) {
      infoRef.current = info
      const list = getSupportedQualitys()
      setQualitys(list)
      const current = settingState.setting['download.quality']
      setQuality(list.includes(current) ? current : list[0])
      if (visible) {
        modalRef.current?.setVisible(true)
      } else {
        setVisible(true)
        requestAnimationFrame(() => {
          modalRef.current?.setVisible(true)
        })
      }
    },
  }))

  const handleConfirm = () => {
    const info = infoRef.current
    const count = addTasks(info.musicInfos, { quality, listId: info.listId })
    modalRef.current?.setVisible(false)
    if (count) {
      updateSetting({ 'download.quality': quality })
      toast(`已添加 ${count} 个下载任务`)
    } else {
      toast('这些歌曲已在下载列表中')
    }
  }

  if (!visible) return null

  return (
    <Modal ref={modalRef} onHide={() => { setVisible(false) }}>
      <View style={styles.mask}>
        <View
          style={{ ...styles.card, backgroundColor: theme['c-content-background'] }}
          onStartShouldSetResponder={() => true}
        >
          <Text size={15} style={styles.title} numberOfLines={1}>
            {infoRef.current.title ?? '选择下载音质'}
          </Text>
          <Text size={12} color={theme['c-500']} style={styles.subTitle} numberOfLines={2}>
            {`共 ${infoRef.current.musicInfos.length} 首歌曲，音质越高文件越大`}
          </Text>
          <View style={styles.qualityList}>
            {
              qualitys.map(item => (
                <TouchableOpacity
                  key={item}
                  style={styles.qualityItem}
                  onPress={() => { setQuality(item) }}
                >
                  <Icon
                    name={quality === item ? 'checkbox-marked' : 'checkbox-blank-outline'}
                    color={quality === item ? theme['c-primary'] : theme['c-400']}
                    size={15}
                  />
                  <Text size={14} style={styles.qualityLabel}>{QUALITY_LABEL[item] ?? item}</Text>
                </TouchableOpacity>
              ))
            }
          </View>
          <View style={styles.footer}>
            <Button style={styles.footerBtn} onPress={() => { modalRef.current?.setVisible(false) }}>
              <Text size={14} color={theme['c-button-font']} style={styles.footerBtnText}>取消</Text>
            </Button>
            <Button style={{ ...styles.footerBtn, backgroundColor: theme['c-primary'] }} onPress={handleConfirm}>
              <Text size={14} color={theme['c-button-font']} style={styles.footerBtnText}>开始下载</Text>
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  )
})

const styles = createStyle({
  mask: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingLeft: 30,
    paddingRight: 30,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 8,
    paddingTop: 18,
    paddingBottom: 12,
    paddingLeft: 18,
    paddingRight: 18,
  },
  title: {
    fontWeight: 'bold',
  },
  subTitle: {
    marginTop: 6,
  },
  qualityList: {
    marginTop: 12,
    marginBottom: 8,
  },
  qualityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 10,
  },
  qualityLabel: {
    marginLeft: 10,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  footerBtn: {
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 8,
    paddingBottom: 8,
    borderRadius: 4,
    marginLeft: 10,
  },
  footerBtnText: {
    textAlign: 'center',
  },
})
