import { memo } from 'react'
import { View, TouchableOpacity } from 'react-native'
import { Icon } from '@/components/common/Icon'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { useNavActiveId } from '@/store/common/hook'
import { useI18n } from '@/lang'
import { NAV_MENUS } from '@/config/constant'
import { setNavActiveId } from '@/core/common'
import { createStyle } from '@/utils/tools'

export default memo(() => {
  const theme = useTheme()
  const t = useI18n()
  const activeId = useNavActiveId()

  return (
    <View style={{ ...styles.bar, backgroundColor: theme['c-content-background'], borderTopColor: theme['c-border-background'] }}>
      {
        NAV_MENUS.map(menu => {
          const isActive = activeId === menu.id
          const color = isActive ? theme['c-primary'] : theme['c-450']
          return (
            <TouchableOpacity
              key={menu.id}
              style={styles.item}
              activeOpacity={0.7}
              onPress={() => { if (!isActive) setNavActiveId(menu.id) }}
            >
              <View style={styles.iconWrap}>
                <Icon name={menu.icon} size={21} color={color} />
                {isActive ? <View style={{ ...styles.dot, backgroundColor: theme['c-primary'] }} /> : null}
              </View>
              <Text size={10} color={color} style={isActive ? styles.labelActive : styles.label}>{t(menu.id)}</Text>
            </TouchableOpacity>
          )
        })
      }
    </View>
  )
})

const styles = createStyle({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 58,
    borderTopWidth: 0.5,
  },
  item: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconWrap: {
    height: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    position: 'absolute',
    bottom: -3,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  label: {
    marginTop: 1,
    letterSpacing: 0.2,
  },
  labelActive: {
    marginTop: 1,
    letterSpacing: 0.2,
    fontWeight: '600',
  },
})
