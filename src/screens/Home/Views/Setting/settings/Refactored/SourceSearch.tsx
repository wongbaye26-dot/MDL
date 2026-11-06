import { View } from 'react-native'
import Section from '../../components/Section'
import Source from '../Source'
import IsShowHistorySearch from '../Search/IsShowHistorySearch'
import IsShowHotSearch from '../Search/IsShowHotSearch'

export default () => (
  <View>
    <Source />
    <Section title='搜索' icon='magnify'>
      <IsShowHistorySearch />
      <IsShowHotSearch />
    </Section>
  </View>
)
