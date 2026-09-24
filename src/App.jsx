import { Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from '@/components/layout/ThemeProvider'
import { AppShell } from '@/components/layout/AppShell'

import Home from '@/pages/Home'
import Play from '@/pages/Play'
import Result from '@/pages/Result'
import Daily from '@/pages/Daily'
import Library from '@/pages/Library'
import Stats from '@/pages/Stats'
import Learn from '@/pages/Learn'
import LearnLesson from '@/pages/LearnLesson'
import Achievements from '@/pages/Achievements'
import Profile from '@/pages/Profile'
import Settings from '@/pages/Settings'
import Replay from '@/pages/Replay'

export default function App() {
  return (
    <ThemeProvider>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<Home />} />
          <Route path="/play" element={<Play />} />
          <Route path="/result" element={<Result />} />
          <Route path="/daily" element={<Daily />} />
          <Route path="/library" element={<Library />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/learn" element={<Learn />} />
          <Route path="/learn/:id" element={<LearnLesson />} />
          <Route path="/achievements" element={<Achievements />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/replay/:id" element={<Replay />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </ThemeProvider>
  )
}
