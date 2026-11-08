/** 从 http:// URL 里取域名；不是 http 或解析失败返回 '' */
export const getHttpHost = (url: string): string => {
  if (!url || !/^http:\/\//i.test(url)) return ''
  const match = /^http:\/\/([^/:?#]+)/i.exec(url)
  return match?.[1]?.toLowerCase() ?? ''
}
