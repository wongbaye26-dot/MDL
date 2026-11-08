#!/usr/bin/env node
/**
 * 发版校验：APK 签名证书、SHA256、产物完整性。
 *
 * 用法：node scripts/verify-release.js [version]
 *
 * 产物位置兼容两种归档方式：
 *  - `../dist/v<version>/`（旧 flow，per-version 子目录 + SHA256SUMS）
 *  - `../dist/EmoMusic-v<version>-<abi>.apk`（当前 scripts/release.js 的扁平归档）
 */
const { execFileSync } = require('node:child_process')
const { createHash } = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')

const version = process.argv[2] || require('../package.json').version
const DIST = path.join(__dirname, '../../dist') // 与 scripts/release.js 的归档目录一致
const versionedDir = path.join(DIST, `v${version}`)
const dir = fs.existsSync(versionedDir) ? versionedDir : DIST

if (!fs.existsSync(dir)) {
  console.error(`❌ 找不到产物目录: ${dir}`)
  process.exit(1)
}

// 只校验「当前版本」的包，避免把 dist 里历史版本也算进来
const apks = fs.readdirSync(dir)
  .filter(name => name.endsWith('.apk') && name.includes(`v${version}-`))
  .sort()
if (!apks.length) {
  console.error(`❌ 没有 v${version} 的 APK（目录：${dir}）`)
  process.exit(1)
}

const sha256 = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const actual = {}
for (const apk of apks) {
  const file = path.join(dir, apk)
  actual[apk] = sha256(file)
  console.log(`${actual[apk]}  ${apk}`)
}

/** 找一个可用的 apksigner（优先 $APKSIGNER，其次 Android SDK build-tools 里最新的一版） */
const findApksigner = () => {
  if (process.env.APKSIGNER) return process.env.APKSIGNER
  const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT ||
    path.join(process.env.HOME || '', 'Library/Android/sdk')
  const buildTools = path.join(sdk, 'build-tools')
  if (!fs.existsSync(buildTools)) return null
  const candidates = fs.readdirSync(buildTools)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .reverse()
    .map(v => path.join(buildTools, v, 'apksigner'))
  return candidates.find(p => fs.existsSync(p)) || null
}

const arm64 = path.join(dir, apks.find(apk => apk.includes('arm64-v8a')) || '')
const apksigner = findApksigner()
if (apksigner && arm64 && fs.existsSync(arm64)) {
  const out = execFileSync(apksigner, ['verify', '--print-certs', arm64], { encoding: 'utf8' })
  if (!/CN=Emo Music/.test(out)) {
    console.error('❌ release 签名证书不是 CN=Emo Music')
    process.exit(1)
  }
  console.log(`✅ 签名校验通过: CN=Emo Music（${path.basename(apksigner)}）`)
} else {
  console.log('⚠️ 跳过签名校验（找不到 apksigner 或 arm64 包）')
}

// per-version 目录里的 SHA256SUMS 是可选的历史约定；存在就核对，不存在只提示。
const sumsFile = path.join(dir, 'SHA256SUMS')
if (fs.existsSync(sumsFile)) {
  const lines = fs.readFileSync(sumsFile, 'utf8').trim().split(/\r?\n/).filter(Boolean)
  let bad = 0
  for (const line of lines) {
    const [hash, name] = line.trim().split(/\s+/)
    if (!name || !actual[name]) continue
    if (actual[name] !== hash) {
      console.error(`❌ SHA256 不匹配: ${name}`)
      bad += 1
    }
  }
  if (bad) process.exit(1)
  console.log('✅ SHA256SUMS 校验通过')
} else {
  console.log('ℹ️ 未找到 SHA256SUMS（当前 release.js 扁平归档不生成），已打印实际 SHA256 供发行说明使用')
}

console.log(`✅ 产物校验完成: v${version} 共 ${apks.length} 个 APK`)
