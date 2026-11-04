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
    sh('node dependencies-patch.js --strict')
    console.log('  ✓ 依赖补丁全部生效')

    console.log(`\n▶ 构建 v${version} …`)
    // 每次强制重打 JS bundle：增量构建有时会漏掉 JS 改动
    fs.rmSync(path.join(ROOT, 'android/app/build/generated/assets/createBundleReleaseJsAndAssets'), { recursive: true, force: true })
    sh('./gradlew :app:assembleRelease -q', path.join(ROOT, 'android'))
  }

  if (!fs.existsSync(APK_DIR)) throw new Error(`找不到产物目录：${APK_DIR}`)
  if (!fs.existsSync(DIST)) fs.mkdirSync(DIST, { recursive: true })

  // 只归档 arm64-v8a 和 universal：前者给真机覆盖升级，后者给全新安装
  const wanted = [
    { abi: 'arm64-v8a', file: `em-music-v${version}-arm64-v8a.apk` },
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
  console.log('注意：arm64 包可覆盖升级；universal 包的 versionCode 不带 ABI 后缀，只能全新安装。')
}

main()
