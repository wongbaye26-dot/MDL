import { memo, useCallback, useState } from 'react'
import { View } from 'react-native'

import Section from '../../components/Section'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import CoverFixSection from './CoverFixSection'
import TagScrapeSection from './TagScrapeSection'

/**
 * 音乐工具：给本地曲库批量补封面 / 批量刮削标签。
 *
 * 两个区块的「统计 / 处理完」都依赖曲库最新状态，所以父级维护一个 refreshToken：
 * 任一区块跑完后 +1，两个区块据此各自重新统计（补封面会改封面数量，刮削会改标签）。
 */
export default memo(() => {
  const theme = useTheme()
  const [refreshToken, setRefreshToken] = useState(0)

  const handleChanged = useCallback(() => {
    setRefreshToken(token => token + 1)
  }, [])

  return (
    <>
      <CoverFixSection refreshToken={refreshToken} onChanged={handleChanged} />
      <TagScrapeSection refreshToken={refreshToken} onChanged={handleChanged} />
      <Section title='说明'>
        <View style={styles.textBlock}>
          <Text size={12} color={theme['c-450']} style={styles.paragraph}>
            「缺少封面」按能不能真的显示来算：先看文件里有没有内嵌封面，再看曲库里记的地址是否可用。
            系统相册接口给的 albumart 地址在没有封面的专辑上也会生成，所以不算有效封面。
          </Text>
          <Text size={12} color={theme['c-450']} style={styles.paragraph}>
            补封面会先抽文件内嵌的封面，确实没有才用「歌名 + 歌手」去酷我 / QQ / 网易搜。
            找到的图会尽量写进音频文件（其他播放器也能看到）；目录不允许改写时只记在曲库里给本应用使用。
          </Text>
          <Text size={12} color={theme['c-450']} style={styles.paragraph}>
            刮削标签同样会先搜索并核对歌名、歌手，对不上就不写（宁可不补，也不写错）。
            写不进音频文件时只更新曲库，处理过程可以随时停止，已完成的结果会保留。
          </Text>
        </View>
      </Section>
    </>
  )
})

const styles = createStyle({
  textBlock: {
    paddingLeft: 14,
    paddingRight: 14,
    paddingTop: 12,
    paddingBottom: 12,
  },
  paragraph: {
    lineHeight: 18,
    marginBottom: 8,
  },
})
