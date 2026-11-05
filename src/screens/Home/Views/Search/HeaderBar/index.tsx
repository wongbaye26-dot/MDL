import { useRef, forwardRef, useImperativeHandle, useMemo, useState } from 'react'
import { Pressable, ScrollView, TouchableOpacity, View } from 'react-native'

import SearchTypeIcon from '@/components/common/SearchTypeIcon'
import { SourceChip } from '@/components/common/SourceLogo'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { useStatusbarHeight } from '@/store/common/hook'
import { useSourceListI18n } from '@/components/SourceSelector'
import { useKeyboard } from '@/utils/hooks'
import SearchInput, { type SearchInputType, type SearchInputProps } from './SearchInput'
import SearchTypeSelector from '../SearchTypeSelector'
import { createStyle } from '@/utils/tools'

type Source = LX.OnlineSource | 'all'

export interface HeaderBarProps {
  onClose: () => void
  onSourceChange: (source: Source) => void
  onTipSearch: SearchInputProps['onChangeText']
  onSearch: SearchInputProps['onSubmit']
  onHideTipList: SearchInputProps['onBlur']
  onShowTipList: SearchInputProps['onTouchStart']
}

export interface HeaderBarType {
  setSourceList: (list: Readonly<Source[]>, source: Source) => void
  setText: SearchInputType['setText']
  blur: SearchInputType['blur']
}


export default forwardRef<HeaderBarType, HeaderBarProps>(({
  onClose,
  onSourceChange,
  onTipSearch,
  onSearch,
  onHideTipList,
  onShowTipList,
}, ref) => {
  const theme = useTheme()
  const statusBarHeight = useStatusbarHeight()
  const searchInputRef = useRef<SearchInputType>(null)
  const [sources, setSources] = useState<Readonly<Source[]>>([])
  const [source, setSource] = useState<Source>('all')
  /**
   * 键盘弹起后页面可视高度会被压得很矮（实测只剩一两行热词的高度）。
   * 这时把「歌曲/歌单 + 音源」这一排筛选暂时收起来，把空间全部让给
   * 热门搜索/历史搜索（它们会切到紧凑布局），否则用户只看得到一行。
   * 键盘收起（提交搜索/失焦）后筛选行自动回来。
   */
  const { keyboardShown } = useKeyboard()

  useImperativeHandle(ref, () => ({
    setSourceList(list, source) {
      setSources(list)
      setSource(source)
    },
    setText(text) {
      searchInputRef.current?.setText(text)
    },
    blur() {
      searchInputRef.current?.blur()
    },
  }), [])

  const sourceList = useMemo(() => {
    const list = [...sources]
    const allIndex = list.indexOf('all')
    if (allIndex > 0) {
      list.splice(allIndex, 1)
      list.unshift('all')
    }
    return list
  }, [sources])
  const sourceLabels = useSourceListI18n(sourceList)

  return (
    <View style={{ ...styles.header, paddingTop: statusBarHeight }}>
      <View style={styles.searchRow}>
        <TouchableOpacity
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          onPress={onClose}
        >
          <Icon name='chevron-left-2' size={21} color={theme['c-font']} />
        </TouchableOpacity>
        <View style={{
          ...styles.searchBox,
          backgroundColor: theme['c-primary-alpha-900'],
          borderColor: theme['c-primary-alpha-700'],
        }}>
          <Icon name='search-2' size={15} color={theme['c-450']} style={styles.searchIcon} />
          <SearchInput
            ref={searchInputRef}
            onChangeText={onTipSearch}
            onSubmit={onSearch}
            onBlur={onHideTipList}
            onTouchStart={onShowTipList}
          />
        </View>
      </View>

      {
        // 键盘弹起时收起筛选行，把高度让给下方热门/历史搜索（见 keyboardShown 注释）
        keyboardShown
          ? null
          : (
            /*
              一整行铺满竖屏宽度：歌曲/歌单（Fragment 直接作为这一行的子项）+ 分隔线 +
              聚合 + 5 个品牌图标，共 8 个图标。
              contentContainerStyle 用 flexGrow + space-between：
              - 竖屏放得下时整行撑满，8 个图标之间的间距完全均分；
              - 极窄屏 / 横屏放不下时才退化成横向滚动，不会把图标挤变形。
              每个图标热区 38dp、图标 22dp；容器左右 padding 8 = 内容边距 16 - (38-22)/2，
              所以图标字形左右正好落在页面内容边距（16dp）上。
            */
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.filterScroll}
              contentContainerStyle={styles.filterContent}
            >
              <SearchTypeSelector boxSize={38} iconSize={22} />
              <View style={{ ...styles.divider, backgroundColor: theme['c-primary-alpha-700'] }} />
              {
                sourceLabels.map(({ label, action }) => {
                  const handlePress = () => {
                    if (action === source) return
                    setSource(action)
                    onSourceChange(action)
                  }
                  // 品牌音源只显示品牌 logo（SourceChip 已带 accessibilityLabel=音源名）；
                  // 「聚合大会 / 聚合搜索」（音源 all）不是品牌，但用户要求也换成单色矢量图标，
                  // 这里用同规格的 38dp 热区 + 22dp 聚合图标，无障碍标签仍保留原文字
                  return action === 'all'
                    ? (
                      <Pressable
                        key={action}
                        accessibilityRole='button'
                        accessibilityLabel={label}
                        accessibilityState={{ selected: action === source }}
                        hitSlop={4}
                        onPress={handlePress}
                        style={({ pressed }) => ({
                          width: 38,
                          height: 38,
                          alignItems: 'center',
                          justifyContent: 'center',
                          opacity: pressed ? 0.5 : 1,
                        })}
                      >
                        <SearchTypeIcon
                          type='aggregate'
                          size={22}
                          color={action === source ? theme['c-primary'] : theme['c-450']}
                        />
                      </Pressable>
                      )
                    : (
                      <SourceChip
                        key={action}
                        source={action}
                        label={label}
                        // 品牌图标用 lg 档位：38dp 热区 / 22dp 图标，和类型图标、聚合图标一致
                        size='lg'
                        active={action === source}
                        onPress={handlePress}
                      />
                      )
                })
              }
            </ScrollView>
            )
      }
    </View>
  )
})

const styles = createStyle({
  header: {
    paddingBottom: 2,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 4,
    paddingRight: 14,
    paddingTop: 4,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBox: {
    flexGrow: 1,
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    borderRadius: 20,
    borderWidth: 0.5,
    paddingLeft: 12,
    paddingRight: 6,
  },
  searchIcon: {
    marginRight: 6,
  },
  /** 横向筛选行：高度跟着内容走，不参与父级纵向伸缩 */
  filterScroll: {
    flexGrow: 0,
    flexShrink: 0,
  },
  /**
   * 筛选行（横向）内容容器：
   * flexGrow 让它在竖屏撑满整行，space-between 把多余宽度均分成图标间距；
   * 窄屏放不下时内容保持自身宽度、由 ScrollView 横向滚动。
   * padding 8 = 页面内容边距 16 − (38dp 热区 − 22dp 图标)/2，保证图标字形对齐内容边距。
   */
  filterContent: {
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 8,
    paddingRight: 8,
    paddingTop: 8,
    paddingBottom: 4,
  },
  divider: {
    width: 1,
    height: 20,
  },
})
