#!/usr/bin/env node
/**
 * 打印 release 签名信息（不打印密码）。
 *
 * 用途：确认「这次出包用的是不是同一把钥匙」。
 * 签名不一致会导致老用户无法覆盖升级（只能卸载重装、数据全丢），
 * 而这件事只有真正升级失败时才会暴露 —— 所以定期核对一下指纹。
 *
 * 用法：node scripts/keystore-info.js
 */

const { execSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.join(__dirname, '..')
const PROPS = path.join(ROOT, 'android/keystore.properties')

const main = () => {
  if (!fs.existsSync(PROPS)) {
    console.error(`❌ 找不到 ${path.relative(ROOT, PROPS)}`)
    console.error('   release 包必须用固定密钥签名，否则老用户无法覆盖升级。')
    process.exit(1)
  }

  const props = {}
  for (const line of fs.readFileSync(PROPS, 'utf8').split('\n')) {
    const m = /^\s*([\w.]+)\s*=\s*(.*)\s*$/.exec(line)
    if (m) props[m[1]] = m[2]
  }

  const storeFile = props.storeFile
  const alias = props.keyAlias
  const storePass = props.storePassword
  const keyPass = props.keyPassword ?? storePass

  if (!storeFile) {
    console.error('❌ keystore.properties 里没有 storeFile')
    process.exit(1)
  }

  // storeFile 可能是相对 android/ 或相对 android/app/ 的写法，两处都找一下
  const candidates = path.isAbsolute(storeFile)
    ? [storeFile]
    : [path.join(ROOT, 'android', storeFile), path.join(ROOT, 'android/app', storeFile)]
  const abs = candidates.find(p => fs.existsSync(p)) ?? candidates[0]

  console.log(`密钥文件: ${path.relative(ROOT, abs)}`)
  console.log(`别名    : ${alias ?? '(未配置)'}`)
  if (!fs.existsSync(abs)) {
    console.error(`❌ 密钥文件不存在，试过：\n  ${candidates.map(p => path.relative(ROOT, p)).join('\n  ')}`)
    process.exit(1)
  }

  // 只输出指纹，绝不打印密码
  try {
    const out = execSync(
      `keytool -list -v -keystore ${JSON.stringify(abs)} -alias ${JSON.stringify(alias)} -storepass ${JSON.stringify(storePass)} -keypass ${JSON.stringify(keyPass)}`,
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    )
    const sha256 = /SHA256:\s*([0-9A-F:]+)/i.exec(out)?.[1]
    const sha1 = /SHA1:\s*([0-9A-F:]+)/i.exec(out)?.[1]
    const valid = /Valid from:.*?until:\s*(.+)/i.exec(out)?.[1]
    console.log(`SHA-256 : ${sha256 ?? '(读不到)'}`)
    console.log(`SHA-1   : ${sha1 ?? '(读不到)'}`)
    if (valid) console.log(`有效期至: ${valid.trim()}`)
    console.log('\n把上面两行指纹记到密码管理器里，连同密钥文件的加密备份。')
    console.log('密钥丢了 = 老用户只能卸载重装（本地数据全丢），没有别的补救办法。')
  } catch (err) {
    console.error('⚠ 读取失败（可能没装 JDK / keytool 不在 PATH，或密码不对）')
    console.error(`  ${String(err.message).split('\n')[0]}`)
    console.error('  但密钥文件本身存在，记得备份它和 keystore.properties。')
    process.exit(1)
  }
}

main()
