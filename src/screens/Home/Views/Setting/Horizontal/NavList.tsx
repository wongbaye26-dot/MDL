import { memo, useRef, useState } from 'react'
import { View, TouchableOpacity, FlatList, type FlatListProps } from 'react-native'

import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import Text from '@/components/common/Text'
import { scaleSizeH } from '@/utils/pixelRatio'
import { SETTING_SCREENS, normalizeSettingScreenId, type SettingScreenIds } from '../Main'
import { useI18n } from '@/lang'

type FlatListType = FlatListProps<SettingScreenIds>

const ITEM_HEIGHT = scaleSizeH(46)

const ListItem = memo(({ id, activeId, onPress }: {
  onPress: (item: SettingScreenIds) => void
  activeId: string
  id: SettingScreenIds
}) => {
  const theme = useTheme()
  const t = useI18n()
  const active = activeId === id

  return (
    <View style={{ ...styles.listItem, height: ITEM_HEIGHT }}>
      <TouchableOpacity
        style={{
          ...styles.pill,
          backgroundColor: active ? theme['c-primary-alpha-800'] : 'transparent',
          borderColor: active ? theme['c-primary-alpha-500'] : 'transparent',
        }}
        activeOpacity={0.75}
        onPress={() => { onPress(id) }}
      >
        <Text
          numberOfLines={1}
          size={14}
          color={active ? theme['c-primary'] : theme['c-font']}
          style={active ? styles.pillTextActive : styles.pillText}
        >
          {t(`setting_${id}`)}
        </Text>
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
    paddingLeft: 8,
    paddingRight: 8,
  },
  pill: {
    height: 38,
    borderRadius: 12,
    borderWidth: 0.8,
    justifyContent: 'center',
    paddingLeft: 12,
    paddingRight: 12,
  },
  pillText: {
    fontWeight: '500',
  },
  pillTextActive: {
    fontWeight: '700',
  },
})
