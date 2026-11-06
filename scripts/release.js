#!/usr/bin/env node
/**
 * 一键出包：改版本号 → 构建 → 归档到 dist → 清理旧版本。
 *
 * 之前每轮都是手工 `cp` 到 dist，漏过好几次（v3.5.0 的 universal 包就漏了）。
 * 这个脚本把「构建 → 命名 → 归档 → 瘦身」串成一条命令。
 *
 * 用法：
 *   node scripts/release.js                  # 用当前版本号构建并归档
 *   node scripts/release.js --bump patch     # 先把 version 升一级（patch|minor|major），versionCode +1
 *   node scripts/release.js --no-build       # 只归档已有产物（跳过构建）
 *   node scripts/release.js --keep 3         # 只保留最近 3 个版本（默认 5）
 *   node scripts/release.js --prune-delete   # 旧版本直接删（默认是移到 dist-archive）
 */

const { execSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.join(__dirname, '..')
const APK_DIR = path.join(ROOT, 'android/app/build/outputs/apk/release')
const DIST = path.join(ROOT, '../dist')
const ARCHIVE = path.join(ROOT, '../dist-archive')

const argv = process.argv.slice(2)
const has = (flag) => argv.includes(flag)
const valueOf = (flag, fallback) => {
  const i = argv.indexOf(flag)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback
}

const sh = (cmd, cwd = ROOT) => execSync(cmd, { cwd, stdio: 'inherit' })

const readPkg = () => JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
const writePkg = (pkg) => fs.writeFileSync(path.join(ROOT, 'package.json'), JSON.stringify(pkg, null, 2) + '\n')

const CHANGELOG_PATH = path.join(ROOT, 'CHANGELOG.md')
/** 去掉 Markdown 强调/链接，只留可读文本 */
const stripMd = (text) => text
  .replace(/\*\*/g, '')
  .replace(/`/g, '')
  .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
  .trim()

/**
 * 从 CHANGELOG.md 里解析「### vX.Y.Z + 下面几条 - 」，
 * 用于自动生成 publish/version.json（App 内更新弹窗读它）。
 */
const parseChangelog = () => {
  if (!fs.existsSync(CHANGELOG_PATH)) return []
  const text = fs.readFileSync(CHANGELOG_PATH, 'utf8')
  const headings = [...text.matchAll(/^### v?([\d.]+)\s*$/gm)]
  const sections = []
  for (let i = 0; i < headings.length; i++) {
    const start = headings[i].index + headings[i][0].length
    const end = i + 1 < headings.length ? headings[i + 1].index : text.length
    const lines = text.slice(start, end)
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line.startsWith('- '))
      .map(line => stripMd(line.replace(/^-\s*/, '')))
      .filter(Boolean)
    if (!lines.length) continue
    // 更新弹窗里显示 4 条足够，太长会把弹窗撑满
    sections.push({ version: headings[i][1], desc: lines.slice(0, 4).join('\n') })
  }
  return sections
}

/** CHANGELOG 还没补当前版本时，退回读 doc/release-notes-X.md */
const readReleaseNotesDesc = (version) => {
  const file = path.join(ROOT, 'doc', `release-notes-${version}.md`)
  if (!fs.existsSync(file)) return ''
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).map(line => line.trim())
  const bullets = lines
    .filter(line => line.startsWith('- '))
    .map(line => stripMd(line.replace(/^-\s*/, '')))
    .filter(Boolean)
    .slice(0, 4)
  if (bullets.length) return bullets.join('\n')
  const first = lines.find(line => line && !line.startsWith('#') && !line.startsWith('>') && !line.startsWith('---'))
  return first ? stripMd(first) : ''
}

/**
 * 把当前版本写进 publish/version.json。
 *
 * 这是 App 内「检查更新」的数据源（src/utils/version.js 直接读它）。
 * 以前靠手改，v3.6.4 之后就一直没更新，导致 3.8.x 的包永远检测不到新版本。
 */
const writePublishVersion = (version) => {
  const sections = parseChangelog()
  const current = sections.find(item => item.version === version)
  const desc = current?.desc || readReleaseNotesDesc(version) || `EmoMusic v${version}`
  const history = sections
    .filter(item => item.version !== version && item.desc)
    .slice(0, 5)
    .map(item => ({ version: item.version, desc: item.desc }))
  const payload = { version, desc, history }
  const file = path.join(ROOT, 'publish/version.json')
  fs.writeFileSync(file, JSON.stringify(payload, null, 2) + '\n')
  console.log(`  → publish/version.json 已更新到 v${version}（history ${history.length} 条）`)
}

/** 升版本号：patch / minor / major */
const bump = (type) => {
  const pkg = readPkg()
  const parts = pkg.version.split('.').map(Number)
  if (type === 'major') { parts[0] += 1; parts[1] = 0; parts[2] = 0 } else if (type === 'minor') { parts[1] += 1; parts[2] = 0 } else parts[2] += 1
  pkg.version = parts.join('.')
  // versionCode 单调递增，否则装不上（Android 只认更大的）
  pkg.versionCode = (pkg.versionCode ?? 0) + 1
  writePkg(pkg)
  console.log(`版本 → ${pkg.version}（versionCode ${pkg.versionCode}）`)
  return pkg
}

const main = () => {
  const bumpType = valueOf('--bump', null)
  const pkg = bumpType ? bump(bumpType) : readPkg()
  const version = pkg.version
  const keep = Number(valueOf('--keep', '5'))

  if (!has('--no-build')) {
    // 前置检查：任何一项失败就中止，别把「按钮静默消失」的包发出去
    console.log('\n▶ 前置检查 …')
    sh('npx tsc --noEmit -p tsconfig.json')
    console.log('  ✓ 类型检查通过')
    sh('npm run lint')
    console.log('  ✓ ESLint 通过')
    sh('node dependencies-patch.js --strict')
    console.log('  ✓ 依赖补丁全部生效')

    console.log(`\n▶ 构建 v${version} …`)
    // 每次强制重打 JS bundle：增量构建有时会漏掉 JS 改动
    fs.rmSync(path.join(ROOT, 'android/app/build/generated/assets/createBundleReleaseJsAndAssets'), { recursive: true, force: true })
    sh('./gradlew :app:assembleRelease -q', path.join(ROOT, 'android'))
  }

  if (!fs.existsSync(APK_DIR)) throw new Error(`找不到产物目录：${APK_DIR}`)
  if (!fs.existsSync(DIST)) fs.mkdirSync(DIST, { recursive: true })

  // 归档三种包：
  //  - arm64-v8a：新机型真机覆盖升级（versionCode 带 ABI 后缀，可覆盖同架构旧包）
  //  - armeabi-v7a：老机型 / 部分车机
  //  - universal：全新安装 / 不确定架构时用（versionCode 无 ABI 后缀，只能全新安装）
  // 文件名映射：android/app/build.gradle 用 package.json 的 name 生成
  //   em-music-vX.Y.Z-{abi}.apk / em-music-vX.Y.Z-universal.apk
  // 归档后统一改名成 EmoMusic-vX.Y.Z-{abi}.apk。
  const wanted = [
    { abi: 'arm64-v8a', file: `em-music-v${version}-arm64-v8a.apk` },
    { abi: 'armeabi-v7a', file: `em-music-v${version}-armeabi-v7a.apk` },
    { abi: 'universal', file: `em-music-v${version}-universal.apk` },
  ]

  console.log('\n▶ 归档到 dist …')
  let copied = 0
  for (const item of wanted) {
    const src = path.join(APK_DIR, item.file)
    if (!fs.existsSync(src)) {
      console.warn(`⚠ 缺少 ${item.file}，跳过`)
      continue
    }
    const dest = path.join(DIST, `EmoMusic-v${version}-${item.abi}.apk`)
    fs.copyFileSync(src, dest)
    const mb = (fs.statSync(dest).size / 1048576).toFixed(1)
    console.log(`  → ${path.basename(dest)}  (${mb} MB)`)
    copied += 1
  }
  if (!copied) throw new Error('一个包都没归档，检查构建是否成功')

  // 更新 App 内检查更新的数据源；放在归档成功之后，避免构建/归档失败时
  // 把 version.json 提前推到下一个版本，导致老包检测到「不存在的更新」。
  console.log('\n▶ 更新 publish/version.json …')
  writePublishVersion(version)

  // 瘦身：只保留最近 N 个版本
  const versions = [...new Set(
    fs.readdirSync(DIST)
      .filter(f => f.startsWith('EmoMusic-v') && f.endsWith('.apk'))
      .map(f => /^EmoMusic-(v[\d.]+)-/.exec(f)?.[1])
      .filter(Boolean),
  )].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))

  const drop = versions.slice(0, Math.max(0, versions.length - keep))
  if (drop.length) {
    console.log(`\n▶ 清理旧版本（保留最近 ${keep} 个：${versions.slice(-keep).join(', ')}）`)
    if (!has('--prune-delete') && !fs.existsSync(ARCHIVE)) fs.mkdirSync(ARCHIVE, { recursive: true })
    for (const v of drop) {
      for (const f of fs.readdirSync(DIST).filter(n => n.startsWith(`EmoMusic-${v}-`))) {
        const from = path.join(DIST, f)
        if (has('--prune-delete')) {
          fs.rmSync(from, { force: true })
          console.log(`  删除 ${f}`)
        } else {
          fs.renameSync(from, path.join(ARCHIVE, f))
          console.log(`  移出 ${f} → dist-archive/`)
        }
      }
    }
  }

  console.log(`\n✅ v${version} 完成。dist 现有 ${fs.readdirSync(DIST).filter(f => f.endsWith('.apk')).length} 个 APK。`)
  console.log('注意：arm64-v8a / armeabi-v7a 包可覆盖升级同架构旧包；universal 包的 versionCode 不带 ABI 后缀，只能全新安装。')
}

main()
