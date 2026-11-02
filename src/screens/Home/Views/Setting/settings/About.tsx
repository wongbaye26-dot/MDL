import { memo } from 'react'
import { View, TouchableOpacity, Image } from 'react-native'

import Section from '../components/Section'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import MiniTag from '@/components/common/MiniTag'
import { useTheme } from '@/store/theme/hook'
import { createStyle, openUrl } from '@/utils/tools'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const emoLogo = require('@/resources/images/emo-logo.png')
const currentVer = process.versions.app

const REPO = 'https://github.com/wongbaye26-dot/MDL'
const UPSTREAM = 'https://github.com/lyswhut/lx-music-mobile'

const LinkRow = ({ icon, title, desc, onPress }: {
  icon: string
  title: string
  desc?: string
  onPress: () => void
}) => {
  const theme = useTheme()
  return (
    <TouchableOpacity style={styles.linkRow} activeOpacity={0.7} onPress={onPress}>
      <View style={{ ...styles.linkIcon, backgroundColor: theme['c-primary-alpha-800'] }}>
        <Icon name={icon} size={15} color={theme['c-primary-light-200']} />
      </View>
      <View style={styles.linkInfo}>
        <Text size={14}>{title}</Text>
        {desc ? <Text size={10} color={theme['c-450']} numberOfLines={1} style={styles.linkDesc}>{desc}</Text> : null}
      </View>
      <Icon name='chevron-right' size={14} color={theme['c-350']} />
    </TouchableOpacity>
  )
}

/** 纯文字行，用于技术信息这种不需要跳转的条目 */
const InfoRow = ({ label, value }: { label: string, value: string }) => {
  const theme = useTheme()
  return (
    <View style={styles.infoRow}>
      <Text size={12} color={theme['c-450']} style={styles.infoLabel}>{label}</Text>
      <Text size={12} numberOfLines={1} style={styles.infoValue}>{value}</Text>
    </View>
  )
}

export default memo(() => {
  const theme = useTheme()

  return (
    <>
      {/* ── 品牌区 ── */}
      <View style={styles.brand}>
        <Image source={emoLogo} style={styles.logo} />
        <View style={styles.brandInfo}>
          {/* 角标跟名称同一行：放最右边会被整个 brandInfo 挤掉宽度 */}
          <View style={styles.nameRow}>
            <Text size={20} style={styles.brandName}>EMO音乐</Text>
            <View style={styles.versionTag}>
              <Text size={11} color={theme['c-primary']}>v{currentVer}</Text>
            </View>
          </View>
          <Text size={11} color={theme['c-450']} style={styles.brandDesc}>深夜下载 · 情绪收藏</Text>
          <View style={styles.brandTags}>
            <MiniTag text='本地 + 在线' />
            <MiniTag text='Material You' />
          </View>
        </View>
      </View>

      {/* ── 链接 ── */}
      <Section title='关于'>
        <LinkRow
          icon='github'
          title='项目仓库'
          desc='wongbaye26-dot/MDL'
          onPress={() => { void openUrl(REPO) }}
        />
        <LinkRow
          icon='bug-outline'
          title='问题反馈'
          desc='遇到问题或有建议，欢迎提 Issue'
          onPress={() => { void openUrl(`${REPO}/issues`) }}
        />
        <LinkRow
          icon='scale-balance'
          title='开源协议'
          desc='MIT · 基于 LX Music 二次开发'
          onPress={() => { void openUrl(`${REPO}/blob/master/LICENSE`) }}
        />
      </Section>

      {/* ── 技术信息 ── */}
      <Section title='技术信息'>
        <View style={styles.textBlock}>
          <InfoRow label='版本' value={`v${currentVer}`} />
          <InfoRow label='框架' value='React Native' />
          <InfoRow label='设计语言' value='Material You' />
          <InfoRow label='支持平台' value='Android' />
        </View>
      </Section>

      {/* ── 致谢 ── */}
      <Section title='致谢'>
        <View style={styles.textBlock}>
          <Text size={12} color={theme['c-450']} style={styles.paragraph}>
            音源解析、下载与数据层来自{' '}
            <Text
              size={12}
              color={theme['c-primary']}
              onPress={() => { void openUrl(UPSTREAM) }}
            >LX Music 移动版</Text>
            ，感谢 lyswhut 的开源工作。界面、交互与播放器为本项目重做。
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

      <Text size={10} color={theme['c-400']} style={styles.footer}>
        Made with care · EMO音乐 v{currentVer}
      </Text>
    </>
  )
})

const styles = createStyle({
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 4,
    paddingRight: 4,
    marginBottom: 20,
    marginTop: 6,
  },
  logo: {
    width: 58,
    height: 58,
    borderRadius: 18,
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
  brandName: {
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  brandDesc: {
    marginTop: 4,
  },
  brandTags: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 7,
  },
  versionTag: {
    flexShrink: 0,
    marginLeft: 8,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 14,
    paddingRight: 14,
    paddingTop: 12,
    paddingBottom: 12,
  },
  linkIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  linkInfo: {
    flexGrow: 1,
    flexShrink: 1,
  },
  linkDesc: {
    marginTop: 3,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 6,
    paddingBottom: 6,
  },
  infoLabel: {
    width: 76,
    flexShrink: 0,
  },
  infoValue: {
    // 占满剩余宽度再右对齐：靠 flexShrink: 0 撑不开，Text 在 row 里会被压
    flex: 1,
    marginLeft: 12,
    textAlign: 'right',
  },
  textBlock: {
    paddingLeft: 14,
    paddingRight: 14,
    paddingTop: 12,
    paddingBottom: 12,
  },
  paragraph: {
    lineHeight: 18,
    marginBottom: 10,
  },
  paragraphLast: {
    marginBottom: 0,
  },
  footer: {
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 24,
  },
})
