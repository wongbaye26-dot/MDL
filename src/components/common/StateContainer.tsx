import { memo, type ReactNode } from 'react'
import { TouchableOpacity, View } from 'react-native'

import Text from './Text'
import { Icon } from './Icon'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import { SkeletonRows } from './Skeleton'

/**
 * 「加载中 / 加载失败 / 空」三态容器。
 *
 * 之前各页面各写一套：空态有 3 种实现、错误重试只是列表 footer 的一行文字、
 * loading 只有 ActivityIndicator 或什么都没有。这里统一成一个容器：
 *
 *   <StateContainer
 *     loading={status === 'loading'}
 *     error={status === 'error'}
 *     onRetry={onRefresh}
 *     empty={list.length === 0 && status === 'end' ? <EmptyState ... /> : null}
 *   >
 *     <FlatList ... />
 *   </StateContainer>
 *
 * 错误态带「重试」按钮；空态内容由页面传入，避免把业务文案写死在通用组件里。
 */
export default memo(({
  loading = false,
  error = false,
  onRetry,
  empty,
  skeleton,
  children,
}: {
  loading?: boolean
  error?: boolean
  onRetry?: () => void
  /** 空态节点；为 null/undefined 表示不展示空态、直接渲染 children */
  empty?: ReactNode
  /** 自定义 loading 骨架；默认用列表行骨架 */
  skeleton?: ReactNode
  children?: ReactNode
}) => {
  const theme = useTheme()

  if (loading) return <>{skeleton ?? <SkeletonRows />}</>

  if (error) {
    return (
      <View style={styles.state}>
        <View style={[styles.iconWrap, { backgroundColor: theme['c-primary-alpha-900'] }]}>
          <Icon name='cloud-alert-outline' size={26} color={theme['c-400']} />
        </View>
        <Text size={14} style={styles.title}>加载失败</Text>
        <Text size={11} color={theme['c-450']} style={styles.tip}>检查网络或音源后再试一次</Text>
        {
          onRetry
            ? (
              <TouchableOpacity
                style={[styles.retry, { backgroundColor: theme['c-primary'] }]}
                activeOpacity={0.85}
                onPress={onRetry}
                accessibilityRole='button'
                accessibilityLabel='重新加载'
              >
                <Text size={12} color='#FFFFFF'>重试</Text>
              </TouchableOpacity>
              )
            : null
        }
      </View>
    )
  }

  if (empty) return <>{empty}</>

  return <>{children}</>
})

const styles = createStyle({
  state: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 24,
    paddingRight: 24,
    paddingBottom: 40,
  },
  iconWrap: {
    width: 58,
    height: 58,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    marginTop: 14,
    fontWeight: '600',
  },
  tip: {
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 18,
  },
  retry: {
    marginTop: 16,
    height: 34,
    paddingLeft: 20,
    paddingRight: 20,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
