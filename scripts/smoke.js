#!/usr/bin/env node
/**
 * EMO 音乐冒烟测试
 *
 * 为什么用 adb 而不是在 App 里内置自检入口：
 * 自检代码会进 release 包，也会被后续改动影响；adb 脚本完全在外部，
 * 测的是「用户真实会走的那条路」——点按钮、看界面、听播放状态。
 *
 * 断言方式：uiautomator dump 拿界面文本 + dumpsys media_session 拿播放状态，
 * 不靠截图（截图没法自动比对）。
 *
 * 用法：
 *   node scripts/smoke.js              # 跑「启动 / 扫描 / 播放」三条
 *   node scripts/smoke.js --keep-going # 某步失败也继续跑后面的
 *
 * 前置：手机连上 adb、已安装 cn.toside.music.mobile、本地音乐里至少有一首歌。
 * 退出码：0 全通过 / 1 有失败。
 *
 * ── 为什么没有自动化的「下载」链路 ──
 * 首页的三张大卡片有常驻的 float/sweep 动画（BigCard.tsx 里的 Animated.loop），
 * 界面永远不会进入 idle 状态，uiautomator 会一直报 "could not get idle state"。
 * 搜索页是盖在首页上的浮层，同样 dump 不到。没有可读的界面层级就没法断言，
 * 硬编码坐标盲点又太容易误触（开发过程中就误删过用户的歌）。
 * 所以下载链路请按下面手动过一遍：
 *
 *   1. 首页右上角搜索 → 点任意热词
 *   2. 第一首右侧「⋮」→ 下载 → 选 128k → 开始下载
 *   3. 进「下载中心」：任务应从「等待中」走到「已完成」，大小与音质对得上
 *   4. 用文件管理器看保存目录：应出现「歌名.mp3」，若开了下载歌词还应出现「歌名.lrc」
 *      （lrc 文件名不能是 URL 编码串、也不能是 .lrc.txt —— 这两种都是历史 bug）
 */

const { execSync } = require('node:child_process')

const PKG = 'cn.toside.music.mobile'
const MAIN = `${PKG}/.MainActivity`

const args = process.argv.slice(2)
const KEEP_GOING = args.includes('--keep-going')

/** ---------- 基础工具 ---------- */

const sh = (cmd, opts = {}) => {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts }).trim()
  } catch (err) {
    if (opts.allowFail) return ''
    throw new Error(`命令失败: ${cmd}\n${err.stderr || err.message}`)
  }
}

const sleep = ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)

const waitFor = async(desc, fn, timeout = 15000, interval = 500) => {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    const result = fn()
    if (result) return result
    sleep(interval)
  }
  throw new Error(`等待超时（${timeout}ms）：${desc}`)
}

/** ---------- 设备 ---------- */

const getScreen = () => {
  const out = sh('adb shell wm size') // Physical size: 1080x2340
  const m = /(\d+)x(\d+)/.exec(out)
  if (!m) throw new Error('拿不到屏幕尺寸，adb 可能没连上')
  return { w: Number(m[1]), h: Number(m[2]) }
}

const tap = (x, y) => {
  sh(`adb shell input tap ${Math.round(x)} ${Math.round(y)}`)
  sleep(400)
}

/**
 * 底部胶囊导航的坐标按屏幕比例算。
 *
 * 胶囊高 58dp、宽 5×58+8=298dp（居中），所以：
 *  - 横向：第一个槽位中心在 (393-298)/2 + 4 + 29 ≈ 80dp → 0.205，之后每格 58dp（0.1476）
 *  - 纵向：胶囊中线 ≈ 屏高 95%
 * 改胶囊尺寸后这里要跟着改，否则点不中（之前 0.905 就因为胶囊变矮而失效）。
 */
const NAV_RATIO = { home: 0.205, download: 0.353, local: 0.5, mine: 0.648, player: 0.795 }
const NAV_Y = 0.95

/** 每个 Tab 落地后一定能看到的文字，用来确认「真的切过去了」 */
const NAV_MARKER = {
  home: /排行榜|歌单广场/,
  download: /全部|下载中|已完成/,
  local: /全部歌曲|扫描/,
  mine: /基本设置|下载设置/,
  player: /本地 ·|在线 ·/,
}

/**
 * 切到某个 Tab。
 *
 * 播放器页会占满全屏、底部胶囊是隐藏的，直接点导航点不到 ——
 * 所以先尝试点左上角的收起箭头（其它页面这块是标题，点了没副作用）。
 */
const navTo = (name, screen) => {
  const marker = NAV_MARKER[name]
  for (let attempt = 0; attempt < 3; attempt++) {
    tap(screen.w * NAV_RATIO[name], screen.h * NAV_Y)
    sleep(1500)
    if (findByText(dumpUi(), marker)) return
    // 可能停在播放器页（底部胶囊是隐藏的），点左上角收起箭头再来一次
    tap(screen.w * 0.078, screen.h * 0.073)
    sleep(900)
  }
  throw new Error(`切不到「${name}」页（找不到标记 ${marker}）`)
}

/** 暂停播放（KEYCODE_MEDIA_PAUSE） */
const pausePlayback = () => {
  sh('adb shell input keyevent 127', { allowFail: true })
  sleep(800)
}

/**
 * 抓一次界面层级，返回 [{ text, x, y }]
 *
 * uiautomator 要求界面「静止」才肯 dump，而胶囊上的唱片在播放时会一直转，
 * 界面永远不 idle，报 "could not get idle state"。所以失败时先暂停播放再试。
 * （需要断言「正在播放」的用例要在 dump 之后再触发播放。）
 */
const dumpUi = () => {
  // 先暂停：唱片一转界面就永远不 idle，dump 会一直报 "could not get idle state"
  pausePlayback()
  for (let i = 0; i < 4; i++) {
    sh('adb shell uiautomator dump /sdcard/smoke.xml', { allowFail: true })
    const raw = sh('adb shell cat /sdcard/smoke.xml', { allowFail: true })
    if (raw && raw.includes('<hierarchy')) {
      const nodes = []
      const re = /text="([^"]*)"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/g
      let m
      while ((m = re.exec(raw))) {
        const text = m[1].trim()
        if (!text) continue
        nodes.push({
          text,
          x: (Number(m[2]) + Number(m[4])) / 2,
          y: (Number(m[3]) + Number(m[5])) / 2,
        })
      }
      if (nodes.length) return nodes
    }
    sleep(700)
  }
  return []
}

const findByText = (nodes, pattern) => nodes.find(n => pattern instanceof RegExp ? pattern.test(n.text) : n.text === pattern)
const findByTextAll = (nodes, pattern) => nodes.filter(n => pattern instanceof RegExp ? pattern.test(n.text) : n.text === pattern)

/** ---------- 断言 ---------- */

const results = []
const record = (name, ok, detail = '') => {
  results.push({ name, ok, detail })
  console.log(`${ok ? '  ✅' : '  ❌'} ${name}${detail ? `  — ${detail}` : ''}`)
}

const step = async(name, fn) => {
  console.log(`\n▶ ${name}`)
  try {
    await fn()
    return true
  } catch (err) {
    record(name, false, err.message)
    if (!KEEP_GOING) throw err
    return false
  }
}

/** ---------- 用例 ---------- */

/** 1. 启动：进程起来、界面渲染出来、日志里没有致命错误 */
const caseLaunch = async(screen) => {
  sh(`adb shell am force-stop ${PKG}`, { allowFail: true })
  sh('adb logcat -c', { allowFail: true })
  sh(`adb shell am start -n ${MAIN}`)
  sleep(6000)

  const focus = sh('adb shell dumpsys window | grep mCurrentFocus', { allowFail: true })
  if (!focus.includes(PKG)) throw new Error(`应用没到前台：${focus || '(空)'}`)

  const nodes = dumpUi()
  if (!nodes.length) throw new Error('界面层级为空，可能是白屏')

  const fatal = sh('adb logcat -d | grep -icE "FATAL EXCEPTION|ReactNativeJS.*(Error|SyntaxError)"', { allowFail: true })
  if (Number(fatal) > 0) throw new Error(`logcat 里有 ${fatal} 条致命/JS 错误`)

  record('启动', true, `前台 = ${PKG}，界面 ${nodes.length} 个文本节点`)
}

/** 2. 本地音乐扫描：能进页面、能触发扫描、扫完歌曲数 > 0 */
const caseScan = async(screen) => {
  navTo('local', screen)

  const scanBtn = await waitFor('扫描按钮出现', () => {
    const nodes = dumpUi()
    return findByText(nodes, /^扫描$/)
  })
  tap(scanBtn.x, scanBtn.y)

  // 扫描完成后文案从「扫描中，已找到 N 首…」变成「N 首 · 大小」
  const done = await waitFor('扫描完成', () => {
    const nodes = dumpUi()
    const hit = findByText(nodes, /^[\d,]+ 首 · /)
    return hit && !findByText(nodes, /扫描中/) ? hit : null
  }, 90000, 1500)

  const count = Number(/([\d,]+) 首/.exec(done.text)?.[1]?.replace(/,/g, '') ?? 0)
  if (!count) throw new Error('扫描结果是 0 首')

  // 序号必须是 1、2、3… 连续的（这条曾经因为排序/索引错位而错乱过）
  // 扫描刚结束时列表可能还在渲染，读不到序号就等一下重试；
  // 之前是「读不到就跳过检查」，等于这条断言形同虚设。
  let head = []
  for (let i = 0; i < 4 && head.length < 5; i++) {
    if (i) sleep(800)
    head = findByTextAll(dumpUi(), /^\d+$/).map(n => Number(n.text)).slice(0, 5)
  }
  if (head.length < 5) throw new Error('读不到列表序号（界面还没渲染完）')
  if (head.join(',') !== '1,2,3,4,5') {
    throw new Error(`列表序号异常：${head.join(',')}`)
  }

  record('扫描', true, `${count} 首，序号 ${head.join(',')}`)
}

/** 3. 播放：点第一首后播放器要真的进入 PLAYING */
const casePlay = async(screen) => {
  // 先确保停在本地音乐页：扫描用例之后可能被别的点击带走了，
  // 不在这个页面上找元信息行会命中排行榜之类的地方（实测点进过排行榜）
  navTo('local', screen)
  sleep(800)

  // 歌曲行的元信息行（「歌手 · FLAC · 44.1 kHz · …」）是行内唯一稳定的锚点，
  // 用它定位第一首，比找「第一个文本节点」可靠（那个会命中页签胶囊）
  const metaLine = findByText(dumpUi(), /FLAC|MP3|WAV|APE|AAC|OGG/)
  if (!metaLine) throw new Error('找不到歌曲行（没有 FLAC/MP3 元信息文本）')

  tap(screen.w * 0.35, metaLine.y)
  sleep(2500)

  const state = await waitFor('播放器进入 PLAYING', () => {
    const out = sh('adb shell dumpsys media_session | grep "state=PlaybackState"', { allowFail: true })
    return out.includes('state=PLAYING') ? out : null
  }, 20000, 800)

  if (state.includes('error=') && !state.includes('error=null')) {
    throw new Error(`播放器报错：${state}`)
  }

  record('播放', true, 'state=PLAYING，error=null')
}

/** ---------- 入口 ---------- */

;(async() => {
  console.log('EMO 音乐冒烟测试')
  const screen = getScreen()
  console.log(`设备分辨率 ${screen.w}x${screen.h}`)

  const cases = [
    ['启动', caseLaunch],
    ['本地音乐扫描', caseScan],
    ['播放', casePlay],
  ]

  let failed = 0
  for (const [name, fn] of cases) {
    try {
      await step(name, () => fn(screen))
    } catch {
      failed++
      break
    }
  }

  const total = results.length
  const passed = results.filter(r => r.ok).length
  console.log(`\n${passed}/${total} 通过${failed ? '，存在失败' : ''}`)
  process.exit(passed === total && total === cases.length ? 0 : 1)
})().catch((err) => {
  console.error('\n脚本异常：', err.message)
  process.exit(1)
})
