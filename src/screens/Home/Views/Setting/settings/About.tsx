import { memo } from 'react'
import { View, TouchableOpacity, Image } from 'react-native'

import Section from '../components/Section'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { createStyle, openUrl } from '@/utils/tools'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const emoLogo = require('@/resources/images/emo-logo.png')
const currentVer = process.versions.app

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

export default memo(() => {
  const theme = useTheme()

  return (
    <>
      <View style={styles.brand}>
        <Image source={emoLogo} style={styles.logo} />
        <View style={styles.brandInfo}>
          <Text size={19} style={styles.brandName}>EMO音乐</Text>
          <Text size={11} color={theme['c-450']} style={styles.brandDesc}>深夜下载 · 情绪收藏</Text>
        </View>
        <View style={{ ...styles.versionTag, backgroundColor: theme['c-primary-alpha-800'] }}>
          <Text size={10} color={theme['c-primary-light-200']}>v{currentVer}</Text>
        </View>
      </View>

      <Section title='关于'>
        <LinkRow
          icon='logo'
          title='项目主页'
          desc='github.com/lyswhut/lx-music-mobile'
          onPress={() => { void openUrl('https://github.com/lyswhut/lx-music-mobile#readme') }}
        />
        <LinkRow
          icon='help'
          title='常见问题'
          desc='音源、下载、播放异常的排查说明'
          onPress={() => { void openUrl('https://lyswhut.github.io/lx-music-doc/mobile/faq') }}
        />
        <LinkRow
          icon='share'
          title='开源协议'
          desc='本项目基于 LX Music 二次开发'
          onPress={() => { void openUrl('https://github.com/lyswhut/lx-music-mobile#%E9%A1%B9%E7%9B%AE%E5%8D%8F%E8%AE%AE') }}
        />
      </Section>

      <Section title='声明'>
        <View style={styles.textBlock}>
          <Text size={12} color={theme['c-450']} style={styles.paragraph}>
            EMO音乐 是一个本地音乐下载与试听工具，所有内容均来自用户自行配置的第三方音源，软件本身不提供、不存储任何音频内容。
          </Text>
          <Text size={12} color={theme['c-450']} style={styles.paragraph}>
            请仅将本软件用于个人学习与技术研究，下载的音乐版权归原作者及版权方所有，请勿用于任何商业用途或二次分发。
          </Text>
          <Text size={12} color={theme['c-450']} style={styles.paragraph}>
            本项目完全免费、无广告、无任何收费入口。如果你在非官方渠道下载到带有引流信息的版本，请立即停止使用。
          </Text>
        </View>
      </Section>

      <Text size={10} color={theme['c-400']} style={styles.footer}>
        Made with care · EMO音乐 {currentVer}
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
    marginBottom: 22,
    marginTop: 4,
  },
  logo: {
    width: 54,
    height: 54,
    borderRadius: 17,
    marginRight: 13,
  },
  brandInfo: {
    flexGrow: 1,
    flexShrink: 1,
  },
  brandName: {
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  brandDesc: {
    marginTop: 4,
  },
  versionTag: {
    paddingLeft: 9,
    paddingRight: 9,
    paddingTop: 4,
    paddingBottom: 4,
    borderRadius: 9,
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
  footer: {
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 24,
  },
})
