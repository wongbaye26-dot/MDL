import { memo, useState, useEffect, useRef } from 'react'

import { StyleSheet, View, Keyboard } from 'react-native'
import type { InputType, InputProps } from '@/components/common/Input'
import Input from '@/components/common/Input'
import { useTheme } from '@/store/theme/hook'
import Text from '@/components/common/Text'


export interface InputItemProps extends InputProps {
  value: string
  label: string
  onChanged: (text: string, callback: (vlaue: string) => void) => void
}

export default memo(({ value, label, onChanged, ...props }: InputItemProps) => {
  const [text, setText] = useState(value)
  const textRef = useRef(value)
  const isMountRef = useRef(false)
  const inputRef = useRef<InputType>(null)
  const theme = useTheme()
  const saveValue = () => {
    onChanged?.(text, (value: string) => {
      if (!isMountRef.current) return
      const newValue = String(value)
      setText(newValue)
      textRef.current = newValue
    })
  }
  useEffect(() => {
    isMountRef.current = true
    return () => {
      isMountRef.current = false
    }
  }, [])
  useEffect(() => {
    const handleKeyboardDidHide = () => {
      if (!inputRef.current?.isFocused()) return
      onChanged?.(textRef.current, value => {
        if (!isMountRef.current) return
        const newValue = String(value)
        setText(newValue)
        textRef.current = newValue
      })
    }
    const keyboardDidHide = Keyboard.addListener('keyboardDidHide', handleKeyboardDidHide)

    return () => {
      keyboardDidHide.remove()
    }
  }, [onChanged])
  useEffect(() => {
    if (value != text) {
      const newValue = String(value)
      setText(newValue)
      textRef.current = newValue
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  const handleSetSelectMode = (text: string) => {
    setText(text)
    textRef.current = text
  }
  return (
    <View style={styles.container}>
      <Text style={styles.label} size={13}>{label}</Text>
      <Input
        value={text}
        ref={inputRef}
        onChangeText={handleSetSelectMode}
        style={{ ...styles.input, backgroundColor: theme['c-primary-alpha-800'], color: theme['c-font'] }}
        {...props}
        onBlur={saveValue}
       />
    </View>
  )
})

const styles = StyleSheet.create({
  container: {
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 13,
    paddingBottom: 13,
  },
  label: {
    marginBottom: 8,
  },
  input: {
    flexGrow: 1,
    flexShrink: 1,
    borderRadius: 14,
    height: 40,
    paddingLeft: 12,
    paddingRight: 12,
    maxWidth: 300,
  },
})
