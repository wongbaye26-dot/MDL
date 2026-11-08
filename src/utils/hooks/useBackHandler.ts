import { useEffect } from 'react'
import { BackHandler } from 'react-native'

export function useBackHandler(handler: () => boolean) {
  useEffect(() => {
    // RN 0.77 起 BackHandler.removeEventListener 已移除，统一用 subscription.remove()
    const subscription = BackHandler.addEventListener('hardwareBackPress', handler)

    return () => {
      subscription.remove()
    }
  }, [handler])
}
