import { memo, useCallback, useMemo, useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native'

import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import CapsuleIconButton from '@/components/common/CapsuleIconButton'
import { useTheme } from '@/store/theme/hook'
import { clearListeningStats, useListeningStats } from '@/core/player/listenStats'
import { getListMusicSync } from '@/utils/listManage'
import { useMyList } from '@/store/list/hook'
import { LIST_IDS } from '@/config/constant'
import { confirmDialog, createStyle, toast } from '@/utils/tools'

type Period = 'week' | 'month' | 'year' | 'all'

const PERIODS: Array<{ key: Period, label: string }> = [
  { key: 'week', label: '本周' },
  { key: 'month', label: '本月' },
  { key: 'year', label: '今年' },
  { key: 'all', label: '全部' },
]

const hourText = (seconds: number) => {
  const hours = seconds / 3600
  if (hours >= 10) return hours.toFixed(1)
  return hours.toFixed(1)
}

const formatDuration = (seconds: number) => {
  if (seconds < 60) return `${Math.round(seconds)} 秒`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} 分钟`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours} 小时 ${rest} 分钟` : `${hours} 小时`
}

export default memo(({ visible, onClose }: { visible: boolean, onClose: () => void }) => {
  const theme = useTheme()
  const stats = useListeningStats()
  const userLists = useMyList().slice(2) as LX.List.UserListInfo[]
  const [period, setPeriod] = useState<Period>('week')

  const totalSeconds = period === 'week'
    ? stats.weekSeconds
    : period === 'month'
      ? stats.monthSeconds
      : period === 'year'
        ? stats.yearSeconds
        : stats.totalSeconds
  const maxDay = useMemo(() => Math.max(1, ...stats.days.map(day => day.seconds)), [stats.days])
  const today = stats.days[stats.days.length - 1]
  const favorite = stats.topSongs[0]
  const loveCount = getListMusicSync(LIST_IDS.LOVE).length

  const handleClear = useCallback(async() => {
    const confirmed = await confirmDialog({
      message: '清空全部听歌统计？累计时长、播放次数与艺人统计都会被删除，且不可恢复。',
    })
    if (!confirmed) return
    await clearListeningStats()
    toast('已清空听歌统计')
  }, [])

  return (
    <Modal visible={visible} transparent animationType='fade' statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole='button' accessibilityLabel='关闭听歌统计' />
        <View style={[styles.card, { backgroundColor: theme['c-content-background'], borderColor: theme['c-primary-alpha-700'] }]}>
          <View style={[styles.grabber, { backgroundColor: theme['c-primary-alpha-700'] }]} />
          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            <View style={styles.header}>
              <View style={styles.headerTitle}>
                <Icon name='chart-bar' size={20} color={theme['c-primary']} />
                <Text size={17} style={styles.title}>听歌统计</Text>
              </View>
              <CapsuleIconButton icon='close' label='关闭' onPress={onClose} />
            </View>

            <View style={[styles.periods, { backgroundColor: theme['c-primary-alpha-900'] }]}>
              {PERIODS.map(item => {
                const active = period === item.key
                return (
                  <TouchableOpacity
                    key={item.key}
                    style={[styles.periodPill, active ? { backgroundColor: theme['c-primary'] } : null]}
                    activeOpacity={0.85}
                    onPress={() => { setPeriod(item.key) }}
                  >
                    <Text size={11.5} color={active ? '#FFFFFF' : theme['c-450']} style={styles.periodText}>{item.label}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>

            <View style={styles.hero}>
              <View style={styles.heroInfo}>
                <Text size={11.5} color={theme['c-450']}>这段时间你一共听了</Text>
                <View style={styles.heroValueRow}>
                  <Text size={44} numberOfLines={1} adjustsFontSizeToFit style={styles.heroValue}>{hourText(totalSeconds)}</Text>
                  <Text size={14} color={theme['c-450']} style={styles.heroUnit}>小时</Text>
                </View>
                <View style={styles.heroMetaRow}>
                  <Icon name='arrow-up' size={13} color='#22B07D' />
                  <Text size={11} color='#22B07D'>{`今日 ${formatDuration(stats.todaySeconds)}`}</Text>
                  <Text size={11} color={theme['c-450']} style={styles.heroDot}>·</Text>
                  <Text size={11} color={theme['c-450']}>{`累计 ${formatDuration(stats.totalSeconds)}`}</Text>
                </View>
              </View>
              {/* 唱片插画：纯 View 画，避免额外图片资源 */}
              <View style={styles.vinylWrap} pointerEvents='none'>
                <View style={[styles.vinyl, { backgroundColor: theme.isDark ? '#23202E' : '#171522' }]}>
                  <View style={[styles.vinylRing, { borderColor: 'rgba(255,255,255,0.08)' }]} />
                  <View style={[styles.vinylLabel, { backgroundColor: theme['c-primary'] }]}>
                    <Icon name='music-note' size={22} color='#FFFFFF' />
                  </View>
                </View>
                <View style={[styles.vinylOrbit, { borderColor: theme['c-primary-alpha-700'] }]} />
              </View>
            </View>

            <View style={[styles.chartCard, { backgroundColor: theme['c-primary-alpha-900'] }]}>
              <View style={styles.chartHead}>
                <Text size={12} style={styles.chartTitle}>最近 7 天</Text>
                <Text size={10} color={theme['c-450']}>{`今日 ${formatDuration(stats.todaySeconds)}`}</Text>
              </View>
              <View style={styles.chart}>
                {stats.days.map(day => {
                  const height = Math.max(8, Math.round((day.seconds / maxDay) * 92))
                  const isToday = day.key === today?.key
                  return (
                    <View key={day.key} style={styles.chartCol}>
                      {day.seconds === maxDay && day.seconds > 0
                        ? (
                          <View style={[styles.bubble, { backgroundColor: theme['c-primary'] }]}>
                            <Text size={9} color='#FFFFFF'>{`${(day.seconds / 3600).toFixed(1)}h`}</Text>
                          </View>
                          )
                        : null}
                      <View style={[styles.bar, { height, backgroundColor: isToday ? theme['c-primary'] : theme['c-primary-alpha-700'] }]} />
                      <Text size={9} color={isToday ? theme['c-primary'] : theme['c-450']} style={styles.barLabel}>{day.label}</Text>
                    </View>
                  )
                })}
              </View>
            </View>

            <View style={styles.metrics}>
              <View style={[styles.metric, { backgroundColor: theme['c-primary-alpha-900'] }]}>
                <View style={[styles.metricIcon, { backgroundColor: theme['c-primary-alpha-800'] }]}>
                  <Icon name='headphones' size={17} color={theme['c-primary']} />
                </View>
                <Text size={20} style={styles.metricValue}>{stats.totalPlays}</Text>
                <Text size={10} color={theme['c-450']}>播放次数</Text>
              </View>
              <View style={[styles.metric, { backgroundColor: theme['c-primary-alpha-900'] }]}>
                <View style={[styles.metricIcon, { backgroundColor: 'rgba(255,90,120,0.16)' }]}>
                  <Icon name='heart' size={17} color='#FF5A78' />
                </View>
                <Text size={20} style={styles.metricValue}>{loveCount}</Text>
                <Text size={10} color={theme['c-450']}>喜欢歌曲</Text>
              </View>
              <View style={[styles.metric, { backgroundColor: theme['c-primary-alpha-900'] }]}>
                <View style={[styles.metricIcon, { backgroundColor: theme['c-primary-alpha-800'] }]}>
                  <Icon name='playlist-music' size={17} color={theme['c-primary']} />
                </View>
                <Text size={20} style={styles.metricValue}>{userLists.length}</Text>
                <Text size={10} color={theme['c-450']}>收藏歌单</Text>
              </View>
            </View>

            <View style={[styles.favoriteCard, { backgroundColor: theme['c-primary-alpha-900'] }]}>
              <View style={styles.favoriteHead}>
                <Icon name='trophy-outline' size={16} color='#F5A524' />
                <Text size={13} style={styles.favoriteTitle}>本周最爱</Text>
                <Text size={10.5} color={theme['c-450']}>按收听时长</Text>
              </View>
              {favorite
                ? (
                  <View style={styles.favoriteRow}>
                    <View style={[styles.favoriteCover, { backgroundColor: theme['c-primary-alpha-800'] }]}>
                      <Icon name='music-note' size={24} color={theme['c-primary']} />
                    </View>
                    <View style={styles.favoriteInfo}>
                      <Text size={14} numberOfLines={1} style={styles.favoriteName}>{favorite.name}</Text>
                      <Text size={10.5} color={theme['c-450']} numberOfLines={1} style={styles.favoriteSinger}>{favorite.singer || '未知歌手'}</Text>
                    </View>
                    <Text size={10.5} color={theme['c-450']}>{formatDuration(favorite.seconds)}</Text>
                    <View style={[styles.favoriteHeart, { backgroundColor: theme['c-primary-alpha-800'] }]}>
                      <Icon name='heart' size={16} color={theme['c-primary']} />
                    </View>
                  </View>
                  )
                : <Text size={11} color={theme['c-450']} style={styles.empty}>还没有常听歌曲，多听几首就会出现</Text>}
            </View>

            <TouchableOpacity style={styles.clearBtn} activeOpacity={0.7} onPress={() => { void handleClear() }}>
              <Icon name='trash-can-outline' size={14} color={theme['c-450']} />
              <Text size={11.5} color={theme['c-450']} style={styles.clearText}>清空听歌统计</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
})

const styles = createStyle({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 8,
  },
  card: {
    width: '100%',
    maxHeight: '92%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 0.5,
    borderRadius: 0,
    paddingTop: 14,
  },
  body: {
    paddingLeft: 16,
    paddingRight: 16,
    paddingBottom: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontWeight: '700',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periods: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 3,
    marginBottom: 14,
  },
  periodPill: {
    flex: 1,
    height: 30,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodText: {
    fontWeight: '600',
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  heroInfo: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    paddingRight: 6,
  },
  heroValueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 2,
  },
  heroValue: {
    fontWeight: '800',
    letterSpacing: -1,
  },
  heroUnit: {
    marginLeft: 6,
    marginBottom: 8,
  },
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  heroDot: {
    marginHorizontal: 6,
  },
  vinylWrap: {
    width: 128,
    height: 128,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vinyl: {
    width: 108,
    height: 108,
    borderRadius: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vinylRing: {
    position: 'absolute',
    width: 86,
    height: 86,
    borderRadius: 43,
    borderWidth: 1,
  },
  vinylLabel: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vinylOrbit: {
    position: 'absolute',
    width: 138,
    height: 62,
    borderRadius: 69,
    borderWidth: 1,
    transform: [{ rotate: '-24deg' }],
  },
  chartCard: {
    borderRadius: 18,
    padding: 12,
    paddingTop: 10,
    marginBottom: 14,
  },
  chartHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  chartTitle: {
    fontWeight: '600',
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 150,
    paddingTop: 18,
  },
  chartCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  bubble: {
    position: 'absolute',
    top: 0,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 9,
  },
  bar: {
    width: '58%',
    borderRadius: 8,
    minHeight: 8,
  },
  barLabel: {
    marginTop: 6,
  },
  metrics: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  metric: {
    flex: 1,
    borderRadius: 18,
    paddingTop: 12,
    paddingBottom: 12,
    alignItems: 'center',
  },
  metricIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  metricValue: {
    fontWeight: '700',
  },
  favoriteCard: {
    borderRadius: 18,
    padding: 12,
    marginBottom: 12,
  },
  favoriteHead: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 6,
  },
  favoriteTitle: {
    flexGrow: 1,
    fontWeight: '700',
  },
  favoriteRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  favoriteCover: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  favoriteInfo: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    paddingLeft: 10,
    paddingRight: 8,
  },
  favoriteName: {
    fontWeight: '600',
  },
  favoriteSinger: {
    marginTop: 2,
  },
  favoriteHeart: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  empty: {
    paddingVertical: 10,
    textAlign: 'center',
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  clearText: {
    marginLeft: 5,
  },
})
