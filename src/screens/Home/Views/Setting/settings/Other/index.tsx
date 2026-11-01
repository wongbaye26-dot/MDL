import { memo } from 'react'

import Section from '../../components/Section'
import ResourceCache from './ResourceCache'
import MetaCache from './MetaCache'
import DislikeList from './DislikeList'
import Log from './Log'
import Permissions from './Permissions'

export default memo(() => {
  return (
    <>
      <Section title='缓存'>
        <ResourceCache />
        <MetaCache />
      </Section>
      <Section title='其他'>
        <DislikeList />
        <Log />
      </Section>
      <Permissions />
    </>
  )
})
