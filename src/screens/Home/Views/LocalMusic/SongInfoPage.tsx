import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'

import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { useStatusbarHeight } from '@/store/common/hook'
import { useWindowSize, useKeyboard } from '@/utils/hooks'
import { createStyle, toast } from '@/utils/tools'
import { formatSize, formatSampleRate } from '@/core/download/utils'
import { documentUriToRealPath } from '@/utils/directoryPicker'
import { writeMetadata } from '@/utils/localMediaMetadata'
import { readFlacTags, writeFlacTags } from '@/utils/flacTag'
import { updateLocalMusicMeta } from '@/core/localMusic'
import { refreshMediaUri } from '@/screens/Home/Views/Setting/settings/Tools/fileWrite'
import { CoverImage } from './cover'
import { useNeutralPalette } from './palette'

/**
 * 歌曲信息（查看 / 编辑）页 —— 对齐飞牛音乐 /tmp/fn_info.png、/tmp/fn_info2.png。
 *
 * 布局：圆形返回 + 居中标题 + 圆形保存 → 大封面 → 码率/采样率/时长统计卡
 * → 文件位置/大小/添加日期卡 → 可编辑字段（名称/歌手/专辑）。
 * FLAC 额外有 年份/曲目序号/光盘序号/风格：这些字段曲库模型里不存，
 * 只在文件标签里，用 flacTag 的 readFlacTags / writeFlacTags 读写。
 *
 * 保存顺序（失败要能说清楚「哪一步没成」）：
 *   ① 原生库写名称/歌手/专辑（target 优先 content://，原生支持）
 *   ② FLAC 扩展标签写年份/曲目/光盘/风格（走纯 JS 的 writeFlacTags，保留原封面）
 *   ③ 写回曲库（updateLocalMusicMeta）→ 触发列表刷新
 * ①失败直接报错、不写曲库（列表里不会出现「没保存成功但显示已改」的脏数据）。
 */

interface Props {
  /** 为 null 时页面关闭 */
  item: LX.Music.MusicInfoLocal | null
  onClose: () => void
}

const pad2 = (n: number) => (n < 10 ? `0${n}` : String(n))
/** 添加日期：参考图是 2026-07-29 18:11 这种分钟级格式 */
const formatDateTime = (ts: number) => {
  if (!ts) return '—'
  const date = new Date(ts)
  if (Number.isNaN(date.getTime())) return '—'
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

interface FieldValues {
  name: string
  singer: string
  albumName: string
  year: string
  trackNumber: string
  discNumber: string
  genre: string
  language: string
}

const EMPTY_VALUES: FieldValues = {
  name: '',
  singer: '',
  albumName: '',
  year: '',
  trackNumber: '',
  discNumber: '',
  genre: '',
  language: '',
}

export default ({ item, onClose }: Props) => {
  const palette = useNeutralPalette()
  const statusBarHeight = useStatusbarHeight()
  const { width: windowWidth } = useWindowSize()
  const { keyboardShown, keyboardHeight } = useKeyboard()
  const [values, setValues] = useState<FieldValues>(EMPTY_VALUES)
  const [baseline, setBaseline] = useState<FieldValues>(EMPTY_VALUES)
  const [saving, setSaving] = useState(false)
  /** 用户已经动过输入框：标签异步读回来时不能再覆盖他的手改 */
  const touchedRef = useRef(false)
  const itemId = item?.id ?? ''

  /** 写文件时用的目标：content:// 优先（原生库支持），其次真实路径 */
  const contentUri = item?.meta.contentUri ?? (item?.meta.filePath?.startsWith('content://') ? item.meta.filePath : '')
  /**
   * 真实路径：FLAC 扩展标签只能走纯 JS 写真实文件，读也一样。
   * SAF 的 content:// 能还原成真实路径（documentUriToRealPath）；MediaStore 的还原不了就为空。
   */
  const realPath = useMemo(() => {
    if (!item) return ''
    const filePath = item.meta.filePath ?? ''
    if (filePath.startsWith('/')) return filePath
    const uri = item.meta.contentUri ?? (filePath.startsWith('content://') ? filePath : '')
    return uri ? documentUriToRealPath(uri) : ''
  }, [item])
  const isFlac = (item?.meta.ext ?? '').toLowerCase() === 'flac'
  const canEditFlacTags = isFlac && !!realPath

  const applyValues = useCallback((next: FieldValues, nextBaseline: FieldValues) => {
    setValues(next)
    setBaseline(nextBaseline)
  }, [])

  // 换歌（或首次打开）时重置表单；只在 item.id 变化时跑，
  // 列表刷新导致的 item 对象替换不会把用户正在改的内容冲掉
  useEffect(() => {
    if (!item) return
    touchedRef.current = false
    const next: FieldValues = {
      name: item.name ?? '',
      singer: item.singer ?? '',
      albumName: item.meta.albumName ?? '',
      year: item.meta.year ?? '',
      trackNumber: '',
      discNumber: '',
      genre: item.meta.genre ?? '',
      language: item.meta.language ?? '',
    }
    applyValues(next, { ...next })
    // 扩展标签异步读（只读文件头，几十毫秒），回来时如果用户没动过输入框就补上
    if (!canEditFlacTags) return
    let alive = true
    void readFlacTags(realPath).then(tags => {
      if (!alive || !tags || touchedRef.current) return
      const withTags: FieldValues = {
        ...next,
        year: tags.DATE ?? tags.YEAR ?? '',
        trackNumber: tags.TRACKNUMBER ?? '',
        discNumber: tags.DISCNUMBER ?? '',
        genre: tags.GENRE ?? next.genre,
        language: tags.LANGUAGE ?? next.language,
      }
      applyValues(withTags, { ...withTags })
    }).catch(() => {})
    return () => { alive = false }
    // item 用 id 做依赖：刷新列表时对象引用会变，但不应该重置表单
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId, canEditFlacTags, realPath, applyValues])

  const setField = useCallback(<K extends keyof FieldValues>(key: K, value: FieldValues[K]) => {
    touchedRef.current = true
    setValues(prev => ({ ...prev, [key]: value }))
  }, [])

  const dirty = useMemo(() => (Object.keys(baseline) as Array<keyof FieldValues>).some(key => values[key] !== baseline[key]), [baseline, values])

  const handleSave = useCallback(async() => {
    if (!item || saving) return
    const nextName = values.name.trim()
    const nextSinger = values.singer.trim()
    const nextAlbum = values.albumName.trim()
    // 空歌名会让列表出现一整行空白，直接拦住
    if (!nextName) {
      toast('名称不能为空')
      return
    }
    const target = contentUri || realPath
    if (!target) {
      toast('找不到可写的文件路径，无法保存')
      return
    }
    setSaving(true)
    try {
      // ① 原生库写三个基础标签（content:// 也支持）
      try {
        await writeMetadata(target, {
          name: nextName,
          singer: nextSinger,
          albumName: nextAlbum,
        })
      } catch (err) {
        toast(`写入文件标签失败：${(err as Error)?.message ?? '未知错误'}`)
        return
      }
      // ② FLAC 扩展标签：只有拿到真实路径才能写（SAF 的 content:// 写不了纯 JS）
      let flacError = ''
      if (canEditFlacTags) {
        try {
          await writeFlacTags(realPath, {
            TITLE: nextName,
            ARTIST: nextSinger,
            ALBUM: nextAlbum,
            DATE: values.year.trim(),
            TRACKNUMBER: values.trackNumber.trim(),
            DISCNUMBER: values.discNumber.trim(),
            GENRE: values.genre.trim(),
            LANGUAGE: values.language.trim(),
          })
        } catch (err) {
          flacError = (err as Error)?.message ?? '未知错误'
        }
      }
      // ③ 写回曲库：文件标签写成功了才更新列表数据
      const refreshedUri = canEditFlacTags ? await refreshMediaUri(realPath) : ''
      await updateLocalMusicMeta(item, {
        name: nextName,
        singer: nextSinger,
        albumName: nextAlbum,
        year: values.year.trim() || undefined,
        genre: values.genre.trim() || undefined,
        language: values.language.trim() || undefined,
        contentUri: refreshedUri || undefined,
      })
      if (flacError) toast(`基础标签已保存；FLAC 扩展标签写入失败：${flacError}`)
      else toast('已保存')
      onClose()
    } catch (err) {
      toast(`保存失败：${(err as Error)?.message ?? '未知错误'}`)
    } finally {
      setSaving(false)
    }
  }, [canEditFlacTags, contentUri, item, onClose, realPath, saving, values])

  if (!item) return null

  const coverSize = Math.min(224, Math.round(windowWidth * 0.52))
  const bitrate = item.meta.bitrate ? `${item.meta.bitrate} kbps` : '—'
  const sampleRate = item.meta.sampleRate ? formatSampleRate(item.meta.sampleRate) : '—'
  const duration = item.interval ?? '—'
  const fileLocation = realPath || item.meta.filePath || '—'

  return (
    <Modal
      visible
      animationType='slide'
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={{ flex: 1, backgroundColor: palette.bg }}>
        {/* 顶部：圆形返回 + 居中标题 + 圆形保存 */}
        <View style={{ paddingTop: statusBarHeight + 6, paddingHorizontal: 16 }}>
          <View style={styles.header}>
            <TouchableOpacity
              style={{ ...styles.circleBtn, backgroundColor: palette.card }}
              activeOpacity={0.7}
              onPress={onClose}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Icon name='chevron-left' size={22} color={palette.icon} />
            </TouchableOpacity>
            <View pointerEvents='none' style={styles.titleWrap}>
              <Text size={17} color={palette.text} style={{ fontWeight: '600' }}>歌曲信息</Text>
            </View>
            <TouchableOpacity
              style={{
                ...styles.circleBtn,
                backgroundColor: dirty ? palette.text : palette.card,
              }}
              activeOpacity={0.7}
              disabled={!dirty || saving}
              onPress={() => { void handleSave() }}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              {
                saving
                  ? <ActivityIndicator size='small' color={dirty ? palette.bg : palette.textSecondary} />
                  : <Icon name='check' size={20} color={dirty ? palette.bg : palette.textSecondary} />
              }
            </TouchableOpacity>
          </View>
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS == 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingTop: 8,
              paddingBottom: keyboardShown ? keyboardHeight + 24 : 40,
            }}
            keyboardShouldPersistTaps='handled'
          >
            {/* 大封面 */}
            <View style={{ alignItems: 'center', marginTop: 4, marginBottom: 18 }}>
              <CoverImage
                item={item}
                size={coverSize}
                radius={24}
                inset={0}
                background={palette.card}
              />
            </View>

            {/* 码率 / 采样率 / 时长 */}
            <View style={{ ...styles.card, flexDirection: 'row', alignItems: 'center', height: 78, backgroundColor: palette.card }}>
              <Stat label='码率' value={bitrate} />
              <View style={{ width: 1, height: 26, backgroundColor: palette.divider }} />
              <Stat label='采样率' value={sampleRate} />
              <View style={{ width: 1, height: 26, backgroundColor: palette.divider }} />
              <Stat label='时长' value={duration} />
            </View>

            {/* 文件信息 */}
            <View style={{ ...styles.card, marginTop: 16, paddingTop: 16, paddingBottom: 18, paddingLeft: 16, paddingRight: 16, backgroundColor: palette.card }}>
              <FileInfo label='文件位置' value={fileLocation} />
              <FileInfo label='文件大小' value={item.meta.size ? formatSize(item.meta.size) : '—'} />
              <FileInfo label='添加日期' value={formatDateTime(item.meta.mtime ?? 0)} last />
            </View>

            {/* 可编辑字段 */}
            <Field
              label='名称'
              value={values.name}
              placeholder='请输入歌曲名称'
              onChangeText={text => { setField('name', text) }}
            />
            <Field
              label='歌手'
              value={values.singer}
              placeholder='请输入歌手'
              onChangeText={text => { setField('singer', text) }}
            />
            <Field
              label='专辑'
              value={values.albumName}
              placeholder='请输入专辑'
              onChangeText={text => { setField('albumName', text) }}
            />

            <Field
              label='语言'
              value={values.language}
              placeholder='中文 / 英文 / 粤语 / 日文 / 韩文'
              onChangeText={text => { setField('language', text) }}
            />
            <Field
              label='年份'
              value={values.year}
              placeholder='发行年份'
              keyboardType='number-pad'
              onChangeText={text => { setField('year', text) }}
            />
            <Field
              label='风格'
              value={values.genre}
              placeholder='如 Pop / Rock / 粤语流行'
              onChangeText={text => { setField('genre', text) }}
            />

            {
              canEditFlacTags
                ? (
                  <>
                    <Field
                      label='曲目序号'
                      value={values.trackNumber}
                      placeholder='请输入曲目序号'
                      keyboardType='number-pad'
                      onChangeText={text => { setField('trackNumber', text) }}
                    />
                    <Field
                      label='光盘序号'
                      value={values.discNumber}
                      placeholder='请输入光盘序号'
                      keyboardType='number-pad'
                      onChangeText={text => { setField('discNumber', text) }}
                    />
                  </>
                  )
                : null
            }
            {
              // FLAC 但拿不到真实路径（只存在于 SAF 文档 uri 里）时说明为什么没有扩展字段
              isFlac && !canEditFlacTags
                ? (
                  <Text size={12} color={palette.textSecondary} style={{ marginTop: 16, lineHeight: 18 }}>
                    这个文件只有 SAF 文档地址、拿不到真实路径，年份/曲目/光盘/风格无法写入。
                  </Text>
                  )
                : null
            }
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  )
}

/** 统计卡的一列：数值 + 灰色标题 */
const Stat = ({ label, value }: { label: string, value: string }) => {
  const palette = useNeutralPalette()
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text size={16} color={palette.text} numberOfLines={1} style={{ fontWeight: '700' }}>{value}</Text>
      <Text size={12} color={palette.textSecondary} style={{ marginTop: 6 }}>{label}</Text>
    </View>
  )
}

/** 文件信息卡的一行：标题 + 值（文件位置可能很长，允许换行并可选复制） */
const FileInfo = ({ label, value, last = false }: { label: string, value: string, last?: boolean }) => {
  const palette = useNeutralPalette()
  return (
    <View style={{ marginBottom: last ? 0 : 16 }}>
      <Text size={13} color={palette.text}>{label}</Text>
      <Text
        size={13}
        color={palette.textSecondary}
        selectable
        style={{ marginTop: 6, lineHeight: 19 }}
      >{value}</Text>
    </View>
  )
}

/** 可编辑字段：标题 + 白色圆角输入框（参考图里是 50dp 高、圆角 12） */
const Field = ({ label, value, placeholder, keyboardType, onChangeText }: {
  label: string
  value: string
  placeholder: string
  keyboardType?: 'default' | 'number-pad'
  onChangeText: (text: string) => void
}) => {
  const palette = useNeutralPalette()
  return (
    <View style={{ marginTop: 20 }}>
      <Text size={14} color={palette.text} style={{ marginBottom: 8 }}>{label}</Text>
      <View
        style={{
          height: 50,
          borderRadius: 12,
          backgroundColor: palette.card,
          justifyContent: 'center',
          paddingLeft: 16,
          paddingRight: 16,
        }}
      >
        <TextInput
          style={{ padding: 0, fontSize: 15, color: palette.text }}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={palette.textSecondary}
          keyboardType={keyboardType ?? 'default'}
          selectionColor={palette.textSecondary}
        />
      </View>
    </View>
  )
}

const styles = createStyle({
  header: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  circleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  card: {
    borderRadius: 12,
  },
})
