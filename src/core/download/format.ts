/**
 * 下载文件真实容器格式嗅探（纯函数，不依赖原生模块，方便单测）。
 *
 * 为什么需要它：自定义源脚本 / 三方接口返回的 `type`（音质）只是「声称」，
 * 实际给的可能是另一种容器 —— 线上已经出现过「下载中心显示 FLAC 无损、
 * 文件头却是 ID3（MP3）」的情况：
 *   - 写标签 / 写封面的原生模块按扩展名选解析器（flac 解析器读到 ID3 直接报
 *     `FlacHeader not found`），标签和封面全部丢失；
 *   - 本地曲库按扩展名入库，把 MP3 标成 FLAC，用户看到的信息是错的；
 *   - 播放器 / 其他 App 也可能因为扩展名与内容不符而识别不了。
 *
 * 所以要按**文件头**而不是按音源声称的 type 来落定扩展名与音质。
 */

/** 支持的音频容器 */
export type AudioContainer = 'flac' | 'mp3' | 'm4a' | 'ogg' | 'wav' | 'ape' | 'aac'

/** 与容器匹配的音质档位（是 LX.Quality 的子集：lossless 对应无损档，lossy 统一按 320k 记） */
export type DetectedQuality = 'flac' | '320k' | 'wav' | 'ape'

export interface DetectedAudioFormat {
  container: AudioContainer
  /** 与容器匹配的扩展名（可能超出 LX.Download.FileExt 的枚举，如 m4a/ogg/aac） */
  ext: string
  /** 与容器匹配的音质档位，用于修正 metadata.quality */
  quality: DetectedQuality
}

/** 容器 → 扩展名 / 音质档位 */
const CONTAINER_INFO: Record<AudioContainer, { ext: string, quality: DetectedQuality }> = {
  flac: { ext: 'flac', quality: 'flac' },
  mp3: { ext: 'mp3', quality: '320k' },
  m4a: { ext: 'm4a', quality: '320k' },
  ogg: { ext: 'ogg', quality: '320k' },
  wav: { ext: 'wav', quality: 'wav' },
  ape: { ext: 'ape', quality: 'ape' },
  aac: { ext: 'aac', quality: '320k' },
}

/** 从文件头指定偏移处比较 ASCII 魔数 */
const matchAscii = (header: Uint8Array, offset: number, magic: string) => {
  if (header.length < offset + magic.length) return false
  for (let i = 0; i < magic.length; i++) {
    if (header[offset + i] !== magic.charCodeAt(i)) return false
  }
  return true
}

const toResult = (container: AudioContainer): DetectedAudioFormat => ({
  container,
  ext: CONTAINER_INFO[container].ext,
  quality: CONTAINER_INFO[container].quality,
})

/**
 * 按文件头（建议前 16 字节）判断真实容器格式。
 *
 * @returns
 *   DetectedAudioFormat：识别出的容器；
 *   'invalid'：明显不是音频（HTML 错误页 / 纯文本等），调用方应按失败处理；
 *   null：认不出来（未知容器 / 空数据），调用方应保持原有逻辑，不要误判。
 */
export const detectAudioContainer = (header: Uint8Array): DetectedAudioFormat | 'invalid' | null => {
  if (!header?.length) return null

  // 错误页：跳过开头空白后是 '<'（<html、<!DOCTYPE ...），任何音频都不长这样
  const firstVisible = header.findIndex(byte => byte !== 0x20 && byte !== 0x09 && byte !== 0x0A && byte !== 0x0D)
  if (firstVisible >= 0 && header[firstVisible] === 0x3C) return 'invalid'

  // fLaC
  if (matchAscii(header, 0, 'fLaC')) return toResult('flac')
  // ID3v2（MP3 常见带标签头）
  if (matchAscii(header, 0, 'ID3')) return toResult('mp3')
  // MPEG 帧同步 0xFF 0xEx / 0xFF 0xFx：
  //   byte1 的 bit1-2 是 layer 字段，00 是保留值 —— 那是 ADTS AAC，不是 MP3
  if (header[0] === 0xFF && header.length > 1 && (header[1] & 0xE0) === 0xE0) {
    return toResult((header[1] & 0x06) === 0x00 ? 'aac' : 'mp3')
  }
  // MP4 / M4A：偏移 4 处是 ftyp
  if (matchAscii(header, 4, 'ftyp')) return toResult('m4a')
  // Ogg
  if (matchAscii(header, 0, 'OggS')) return toResult('ogg')
  // WAV：RIFF....WAVE（WAVE 在偏移 8）
  if (matchAscii(header, 0, 'RIFF')) return toResult('wav')
  // Monkey's Audio
  if (matchAscii(header, 0, 'MAC ')) return toResult('ape')
  // AAC：ADIF（裸流）/ ADTS（带 ADTS 字样的封装头）
  if (matchAscii(header, 0, 'ADIF') || matchAscii(header, 0, 'ADTS')) return toResult('aac')

  // 认不出来就返回 null：宁可保留原逻辑，也不要因为误判把正常文件删掉
  return null
}
