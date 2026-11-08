module.exports = (api) => {
  const isProd = api.env('production')
  return {
    presets: ['module:@react-native/babel-preset'],
    plugins: [
      ...(isProd ? ['./scripts/babel-plugin-strip-console.js'] : []),
      '@babel/plugin-proposal-export-namespace-from',
      [
        'module-resolver',
        {
          root: ['.'],
          extensions: [
            '.android.ts',
            '.ios.ts',
            '.android.tsx',
            '.ios.tsx',
            '.tsx',
            '.ts',
            '.android.js',
            '.ios.js',
            '.android.jsx',
            '.ios.jsx',
            '.jsx',
            '.js',
            '.json',
          ],
          alias: {
            '@': './src',
          // '@config': './src/config',
          // '@store': './src/store',
          // '@components': './src/components',
          // '@navigation': './src/navigation',
          // '@screens': './src/screens',
          // '@theme': './src/theme',
          },
        },
      ],
    ],
  }
}
