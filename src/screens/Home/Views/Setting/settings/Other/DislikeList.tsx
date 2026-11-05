import { memo, useRef } from 'react'
import { View } from 'react-native'

import SettingRow from '../../components/SettingRow'
import Button from '../../components/Button'
import { toast, createStyle } from '@/utils/tools'
import { useI18n } from '@/lang'
import { state, useRuleNum } from '@/store/dislikeList'
import DislikeEditModal, { type DislikeEditModalType } from './DislikeEditModal'
import { overwirteDislikeInfo } from '@/core/dislikeList'

/**
 * 「不喜欢的歌曲」规则：统一成设置页通用行 + 右侧编辑按钮。
 */
export default memo(() => {
  const t = useI18n()
  const modalRef = useRef<DislikeEditModalType>(null)
  const ruleNum = useRuleNum()

  const handleShow = () => {
    modalRef.current?.show(state.dislikeInfo.rules)
  }

  const handleSave = async(rules: string) => {
    if (state.dislikeInfo.rules.trim() == rules.trim()) return
    await overwirteDislikeInfo(rules)
    toast(t('setting__other_dislike_list_saved_tip'))
  }

  return (
    <View>
      <SettingRow
        icon='heart-off-outline'
        title={t('setting__other_dislike_list')}
        desc={t('setting__other_dislike_list_label', { num: ruleNum })}
        right={<View style={styles.rightBtn}><Button onPress={handleShow}>{t('setting_other_dislike_list_show_btn')}</Button></View>}
      />
      <DislikeEditModal ref={modalRef} onSave={handleSave} />
    </View>
  )
})

const styles = createStyle({
  rightBtn: {
    marginRight: -10,
  },
})
