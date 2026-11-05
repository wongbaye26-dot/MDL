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

const ITEM_HEIGHT = scaleSizeH(46)

/**
 * 横屏设置左侧导航：和竖屏设置首页同一套列表语言
 * （36dp 彩色圆角图标 + 标题 + 选中态主色高亮，顺序与 SETTING_SCREENS 一致）。
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
          <Icon name={meta.icon} size={16} color={meta.color} />
        </View>
        <View style={styles.titleWrap}>
          <Text
            numberOfLines={1}
            size={13.5}
            color={active ? theme['c-primary'] : theme['c-font']}
            style={active ? styles.rowTextActive : styles.rowText}
          >
            {t(`setting_${id}`)}
          </Text>
        </View>
        {active ? <Icon name='chevron-right' size={14} color={theme['c-primary']} /> : null}
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
      renderItem={renderItem}
      keyExtractor={getkey}
      getItemLayout={getItemLayout}
    />
  )
}

const styles = createStyle({
  container: {
    flexShrink: 1,
    flexGrow: 0,
  },
  listItem: {
    justifyContent: 'center',
    paddingLeft: 6,
    paddingRight: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 42,
    borderRadius: 12,
    paddingLeft: 8,
    paddingRight: 8,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
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
