import RNFS from 'react-native-fs'
import { fromByteArray, toByteArray } from 'react-native-quick-base64'

/**
 * 纯 JS 的 FLAC 标签写入。
 *
 * 为什么不用 `react-native-local-media-metadata`：
 * 它写标签前会把文件复制到 `cache/local-media-metadata-temp-file/` 下的临时文件，
 * 在 SAF 下载目录下这一步会稳定地抛
 * `FileOutputStream: open failed: ENOENT` —— 即使目录确实存在、路径也完全对得上。
 * （Java 侧 `mkdirs()` + `FileOutputStream` 的组合在部分 ROM 上就是拿不到这个 cache 子目录。）
 *
 * 这里直接操作字节：读 FLAC → 重建 metadata blocks（VORBIS_COMMENT / PICTURE）→ 写回。
 * 只处理真实路径下的 FLAC（SAF 的 content:// 交给原生库），MP3 等格式也仍走原生库。
 *
 * 注意两个「保留」语义（工具页的补封面 / 刮削都依赖）：
 * - `tags` 传空对象：保留文件里原有的 VORBIS_COMMENT，只改 PICTURE；
 * - `picPath` 不传：保留文件里原有的 PICTURE，只改标签。
 */

interface FlacBlock {
  type: number
  body: Uint8Array
}

interface ParsedFlac {
  blocks: FlacBlock[]
  /** 音频帧的起始偏移 */
  audioStart: number
}

const pushU32BE = (out: number[], v: number) => {
  out.push((v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff)
}

const pushU32LE = (out: number[], v: number) => {
  out.push(v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff)
}

/** 字符串 → UTF-8 字节（不依赖已废弃的 unescape） */
const utf8Bytes = (s: string): number[] => {
  const out: number[] = []
  for (let i = 0; i < s.length; i++) {
    let code = s.charCodeAt(i)
    if (code < 0x80) {
      out.push(code)
    } else if (code < 0x800) {
      out.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f))
    } else if (code >= 0xd800 && code <= 0xdbff && i + 1 < s.length) {
      // 代理对（emoji 等）
      const low = s.charCodeAt(++i)
      code = 0x10000 + ((code - 0xd800) << 10) + (low - 0xdc00)
      out.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      )
    } else {
      out.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f))
    }
  }
  return out
}

/** 解析 FLAC 的 metadata blocks，记下音频帧起点 */
const parseFlac = (bytes: Uint8Array): ParsedFlac | null => {
  if (bytes.length < 8) return null
  if (String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) !== 'fLaC') return null
  let pos = 4
  const blocks: FlacBlock[] = []
  while (pos + 4 <= bytes.length) {
    const hdr = bytes[pos]
    const isLast = (hdr & 0x80) !== 0
    const type = hdr & 0x7f
    const len = (bytes[pos + 1] << 16) + (bytes[pos + 2] << 8) + bytes[pos + 3]
    const bodyStart = pos + 4
    if (bodyStart + len > bytes.length) return null
    blocks.push({ type, body: bytes.subarray(bodyStart, bodyStart + len) })
    pos = bodyStart + len
    if (isLast) return { blocks, audioStart: pos }
  }
  return null
}

/** 构造 VORBIS_COMMENT（type 4） */
const buildVorbisComment = (tags: Record<string, string>): Uint8Array => {
  const out: number[] = []
  const vendor = utf8Bytes('Emo Music')
  pushU32LE(out, vendor.length)
  out.push(...vendor)
  const items = Object.entries(tags)
    .filter(([, v]) => v)
    .map(([k, v]) => utf8Bytes(`${k.toUpperCase()}=${v}`))
  pushU32LE(out, items.length)
  for (const item of items) {
    pushU32LE(out, item.length)
    out.push(...item)
  }
  return new Uint8Array(out)
}

/** 构造 PICTURE（type 6），type=3 表示 front cover */
const buildPicture = (pic: Uint8Array, mime: string): Uint8Array => {
  const out: number[] = []
  pushU32BE(out, 3) // picture type: front cover
  const mimeBytes = utf8Bytes(mime)
  pushU32BE(out, mimeBytes.length)
  out.push(...mimeBytes)
  pushU32BE(out, 0) // description 长度 0
  pushU32BE(out, 0) // width
  pushU32BE(out, 0) // height
  pushU32BE(out, 0) // color depth
  pushU32BE(out, 0) // palette size
  pushU32BE(out, pic.length)
  out.push(...pic)
  return new Uint8Array(out)
}

/** 头部读取上限：VORBIS_COMMENT 一定在音频帧之前，512KB 足够覆盖（PICTURE 可能很大，读不下就只取已解析到的） */
const MAX_READ_BYTES = 512 * 1024

/** UTF-8 解码（Hermes 没有 TextDecoder，这里手写，避免依赖 polyfill） */
const utf8Decode = (bytes: Uint8Array): string => {
  let out = ''
  let i = 0
  while (i < bytes.length) {
    const b = bytes[i++]
    if (b < 0x80) {
      out += String.fromCharCode(b)
    } else if (b < 0xe0) {
      out += String.fromCharCode(((b & 0x1f) << 6) | (bytes[i++] & 0x3f))
    } else if (b < 0xf0) {
      out += String.fromCharCode(((b & 0x0f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f))
    } else {
      let code = ((b & 0x07) << 18) | ((bytes[i++] & 0x3f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f)
      code -= 0x10000
      out += String.fromCharCode(0xd800 + (code >> 10), 0xdc00 + (code & 0x3ff))
    }
  }
  return out
}

/** 解析 VORBIS_COMMENT（type 4）里的 KEY=VALUE，键统一大写（Vorbis 规范是大小写不敏感） */
const parseVorbisComment = (body: Uint8Array): Record<string, string> => {
  const out: Record<string, string> = {}
  let pos = 0
  const readU32 = () => {
    if (pos + 4 > body.length) return -1
    const value = body[pos] | (body[pos + 1] << 8) | (body[pos + 2] << 16) | (body[pos + 3] << 24)
    pos += 4
    return value >>> 0
  }
  // vendor string 先跳过
  const vendorLength = readU32()
  if (vendorLength < 0 || pos + vendorLength > body.length) return out
  pos += vendorLength
  const count = readU32()
  if (count < 0) return out
  for (let i = 0; i < count; i++) {
    const length = readU32()
    if (length < 0 || pos + length > body.length) break
    const str = utf8Decode(body.subarray(pos, pos + length))
    pos += length
    const eq = str.indexOf('=')
    if (eq <= 0) continue
    const key = str.slice(0, eq).toUpperCase()
    // 同名键只取第一个（多值字段如多个 ARTIST 用首个，和大多数播放器一致）
    if (!(key in out)) out[key] = str.slice(eq + 1)
  }
  return out
}

/**
 * 只读 FLAC 头部的 VORBIS_COMMENT，返回 `{TITLE, ARTIST, ALBUM, DATE, TRACKNUMBER, DISCNUMBER, GENRE...}`。
 *
 * 歌曲信息页要用它回填「年份 / 曲目序号 / 光盘序号 / 风格」这些曲库模型里没存的字段。
 * 元数据块都在文件开头，只读头部 512KB（避免整首几十 MB 都读进内存）；
 * 头部里读不完的 PICTURE 大块直接忽略，已经解析到的 VORBIS_COMMENT 照样能用。
 *
 * @returns 非 FLAC / 读不到时返回 null；是 FLAC 但没有 VORBIS_COMMENT 返回空对象
 */
export const readFlacTags = async(filePath: string): Promise<Record<string, string> | null> => {
  if (!filePath || filePath.startsWith('content://')) return null
  let head: Uint8Array
  try {
    const info = await RNFS.stat(filePath)
    const fileSize = Number(info.size) || 0
    if (fileSize < 8) return null
    const length = Math.min(MAX_READ_BYTES, fileSize)
    head = toByteArray(await RNFS.read(filePath, length, 0, 'base64'))
  } catch {
    return null
  }
  if (head.length < 8) return null
  // 'fLaC'
  if (head[0] !== 0x66 || head[1] !== 0x4c || head[2] !== 0x61 || head[3] !== 0x43) return null
  let pos = 4
  while (pos + 4 <= head.length) {
    const header = head[pos]
    const isLast = (header & 0x80) !== 0
    const type = header & 0x7f
    const length = (head[pos + 1] << 16) + (head[pos + 2] << 8) + head[pos + 3]
    const bodyStart = pos + 4
    const bodyEnd = bodyStart + length
    if (bodyEnd > head.length) break
    if (type === 4) return parseVorbisComment(head.subarray(bodyStart, bodyEnd))
    pos = bodyEnd
    if (isLast) break
  }
  return {}
}

/**
 * 给 FLAC 写入标签与封面。
 * 保留 STREAMINFO(0) / SEEKTABLE(3) / APPLICATION(2) 等原有块；
 * 旧的 VORBIS_COMMENT(4) / PICTURE(6) 只有在这次要覆盖时才丢掉
 * （VORBIS_COMMENT 必须唯一，PICTURE 重复会显示错图）。
 */
/** 流式读取 FLAC 头部：按 4MB 递增，直到 metadata blocks 完整（避免整文件读入内存 OOM） */
const readFlacHeader = async(filePath: string, size: number): Promise<ParsedFlac> => {
  let length = Math.min(4 * 1024 * 1024, size)
  while (true) {
    const bytes = toByteArray(await RNFS.read(filePath, length, 0, 'base64'))
    const parsed = parseFlac(bytes)
    if (parsed) return parsed
    if (length >= size) throw new Error('不是有效的 FLAC 文件')
    length = Math.min(length * 2, size)
  }
}

export const writeFlacTags = async(
  filePath: string,
  tags: Record<string, string>,
  picPath?: string | null,
): Promise<void> => {
  if (filePath.startsWith('content://')) throw new Error('SAF 文档 uri 不支持纯 JS 写入')
  const info = await RNFS.stat(filePath)
  const fileSize = Number(info.size) || 0
  if (fileSize < 8) throw new Error('文件为空')
  const parsed = await readFlacHeader(filePath, fileSize)

  let pic: Uint8Array | null = null
  let mime = 'image/jpeg'
  if (picPath) {
    const picB64 = await RNFS.readFile(picPath, 'base64')
    pic = toByteArray(picB64)
    if (pic[0] === 0x89 && pic[1] === 0x50) mime = 'image/png'
  }

  const replaceTags = Object.values(tags).some(value => !!value)
  const replacePic = !!picPath
  const kept = parsed.blocks.filter(block => {
    if (block.type === 4) return !replaceTags
    if (block.type === 6) return !replacePic
    return true
  })
  const nextBlocks: FlacBlock[] = [...kept]
  if (replaceTags) nextBlocks.push({ type: 4, body: buildVorbisComment(tags) })
  if (pic) nextBlocks.push({ type: 6, body: buildPicture(pic, mime) })

  // 只组装新的 metadata 区（不含音频帧）
  let headerSize = 4
  for (const b of nextBlocks) headerSize += 4 + b.body.length
  const headOut = new Uint8Array(headerSize)
  headOut[0] = 0x66; headOut[1] = 0x4c; headOut[2] = 0x61; headOut[3] = 0x43
  let pos = 4
  nextBlocks.forEach((b, i) => {
    const isLast = i === nextBlocks.length - 1
    headOut[pos] = (isLast ? 0x80 : 0x00) | (b.type & 0x7f)
    headOut[pos + 1] = (b.body.length >> 16) & 0xff
    headOut[pos + 2] = (b.body.length >> 8) & 0xff
    headOut[pos + 3] = b.body.length & 0xff
    headOut.set(b.body, pos + 4)
    pos += 4 + b.body.length
  })

  const tmp = `${filePath}.emo-tmp`
  const bak = `${filePath}.emo-bak`
  // 先写头部，再把音频帧按 4MB 分块追加：内存占用恒定，不会 OOM
  await RNFS.writeFile(tmp, fromByteArray(headOut), 'base64')
  const CHUNK = 4 * 1024 * 1024
  for (let offset = parsed.audioStart; offset < fileSize; offset += CHUNK) {
    const length = Math.min(CHUNK, fileSize - offset)
    const b64 = await RNFS.read(filePath, length, offset, 'base64')
    await RNFS.appendFile(tmp, b64, 'base64')
  }

  await RNFS.unlink(bak).catch(() => {})
  await RNFS.moveFile(filePath, bak)
  try {
    await RNFS.moveFile(tmp, filePath)
  } catch (err) {
    await RNFS.moveFile(bak, filePath).catch(() => {})
    throw err
  }
  await RNFS.unlink(bak).catch(() => {})
}
