import { memo, useCallback, useState } from 'react'
import { View, Image } from 'react-native'

import Section from '../components/Section'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import MiniTag from '@/components/common/MiniTag'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import SettingRow from '../components/SettingRow'
import { getCardBackground, getCardBorder, getCardShadow, getTileBackground } from '../components/surfaces'
import { checkUpdate } from '@/core/version'
import { useI18n } from '@/lang'

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
      <View style={{ ...styles.techIcon, backgroundColor: getTileBackground(theme, '#8B5CF6') }}>
        <Icon name={icon} size={14} color='#8B5CF6' />
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
  const t = useI18n()
  const [checking, setChecking] = useState(false)

  const handleCheckUpdate = useCallback(async() => {
    if (checking) return
    setChecking(true)
    try {
      await checkUpdate(true)
    } finally {
      setChecking(false)
    }
  }, [checking])

  return (
    <>
      {/* ── 品牌 hero 卡 ── */}
      <View style={{
        ...styles.hero,
        backgroundColor: getCardBackground(theme),
        borderColor: getCardBorder(theme),
        ...getCardShadow(theme),
      }}>
        <View style={styles.heroTop}>
          <Image source={emoLogo} style={styles.logo} />
          <View style={styles.brandInfo}>
            {/* RN 的 Text 不支持 flexShrink：名称要包一层 View 才会让位，版本 chip 才能完整显示 */}
            <View style={styles.nameRow}>
              <View style={styles.nameWrap}>
                <Text size={20} numberOfLines={1} style={styles.brandName}>Emo音乐</Text>
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
      <Section title='技术信息' icon='information-outline'>
        <View style={styles.techGrid}>
          <TechCell icon='information-outline' label='版本' value={`v${currentVer}`} />
          <TechCell icon='react' label='框架' value='React Native' />
          <TechCell icon='palette-outline' label='设计语言' value='Material You' />
          <TechCell icon='android' label='平台' value='Android' />
        </View>
      </Section>

      {/* ── 更新 ── */}
      <Section title={t('setting_about_update')} icon='update'>
        <SettingRow
          icon='available_updates'
          title={t('setting_about_check_update')}
          desc={checking ? t('setting_about_checking') : t('setting_about_check_desc')}
          right={<Icon name='chevron-right' size={16} color={theme['c-350']} />}
          onPress={() => { void handleCheckUpdate() }}
        />
      </Section>

      {/* ── 致谢 ── */}
      <Section title='致谢' icon='heart-outline'>
        <View style={styles.textBlock}>
          <Text size={12} color={theme['c-450']} style={styles.paragraph}>
            感谢 lxmusic 开源项目。EmoMusic 基于 lxmusic 开源项目二次开发：音源解析、播放内核接入与数据层沿用/改造自上游 lx-music-mobile；品牌、界面、交互、播放器、本地音乐、下载中心与通知/锁屏媒体能力由 EmoMusic 开发或重做。
          </Text>
        </View>
      </Section>

      {/* ── 声明 ── */}
      <Section title='声明' icon='shield-check-outline'>
        <View style={styles.textBlock}>
          <Text size={12} color={theme['c-450']} style={styles.paragraph}>
            Emo音乐 是一个本地音乐下载与试听工具，所有内容均来自用户自行配置的第三方音源，软件本身不提供、不存储任何音频内容。
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
        <Text size={10} color={theme['c-400']}>Made with care · Emo音乐</Text>
        <Text size={10} color={theme['c-400']} numberOfLines={1} style={styles.footerVersion}>v{currentVer}</Text>
      </View>
    </>
  )
})

const styles = createStyle({
  hero: {
    borderRadius: 24,
    borderWidth: 0.8,
    paddingLeft: 18,
    paddingRight: 18,
    paddingTop: 18,
    paddingBottom: 16,
    marginTop: 4,
    marginBottom: 20,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 20,
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
    letterSpacing: 0.4,
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
