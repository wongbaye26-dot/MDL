import { useState } from 'react'
import { View, TouchableOpacity } from 'react-native'
import { useTheme } from '@/store/theme/hook'
import { useNavActiveId, useStatusbarHeight } from '@/store/common/hook'
import { useI18n } from '@/lang'
import { createStyle } from '@/utils/tools'
import { Icon } from '@/components/common/Icon'
import Text from '@/components/common/Text'
import StatusBar from '@/components/common/StatusBar'
import { scaleSizeH } from '@/utils/pixelRatio'
import { HEADER_HEIGHT } from '@/config/constant'
import SearchModal from './SearchModal'

export default () => {
  const theme = useTheme()
  const t = useI18n()
  const id = useNavActiveId()
  const statusBarHeight = useStatusbarHeight()
  const [searchVisible, setSearchVisible] = useState(false)

  return (
    <>
      <StatusBar />
      {
        id === 'nav_download'
          ? null
          : (
              <View style={{
                ...styles.container,
                height: scaleSizeH(HEADER_HEIGHT) + statusBarHeight,
                paddingTop: statusBarHeight,
                backgroundColor: theme['c-content-background'],
              }}>
                <Text style={styles.title} size={20} numberOfLines={1}>{t(id)}</Text>
                <TouchableOpacity
                  style={styles.btn}
                  onPress={() => { setSearchVisible(true) }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Icon name="search-2" size={19} color={theme['c-font']} />
                </TouchableOpacity>
              </View>
            )
      }
      {searchVisible ? <SearchModal onClose={() => { setSearchVisible(false) }} /> : null}
    </>
  )
}


const styles = createStyle({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 6,
    zIndex: 10,
  },
  title: {
    flexGrow: 1,
    flexShrink: 1,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  btn: {
    width: 44,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
})
