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
  const vendor = utf8Bytes('EMO Music')
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

/**
 * 给 FLAC 写入标签与封面。
 * 保留 STREAMINFO(0) / SEEKTABLE(3) / APPLICATION(2) 等原有块；
 * 旧的 VORBIS_COMMENT(4) / PICTURE(6) 只有在这次要覆盖时才丢掉
 * （VORBIS_COMMENT 必须唯一，PICTURE 重复会显示错图）。
 */
export const writeFlacTags = async(
  filePath: string,
  tags: Record<string, string>,
  picPath?: string | null,
): Promise<void> => {
  if (filePath.startsWith('content://')) throw new Error('SAF 文档 uri 不支持纯 JS 写入')
  const b64 = await RNFS.readFile(filePath, 'base64')
  const bytes = toByteArray(b64)
  const parsed = parseFlac(bytes)
  if (!parsed) throw new Error('不是有效的 FLAC 文件')

  let pic: Uint8Array | null = null
  let mime = 'image/jpeg'
  if (picPath) {
    const picB64 = await RNFS.readFile(picPath, 'base64')
    pic = toByteArray(picB64)
    // 按文件头判断格式，别硬编码 jpeg
    if (pic[0] === 0x89 && pic[1] === 0x50) mime = 'image/png'
  }

  const replaceTags = Object.values(tags).some(value => !!value)
  const replacePic = !!picPath
  // 组装新的 block 列表：要覆盖的 4/6 丢掉，再补上新的；不覆盖的原样保留
  const kept = parsed.blocks.filter(block => {
    if (block.type === 4) return !replaceTags
    if (block.type === 6) return !replacePic
    return true
  })
  const nextBlocks: FlacBlock[] = [...kept]
  if (replaceTags) nextBlocks.push({ type: 4, body: buildVorbisComment(tags) })
  if (pic) nextBlocks.push({ type: 6, body: buildPicture(pic, mime) })

  // 计算新文件大小
  let size = 4 // 'fLaC'
  for (const b of nextBlocks) size += 4 + b.body.length
  size += bytes.length - parsed.audioStart

  const out = new Uint8Array(size)
  out[0] = 0x66; out[1] = 0x4c; out[2] = 0x61; out[3] = 0x43 // 'fLaC'
  let pos = 4
  nextBlocks.forEach((b, i) => {
    const isLast = i === nextBlocks.length - 1
    out[pos] = (isLast ? 0x80 : 0x00) | (b.type & 0x7f)
    out[pos + 1] = (b.body.length >> 16) & 0xff
    out[pos + 2] = (b.body.length >> 8) & 0xff
    out[pos + 3] = b.body.length & 0xff
    out.set(b.body, pos + 4)
    pos += 4 + b.body.length
  })
  // 音频帧原样搬过去
  out.set(bytes.subarray(parsed.audioStart), pos)

  // 先写临时文件，再把原文件挪成备份、临时文件补位，最后删备份：
  // 中途失败（存储满 / 被占用）还能把原文件还原，不会留下一个半截文件。
  const tmp = `${filePath}.emo-tmp`
  const bak = `${filePath}.emo-bak`
  await RNFS.writeFile(tmp, fromByteArray(out), 'base64')
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
