import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { View, TouchableOpacity } from 'react-native'
import Modal, { type ModalType } from '@/components/common/Modal'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { createStyle, toast } from '@/utils/tools'
import { addTasks } from '@/core/download'
import { QUALITYS, QUALITY_LABEL, QUALITY_DESC } from '@/core/download/utils'
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

/** 音质档位的补充说明，让用户能判断文件大小 */
const QUALITY_HINT: Partial<Record<LX.Quality, string>> = {
  flac24bit: '24bit 母带级',
  flac: '无损压缩',
  wav: '未压缩',
  ape: '无损压缩',
  '320k': '高品质',
  '192k': '标准',
  '128k': '省流量',
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

  const count = infoRef.current.musicInfos.length

  return (
    <Modal ref={modalRef} onHide={() => { setVisible(false) }} animationType='slide'>
      <TouchableOpacity
        style={styles.mask}
        activeOpacity={1}
        onPress={() => { modalRef.current?.setVisible(false) }}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={{ ...styles.sheet, backgroundColor: getSheetColor(theme) }}
          onPress={() => {}}
        >
          <View style={styles.handleWrap} pointerEvents='none'>
            <View style={{ ...styles.handle, backgroundColor: theme['c-primary-alpha-600'] }} />
          </View>

          <View style={styles.head}>
            <Text size={18} style={styles.title} numberOfLines={1}>
              {infoRef.current.title ?? '选择下载音质'}
            </Text>
            <Text size={12} color={theme['c-450']} style={styles.subTitle} numberOfLines={2}>
              {`共 ${count} 首歌曲 · 音质越高文件越大`}
            </Text>
          </View>

          <View style={styles.qualityList}>
            {
              qualitys.map(item => {
                const active = quality === item
                return (
                  <TouchableOpacity
                    key={item}
                    activeOpacity={0.8}
                    style={{
                      ...styles.qualityItem,
                      backgroundColor: active ? theme['c-primary-alpha-900'] : 'transparent',
                      borderColor: active ? theme['c-primary-alpha-500'] : theme['c-primary-alpha-800'],
                    }}
                    onPress={() => { setQuality(item) }}
                  >
                    <View style={{
                      ...styles.radio,
                      borderColor: active ? theme['c-primary'] : theme['c-350'],
                    }}>
                      {active ? <View style={{ ...styles.radioDot, backgroundColor: theme['c-primary'] }} /> : null}
                    </View>
                    <View style={styles.qualityInfo}>
                      <Text size={15} numberOfLines={1} style={styles.qualityLabel}>
                        {QUALITY_LABEL[item] ?? item}
                      </Text>
                      <Text size={11} color={theme['c-450']} numberOfLines={1} style={styles.qualityHint}>
                        {QUALITY_HINT[item] ?? QUALITY_DESC[item] ?? ''}
                      </Text>
                    </View>
                    {
                      active
                        ? <Icon name='check' size={16} color={theme['c-primary']} />
                        : null
                    }
                  </TouchableOpacity>
                )
              })
            }
          </View>

          <TouchableOpacity
            activeOpacity={0.85}
            style={{ ...styles.primaryBtn, backgroundColor: theme['c-primary'] }}
            onPress={handleConfirm}
          >
            <Icon name='download-2' size={17} color='#FFFFFF' />
            <Text size={15} color='#FFFFFF' style={styles.primaryBtnText}>
              {`开始下载${count > 1 ? `（${count} 首）` : ''}`}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.cancelBtn}
            onPress={() => { modalRef.current?.setVisible(false) }}
          >
            <Text size={13} color={theme['c-450']}>取消</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  )
})

/** 弹层底色：主背景可能是半透明的（主题带背景图），这里压成实色 */
const getSheetColor = (theme: LX.ActiveTheme) => theme['c-content-background']

const styles = createStyle({
  mask: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingLeft: 18,
    paddingRight: 18,
    paddingBottom: 22,
  },
  handleWrap: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 6,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  head: {
    paddingTop: 6,
    paddingBottom: 14,
  },
  title: {
    fontWeight: '700',
  },
  subTitle: {
    marginTop: 5,
  },
  qualityList: {
    marginBottom: 16,
  },
  qualityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 14,
    paddingRight: 14,
    paddingTop: 12,
    paddingBottom: 12,
    borderRadius: 14,
    borderWidth: 0.5,
    marginBottom: 8,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  radioDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  qualityInfo: {
    flexGrow: 1,
    flexShrink: 1,
  },
  qualityLabel: {
    fontWeight: '600',
  },
  qualityHint: {
    marginTop: 3,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 24,
  },
  primaryBtnText: {
    marginLeft: 7,
    fontWeight: '700',
  },
  cancelBtn: {
    alignItems: 'center',
    paddingTop: 14,
  },
})
