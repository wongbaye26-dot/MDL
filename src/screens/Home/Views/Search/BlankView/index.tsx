import Text from '@/components/common/Text'
import { useI18n } from '@/lang'
import { useSettingValue } from '@/store/setting/hook'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import { useKeyboard } from '@/utils/hooks'
import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { ScrollView, View, type LayoutChangeEvent } from 'react-native'
import HistorySearch, { type HistorySearchType } from './HistorySearch'
import HotSearch, { type HotSearchType } from './HotSearch'

interface BlankViewProps {
  onSearch: (keyword: string) => void
}
type Source = LX.OnlineSource | 'all'

export interface BlankViewType {
  show: (source: Source) => void
}

/**
 * 可视高度小于这个值就切紧凑布局。
 *
 * 键盘弹出后这片区域会被压得很矮（实测只剩一行热词的高度），
 * 如果继续用大间距/大胶囊，用户就只能看到一行且以为不能滚。
 * 这里不写死高度：跟着 onLayout 的实际高度 + 键盘状态自适应，
 * 紧凑模式把标题、胶囊、间距都收一档，保证「多行可见 + 可滚动」。
 */
const COMPACT_VIEWPORT_HEIGHT = 260

export default forwardRef<BlankViewType, BlankViewProps>(({ onSearch }, ref) => {
  // const [listType, setListType] = useState<SearchState['searchType']>('music')
  const [visible, setVisible] = useState(false)
  /** 空白页实际可视高度（键盘弹出/收起、横竖屏都会变） */
  const [viewportHeight, setViewportHeight] = useState(0)
  const hotSearchRef = useRef<HotSearchType>(null)
  const historySearchRef = useRef<HistorySearchType>(null)
  const isShowHotSearch = useSettingValue('search.isShowHotSearch')
  const isShowHistorySearch = useSettingValue('search.isShowHistorySearch')
  const t = useI18n()
  const theme = useTheme()
  const { keyboardShown } = useKeyboard()

  const compact = keyboardShown || (viewportHeight > 0 && viewportHeight < COMPACT_VIEWPORT_HEIGHT)

  const handleShow = (source: Source) => {
    hotSearchRef.current?.show(source)
    historySearchRef.current?.show()
  }

  useImperativeHandle(ref, () => ({
    show(source) {
      if (visible) handleShow(source)
      else {
        setVisible(true)
        requestAnimationFrame(() => {
          handleShow(source)
        })
      }
    },
  }), [visible])

  const handleLayout = (e: LayoutChangeEvent) => {
    const height = e.nativeEvent.layout.height
    setViewportHeight(prev => Math.abs(prev - height) < 1 ? prev : height)
  }

  // 这两个内容组件有各自的异步状态（热词/历史），compact 变化时只重渲染它们
  const content = (
    <View style={compact ? styles.contentCompact : styles.content}>
      { isShowHotSearch ? <HotSearch ref={hotSearchRef} onSearch={onSearch} compact={compact} /> : null }
      { isShowHistorySearch ? <HistorySearch ref={historySearchRef} onSearch={onSearch} compact={compact} /> : null }
    </View>
  )

  return (
    visible
      ? isShowHotSearch || isShowHistorySearch
        ? (
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps='always'
              keyboardDismissMode='none'
              showsVerticalScrollIndicator={false}
              onLayout={handleLayout}
            >
              {content}
            </ScrollView>
          )
        : (
            <View style={styles.welcome}>
              <Text size={22} color={theme['c-font-label']}>{t('search__welcome')}</Text>
            </View>
          )
      : null

  )
})


const styles = createStyle({
  // ScrollView 必须显式撑满：键盘弹起后父级高度变矮时它要跟着缩，
  // 否则内容会渲染到可视区之外（看起来像「只剩一行」）。
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  content: {
    paddingLeft: 16,
    paddingRight: 16,
  },
  contentCompact: {
    paddingLeft: 12,
    paddingRight: 12,
  },
  welcome: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
