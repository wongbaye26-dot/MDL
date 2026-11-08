import { useEffect, useState } from 'react'
import { AppState } from 'react-native'

/** App 是否在前台（用于暂停装饰动画/循环动画，省电） */
export default (): boolean => {
  const [active, setActive] = useState(AppState.currentState === 'active')

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      setActive(state === 'active')
    })
    return () => { subscription.remove() }
  }, [])

  return active
}
