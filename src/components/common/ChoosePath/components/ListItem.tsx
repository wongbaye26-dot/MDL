import { memo } from 'react'
import { TouchableOpacity, View } from 'react-native'

import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import Text from '@/components/common/Text'
import { createStyle } from '@/utils/tools'

export interface PathItem {
  name: string
  path: string
  isDir: boolean
  mtime?: Date
  desc?: string
  size?: number
  sizeText?: string
  disabled?: boolean
}

export default memo(({ item, onPress }: {
  item: PathItem
  onPress: (item: PathItem) => void
  rowInfo?: unknown
}) => {
  const theme = useTheme()

  return (
    <View style={[styles.row, { borderBottomColor: theme['c-primary-alpha-700'] }]}>
      <TouchableOpacity
        style={[styles.inner, item.disabled ? { opacity: 0.35 } : null]}
        activeOpacity={0.7}
        disabled={item.disabled}
        onPress={() => { onPress(item) }}
      >
        <View style={[styles.iconWrap, { backgroundColor: theme['c-primary-alpha-900'] }]}>
          <Icon name={item.isDir ? 'folder' : 'file-music-outline'} size={18} color={theme['c-primary']} />
        </View>
        <View style={styles.info}>
          <Text size={14} numberOfLines={1} style={styles.title}>{item.name}</Text>
          <Text size={11} color={theme['c-450']} numberOfLines={1} style={styles.desc}>
            {item.mtime ? new Date(item.mtime).toLocaleString() : item.desc}
          </Text>
        </View>
        {item.isDir
          ? <Icon name='chevron-right' size={18} color={theme['c-450']} />
          : <Text size={11} color={theme['c-450']}>{item.sizeText}</Text>}
      </TouchableOpacity>
    </View>
  )
})

const styles = createStyle({
  row: { borderBottomWidth: 0.5, paddingLeft: 16, paddingRight: 16 },
  inner: { flexDirection: 'row', alignItems: 'center', height: 58 },
  iconWrap: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  info: { flex: 1, minWidth: 0 },
  title: { fontWeight: '500' },
  desc: { marginTop: 2 },
})
