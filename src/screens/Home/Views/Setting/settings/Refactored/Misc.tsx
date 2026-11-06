import { View } from 'react-native'
import Section from '../../components/Section'
import ResourceCache from '../Other/ResourceCache'
import MetaCache from '../Other/MetaCache'
import Log from '../Other/Log'
import DislikeList from '../Other/DislikeList'
import About from '../About'

export default () => (
  <View>
    <Section title='缓存' icon='database-outline'>
      <ResourceCache />
      <MetaCache />
    </Section>
    <Section title='其他' icon='dots-horizontal-circle-outline'>
      <DislikeList />
    </Section>
    <Section title='日志' icon='text-box-outline'>
      <Log />
    </Section>
    <View style={{ marginTop: 10 }}>
      <About />
    </View>
  </View>
)
