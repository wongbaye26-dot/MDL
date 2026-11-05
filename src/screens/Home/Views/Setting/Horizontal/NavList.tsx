import { memo, useRef, useState } from 'react'
import { View, TouchableOpacity, FlatList, type FlatListProps } from 'react-native'

import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { scaleSizeH } from '@/utils/pixelRatio'
import { SETTING_SCREENS, normalizeSettingScreenId, type SettingScreenIds } from '../Main'
import { SCREEN_META } from '../components/screenMeta'
import { useI18n } from '@/lang'

type FlatListType = FlatListProps<SettingScreenIds>

// 和竖屏列表同一档呼吸感：行高 54dp（放不下时可滚动）
const ITEM_HEIGHT = scaleSizeH(54)

/**
 * 横屏设置左侧导航：与竖屏设置首页同一套列表语言
 * （彩色圆角图标 + 标题 + 选中态主色高亮，顺序与 SETTING_SCREENS 一致）。
 * 行高/图标比 v3.8.2 放宽，内容超过可视高度时列表可滚动。
 */
const ListItem = memo(({ id, activeId, onPress }: {
  onPress: (item: SettingScreenIds) => void
  activeId: string
  id: SettingScreenIds
}) => {
  const theme = useTheme()
  const t = useI18n()
  const active = activeId === id
  const meta = SCREEN_META[id]

  return (
    <View style={{ ...styles.listItem, height: ITEM_HEIGHT }}>
      <TouchableOpacity
        style={{
          ...styles.row,
          backgroundColor: active ? theme['c-primary-alpha-800'] : 'transparent',
        }}
        activeOpacity={0.7}
        onPress={() => { onPress(id) }}
      >
        <View style={{ ...styles.iconWrap, backgroundColor: `${meta.color}2E` }}>
          <Icon name={meta.icon} size={18} color={meta.color} />
        </View>
        <View style={styles.titleWrap}>
          <Text
            numberOfLines={1}
            size={14}
            color={active ? theme['c-primary'] : theme['c-font']}
            style={active ? styles.rowTextActive : styles.rowText}
          >
            {t(`setting_${id}`)}
          </Text>
        </View>
        {active ? <Icon name='chevron-right' size={15} color={theme['c-primary']} /> : null}
      </TouchableOpacity>
    </View>
  )
}, (prevProps, nextProps) => {
  return !!(prevProps.id === nextProps.id &&
    prevProps.activeId != nextProps.id &&
    nextProps.activeId != nextProps.id
  )
})

export default ({ onChangeId }: {
  onChangeId: (id: SettingScreenIds) => void
}) => {
  const flatListRef = useRef<FlatList>(null)
  const [activeId, setActiveId] = useState(() => normalizeSettingScreenId(global.lx.settingActiveId))

  const handleChangeId = (id: SettingScreenIds) => {
    onChangeId(id)
    setActiveId(id)
    global.lx.settingActiveId = id
  }

  const renderItem: FlatListType['renderItem'] = ({ item }) => (
    <ListItem
      key={item}
      id={item}
      activeId={activeId}
      onPress={handleChangeId}
    />
  )
  const getkey: FlatListType['keyExtractor'] = item => item
  const getItemLayout: FlatListType['getItemLayout'] = (data, index) => {
    return { length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index }
  }

  return (
    <FlatList
      ref={flatListRef}
      style={styles.container}
      data={SETTING_SCREENS}
      maxToRenderPerBatch={9}
      windowSize={9}
      removeClippedSubviews={true}
      initialNumToRender={18}
      showsVerticalScrollIndicator={false}
      renderItem={renderItem}
      keyExtractor={getkey}
      getItemLayout={getItemLayout}
    />
  )
}

const styles = createStyle({
  // 撑满左侧导航卡片可视高度：8 项在横屏放不下时列表可以滚动
  container: {
    flexGrow: 1,
    flexShrink: 1,
  },
  listItem: {
    justifyContent: 'center',
    paddingLeft: 6,
    paddingRight: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderRadius: 14,
    paddingLeft: 10,
    paddingRight: 8,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  titleWrap: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  rowText: {
    fontWeight: '500',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  rowTextActive: {
    fontWeight: '700',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
})
