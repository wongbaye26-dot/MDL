import { memo, useCallback, useState } from 'react'
import { View } from 'react-native'

import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import { privateStorageDirectoryPath, unlink, writeFile } from '@/utils/fs'
import { getSidecarLrcPath } from '@/core/localMusic/lrcPath'
import { readSidecarLyricFile } from '@/core/music/local'
import { ButtonRow, Card, InfoLine, SecondaryButton } from './parts'

const MARKER = 'EMO_SIDECAR_SELFTEST'

/**
 * 同名 .lrc 自检（D-18）：在私有目录写一个临时音频路径 + 同名 .lrc，
 * 验证「路径推导 → 文件读取 → 歌词解析」，不依赖播放器导航。
 */
export default memo(() => {
  const theme = useTheme()
  const [result, setResult] = useState('')
  const [running, setRunning] = useState(false)

  const run = useCallback(() => {
    if (running) return
    setRunning(true)
    setResult('运行中…')
    void (async() => {
      const base = `${privateStorageDirectoryPath}/lyric_selftest_${Date.now()}`
      const audioPath = `${base}.flac`
      const lrcPath = getSidecarLrcPath(audioPath)
      try {
        if (!lrcPath) throw new Error('路径推导失败')
        await writeFile(audioPath, 'dummy')
        await writeFile(lrcPath, `[00:00.00]${MARKER}\n[00:05.00]第二行\n`)
        const lyric = await readSidecarLyricFile(audioPath)
        if (!lyric?.lyric.includes(MARKER)) throw new Error('未解析到同名 .lrc 内容')
        setResult(`通过：${lrcPath.split('/').pop() ?? '.lrc'} 读取并解析成功`)
      } catch (error) {
        setResult(`失败：${error instanceof Error ? error.message : '未知错误'}`)
      } finally {
        await unlink(audioPath).catch(() => {})
        if (lrcPath) await unlink(lrcPath).catch(() => {})
        setRunning(false)
      }
    })()
  }, [running])

  return (
    <Card title='歌词自检' desc='同名 .lrc 路径推导 + 读取 + 解析（不依赖播放器）'>
      <InfoLine label='状态' desc='临时文件写入私有目录，跑完自动清理' value={running ? '运行中' : result.startsWith('通过') ? '通过' : result.startsWith('失败') ? '失败' : '待运行'} tone={result.startsWith('失败') ? 'warning' : result.startsWith('通过') ? 'primary' : undefined} />
      <View style={styles.box}>
        <Text size={11} color={theme['c-450']}>{result || '点下方按钮运行。'}</Text>
      </View>
      <ButtonRow>
        <SecondaryButton label={running ? '运行中…' : '运行歌词自检'} icon='file-music-outline' disabled={running} onPress={run} />
      </ButtonRow>
    </Card>
  )
})

const styles = createStyle({
  box: {
    paddingLeft: 14,
    paddingRight: 14,
    paddingTop: 4,
    paddingBottom: 8,
  },
})
