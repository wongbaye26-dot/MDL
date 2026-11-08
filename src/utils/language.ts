/**
 * 从歌词/歌名判断语种（在线歌大多没有 meta.language，只能看歌词）。
 * 返回：粤语 / 普通话 / 英文 / 日文 / 韩文 / ''
 */
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
    return '普通话'
  }
  return ''
}

export const isCantonese = (language: string) => /粤语|粵語|cantonese/i.test(language)
export const isChineseLanguage = (language: string) => /中文|国语|國語|普通话|普通話|粤语|粵語|chinese/i.test(language)
