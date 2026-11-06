import { View } from 'react-native'
import Section from '../../components/Section'
import IsClickPlayList from '../List/IsClickPlayList'
import IsShowAlbumName from '../List/IsShowAlbumName'
import IsShowInterval from '../List/IsShowInterval'
import Tools from '../Tools'

export default () => (
  <View>
    <Section title='列表显示' icon='format-list-bulleted'>
      <IsClickPlayList />
      <IsShowAlbumName />
      <IsShowInterval />
    </Section>
    <View style={{ marginTop: 10 }}>
      <Tools />
    </View>
  </View>
)
