/**
 * 零新增依赖的 TS 测试注册器：复用仓库已有的 Babel 依赖，把 TS/路径别名
 * 转成 Node 可执行的 CommonJS，供 `node --test` 使用。
 */
require('@babel/register')({
  extensions: ['.ts', '.tsx', '.js', '.jsx'],
  configFile: false,
  babelrc: false,
  presets: [
    ['@babel/preset-env', { targets: { node: 'current' } }],
    '@babel/preset-typescript',
  ],
  plugins: [
    ['module-resolver', {
      root: ['.'],
      alias: {
        '@/plugins/storage': './tests/mocks/storage.js',
        '@': './src',
      },
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    }],
  ],
  ignore: [/node_modules/],
  cache: false,
})
