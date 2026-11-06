// @flow

import { Navigation } from 'react-native-navigation'

import {
  Home,
  SongListScreen,
  SonglistDetail,
  // Setting,
} from '@/screens'
import { Provider } from '@/store/Provider'

import {
  HOME_SCREEN,
  SONGLIST_SCREEN,
  SONGLIST_DETAIL_SCREEN,
  VERSION_MODAL,
  PACT_MODAL,
  // SETTING_SCREEN,
} from './screenNames'
import VersionModal from './components/VersionModal'
import PactModal from './components/PactModal'

function WrappedComponent(Component: any) {
  return function inject(props: Record<string, any>) {
    const EnhancedComponent = () => (
      <Provider>
        <Component
          {...props}
        />
      </Provider>
    )

    return <EnhancedComponent />
  }
}

export default () => {
  Navigation.registerComponent(HOME_SCREEN, () => WrappedComponent(Home))
  Navigation.registerComponent(SONGLIST_SCREEN, () => WrappedComponent(SongListScreen))
  Navigation.registerComponent(SONGLIST_DETAIL_SCREEN, () => WrappedComponent(SonglistDetail))
  Navigation.registerComponent(VERSION_MODAL, () => WrappedComponent(VersionModal))
  Navigation.registerComponent(PACT_MODAL, () => WrappedComponent(PactModal))
  // Navigation.registerComponent(SETTING_SCREEN, () => WrappedComponent(Setting))

  console.info('All screens have been registered...')
}
