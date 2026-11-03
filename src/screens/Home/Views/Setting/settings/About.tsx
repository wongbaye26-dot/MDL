import { memo } from 'react'
import { View, Image } from 'react-native'

import Section from '../components/Section'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import MiniTag from '@/components/common/MiniTag'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const emoLogo = require('@/resources/images/emo-logo.png')
const currentVer = process.versions.app

/** 品牌区的标签：纯展示，不做跳转 */
const BRAND_TAGS = ['本地 + 在线', 'Material You', '免费无广告'] as const

/** 技术信息的一格：圆角图标 + 标签 + 值 */
const TechCell = ({ icon, label, value }: {
  icon: string
  label: string
  value: string
}) => {
  const theme = useTheme()
  return (
    <View style={styles.techCell}>
      <View style={{ ...styles.techIcon, backgroundColor: theme['c-primary-alpha-800'] }}>
        <Icon name={icon} size={14} color={theme['c-primary-light-200']} />
      </View>
      <View style={styles.techInfo}>
        <Text size={10} color={theme['c-450']} numberOfLines={1}>{label}</Text>
        <Text size={12} numberOfLines={1} style={styles.techValue}>{value}</Text>
      </View>
    </View>
  )
}

export default memo(() => {
  const theme = useTheme()

  return (
    <>
      {/* ── 品牌 hero 卡 ── */}
      <View style={{
        ...styles.hero,
        backgroundColor: theme['c-primary-alpha-900'],
        borderColor: theme['c-primary-alpha-700'],
      }}>
        <View style={styles.heroTop}>
          <Image source={emoLogo} style={styles.logo} />
          <View style={styles.brandInfo}>
            {/* RN 的 Text 不支持 flexShrink：名称要包一层 View 才会让位，版本 chip 才能完整显示 */}
            <View style={styles.nameRow}>
              <View style={styles.nameWrap}>
                <Text size={20} numberOfLines={1} style={styles.brandName}>EMO音乐</Text>
              </View>
            </View>
            {/* 版本号并进副标题行（不再单独放窄 chip，避免被省略号截断） */}
            <Text size={11} color={theme['c-450']} style={styles.brandDesc} numberOfLines={1}>
              v{currentVer} · 深夜下载 · 情绪收藏
            </Text>
          </View>
        </View>
        {/* 标签行可换行：小屏 / 大字号下哪怕换行也不会挤出卡片 */}
        <View style={styles.tagRow}>
          {
            BRAND_TAGS.map(tag => (
              <View key={tag} style={styles.tagItem}>
                <MiniTag text={tag} />
              </View>
            ))
          }
        </View>
      </View>

      {/* ── 技术信息 ── */}
      <Section title='技术信息'>
        <View style={styles.techGrid}>
          <TechCell icon='information-outline' label='版本' value={`v${currentVer}`} />
          <TechCell icon='react' label='框架' value='React Native' />
          <TechCell icon='palette-outline' label='设计语言' value='Material You' />
          <TechCell icon='android' label='平台' value='Android' />
        </View>
      </Section>

      {/* ── 致谢 ── */}
      <Section title='致谢'>
        <View style={styles.textBlock}>
          <Text size={12} color={theme['c-450']} style={styles.paragraph}>
            音源解析、下载与数据层来自 LX Music 移动版（lyswhut 开源），感谢作者的开源工作。界面、交互与播放器为本项目重做。
          </Text>
        </View>
      </Section>

      {/* ── 声明 ── */}
      <Section title='声明'>
        <View style={styles.textBlock}>
          <Text size={12} color={theme['c-450']} style={styles.paragraph}>
            EMO音乐 是一个本地音乐下载与试听工具，所有内容均来自用户自行配置的第三方音源，软件本身不提供、不存储任何音频内容。
          </Text>
          <Text size={12} color={theme['c-450']} style={styles.paragraph}>
            请仅将本软件用于个人学习与技术研究，下载的音乐版权归原作者及版权方所有，请勿用于任何商业用途或二次分发。
          </Text>
          <Text size={12} color={theme['c-450']} style={[styles.paragraph, styles.paragraphLast]}>
            本项目完全免费、无广告、无任何收费入口。如果你在非官方渠道下载到带有引流信息的版本，请立即停止使用。
          </Text>
        </View>
      </Section>

      {/* footer 分两行：版本号单独一行，任何宽度下都不会被截断 */}
      <View style={styles.footer}>
        <Text size={10} color={theme['c-400']}>Made with care · EMO音乐</Text>
        <Text size={10} color={theme['c-400']} numberOfLines={1} style={styles.footerVersion}>v{currentVer}</Text>
      </View>
    </>
  )
})

const styles = createStyle({
  hero: {
    borderRadius: 20,
    borderWidth: 0.5,
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 16,
    paddingBottom: 14,
    marginTop: 6,
    marginBottom: 20,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 62,
    height: 62,
    borderRadius: 19,
    marginRight: 14,
  },
  brandInfo: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nameWrap: {
    flexGrow: 0,
    flexShrink: 1,
    minWidth: 0,
  },
  brandName: {
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  brandDesc: {
    marginTop: 6,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
  },
  tagItem: {
    marginBottom: 6,
  },
  techGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingLeft: 12,
    paddingRight: 12,
    paddingTop: 8,
    paddingBottom: 8,
  },
  techCell: {
    width: '50%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 8,
    paddingRight: 6,
  },
  techIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  techInfo: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  techValue: {
    marginTop: 2,
    fontWeight: '600',
  },
  textBlock: {
    paddingLeft: 14,
    paddingRight: 14,
    paddingTop: 12,
    paddingBottom: 12,
  },
  paragraph: {
    lineHeight: 19,
    marginBottom: 10,
  },
  paragraphLast: {
    marginBottom: 0,
  },
  footer: {
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 24,
  },
  footerVersion: {
    marginTop: 3,
    letterSpacing: 0.4,
  },
})
