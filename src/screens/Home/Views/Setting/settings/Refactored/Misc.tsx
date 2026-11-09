import { useCallback, useEffect, useRef, useState } from 'react'
import { View } from 'react-native'
import { Group, CustomToggleRow, ValueRow, ActionRow, StepperRow } from '../../components/ui'
import ConfirmAlert, { type ConfirmAlertType } from '@/components/common/ConfirmAlert'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { toast, createStyle, confirmDialog } from '@/utils/tools'
import { getAppCacheSize, clearAppCache } from '@/utils/nativeModules/cache'
import { getCacheSize, clearCache } from '@/plugins/player/utils'
import { sizeFormate } from '@/utils'
import { getLogs, clearLogs } from '@/utils/log'
import { getMetaCache, clearLyric, clearOtherSource, clearMusicUrl } from '@/utils/data'
import { checkUpdate } from '@/core/version'
import { Space, Type } from '@/theme/designTokens'

const currentVer = process.versions.app

/** 数据与存储 / 关于与版本（IA 第 10、11 组） */
export default () => {
  const theme = useTheme()
  const t = useI18n()
  const alertRef = useRef<ConfirmAlertType>(null)
  const [logText, setLogText] = useState('')
  const [logSync, setLogSync] = useState(global.lx.isEnableSyncLog)
  const [logApi, setLogApi] = useState(global.lx.isEnableUserApiLog)
  const [cacheSize, setCacheSize] = useState<string | null>(null)
  const [meta, setMeta] = useState<{ otherSourceKeys: string[] | null, lyricKeys: string[] | null }>({ otherSourceKeys: null, lyricKeys: null })
  const [checking, setChecking] = useState(false)

  const loadCache = useCallback(() => {
    void Promise.all([getAppCacheSize(), getCacheSize()]).then(([a, b]) => { setCacheSize(sizeFormate(a + b)) })
    void getMetaCache().then(setMeta)
  }, [])

  useEffect(() => { loadCache() }, [loadCache])

  const cleanResource = async() => {
    const confirmed = await confirmDialog({ message: '确定清理资源缓存？', confirmButtonText: '清理', danger: true })
    if (!confirmed) return
    await Promise.all([clearAppCache(), clearCache(), clearMusicUrl()])
    toast('资源缓存已清理'); loadCache()
  }

  const cleanMeta = async() => {
    await Promise.all([
      meta.otherSourceKeys?.length ? clearOtherSource(meta.otherSourceKeys) : Promise.resolve(),
      meta.lyricKeys?.length ? clearLyric(meta.lyricKeys) : Promise.resolve(),
    ])
    toast('歌曲信息缓存已清理'); loadCache()
  }

  const openLogs = () => {
    void getLogs().then(log => {
      const lines = log.split(/^----lx log----\n|\n----lx log----\n|\n----lx log----$/).reverse()
      setLogText(lines.join('\n\n').replace(/^\n+|\n+$/, ''))
      alertRef.current?.setVisible(true)
    })
  }

  const check = async() => {
    setChecking(true)
    try { await checkUpdate(true) } finally { setChecking(false) }
  }

  return (
    <View>
      <Group title='数据与存储'>
        <StepperRow settingKey='player.cacheSize' title='播放缓存上限' desc='缓存越大越省流量，重启后生效' min={0} max={4096} step={256} format={value => value ? `${value} MiB` : '禁用'} />
        <ValueRow title='资源缓存' desc='封面、歌词、接口响应等临时文件' value={cacheSize ?? '计算中…'} />
        <ActionRow title='清理资源缓存' action='清理' danger onPress={() => { void cleanResource() }} />
        <ActionRow title='歌曲信息缓存' desc={`换源信息 ${meta.otherSourceKeys?.length ?? '…'} 条 · 歌词 ${meta.lyricKeys?.length ?? '…'} 条`} action='清理' danger onPress={() => { void cleanMeta() }} />
        <CustomToggleRow title={t('setting_other_log_sync_log')} value={logSync} onChange={v => { setLogSync(v); global.lx.isEnableSyncLog = v }} />
        <CustomToggleRow title={t('setting_other_log_user_api_log')} value={logApi} onChange={v => { setLogApi(v); global.lx.isEnableUserApiLog = v }} />
        <ValueRow title='查看错误日志' desc={t('setting_other_log')} value='打开' onPress={openLogs} />
        <ActionRow title='清空日志' action='清空' danger onPress={() => { void clearLogs().then(() => { toast('日志已清空'); setLogText(''); alertRef.current?.setVisible(false) }) }} />
      </Group>
      <Group
        title='关于与版本'
        footer={(
          <View style={styles.thanks}>
            <Text size={Type.caption.fontSize} color={theme['c-450']} style={styles.thanksText}>感谢 LX Music、React Native 及所有开源依赖与贡献者。</Text>
            <Text size={Type.caption.fontSize} color={theme['c-450']} style={styles.thanksText}>本应用仅用于个人音乐管理与播放，所有在线内容版权归各平台所有。</Text>
          </View>
        )}
      >
        <ValueRow title='版本' value={`v${currentVer}`} />
        <ValueRow title='框架' value='React Native' />
        <ValueRow title='设计语言' value='Material You' />
        <ValueRow title='平台' value='Android' />
        <ActionRow title='检查更新' desc='检查 GitHub 是否有新版本' action={checking ? '检查中…' : '检查'} onPress={() => { void check() }} />
      </Group>
      <ConfirmAlert ref={alertRef} cancelText='关闭' confirmText='清空' onConfirm={() => { void clearLogs().then(() => { toast('日志已清空'); setLogText('') }) }} showConfirm={!!logText} reverseBtn>
        <View style={styles.logBox}>
          <Text size={Type.caption.fontSize} color={theme['c-450']} style={styles.logText}>{logText || '暂无日志'}</Text>
        </View>
      </ConfirmAlert>
    </View>
  )
}

const styles = createStyle({
  thanks: {
    paddingLeft: Space.lg,
    paddingRight: Space.lg,
    paddingTop: Space.sm,
    paddingBottom: Space.md,
  },
  thanksText: {
    lineHeight: 18,
    marginBottom: Space.xs,
  },
  logBox: {
    maxHeight: 360,
    padding: Space.sm,
  },
  logText: {
    lineHeight: 15,
  },
})
