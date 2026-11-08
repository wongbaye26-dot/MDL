/**
 * 从歌词/歌名判断语种（在线歌大多没有 meta.language，只能看歌词）。
 * 返回：粤语 / 普通话 / 英文 / 日文 / 韩文 / ''
 */
/** 粤语歌手特征表：歌词没明显粤语字时用于兜底（这些歌手以粤语歌为主） */
const CANTONESE_SINGERS = [
  '李克勤', '陈奕迅', '陳奕迅', '杨千嬅', '楊千嬅', '容祖儿', '容祖兒', '张国荣', '張國榮',
  '谭咏麟', '譚詠麟', '谢霆锋', '謝霆鋒', '郑秀文', '鄭秀文', '陈慧琳', '陳慧琳', '古巨基',
  '梁咏琪', '梁詠琪', '张敬轩', '張敬軒', '许冠杰', '許冠傑', '林子祥', '梅艳芳', '梅艷芳',
  '关淑怡', '關淑怡', '叶倩文', '葉蒨文', '彭羚', '郑伊健', '鄭伊健', '陈小春', '陳小春',
  'twins', 'twins', 'beyond', 'beyond', '草蜢', '达明一派', '達明一派', '麦浚龙', '麥浚龍',
  '谢安琪', '謝安琪', '卫兰', '衛蘭', '吴雨霏', '吳雨霏', '张智霖', '張智霖', '苏永康', '蘇永康',
]
const looksCantoneseSinger = (text: string) => {
  const lower = text.toLowerCase()
  return CANTONESE_SINGERS.some(name => lower.includes(name.toLowerCase()))
}

export const detectLanguage = (lyric: string, fallbackText = ''): string => {
  const text = lyric || fallbackText
  if (!text) return ''
  if (/[\u3040-\u30ff]/.test(text)) return '日文'
  if (/[\uac00-\ud7af]/.test(text)) return '韩文'
  // 粤语常用字（含繁体写法）
  if (/[冇嘅咗唔係佢哋睇咁嚟呢嗰乜嘢俾揾瞓諗啲咩咪喺囉喎啩㗎]/.test(text)) return '粤语'
  const cjk = (text.match(/[\u4e00-\u9fff]/g) ?? []).length
  const latin = (text.match(/[a-zA-Z]/g) ?? []).length
  if (latin > cjk * 3 && latin > 20) return '英文'
  if (cjk > 0) {
    const traditional = (text.match(/[聽説說愛這這麼們時間開關學習邊裡為與來對過還讓從會後發現實現點電話車見覺樣願記憶舊夢歲華麗聲響風雲變換傷終於無數擁抱親吻淚流嗎呢吧啊呀]/g) ?? []).length
    if (traditional / cjk > 0.12) return '粤语'
    // 歌词粤语字不明显，但歌手是粤语歌手 → 按粤语处理
    if (looksCantoneseSinger(fallbackText)) return '粤语'
    return '普通话'
  }
  return ''
}

export const isCantonese = (language: string) => /粤语|粵語|cantonese/i.test(language)
export const isChineseLanguage = (language: string) => /中文|国语|國語|普通话|普通話|粤语|粵語|chinese/i.test(language)
