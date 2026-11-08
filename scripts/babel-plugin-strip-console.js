/** release 构建移除 console.log/debug，保留 warn/error；避免生产日志泄漏与噪音 */
module.exports = function stripConsole({ types }) {
  return {
    name: 'strip-console',
    visitor: {
      CallExpression(path) {
        const callee = path.get('callee')
        if (!callee.isMemberExpression()) return
        const obj = callee.get('object')
        const prop = callee.get('property')
        if (!obj.isIdentifier({ name: 'console' })) return
        const method = prop.isIdentifier() ? prop.node.name : ''
        if (!['log', 'debug', 'info'].includes(method)) return
        // 只处理独立的 console.xxx(...) 语句，保留作为表达式返回值的情况
        if (!path.parentPath.isExpressionStatement()) return
        path.parentPath.remove()
      },
    },
  }
}
