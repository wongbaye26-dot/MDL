import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import Dialog, { type DialogType } from '@/components/common/Dialog'
import { toast } from '@/utils/tools'
import { View } from 'react-native'
import Text from '@/components/common/Text'
import List from './List'
import { useI18n } from '@/lang'
import { addListMusics, moveListMusics } from '@/core/list'
import settingState from '@/store/setting/state'

export interface SelectInfo {
  selectedList: LX.Music.MusicInfo[]
  listId: string
  isMove: boolean
  // single: boolean
}
const initSelectInfo = { selectedList: [], listId: '', isMove: false }

export interface MusicMultiAddModalProps {
  onAdded?: () => void
  // onRename: (listInfo: LX.List.UserListInfo) => void
  // onImport: (listInfo: LX.List.MyListInfo, index: number) => void
  // onExport: (listInfo: LX.List.MyListInfo, index: number) => void
  // onSync: (listInfo: LX.List.UserListInfo) => void
  // onRemove: (listInfo: LX.List.UserListInfo) => void
}
export interface MusicMultiAddModalType {
  show: (info: SelectInfo) => void
}

export default forwardRef<MusicMultiAddModalType, MusicMultiAddModalProps>(({ onAdded }, ref) => {
  const t = useI18n()
  const dialogRef = useRef<DialogType>(null)
  const [selectInfo, setSelectInfo] = useState<SelectInfo>(initSelectInfo)

  useImperativeHandle(ref, () => ({
    show(selectInfo) {
      setSelectInfo(selectInfo)

      requestAnimationFrame(() => {
        dialogRef.current?.setVisible(true)
      })
    },
  }))

  const handleHide = () => {
    requestAnimationFrame(() => {
      setSelectInfo({ ...selectInfo, selectedList: [] })
    })
  }

  const handleSelect = (listInfo: LX.List.MyListInfo) => {
    dialogRef.current?.setVisible(false)
    if (selectInfo.isMove) {
      void moveListMusics(selectInfo.listId, listInfo.id,
        [...selectInfo.selectedList],
        settingState.setting['list.addMusicLocationType'],
      ).then(() => {
        onAdded?.()
        toast(t('list_edit_action_tip_move_success'))
      }).catch(() => {
        toast(t('list_edit_action_tip_move_failed'))
      })
    } else {
      void addListMusics(listInfo.id,
        [...selectInfo.selectedList],
        settingState.setting['list.addMusicLocationType'],
      ).then(() => {
        onAdded?.()
        toast(t('list_edit_action_tip_add_success'))
      }).catch(() => {
        toast(t('list_edit_action_tip_add_failed'))
      })
    }
  }

  return (
    <Dialog ref={dialogRef} onHide={handleHide}>
      {
        selectInfo.selectedList.length
          ? (
              <View>
                <View style={{ paddingLeft: 20, paddingRight: 20, paddingTop: 4, paddingBottom: 12 }}>
                  <Text size={12} color='#9E9E9E' numberOfLines={1}>
                    {selectInfo.isMove ? '移动' : '添加'} {selectInfo.selectedList.length} 首到歌单
                  </Text>
                </View>
                <List listId={selectInfo.listId} onPress={handleSelect} />
              </View>
            )
          : null
      }
    </Dialog>
  )
})

