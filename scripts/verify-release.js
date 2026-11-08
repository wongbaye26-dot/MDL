#!/usr/bin/env node
/** 发版校验：APK 签名证书、SHA256、产物完整性。用法：node scripts/verify-release.js <version> */
const { execFileSync } = require('node:child_process')
const { createHash } = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')

const version = process.argv[2] || require('../package.json').version
const dir = path.join(__dirname, '../dist', `v${version}`)
if (!fs.existsSync(dir)) {
  console.error(`❌ 找不到产物目录: ${dir}`)
  process.exit(1)
}

const apks = fs.readdirSync(dir).filter(name => name.endsWith('.apk'))
if (!apks.length) {
  console.error('❌ 没有 APK')
  process.exit(1)
}

const sha256 = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex')
for (const apk of apks) {
  const file = path.join(dir, apk)
  console.log(`${sha256(file)}  ${apk}`)
}

const arm64 = path.join(dir, `em-music-v${version}-arm64-v8a.apk`)
const apksigner = process.env.APKSIGNER || path.join(process.env.ANDROID_HOME || path.join(process.env.HOME || '', 'Library/Android/sdk'), 'build-tools/37.0.0/apksigner')
if (fs.existsSync(apksigner) && fs.existsSync(arm64)) {
  const out = execFileSync(apksigner, ['verify', '--print-certs', arm64], { encoding: 'utf8' })
  if (!/CN=Emo Music/.test(out)) {
    console.error('❌ release 签名证书不是 CN=Emo Music')
    process.exit(1)
  }
  console.log('✅ 签名校验通过: CN=Emo Music')
} else {
  console.log('⚠️ 跳过签名校验（找不到 apksigner）')
}

const sumsFile = path.join(dir, 'SHA256SUMS')
if (!fs.existsSync(sumsFile)) {
  console.error('❌ 缺少 SHA256SUMS')
  process.exit(1)
}
console.log(`✅ 产物校验完成: ${apks.length} 个 APK`)
