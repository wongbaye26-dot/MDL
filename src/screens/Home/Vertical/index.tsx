import Content from './Content'
import BottomNav from './BottomNav'
import { useNavActiveId } from '@/store/common/hook'

export default () => {
  const navActiveId = useNavActiveId()

  return (
    <>
      <Content />
      {navActiveId === 'nav_player' ? null : <BottomNav />}
    </>
  )
}
