import { useEffect, useMemo, useState } from 'react'
import Home from '../Views/Home'
import Download from '../Views/Download'
import Mine from '../Views/Mine'
import Player from '../Views/Player'
import LocalMusic from '../Views/LocalMusic'
import commonState, { type InitState as CommonState } from '@/store/common/state'


const Main = () => {
  const [id, setId] = useState(commonState.navActiveId)

  useEffect(() => {
    const handleUpdate = (id: CommonState['navActiveId']) => {
      requestAnimationFrame(() => {
        setId(id)
      })
    }
    global.state_event.on('navActiveIdUpdated', handleUpdate)
    return () => {
      global.state_event.off('navActiveIdUpdated', handleUpdate)
    }
  }, [])

  const component = useMemo(() => {
    switch (id) {
      case 'nav_download': return <Download />
      case 'nav_local': return <LocalMusic />
      case 'nav_mine': return <Mine />
      case 'nav_player': return <Player />
      default: return <Home />
    }
  }, [id])

  return component
}


export default Main

