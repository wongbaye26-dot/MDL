#!/usr/bin/env node
/**
 * 校验本地 fork 依赖是否「该在的都在、该打的补丁都打了」。
 *
 * 这 4 个原生依赖是 lyswhut 的 fork，且有两处必须在装完之后再改源码
 * （见 dependencies-patch.js）。这类「装完还要打补丁」的链路最容易在换机器、
 * 重装依赖、升级依赖时静默失效 —— 表现是类型突然全丢、采样率突然没了。
 * 所以单独做一个可随时跑的检查，CI 也会跑。
 *
 * 用法：node scripts/check-vendor.js
 * 退出码：0 全部正常 / 1 有问题
 */

const { execSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.join(__dirname, '..')
const VENDOR_DIR = path.join(ROOT, '../vendor')
const NM = path.join(ROOT, 'node_modules')

const PINNED = {
  'react-native-track-player': 'd76fe8ff483548a022f29e8b3e8f33111e9c28b6',
  'react-native-file-system': 'fcb0e6f55af684ac60598c720c77cfe0502f2c65',
  'react-native-local-media-metadata': '1b5be310d112afce0df598d3e9c7521c3311049c',
  'react-native-background-timer': '55ecaa80880e9cec1fff81f3ce10e6250ab3c40c',
}

const results = []
const check = (name, fn) => {
  try {
    const detail = fn()
    results.push({ ok: true, name, detail })
  } catch (err) {
    results.push({ ok: false, name, detail: err.message })
  }
}

const readFile = (p) => {
  if (!fs.existsSync(p)) throw new Error(`文件不存在：${path.relative(ROOT, p)}`)
  return fs.readFileSync(p, 'utf8')
}

/** 1. vendor 目录与 commit */
for (const [name, commit] of Object.entries(PINNED)) {
  check(`vendor/${name} @ ${commit.slice(0, 8)}`, () => {
    const dir = path.join(VENDOR_DIR, name)
    if (!fs.existsSync(path.join(dir, '.git'))) {
      throw new Error(`没找到 ${path.relative(ROOT, dir)}，先跑 npm run setup:vendor`)
    }
    const cur = execSync('git rev-parse HEAD', { cwd: dir, encoding: 'utf8' }).trim()
    if (cur !== commit) throw new Error(`commit 不符：当前 ${cur.slice(0, 8)}，期望 ${commit.slice(0, 8)}`)
    return 'ok'
  })
}

/** 2. 依赖是否已安装 */
for (const name of Object.keys(PINNED)) {
  check(`node_modules/${name}`, () => {
    if (!fs.existsSync(path.join(NM, name, 'package.json'))) throw new Error('未安装，先跑 npm i')
    return 'ok'
  })
}

/** 3. 补丁 1：两个 fork 的 types 指向 */
for (const name of ['react-native-file-system', 'react-native-local-media-metadata']) {
  check(`${name} types 已修正`, () => {
    const pkg = JSON.parse(readFile(path.join(NM, name, 'package.json')))
    if (pkg.types !== 'src/index.ts') {
      throw new Error(`types = ${String(pkg.types)}，应为 src/index.ts（跑 npm run postinstall 修复）`)
    }
    return 'ok'
  })
}

/** 4. 补丁 2：local-media-metadata 补了 sampleRate */
check('local-media-metadata 已补 sampleRate', () => {
  const java = readFile(path.join(NM, 'react-native-local-media-metadata/android/src/main/java/com/localmediametadata/Metadata.java'))
  if (!java.includes('"sampleRate"')) throw new Error('Metadata.java 里没有 sampleRate 字段（跑 npm run postinstall 修复）')
  return 'ok'
})

/** 5. 自定义能力：track-player 的扩展方法还在 */
check('track-player 扩展方法还在', () => {
  const ts = readFile(path.join(NM, 'react-native-track-player/src/trackPlayer.ts'))
  const missing = ['updateNowPlayingTitles', 'isCached', 'getCacheSize', 'clearCache'].filter(fn => !ts.includes(fn))
  if (missing.length) throw new Error(`缺少：${missing.join(', ')}（vendor commit 可能不对）`)
  return 'ok'
})

/** 6. linear-gradient 的 AGP8 namespace 补丁 */
check('linear-gradient 已打 AGP8 补丁', () => {
  const gradle = readFile(path.join(NM, 'react-native-linear-gradient/android/build.gradle'))
  if (!gradle.includes('namespace')) throw new Error('build.gradle 缺 namespace，构建会失败（跑 npm run postinstall 修复）')
  return 'ok'
})

let failed = 0
for (const r of results) {
  console.log(`${r.ok ? '✅' : '❌'} ${r.name}${r.ok ? '' : `  — ${r.detail}`}`)
  if (!r.ok) failed += 1
}
console.log(`\n${results.length - failed}/${results.length} 通过`)
process.exit(failed ? 1 : 0)
