/**
 * 中文歌名首字母（A-Z）推导。
 *
 * 不引入拼音库：用 `Intl.Collator('zh-Hans-CN')` 的中文排序能力，
 * 把每个字和 23 个「拼音首字母边界字」比较，二分定位它落在哪个字母区间。
 * 这是浏览器/ICU 里做中文索引的常用技巧，Hermes 的 Intl 支持与系统 ICU 一致
 * （项目里已有大量 `localeCompare(..., 'zh-Hans-CN')` 在使用）。
 *
 * 边界字：阿(A) 八(B) 擦(C) 搭(D) 蛾(E) 发(F) 噶(G) 哈(H) 击(J) 喀(K) 垃(L)
 *        妈(M) 拿(N) 哦(O) 啪(P) 期(Q) 然(R) 撒(S) 塌(T) 挖(W) 昔(X) 压(Y) 匝(Z)
 * （拼音没有 I/U/V 开头的音节，所以字母表里跳过这三个）
 *
 * 非中文：字母返回大写，数字/符号/空统一归到 '#'。
 */

const BOUNDARIES = ['阿', '八', '擦', '搭', '蛾', '发', '噶', '哈', '击', '喀', '垃', '妈', '拿', '哦', '啪', '期', '然', '撒', '塌', '挖', '昔', '压', '匝']
const LETTERS = 'ABCDEFGHJKLMNOPQRSTWXYZ'
const CHINESE = /[\u4e00-\u9fa5]/
const LATIN = /[a-zA-Z]/

let collator: Intl.Collator | null | undefined
const cache = new Map<string, string>()

const getCollator = (): Intl.Collator | null => {
  if (collator === undefined) {
    try {
      collator = new Intl.Collator('zh-Hans-CN')
    } catch {
      // 极少数没有 ICU 的运行时：退回 '#'，筛选栏仍然可用，只是中文都归到 #
      collator = null
    }
  }
  return collator
}

/** 单个字符的首字母；中文按拼音，拉丁按大写字母，其它 '#' */
export const initialOfChar = (char: string): string => {
  const cached = cache.get(char)
  if (cached) return cached
  let result: string
  if (LATIN.test(char)) {
    result = char.toUpperCase()
  } else if (CHINESE.test(char)) {
    const instance = getCollator()
    if (!instance) {
      result = '#'
    } else {
      let lo = 0
      let hi = BOUNDARIES.length - 1
      let index = 0
      while (lo <= hi) {
        const mid = (lo + hi) >> 1
        if (instance.compare(char, BOUNDARIES[mid]) >= 0) {
          index = mid
          lo = mid + 1
        } else {
          hi = mid - 1
        }
      }
      result = LETTERS.charAt(index) || '#'
    }
  } else {
    result = '#'
  }
  cache.set(char, result)
  return result
}

/** 文本首字符的首字母（用于歌名索引；空串归 '#'） */
export const initialOfText = (text: string): string => {
  const first = (text ?? '').trim().charAt(0)
  return first ? initialOfChar(first) : '#'
}
