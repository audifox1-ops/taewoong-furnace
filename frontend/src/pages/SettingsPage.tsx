import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/Toast'
import { Settings, Clock, Save, RotateCcw } from 'lucide-react'

interface ShiftConfig {
  dayStart: string
  dayEnd: string
  nightStart: string
  nightEnd: string
}

const DEFAULT_CONFIG: ShiftConfig = {
  dayStart: '08:00',
  dayEnd: '19:30',
  nightStart: '20:00',
  nightEnd: '07:00',
}

const STORAGE_KEY = 'taewoong-shift-config'

function loadConfig(): ShiftConfig {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) : DEFAULT_CONFIG
  } catch {
    return DEFAULT_CONFIG
  }
}

function saveConfig(config: ShiftConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
}

export function SettingsPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [config, setConfig] = useState<ShiftConfig>(loadConfig)

  const isAdmin = user?.role === 'admin'

  const handleSave = () => {
    saveConfig(config)
    toast('success', '설정이 저장되었습니다')
  }

  const handleReset = () => {
    setConfig(DEFAULT_CONFIG)
    saveConfig(DEFAULT_CONFIG)
    toast('info', '기본값으로 초기화되었습니다')
  }

  const parseTime = (t: string) => {
    const [h, m] = t.split(':').map(Number)
    return { hours: h, minutes: m }
  }

  const formatDuration = (start: string, end: string, crossesMidnight: boolean) => {
    const s = parseTime(start)
    const e = parseTime(end)
    let diffMinutes = (e.hours * 60 + e.minutes) - (s.hours * 60 + s.minutes)
    if (crossesMidnight) diffMinutes += 24 * 60
    const hours = Math.floor(diffMinutes / 60)
    const minutes = diffMinutes % 60
    return `${hours}시간 ${minutes}분`
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">설정</h1>

      <div className="max-w-2xl space-y-6">
        {/* Shift Configuration */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center mb-4">
            <Clock className="h-5 w-5 text-blue-500 mr-2" />
            <h2 className="text-lg font-medium text-gray-900">교대 시간 설정</h2>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                <span className="w-3 h-3 rounded-full bg-yellow-400 mr-2" />
                주간 (Day)
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-500">시작 시간</label>
                  <input type="time" value={config.dayStart}
                    onChange={(e) => setConfig({ ...config, dayStart: e.target.value })}
                    disabled={!isAdmin}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm disabled:bg-gray-100" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500">종료 시간</label>
                  <input type="time" value={config.dayEnd}
                    onChange={(e) => setConfig({ ...config, dayEnd: e.target.value })}
                    disabled={!isAdmin}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm disabled:bg-gray-100" />
                </div>
                <p className="text-xs text-gray-400">
                  근무시간: {formatDuration(config.dayStart, config.dayEnd, false)}
                </p>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                <span className="w-3 h-3 rounded-full bg-indigo-500 mr-2" />
                야간 (Night)
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-500">시작 시간</label>
                  <input type="time" value={config.nightStart}
                    onChange={(e) => setConfig({ ...config, nightStart: e.target.value })}
                    disabled={!isAdmin}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm disabled:bg-gray-100" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500">종료 시간</label>
                  <input type="time" value={config.nightEnd}
                    onChange={(e) => setConfig({ ...config, nightEnd: e.target.value })}
                    disabled={!isAdmin}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm disabled:bg-gray-100" />
                </div>
                <p className="text-xs text-gray-400">
                  근무시간: {formatDuration(config.nightStart, config.nightEnd, true)}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 p-3 bg-gray-50 rounded-lg text-xs text-gray-500">
            <p>비근무 구간: {config.dayEnd} ~ {config.nightStart}, {config.nightEnd} ~ {config.dayStart}</p>
            <p className="mt-1">* 설정은 브라우저에 저장됩니다 (로컬 스토리지).</p>
          </div>

          {isAdmin && (
            <div className="mt-4 flex gap-2">
              <button onClick={handleSave}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700">
                <Save className="h-4 w-4 mr-1" />
                저장
              </button>
              <button onClick={handleReset}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                <RotateCcw className="h-4 w-4 mr-1" />
                기본값으로 초기화
              </button>
            </div>
          )}

          {!isAdmin && (
            <p className="mt-4 text-xs text-gray-400">설정 변경은 관리자만 가능합니다.</p>
          )}
        </div>

        {/* Current User Info */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center mb-4">
            <Settings className="h-5 w-5 text-gray-500 mr-2" />
            <h2 className="text-lg font-medium text-gray-900">시스템 정보</h2>
          </div>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-gray-500">현재 사용자</dt>
              <dd className="font-medium text-gray-900">{user?.username} ({user?.role})</dd>
            </div>
            <div>
              <dt className="text-gray-500">가열로 수</dt>
              <dd className="font-medium text-gray-900">19개 (7호기 제외)</dd>
            </div>
            <div>
              <dt className="text-gray-500">교대 시간</dt>
              <dd className="font-medium text-gray-900">
                주간 {config.dayStart}~{config.dayEnd} / 야간 {config.nightStart}~{config.nightEnd}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">데이터베이스</dt>
              <dd className="font-medium text-gray-900">SQLite</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  )
}
