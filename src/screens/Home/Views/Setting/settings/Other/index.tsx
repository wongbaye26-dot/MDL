import { memo } from 'react'

import Section from '../../components/Section'
import ResourceCache from './ResourceCache'
import MetaCache from './MetaCache'
import DislikeList from './DislikeList'
import Log from './Log'
import Permissions from './Permissions'
import DeviceCompat from './DeviceCompat'

export default memo(() => {
  return (
    <>
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
      <Permissions />
      <DeviceCompat />
    </>
  )
})
