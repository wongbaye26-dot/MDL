import { memo, useCallback, useMemo } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native'

import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { clearListeningStats, useListeningStats } from '@/core/player/listenStats'
import { confirmDialog, createStyle, toast } from '@/utils/tools'

/**
 * 首页「听歌统计」的大卡片详情。
 *
 * 旧版是整屏页面，这里按反馈改成「居中大卡片」：
 * 遮罩 + 26dp 圆角卡 + 今日主 KPI + 6 项小指标 + 7 日柱状 + 常听艺人 + 清空。
 * 信息分层：主数字（今日）最大，其次是本周/累计，柱状与艺人作为明细。
 */
const formatDuration = (seconds: number) => {
  if (seconds < 60) return `${seconds} 秒`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} 分钟`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours} 小时 ${rest} 分钟` : `${hours} 小时`
}

const shortDuration = (seconds: number) => {
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours}h${rest}m` : `${hours}h`
}

export default memo(({ visible, onClose }: { visible: boolean, onClose: () => void }) => {
  const theme = useTheme()
  const stats = useListeningStats()

  const maxDay = useMemo(() => Math.max(1, ...stats.days.map(day => day.seconds)), [stats.days])
  const maxArtist = useMemo(() => Math.max(1, ...stats.topArtists.map(item => item.seconds)), [stats.topArtists])
  const todayKey = stats.days[stats.days.length - 1]?.key
  const maxSong = useMemo(() => Math.max(1, ...stats.topSongs.map(item => item.seconds)), [stats.topSongs])

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
        {/* 遮罩单独绝对定位，卡片里是 ScrollView；之前整个卡片套 Pressable 会抢走竖向滑动 */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole='button'
          accessibilityLabel='关闭听歌统计'
        />
        <View style={[styles.card, { backgroundColor: theme['c-content-background'] }]}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text size={18} style={styles.title}>听歌统计</Text>
              <Text size={11} color={theme['c-450']} style={styles.subtitle}>从开启统计之日起累计</Text>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              activeOpacity={0.7}
              onPress={onClose}
              accessibilityRole='button'
              accessibilityLabel='关闭听歌统计'
            >
              <Icon name='close' size={20} color={theme['c-font']} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            {/* 主 KPI：今日分钟数，最大字号 */}
            <View style={[styles.hero, { backgroundColor: theme['c-primary-alpha-900'] }]}>
              <View style={styles.heroTop}>
                <Text size={11.5} color={theme['c-450']}>今日</Text>
                <View style={[styles.heroPill, { backgroundColor: theme['c-primary'] }]}>
                  <Text size={9.5} color='#FFFFFF'>实时</Text>
                </View>
              </View>
              <View style={styles.heroValueRow}>
                <Text size={34} color={theme['c-font']} numberOfLines={1} adjustsFontSizeToFit style={styles.heroValue}>
                  {formatDuration(stats.todaySeconds)}
                </Text>
              </View>
              <Text size={11} color={theme['c-450']} style={styles.heroMeta}>
                {`本周 ${formatDuration(stats.weekSeconds)} · 累计 ${formatDuration(stats.totalSeconds)}`}
              </Text>
            </View>

            {/* 三项明细 */}
            <View style={styles.metrics}>
              {[
                { label: '累计时长', value: formatDuration(stats.totalSeconds), icon: 'clock-outline' },
                { label: '播放次数', value: `${stats.totalPlays} 次`, icon: 'play-circle-outline' },
                { label: '常听艺人', value: `${stats.topArtists.length} 位`, icon: 'account-music-outline' },
              ].map(item => (
                <View key={item.label} style={[styles.metric, { backgroundColor: theme['c-primary-alpha-900'] }]}>
                  <Icon name={item.icon} size={14} color={theme['c-primary']} />
                  <Text size={10.5} color={theme['c-450']} style={styles.metricLabel}>{item.label}</Text>
                  <Text size={13} numberOfLines={1} adjustsFontSizeToFit style={styles.metricValue}>{item.value}</Text>
                </View>
              ))}
            </View>

            <View style={styles.sectionHead}>
              <Text size={13} style={styles.sectionTitle}>最近 7 天</Text>
              <Text size={10.5} color={theme['c-450']}>{`峰值 ${shortDuration(maxDay)}`}</Text>
            </View>
            <View style={[styles.chart, { backgroundColor: theme['c-primary-alpha-900'] }]}>
              {stats.days.map(day => {
                const height = Math.max(5, Math.round((day.seconds / maxDay) * 76))
                const isToday = day.key === todayKey
                return (
                  <View key={day.key} style={styles.chartCol}>
                    <Text size={8.5} color={isToday ? theme['c-primary'] : theme['c-400']} style={styles.chartValue}>
                      {Math.round(day.seconds / 60)}
                    </Text>
                    <View style={styles.chartBarWrap}>
                      <View style={[
                        styles.chartBar,
                        {
                          height,
                          backgroundColor: isToday ? theme['c-primary'] : theme['c-primary-alpha-700'],
                        },
                      ]} />
                    </View>
                    <Text size={9} color={isToday ? theme['c-primary'] : theme['c-450']}>{day.label}</Text>
                  </View>
                )
              })}
            </View>

            <View style={styles.sectionHead}>
              <Text size={13} style={styles.sectionTitle}>常听歌曲</Text>
              <Text size={10.5} color={theme['c-450']}>按收听时长</Text>
            </View>
            {stats.topSongs.length
              ? (
                <View style={[styles.artists, { backgroundColor: theme['c-primary-alpha-900'] }]}>
                  {stats.topSongs.map((song, index) => (
                    <View key={`${song.name}_${song.singer}`} style={styles.artistRow}>
                      <View style={[styles.artistRank, { backgroundColor: theme['c-primary-alpha-800'] }]}>
                        <Text size={10} color={theme['c-primary']} style={styles.artistRankText}>{index + 1}</Text>
                      </View>
                      <View style={styles.artistInfo}>
                        <View style={styles.artistLine}>
                          <Text size={12.5} numberOfLines={1} style={styles.artistName}>{song.name}</Text>
                          <Text size={10.5} color={theme['c-450']}>{formatDuration(song.seconds)}</Text>
                        </View>
                        <View style={[styles.artistBarTrack, { backgroundColor: theme['c-primary-alpha-700'] }]}>
                          <View
                            style={[styles.artistBarFill, {
                              width: `${Math.max(5, (song.seconds / maxSong) * 100)}%`,
                              backgroundColor: theme['c-primary'],
                            }]}
                          />
                        </View>
                        {song.singer ? <Text size={9.5} color={theme['c-400']} numberOfLines={1} style={styles.songSinger}>{song.singer}</Text> : null}
                      </View>
                    </View>
                  ))}
                </View>
                )
              : <Text size={11.5} color={theme['c-450']} style={styles.empty}>还没有常听歌曲，多听几首就会出现</Text>}

            <View style={styles.sectionHead}>
              <Text size={13} style={styles.sectionTitle}>常听艺人</Text>
              <Text size={10.5} color={theme['c-450']}>按收听时长</Text>
            </View>
            {stats.topArtists.length
              ? (
                <View style={[styles.artists, { backgroundColor: theme['c-primary-alpha-900'] }]}>
                  {stats.topArtists.map((artist, index) => (
                    <View key={artist.name} style={styles.artistRow}>
                      <View style={[styles.artistRank, { backgroundColor: theme['c-primary-alpha-800'] }]}>
                        <Text size={10} color={theme['c-primary']} style={styles.artistRankText}>{index + 1}</Text>
                      </View>
                      <View style={styles.artistInfo}>
                        <View style={styles.artistLine}>
                          <Text size={12.5} numberOfLines={1} style={styles.artistName}>{artist.name}</Text>
                          <Text size={10.5} color={theme['c-450']}>{formatDuration(artist.seconds)}</Text>
                        </View>
                        <View style={[styles.artistBarTrack, { backgroundColor: theme['c-primary-alpha-700'] }]}>
                          <View
                            style={[styles.artistBarFill, {
                              width: `${Math.max(5, (artist.seconds / maxArtist) * 100)}%`,
                              backgroundColor: theme['c-primary'],
                            }]}
                          />
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
                )
              : <Text size={11.5} color={theme['c-450']} style={styles.empty}>还统计不到艺人，听几首带歌手的歌就会出现</Text>}

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
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '86%',
    borderRadius: 26,
    overflow: 'hidden',
    elevation: 24,
    shadowColor: '#000000',
    shadowOpacity: 0.3,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 16 },
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 20,
    paddingRight: 10,
    paddingTop: 18,
    paddingBottom: 10,
  },
  headerText: {
    flexShrink: 1,
  },
  title: {
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 2,
  },
  closeBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    // 卡片有 maxHeight，ScrollView 必须能收缩，否则它按内容高度摊开、被卡片裁掉却不滚动
    flexShrink: 1,
  },
  body: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  hero: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  heroValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  heroValue: {
    fontWeight: '700',
    flexShrink: 1,
  },
  heroMeta: {
    marginTop: 4,
  },
  metrics: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  metric: {
    flex: 1,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 11,
  },
  metricLabel: {
    marginTop: 5,
  },
  metricValue: {
    marginTop: 2,
    fontWeight: '600',
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontWeight: '600',
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
  },
  chartCol: {
    flex: 1,
    alignItems: 'center',
  },
  chartValue: {
    marginBottom: 4,
  },
  chartBarWrap: {
    height: 64,
    justifyContent: 'flex-end',
  },
  chartBar: {
    width: 12,
    borderRadius: 6,
  },
  artists: {
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  artistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  artistRank: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  artistRankText: {
    fontWeight: '600',
  },
  artistInfo: {
    flex: 1,
    minWidth: 0,
  },
  artistLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  artistName: {
    flexShrink: 1,
  },
  artistBarTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  artistBarFill: {
    height: 4,
    borderRadius: 2,
  },
  empty: {
    paddingVertical: 18,
    textAlign: 'center',
  },
  songSinger: {
    marginTop: 3,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    paddingVertical: 12,
  },
  clearText: {
    marginLeft: 5,
  },
})
