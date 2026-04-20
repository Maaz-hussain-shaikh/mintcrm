import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Profile } from '@/types'

interface AuthState {
  profile: Profile | null
  attendanceId: string | null
  setProfile: (profile: Profile | null) => void
  setAttendanceId: (id: string | null) => void
  reset: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      profile: null,
      attendanceId: null,
      setProfile: (profile) => set({ profile }),
      setAttendanceId: (attendanceId) => set({ attendanceId }),
      reset: () => set({ profile: null, attendanceId: null }),
    }),
    {
      name: 'auth-store',
      partialize: (state) => ({ attendanceId: state.attendanceId }),
    }
  )
)
