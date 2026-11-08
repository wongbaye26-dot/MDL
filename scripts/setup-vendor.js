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
    // 这两个包的 Metro 入口是 src（已由 dependencies-patch.js 改 types），
    // 不需要 bob 产物；删掉 prepare，避免 npm i 时因缺少 bob 直接失败。
    if (pkg.name === 'react-native-file-system' || pkg.name === 'react-native-local-media-metadata') {
      const pkgFile = path.join(dir, 'package.json')
      const json = JSON.parse(fs.readFileSync(pkgFile, 'utf8'))
      if (json.scripts?.prepare) {
        delete json.scripts.prepare
        fs.writeFileSync(pkgFile, JSON.stringify(json, null, 2) + '\n')
      }
    }
    cloned += 1
    console.log(`✅ ${pkg.name} @ ${pkg.commit.slice(0, 8)}`)
  }

  console.log(`\n完成：新拉取 ${cloned} 个，其余已就位。`)
  console.log('接下来跑 `npm i`（会执行 postinstall 里的 dependencies-patch.js）。')
}

main()
