import { useCallback, useEffect, useRef, useState } from 'react'
import { View, ScrollView, TouchableOpacity, Image } from 'react-native'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { useStatus } from '@/store/userApi'
import { useDownloadList } from '@/store/download'
import { useStatusbarHeight } from '@/store/common/hook'
import { setNavActiveId } from '@/core/common'
import playerState from '@/store/player/state'
import { getList } from '@/core/songlist'
import type { ListInfoItem } from '@/store/songlist/state'
import { createStyle } from '@/utils/tools'
import { formatSize } from '@/core/download/utils'
import SearchModal from '../../Vertical/SearchModal'
import PageModal from '../../Vertical/PageModal'
import SongList from '../SongList'
import Leaderboard from '../Leaderboard'
import Mylist from '../Mylist'
import UserApiEditModal, { type UserApiEditModalType } from '../Setting/settings/Basic/UserApiEditModal'

const emoLogo = require('@/resources/images/emo-logo.png')

type ModalType = 'songlist' | 'leaderboard' | 'mylist' | null

const ENTRIES = [
  { key: 'leaderboard', title: '排行榜', desc: '热歌 / 飙升 / 新声', icon: 'leaderboard', color: '#8B5CF6' },
  { key: 'songlist', title: '歌单广场', desc: '按分类发现好歌单', icon: 'album', color: '#EC4899' },
  { key: 'mylist', title: '我的列表', desc: '收藏与自建歌单', icon: 'love', color: '#14B8A6' },
  { key: 'source', title: '音源管理', desc: '导入 LX 音源脚本', icon: 'share', color: '#F59E0B' },
] as const

export default () => {
  const theme = useTheme()
  const statusBarHeight = useStatusbarHeight()
  const userApiStatus = useStatus()
  const downloadList = useDownloadList()
  const [searchVisible, setSearchVisible] = useState(false)
  const [modal, setModal] = useState<ModalType>(null)
  const userApiModalRef = useRef<UserApiEditModalType>(null)

  const handleEntry = useCallback((key: typeof ENTRIES[number]['key']) => {
    if (key === 'source') {
      userApiModalRef.current?.show()
      return
    }
    setModal(key)
  }, [])

  const recent = [...downloadList]
    .sort((a, b) => {
      if (a.isComplate !== b.isComplate) return a.isComplate ? 1 : -1
      return (b.createdAt ?? 0) - (a.createdAt ?? 0)
    })
    .slice(0, 4)

  const playedList = [...playerState.playedList].slice(-4).reverse()

  const [recommend, setRecommend] = useState<ListInfoItem[]>([])
  useEffect(() => {
    void getList('kw', '全部', 'hot', 1)
      .then(res => { setRecommend((res.list ?? []).slice(0, 8)) })
      .catch(() => {})
  }, [])

  const sourceReady = userApiStatus.status
  const sourceText = sourceReady ? '音源已就绪' : '音源未就绪'

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingTop: statusBarHeight + 12, paddingBottom: 24 }}>
        <View style={styles.brandRow}>
          <Image source={emoLogo} style={styles.logo} />
          <View style={styles.brandText}>
            <Text size={22} style={styles.brandName}>EMO音乐</Text>
            <Text size={11} color={theme['c-450']} style={styles.brandDesc}>
              {`全网音乐 · 聚合搜索 · ${sourceText}`}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={{ ...styles.searchBox, backgroundColor: theme['c-primary-alpha-900'], borderColor: theme['c-primary-alpha-700'] }}
          activeOpacity={0.7}
          onPress={() => { setSearchVisible(true) }}
        >
          <Icon name='search-2' size={16} color={theme['c-450']} />
          <Text size={12} color={theme['c-450']} style={styles.searchText}>搜索歌曲、歌手或专辑</Text>
          <View style={{ ...styles.searchBtn, backgroundColor: theme['c-primary'] }}>
            <Text size={11} color='#FFFFFF'>搜索</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.entryGrid}>
          {
            ENTRIES.map(entry => (
              <TouchableOpacity
                key={entry.key}
                style={{ ...styles.entry, backgroundColor: `${entry.color}22`, borderColor: `${entry.color}55` }}
                activeOpacity={0.75}
                onPress={() => { handleEntry(entry.key) }}
              >
                <View style={{ ...styles.entryIcon, backgroundColor: `${entry.color}44` }}>
                  <Icon name={entry.icon} size={18} color='#FFFFFF' />
                </View>
                <Text size={15} style={styles.entryTitle}>{entry.title}</Text>
                <Text size={10} color={theme['c-400']} numberOfLines={1} style={styles.entryDesc}>{entry.desc}</Text>
                <View style={{ ...styles.entryWatermark, backgroundColor: `${entry.color}33` }}>
                  <Icon name={entry.icon} size={44} color={`${entry.color}99`} />
                </View>
              </TouchableOpacity>
            ))
          }
        </View>

        <View style={styles.sectionHead}>
          <Text size={15} style={styles.sectionTitle}>最近下载</Text>
          <TouchableOpacity onPress={() => { setNavActiveId('nav_download') }}>
            <Text size={11} color={theme['c-450']}>全部 ›</Text>
          </TouchableOpacity>
        </View>

        {
          recent.length
            ? recent.map(task => (
                <TouchableOpacity
                  key={task.id}
                  style={styles.recentRow}
                  activeOpacity={0.7}
                  onPress={() => { setNavActiveId('nav_download') }}
                >
                  <View style={{ ...styles.recentIcon, backgroundColor: task.isComplate ? 'rgba(52, 211, 153, 0.14)' : theme['c-primary-alpha-800'] }}>
                    <Icon name={task.isComplate ? 'checkbox-marked' : 'download-2'} size={14} color={task.isComplate ? '#34D399' : theme['c-primary-light-200']} />
                  </View>
                  <View style={styles.recentInfo}>
                    <Text size={13} numberOfLines={1}>{task.metadata.musicInfo.name}</Text>
                    <Text size={10} color={theme['c-450']} numberOfLines={1} style={styles.recentDesc}>
                      {task.isComplate
                        ? `${task.metadata.musicInfo.singer} · ${task.metadata.ext.toUpperCase()} · ${formatSize(task.total)}`
                        : `${task.metadata.musicInfo.singer} · ${task.status === 'run' ? `下载中 ${task.progress.toFixed(0)}%` : task.status === 'error' ? '下载失败' : '等待下载'}`}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))
            : (
                <View style={styles.emptyRecent}>
                  <Text size={11} color={theme['c-450']}>还没有下载记录，去搜索一首歌试试</Text>
                </View>
              )
        }
        {
          recommend.length
            ? (
                <>
                  <View style={styles.sectionHead}>
                    <Text size={15} style={styles.sectionTitle}>推荐歌单</Text>
                    <TouchableOpacity onPress={() => { setModal('songlist') }}>
                      <Text size={11} color={theme['c-450']}>更多 ›</Text>
                    </TouchableOpacity>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recommendRow}>
                    {
                      recommend.map(item => (
                        <TouchableOpacity
                          key={item.id}
                          style={styles.recCard}
                          activeOpacity={0.8}
                          onPress={() => { setModal('songlist') }}
                        >
                          <Image url={item.img} style={styles.recCover} />
                          <Text size={11} numberOfLines={2} style={styles.recName}>{item.name}</Text>
                          <Text size={9} color={theme['c-450']} numberOfLines={1} style={styles.recMeta}>
                            {item.play_count ? `${item.play_count} 次播放` : item.author}
                          </Text>
                        </TouchableOpacity>
                      ))
                    }
                  </ScrollView>
                </>
              )
            : null
        }
        {
          playedList.length
            ? (
                <>
                  <View style={styles.sectionHead}>
                    <Text size={15} style={styles.sectionTitle}>最近播放</Text>
                    <TouchableOpacity onPress={() => { setNavActiveId('nav_player') }}>
                      <Text size={11} color={theme['c-450']}>播放器 ›</Text>
                    </TouchableOpacity>
                  </View>
                  {
                    playedList.map(item => (
                      <TouchableOpacity
                        key={item.musicInfo.id}
                        style={styles.recentRow}
                        activeOpacity={0.7}
                        onPress={() => { setNavActiveId('nav_player') }}
                      >
                        <Image url={item.musicInfo.meta?.picUrl} style={styles.playedCover} />
                        <View style={styles.recentInfo}>
                          <Text size={13} numberOfLines={1}>{item.musicInfo.name}</Text>
                          <Text size={10} color={theme['c-450']} numberOfLines={1} style={styles.recentDesc}>{item.musicInfo.singer}</Text>
                        </View>
                      </TouchableOpacity>
                    ))
                  }
                </>
              )
            : null
        }
      </ScrollView>

      {searchVisible ? <SearchModal onClose={() => { setSearchVisible(false) }} /> : null}
      {
        modal === 'songlist'
          ? <PageModal title='歌单广场' onClose={() => { setModal(null) }}><SongList /></PageModal>
          : modal === 'leaderboard'
            ? <PageModal title='排行榜' onClose={() => { setModal(null) }}><Leaderboard /></PageModal>
            : modal === 'mylist'
              ? <PageModal title='我的列表' onClose={() => { setModal(null) }}><Mylist /></PageModal>
              : null
      }
      <UserApiEditModal ref={userApiModalRef} />
    </View>
  )
}

const styles = createStyle({
  container: {
    flex: 1,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 16,
  },
  logo: {
    width: 46,
    height: 46,
    borderRadius: 15,
    marginRight: 12,
  },
  brandText: {
    flexGrow: 1,
    flexShrink: 1,
  },
  brandName: {
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  brandDesc: {
    marginTop: 3,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 16,
    marginRight: 16,
    marginTop: 16,
    height: 44,
    borderRadius: 14,
    borderWidth: 0.5,
    paddingLeft: 12,
    paddingRight: 5,
  },
  searchText: {
    flexGrow: 1,
    flexShrink: 1,
    marginLeft: 8,
  },
  searchBtn: {
    height: 34,
    paddingLeft: 14,
    paddingRight: 14,
    borderRadius: 11,
    justifyContent: 'center',
  },
  entryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingLeft: 12,
    paddingRight: 12,
    marginTop: 6,
  },
  entry: {
    width: '46%',
    marginLeft: 4,
    marginRight: 4,
    marginTop: 10,
    padding: 14,
    borderRadius: 20,
    borderWidth: 0.5,
    height: 116,
    overflow: 'hidden',
  },
  entryIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  entryWatermark: {
    position: 'absolute',
    right: -8,
    bottom: -10,
    width: 74,
    height: 74,
    borderRadius: 37,
    justifyContent: 'center',
    alignItems: 'center',
  },
  entryTitle: {
    fontWeight: '600',
  },
  entryDesc: {
    marginTop: 3,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 16,
    paddingRight: 16,
    marginTop: 22,
    marginBottom: 6,
  },
  sectionTitle: {
    fontWeight: '700',
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  recentIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 11,
  },
  recentInfo: {
    flexGrow: 1,
    flexShrink: 1,
  },
  recentDesc: {
    marginTop: 2,
  },
  recommendRow: {
    paddingLeft: 16,
    paddingRight: 8,
    paddingBottom: 2,
  },
  recCard: {
    width: 108,
    marginRight: 12,
  },
  recCover: {
    width: 108,
    height: 108,
    borderRadius: 16,
    marginBottom: 6,
  },
  recName: {
    lineHeight: 15,
  },
  recMeta: {
    marginTop: 3,
  },
  playedCover: {
    width: 38,
    height: 38,
    borderRadius: 12,
    marginRight: 11,
  },
  emptyRecent: {
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
})
