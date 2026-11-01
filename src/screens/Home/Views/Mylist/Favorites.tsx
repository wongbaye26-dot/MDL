import { useEffect, useState } from 'react'
import { View } from 'react-native'

import Chip from '@/components/common/Chip'
import Text from '@/components/common/Text'
import MusicList from './MusicList'
import { setActiveList } from '@/core/list'
import { LIST_IDS } from '@/config/constant'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'

type Tab = 'love' | 'temp'

/**
 * 收藏页：把「我的收藏」和「试听列表」并列成两个胶囊页签。
 *
 * 之前点收藏打开的是「我的列表」抽屉（左边一列歌单、右边歌曲），
 * 想看试听列表还得先在抽屉里切一次；现在两个常用列表直接摆出来，
 * 样式和首页/排行榜的胶囊筛选一致。
 */
export default () => {
  const theme = useTheme()
  const [tab, setTab] = useState<Tab>('love')

  useEffect(() => {
    setActiveList(tab === 'love' ? LIST_IDS.LOVE : LIST_IDS.TEMP)
  }, [tab])

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        <Chip
          label='我的收藏'
          active={tab === 'love'}
          onPress={() => { if (tab !== 'love') setTab('love') }}
        />
        <Chip
          label='试听列表'
          active={tab === 'temp'}
          onPress={() => { if (tab !== 'temp') setTab('temp') }}
        />
      </View>

      <View style={styles.hint}>
        <Text size={11} color={theme['c-450']} numberOfLines={1}>
          {tab === 'love' ? '收藏的歌曲都在这里，长按可以批量管理' : '试听列表：临时放进来试听的歌，重启不会丢'}
        </Text>
      </View>

      <View style={styles.list}>
        <MusicList hideHeader />
      </View>
    </View>
  )
}

const styles = createStyle({
  container: {
    flex: 1,
  },
  tabs: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 10,
  },
  hint: {
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 10,
    paddingBottom: 4,
  },
  list: {
    flex: 1,
    marginTop: 4,
  },
})
