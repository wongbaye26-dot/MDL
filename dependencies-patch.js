// 修补依赖源码以使构建的依赖恢复正常工作

const fs = require('node:fs')
const path = require('node:path')

const rootPath = path.join(__dirname, './')

const patchs = [
  // react-native-linear-gradient 2.8.3 还没适配 AGP 8，缺 namespace 会直接构建失败
  [
    path.join(rootPath, 'node_modules/react-native-linear-gradient/android/build.gradle'),
    "android {\n    compileSdkVersion safeExtGet('compileSdkVersion', 31).toInteger()",
    "android {\n    namespace 'com.BV.LinearGradient'\n    compileSdkVersion safeExtGet('compileSdkVersion', 31).toInteger()",
  ],
  // 这两个 fork 的 package.json 把 types 指到了不存在的 lib/typescript/src/index.d.ts，
  // 导致 utils/fs.ts 和 localMediaMetadata.ts 整层没有类型（TS2307 + 一串隐式 any）。
  // 源码本身是 TS，直接指向 src/index.ts 即可。
  [
    path.join(rootPath, 'node_modules/react-native-file-system/package.json'),
    '"types": "lib/typescript/src/index.d.ts"',
    '"types": "src/index.ts"',
  ],
  [
    path.join(rootPath, 'node_modules/react-native-local-media-metadata/package.json'),
    '"types": "lib/typescript/src/index.d.ts"',
    '"types": "src/index.ts"',
  ],
  // 上游的 Metadata.java 没读采样率，本地音乐列表的「44.1 kHz」就没数据源。
  // 补一行，把 jaudiotagger 拿到的采样率一起返回给 JS。
  [
    path.join(rootPath, 'node_modules/react-native-local-media-metadata/android/src/main/java/com/localmediametadata/Metadata.java'),
    '    params.putString("bitrate", audioHeader.getBitRate());',
    '    params.putString("bitrate", audioHeader.getBitRate());\n    params.putString("sampleRate", audioHeader.getSampleRate());',
  ],
]

;(async() => {
  for (const [filePath, fromStr, toStr] of patchs) {
    const label = filePath.replace(rootPath, '')
    try {
      const file = (await fs.promises.readFile(filePath)).toString()
      // 幂等：已经打过就跳过。否则像「在 bitrate 后面加一行 sampleRate」这种补丁，
      // 每跑一次就多插一行（实测跑三次就变成三行重复）。
      if (file.includes(toStr)) {
        console.log(`Skipping ${label}（已打过）`)
        continue
      }
      if (!file.includes(fromStr)) {
        console.log(`Skipping ${label}（没找到锚点，可能上游改了）`)
        continue
      }
      await fs.promises.writeFile(filePath, file.replace(fromStr, toStr))
      console.log(`Patched ${label}`)
    } catch (err) {
      console.error(`Patch ${label} failed: ${err.message}`)
    }
  }
  console.log('\nDependencies patch finished.\n')
})()

