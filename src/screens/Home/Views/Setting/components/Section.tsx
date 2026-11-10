import { Children } from 'react'
import { View } from 'react-native'

import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import {
  getCardBackground,
  getCardBorder,
  getCardShadow,
  getDividerColor,
  getIconColor,
  getTileBackground,
} from './surfaces'


interface Props {
  title: string
  desc?: string
  icon?: string
  color?: string
  /** false = 只渲染分组头，子内容自己排（设置首页的「播放与下载」双卡片） */
  card?: boolean
  children: React.ReactNode | React.ReactNode[]
}

/**
 * 设置页分组：图标 + 标题 + 说明 + 玻璃卡片。
 *
 * 卡片统一走 surfaces 里的半透明白/深色卡，和设置页渐变背景配合；
 * 子项之间的分隔线由这里统一插，子页面不需要各自处理。
 */
export default ({ title, desc, icon, color, card = true, children }: Props) => {
  const theme = useTheme()
  const items = Children.toArray(children).filter(item => item != null)

  const head = (
    <View style={styles.head}>
      {icon
        ? (
          <View style={{ ...styles.iconWrap, backgroundColor: getTileBackground(theme, color) }}>
            <Icon name={icon} size={15} color={getIconColor(theme, color)} />
          </View>
          )
        : null}
      <View style={styles.headText}>
        <Text size={13.5} style={styles.title}>{title}</Text>
        {desc ? <Text size={10} color={theme['c-450']} style={styles.desc}>{desc}</Text> : null}
      </View>
    </View>
  )

  if (!card) {
    return (
      <View style={styles.container}>
        {head}
        {items}
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={{
        ...styles.card,
        backgroundColor: getCardBackground(theme),
        borderColor: getCardBorder(theme),
        ...getCardShadow(theme),
      }}>
        {head}
        {
          items.map((item, index) => (
            <View key={index}>
              {index > 0 ? <View style={{ ...styles.divider, backgroundColor: getDividerColor(theme) }} /> : null}
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
    marginBottom: 14,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 13,
    paddingBottom: 9,
  },
  iconWrap: {
    width: 27,
    height: 27,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    flexShrink: 0,
  },
  headText: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  title: {
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  desc: {
    marginTop: 2,
    lineHeight: 14,
  },
  card: {
    borderRadius: 24,
    borderWidth: 0.5,
    overflow: 'hidden',
  },
  divider: {
    height: 0.5,
    marginLeft: 16,
    marginRight: 12,
  },
})
