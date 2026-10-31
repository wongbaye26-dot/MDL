export {}

// 主题相关设置项，单独声明以避免修改体积较大的 app_setting.d.ts
declare global {
  namespace LX {
    interface AppSetting {
      /**
       * Material You 种子色（十六进制），为空时使用内置主题
       */
      'theme.seedColor': string

      /**
       * 是否使用 Material You 动态主题（由种子色生成）
       */
      'theme.useSeed': boolean

      /**
       * Material You 主题在非跟随系统模式下的明暗偏好
       */
      'theme.seedDark': boolean
    }
  }
}
