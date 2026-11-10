import { useTheme } from '@/store/theme/hook'
import { BorderRadius } from '@/theme'
import { createStyle } from '@/utils/tools'
import { type ComponentProps, memo, useCallback, useEffect, useMemo, useState } from 'react'
import { View, type ViewProps, StyleSheet, Image as FastImage } from 'react-native'
// import FastImage, { type FastImageProps } from 'react-native-fast-image'
import { Icon } from './Icon'
import { useLayout } from '@/utils/hooks'
// export type { OnLoadEvent } from 'react-native-fast-image'

export interface ImageProps extends ViewProps {
  style: ComponentProps<typeof FastImage>['style']
  url?: string | number | null
  cache?: boolean
  resizeMode?: ComponentProps<typeof FastImage>['resizeMode']
  onError?: (url: string | number) => void
  /** 高斯模糊半径（播放队列背景等场景用） */
  blurRadius?: number
}


export const defaultHeaders = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36',
}

const EmptyPic = memo(({ style, nativeID }: { style: ImageProps['style'], nativeID: ImageProps['nativeID'] }) => {
  const theme = useTheme()
  const { onLayout, width } = useLayout()
  const size = width * 0.36

  return (
    <View style={StyleSheet.compose({ ...styles.emptyPic, backgroundColor: theme['c-primary-light-900-alpha-200'], gap: size * 0.1 }, style)} onLayout={onLayout} nativeID={nativeID}>
      <Icon name='album' rawSize={size} color={theme['c-primary-light-400-alpha-200']} />
    </View>
  )
})

const Image = memo(({ url, cache, resizeMode = 'cover', style, onError, nativeID, blurRadius }: ImageProps) => {
  const [isError, setError] = useState(false)
  /** 远程封面偶发 403/超时时自动重试一次（换 reload 缓存），减少首页「偶发无封面」 */
  const [retry, setRetry] = useState(0)
  const handleError = useCallback(() => {
    if (retry < 1) {
      setRetry(r => r + 1)
      return
    }
    setError(true)
    onError?.(url!)
  }, [onError, retry, url])
  useEffect(() => {
    setError(false)
    setRetry(0)
  }, [url])
  let uri = typeof url == 'number'
    ? FastImage.resolveAssetSource(url).uri
    : url?.startsWith('/')
      ? 'file://' + url
      : url
  const showDefault = useMemo(() => !uri || isError, [isError, uri])
  return (
    showDefault ? <EmptyPic style={style} nativeID={nativeID} />
      : (
          <FastImage
            key={retry}
            style={style}
            source={{
              uri: uri!,
              headers: defaultHeaders,
              cache: retry > 0 ? 'reload' : (cache === false ? 'reload' : 'force-cache'),
              // priority: FastImage.priority.normal,
              // cache: cache === false ? 'web' : 'immutable',
            }}
            onError={handleError}
            resizeMode={resizeMode}
            blurRadius={blurRadius}
            nativeID={nativeID}
            // Android 默认 300ms 淡入会让人觉得封面“慢半拍”；列表封面直接显示
            fadeDuration={0}
            // 按控件尺寸解码，避免整张原图解码后占用带宽/内存
            resizeMethod='resize'
            progressiveRenderingEnabled
          />
        )
  )
}, (prevProps, nextProps) => {
  return prevProps.url == nextProps.url &&
    prevProps.style == nextProps.style &&
    prevProps.nativeID == nextProps.nativeID
})

export const getSize = (uri: string, success: (width: number, height: number) => void, failure?: (error: any) => void) => {
  FastImage.getSize(uri, success, failure)
}
export const clearMemoryCache = async() => {
  // return Promise.all([FastImage.clearMemoryCache(), FastImage.clearDiskCache()])
}
export default Image

const styles = createStyle({
  emptyPic: {
    borderRadius: BorderRadius.normal,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    paddingLeft: 2,
  },
})
