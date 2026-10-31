import { Children } from 'react'
import { View } from 'react-native'

import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import Text from '@/components/common/Text'


interface Props {
  title: string
  desc?: string
  children: React.ReactNode | React.ReactNode[]
}

export default ({ title, desc, children }: Props) => {
  const theme = useTheme()
  const items = Children.toArray(children).filter(item => item != null)

  return (
    <View style={styles.container}>
      <View style={styles.head}>
        <Text size={12} color={theme['c-450']} style={styles.title}>{title}</Text>
        {desc ? <Text size={10} color={theme['c-400']} style={styles.desc}>{desc}</Text> : null}
      </View>
      <View style={{
        ...styles.card,
        backgroundColor: theme['c-primary-alpha-900'],
        borderColor: theme['c-primary-alpha-700'],
      }}>
        {
          items.map((item, index) => (
            <View key={index}>
              {index > 0 ? <View style={{ ...styles.divider, backgroundColor: theme['c-primary-alpha-700'] }} /> : null}
              {item}
            </View>
          ))
        }
      </View>
    </View>
  )
}


const styles = createStyle({
  container: {
    marginBottom: 20,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 4,
    paddingRight: 4,
    marginBottom: 8,
  },
  title: {
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  desc: {
    flexShrink: 1,
    marginLeft: 10,
  },
  card: {
    borderRadius: 18,
    borderWidth: 0.5,
    paddingTop: 2,
    paddingBottom: 2,
    overflow: 'hidden',
  },
  divider: {
    height: 0.5,
    marginLeft: 14,
  },
})
