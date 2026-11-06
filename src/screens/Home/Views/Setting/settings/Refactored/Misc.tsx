import { View } from 'react-native'
import { Group, UiSectionTitle } from '../../components/ui'
import ResourceCache from '../Other/ResourceCache'
import MetaCache from '../Other/MetaCache'
import Log from '../Other/Log'
import DislikeList from '../Other/DislikeList'
import About from '../About'
import { useI18n } from '@/lang'

export default () => {
  const t = useI18n()
  return (
    <View>
      <Group title='缓存' icon='database-outline' color='#F59E0B'>
        <ResourceCache />
        <MetaCache />
      </Group>
      <Group title='不喜欢规则' icon='heart-off-outline' color='#EC4899'>
        <DislikeList />
      </Group>
      <Group title='日志' icon='text-box-outline' color='#64748B'>
        <Log />
      </Group>
      <UiSectionTitle title={t('setting_about')} />
      <About />
    </View>
  )
}
