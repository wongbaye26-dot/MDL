import { forwardRef, memo, useEffect, useImperativeHandle, useState } from 'react'
import { View } from 'react-native'
import ButtonBar from './ActionBar'
import { useNavigationComponentDidAppear } from '@/navigation'
import { NAV_SHEAR_NATIVE_IDS } from '@/config/constant'
import { scaleSizeW } from '@/utils/pixelRatio'
import { useTheme } from '@/store/theme/hook'
import { useSettingValue } from '@/store/setting/hook'
import LiquidGlass from '@/components/common/LiquidGlass'
import Text, { AnimatedText } from '@/components/common/Text'
import { createStyle } from '@/utils/tools'
import Image from '@/components/common/Image'
import { useListInfo } from './state'
import { useAnimateOnecNumber } from '@/utils/hooks/useAnimateNumber'

/** 概览卡封面尺寸：和本地音乐/下载中心的卡片封面比例接近，但这里是歌单主视觉，给大一档 */
const IMAGE_WIDTH = scaleSizeW(92)

const CountText = memo(({ count }: { count: string }) => {
  const [animFade] = useAnimateOnecNumber(0, 1, 250, false)
  const [animTranslateY] = useAnimateOnecNumber(10, 0, 250, false)
  return (
    <AnimatedText style={{
      ...styles.playCount,
      opacity: animFade,
      transform: [
        { translateY: animTranslateY },
      ],
    }} numberOfLines={ 1 }>{count}</AnimatedText>
  )
}, (prevProps, nextProps) => {
  return true
})

const Pic = ({ componentId, playCount, imgUrl }: {
  componentId: string
  playCount: string
  imgUrl?: string
}) => {
  const [pic, setPic] = useState(imgUrl)
  const [animated, setAnimated] = useState(false)
  const info = useListInfo()
  useEffect(() => {
    if (animated) setPic(imgUrl)
  }, [imgUrl, animated])

  useNavigationComponentDidAppear(componentId, () => {
    setAnimated(true)
  })

  return (
    <View style={{ ...styles.coverWrap, width: IMAGE_WIDTH, height: IMAGE_WIDTH }}>
      <Image nativeID={`${NAV_SHEAR_NATIVE_IDS.songlistDetail_pic}_to_${info.id}`} url={pic} style={styles.cover} />
      {
        playCount && animated ? <CountText count={playCount} /> : null
      }
    </View>
  )
}

export interface HeaderProps {
  componentId: string
}

export interface HeaderType {
  setInfo: (info: DetailInfo) => void
}
export interface DetailInfo {
  name: string
  desc: string
  playCount: string
  imgUrl?: string
}

/**
 * 歌单详情顶部概览卡（列表的 ListHeaderComponent，跟着列表一起滚动）。
 *
 * 和本地音乐 / 下载中心同一套圆角卡片语言：封面 + 标题 + 作者/简介 +
 * 「播放全部 / 收藏歌单 / 下载全部」胶囊按钮，整张卡用主色淡底 + 细描边。
 * 页头的返回键/标题是固定的一行，在 index.tsx 里用 PageHeader 渲染。
 */
export default forwardRef<HeaderType, HeaderProps>(({ componentId }: { componentId: string }, ref) => {
  const glassStyle = useSettingValue('common.navGlassStyle') ?? 'liquid'
  const theme = useTheme()
  const info = useListInfo()
  const [detailInfo, setDetailInfo] = useState<DetailInfo>({ name: '', desc: '', playCount: '', imgUrl: info.img })

  useImperativeHandle(ref, () => ({
    setInfo(info) {
      setDetailInfo(info)
    },
  }), [])

  return (
    <View style={styles.wrap}>
      <View style={{
        ...styles.card,
        borderColor: theme['c-primary-alpha-800'],
      }}>
        <LiquidGlass mode={glassStyle} blurRadius={24} radius={16} tint={theme.isDark ? 'rgba(20,16,28,0.42)' : 'rgba(255,255,255,0.34)'} isDark={theme.isDark} seamless />
        <View style={styles.headRow}>
          <Pic componentId={componentId} playCount={detailInfo.playCount} imgUrl={detailInfo.imgUrl} />
          <View style={styles.infoArea} nativeID={NAV_SHEAR_NATIVE_IDS.songlistDetail_title}>
            <Text size={17.5} numberOfLines={2} style={styles.name}>{detailInfo.name || '歌单'}</Text>
            {
              info.author
                ? <Text size={11} color={theme['c-450']} numberOfLines={1} style={styles.author}>{info.author}</Text>
                : null
            }
            {
              detailInfo.desc
                ? <Text size={11} color={theme['c-450']} numberOfLines={3} style={styles.desc}>{detailInfo.desc}</Text>
                : null
            }
          </View>
        </View>
        <View style={styles.actionRow}>
          <ButtonBar />
        </View>
      </View>
    </View>
  )
})

const styles = createStyle({
  wrap: {
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 4,
    paddingBottom: 10,
  },
  card: {
    borderRadius: 16,
    borderWidth: 0.5,
    paddingLeft: 12,
    paddingRight: 12,
    paddingTop: 12,
    paddingBottom: 10,
  },
  headRow: {
    flexDirection: 'row',
  },
  infoArea: {
    flexDirection: 'column',
    flexGrow: 1,
    flexShrink: 1,
    paddingLeft: 12,
    justifyContent: 'center',
  },
  name: {
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  author: {
    marginTop: 4,
  },
  desc: {
    marginTop: 6,
    lineHeight: 17,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    // 用户要求三个操作胶囊作为一组在卡片里水平居中；多选操作条在 PageHeader 右侧
    // （SelectionBarSlot），不在这行里，所以居中不会影响多选管理入口
    justifyContent: 'center',
  },
  coverWrap: {
    flexGrow: 0,
    flexShrink: 0,
    overflow: 'hidden',
    borderRadius: 16,
  },
  cover: {
    flex: 1,
    borderRadius: 16,
  },
  playCount: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: '100%',
    fontSize: 11,
    paddingLeft: 5,
    paddingRight: 5,
    paddingBottom: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    color: '#fff',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
})
