import { Flame } from 'lucide-react'
import { Bar, BarChart, ResponsiveContainer, XAxis } from 'recharts'
import { motion } from 'motion/react'
import { Link } from 'react-router-dom'
import { MoodScoreRing } from '../components/MoodScoreRing'
import { Skeleton } from '../components/Skeleton'
import { useEntriesQuery, useUserQuery, useWeeklyChartQuery } from '../services/api'

export function HomePage() {
  const { data:user, isLoading:ul } = useUserQuery(); const { data:entries, isLoading:el } = useEntriesQuery(); const { data:week, isLoading:wl } = useWeeklyChartQuery()
  const hour = new Date().getHours(); const part = hour<12?'morning':hour<18?'afternoon':'evening'
  const todayScore = entries?.[0]?.mood_score ?? 74
  return <div className="space-y-6"><div className="flex items-center justify-between"><h1 className="text-xl font-semibold">Good {part}, {ul?<Skeleton className='inline-block h-5 w-20'/>:user?.display_name}</h1><div className="h-10 w-10 rounded-full bg-surface"/></div><div className="grid place-items-center"><MoodScoreRing score={todayScore}/></div><div className="inline-flex items-center gap-2 rounded-full bg-surface px-4 py-2"><Flame size={16} className="text-secondary"/> {user?.streak ?? 0} day streak</div><motion.div animate={{scale:[1,1.03,1]}} transition={{repeat:Infinity,duration:1.8}}><Link to="/checkin" className="block rounded-xl bg-primary p-4 text-center text-lg font-semibold">Check In</Link></motion.div><div className="rounded-xl bg-surface p-4"><h3 className="mb-2">7-day mood</h3>{wl?<Skeleton className='h-32'/>:<ResponsiveContainer width="100%" height={140}><BarChart data={week}><XAxis dataKey="day"/><Bar dataKey="mood_score" fill="#7B61FF" radius={[6,6,0,0]}/></BarChart></ResponsiveContainer>}</div><section><h3 className="mb-2">Recent Entries</h3><div className="space-y-3">{el?[1,2,3].map(i=><Skeleton key={i} className='h-20'/>):entries?.slice(0,3).map(e=><div key={e.id} className="rounded-xl bg-surface p-3"><div className="text-sm text-textSecondary">{new Date(e.created_at).toLocaleDateString()} • {e.primary_mood_tag}</div><div>{e.mood_summary}</div><div className="text-primary">Score {e.mood_score}</div></div>)}</div></section></div>
}
