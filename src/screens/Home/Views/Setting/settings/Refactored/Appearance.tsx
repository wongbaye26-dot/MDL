import { View } from 'react-native'
import Section from '../../components/Section'
import { ThemeModeSelector, MaterialYouColors } from '../Basic/ThemeSettings'
import IsHomePageScroll from '../Basic/IsHomePageScroll'
import IsReduceMotion from '../Basic/IsReduceMotion'
import IsHomeCardMotion from '../Basic/IsHomeCardMotion'
import IsCoverRotation from '../Basic/IsCoverRotation'
import FontSize from '../Basic/FontSize'
import Language from '../Basic/Language'
import SourceName from '../Basic/SourceName'
import ShareType from '../Basic/ShareType'
import NavSwipeSwitch from '../Player/NavSwipeSwitch'
import NavProgressStyle from '../Player/NavProgressStyle'
import NavGlassStyle from '../Player/NavGlassStyle'

export default () => (
  <View>
    <Section title='外观' icon='palette-outline'>
      <ThemeModeSelector />
    </Section>
    <Section title='主题色' icon='palette-swatch-outline'>
      <MaterialYouColors />
    </Section>
    <Section title='界面' icon='cellphone'>
      <IsHomePageScroll />
      <IsReduceMotion />
      <IsHomeCardMotion />
      <IsCoverRotation />
      <FontSize />
      <Language />
      <SourceName />
    </Section>
    <Section title='导航与动效' icon='gesture-swipe-horizontal'>
      <NavGlassStyle />
      <NavProgressStyle />
      <NavSwipeSwitch />
    </Section>
    <Section title='分享' icon='share-variant-outline'>
      <ShareType />
    </Section>
  </View>
)
