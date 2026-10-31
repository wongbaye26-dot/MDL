import { memo } from 'react'
import { View, TouchableOpacity } from 'react-native'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { useNavActiveId } from '@/store/common/hook'
import { NAV_MENUS } from '@/config/constant'
import { setNavActiveId } from '@/core/common'
import { createStyle } from '@/utils/tools'

export default memo(() => {
  const theme = useTheme()
  const activeId = useNavActiveId()

  return (
    <View style={styles.wrap}>
      <View style={{
        ...styles.bar,
        backgroundColor: theme['c-content-background'],
        borderColor: theme['c-primary-alpha-700'],
      }}>
        {
          NAV_MENUS.map(menu => {
            const isActive = activeId === menu.id
            return (
              <TouchableOpacity
                key={menu.id}
                style={styles.item}
                activeOpacity={0.7}
                onPress={() => { if (!isActive) setNavActiveId(menu.id) }}
              >
                <View style={{
                  ...styles.iconWrap,
                  backgroundColor: isActive ? theme['c-primary'] : 'rgba(0,0,0,0)',
                }}>
                  <Icon
                    name={menu.icon}
                    size={20}
                    color={isActive ? '#FFFFFF' : theme['c-400']}
                  />
                </View>
              </TouchableOpacity>
            )
          })
        }
      </View>
    </View>
  )
})

const styles = createStyle({
  wrap: {
    paddingLeft: 20,
    paddingRight: 20,
    paddingTop: 4,
    paddingBottom: 10,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 60,
    borderRadius: 30,
    borderWidth: 0.5,
    paddingLeft: 8,
    paddingRight: 8,
    elevation: 14,
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  item: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
})
