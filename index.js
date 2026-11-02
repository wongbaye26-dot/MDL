/**
 * @format
 */
import './shim'

/* eslint-disable import/first */
/* global ErrorUtils */
/*
  网络请求失败时，某些请求库会用 `new Response(body, { status: 0 })` 收尾，
  而 Response 只接受 200~599 —— 于是抛 RangeError 冒到界面上，变成一条「应用错误」小字。
  这不是真的应用错误（业务已经走 catch 分支了），这里直接吞掉。
*/
const __defaultErrorHandler = ErrorUtils.getGlobalHandler()
ErrorUtils.setGlobalHandler((error, isFatal) => {
  if (String((error && error.message) || '').includes("Failed to construct 'Response'")) return
  __defaultErrorHandler(error, isFatal)
})
import './src/app'
// import './test'
// import '@/utils/errorHandle'
// import { Navigation } from 'react-native-navigation'
// import App from './App'

// Navigation.registerComponent('com.myApp.WelcomeScreen', () => App)
// Navigation.events().registerAppLaunchedListener(() => {
//   Navigation.setRoot({
//     root: {
//       stack: {
//         children: [
//           {
//             component: {
//               name: 'com.myApp.WelcomeScreen',
//             },
//           },
//         ],
//       },
//     },
//   })
// })
