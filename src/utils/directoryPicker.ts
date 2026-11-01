import { NativeModules } from 'react-native'

export interface PickedDirectory {
  path: string
  name: string
}

interface DirectoryPickerModule {
  pick: () => Promise<PickedDirectory | null>
}

const nativeModule = NativeModules.DirectoryPicker as DirectoryPickerModule | undefined

/** 当前安装包是否带目录选择器（老版本/其它平台没有） */
export const isDirectoryPickerSupported = !!nativeModule?.pick

/**
 * 打开系统目录选择器（SAF）。
 * 用户取消时 resolve(null)；目录解析不出本机路径时 reject。
 */
export const pickDirectory = async(): Promise<PickedDirectory | null> => {
  if (!nativeModule?.pick) throw new Error('当前版本不支持选择目录')
  return nativeModule.pick()
}
