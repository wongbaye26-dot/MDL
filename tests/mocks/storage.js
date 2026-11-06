/** 单测里的存储替身：索引模块只 import 不执行，给个纯内存实现即可。 */
const data = new Map()
exports.getData = async key => data.get(key)
exports.saveData = async(key, value) => { data.set(key, value) }
exports.removeData = async key => { data.delete(key) }
