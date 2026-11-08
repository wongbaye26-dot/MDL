#!/usr/bin/env node
/**
 * 拉取 4 个本地 fork 的原生依赖到 ../vendor。
 *
 * 为什么需要这一步：
 * package.json 里这 4 个依赖是 `file:../vendor/xxx` —— 指向仓库**外面**的目录，
 * 新机器 clone 下来直接 `npm i` 会失败，CI 更是装不起来。
 * 它们都是 lyswhut 的公开 fork，所以用脚本按 commit 精确拉取，比把 31MB 源码塞进仓库干净。
 *
 * 用法：
 *   node scripts/setup-vendor.js          # 缺什么拉什么，已存在且 commit 正确就跳过
 *   node scripts/setup-vendor.js --force  # 强制重新拉取
 */

const { execSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

/** 仓库根目录的上一级就是 vendor 所在位置 */
const VENDOR_DIR = path.join(__dirname, '../../vendor')

/** 钉死 commit：升级依赖必须同时改这里，否则不同机器装出来的原生代码会不一样 */
const PACKAGES = [
  {
    name: 'react-native-track-player',
    url: 'https://github.com/lyswhut/react-native-track-player.git',
    commit: 'd76fe8ff483548a022f29e8b3e8f33111e9c28b6',
    note: '播放内核。fork 里加了 updateNowPlayingTitles / isCached / getCacheSize / clearCache',
  },
  {
    name: 'react-native-file-system',
    url: 'https://github.com/lyswhut/react-native-file-system.git',
    commit: 'fcb0e6f55af684ac60598c720c77cfe0502f2c65',
    note: '文件读写（含 SAF）。fork 的 package.json 里 types 指向不存在的文件，靠 dependencies-patch.js 修',
  },
  {
    name: 'react-native-local-media-metadata',
    url: 'https://github.com/lyswhut/react-native-local-media-metadata.git',
    commit: '1b5be310d112afce0df598d3e9c7521c3311049c',
    note: '读音频标签/封面。fork 里补了 sampleRate 字段（dependencies-patch.js 打补丁）',
  },
  {
    name: 'react-native-background-timer',
    url: 'https://github.com/lyswhut/react-native-background-timer.git',
    commit: '55ecaa80880e9cec1fff81f3ce10e6250ab3c40c',
    note: '后台计时器，切歌去抖和睡眠定时用',
  },
]

const sh = (cmd, cwd) => execSync(cmd, { cwd, stdio: 'inherit' })

const currentCommit = (dir) => {
  try {
    return execSync('git rev-parse HEAD', { cwd: dir, encoding: 'utf8' }).trim()
  } catch {
    return null
  }
}

/**
 * 每次（无论新拉还是已存在）都要做的一致性处理。
 *
 * 为什么不放在 clone 分支里：已存在的 vendor 目录会走 skip 分支，
 * 之前的写法导致「新增的归一化规则」在旧机器上永远不生效。
 */
const normalize = (pkg, dir) => {
  // 让 vendor 包的 prepare / tsc 能解析到根项目的 react-native 类型和 rimraf/tsc
  const moduleLink = path.join(dir, 'node_modules')
  try {
    if (!fs.existsSync(moduleLink)) fs.symlinkSync(path.join(__dirname, '../node_modules'), moduleLink, 'dir')
  } catch {}

  // 软链装法（没有 install-links）时 dependencies-patch 会写进 vendor 工作树；
  // 现在补丁以 node_modules 为准，vendor 应保持干净。只提示，不擅自 reset。
  try {
    // package.json 是本脚本自己归一化改的、node_modules 是软链，都不算「补丁残留」。
    const dirty = execSync('git status --porcelain', { cwd: dir, encoding: 'utf8' })
      .split('\n')
      .map(line => line.trim())
      .filter(line =>
        line &&
        !line.includes('package.json') &&
        !line.includes('node_modules') &&
        !line.includes('build/'), // Gradle 构建产物，不是补丁残留
      )
    if (dirty.length) {
      console.warn(`⚠ ${pkg.name} 工作树有本地修改（可能是历史补丁残留）：${dirty.join(', ')}`)
      console.warn('  补丁以 node_modules 为准；需要干净源码可执行：')
      console.warn(`  git -C ${JSON.stringify(dir)} checkout -- .`)
    }
  } catch {}

  const pkgFile = path.join(dir, 'package.json')
  const json = JSON.parse(fs.readFileSync(pkgFile, 'utf8'))
  let changed = false

  // 这两个包的 Metro 入口是 src（dependencies-patch.js 会把 types 指到 src），
  // 不需要 bob 产物；删掉 prepare，避免 npm i 时因缺少 bob 直接失败。
  if (pkg.name === 'react-native-file-system' || pkg.name === 'react-native-local-media-metadata') {
    if (json.scripts?.prepare) {
      delete json.scripts.prepare
      changed = true
    }
  }

  // track-player 的 prepare 是 `rimraf lib && tsc`，需要根 node_modules 里的 rimraf/tsc。
  // 干净环境 npm ci 时根依赖还没装好，prepare 必失败（CI 2026-11-04 的失败即此链路）。
  // 处理：去掉 prepare，改由 dependencies-patch.js 在 postinstall 里用根 tsc 生成 lib；
  // 同时把 src/tsconfig 加进 files 白名单，保证 install-links 物化到 node_modules 后仍能就地构建。
  if (pkg.name === 'react-native-track-player') {
    if (json.scripts?.prepare) {
      delete json.scripts.prepare
      changed = true
    }
    const files = ['lib/**/*', 'ios/**/*', 'android/**/*', 'src/**/*', 'tsconfig.json', '*.podspec']
    if (JSON.stringify(json.files) !== JSON.stringify(files)) {
      json.files = files
      changed = true
    }
  }

  if (changed) fs.writeFileSync(pkgFile, JSON.stringify(json, null, 2) + '\n')
}

const main = () => {
  const force = process.argv.includes('--force')
  if (!fs.existsSync(VENDOR_DIR)) fs.mkdirSync(VENDOR_DIR, { recursive: true })

  let cloned = 0
  for (const pkg of PACKAGES) {
    const dir = path.join(VENDOR_DIR, pkg.name)
    const hasGit = fs.existsSync(path.join(dir, '.git'))

    if (hasGit && !force) {
      const cur = currentCommit(dir)
      if (cur === pkg.commit) {
        console.log(`✅ ${pkg.name} 已就位 (${cur.slice(0, 8)})`)
        normalize(pkg, dir)
        continue
      }
      console.log(`↻ ${pkg.name} commit 不符（当前 ${cur?.slice(0, 8) ?? '?'}，期望 ${pkg.commit.slice(0, 8)}），重新拉取`)
      fs.rmSync(dir, { recursive: true, force: true })
    } else if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true })
    }

    console.log(`⬇ 拉取 ${pkg.name} …`)
    sh('git init -q', VENDOR_DIR)
    sh(`git clone --quiet ${pkg.url} ${JSON.stringify(pkg.name)}`, VENDOR_DIR)
    sh(`git checkout --quiet ${pkg.commit}`, dir)
    normalize(pkg, dir)
    cloned += 1
    console.log(`✅ ${pkg.name} @ ${pkg.commit.slice(0, 8)}`)
  }

  console.log(`\n完成：新拉取 ${cloned} 个，其余已就位。`)
  console.log('接下来跑 `npm i`（postinstall 会执行 dependencies-patch.js；track-player 的 lib 会在那里用 tsc 生成）。')
}

main()
