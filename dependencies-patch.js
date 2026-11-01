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
]

;(async() => {
  for (const [filePath, fromStr, toStr] of patchs) {
    console.log(`Patching ${filePath.replace(rootPath, '')}`)
    try {
      const file = (await fs.promises.readFile(filePath)).toString()
      await fs.promises.writeFile(filePath, file.replace(fromStr, toStr))
    } catch (err) {
      console.error(`Patch ${filePath.replace(rootPath, '')} failed: ${err.message}`)
    }
  }
  console.log('\nDependencies patch finished.\n')
})()

