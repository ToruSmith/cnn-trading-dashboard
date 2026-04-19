import React, { useState, useRef, useCallback } from 'react'
import { Play, Square, Download, RefreshCw, Heart, BarChart2, Upload, Settings } from 'lucide-react'
import ConfigPanel from './components/ConfigPanel'
import TrainingDashboard from './components/TrainingDashboard'
import MetricsPanel from './components/MetricsPanel'
import PredictionPanel from './components/PredictionPanel'

const API = import.meta.env.VITE_API_URL || ''

// WS_BASE: 優先用 VITE_WS_URL；若沒設定，從 VITE_API_URL 自動推導
// https://xxx.onrender.com  →  wss://xxx.onrender.com
// http://localhost:8000     →  ws://localhost:8000
function deriveWsBase() {
  if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL
      .replace(/^https:\/\//, 'wss://')
      .replace(/^http:\/\//, 'ws://')
  }
  return 'ws://localhost:8000'
}
const WS_BASE = deriveWsBase()

const DEFAULT_CONFIG = {
  conv_layers: 2, kernel_size: 5, dropout: 0.3,
  lr: 0.001, batch_size: 32, epochs: 20,
  loss_fn: 'CrossEntropy', optimizer: 'Adam',
  data_source: 'synthetic', n_samples: 5000,
}

const TABS = [
  { id: 'train',   label: '訓練監控', icon: <BarChart2 size={14} /> },
  { id: 'metrics', label: '模型指標', icon: <Heart size={14} /> },
  { id: 'predict', label: '預測分析', icon: <Upload size={14} /> },
]

const s = {
  app: { minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' },
  header: {
    padding: '12px 24px', borderBottom: '1px solid #1e3a5f',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    background: 'rgba(10,14,26,0.95)', backdropFilter: 'blur(8px)',
    position: 'sticky', top: 0, zIndex: 100,
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 12 },
  logo: { fontFamily: 'IBM Plex Mono', fontSize: 16, fontWeight: 600, color: '#00d4ff', display: 'flex', alignItems: 'center', gap: 8 },
  subtitle: { fontSize: 11, color: '#475569', fontFamily: 'IBM Plex Mono' },
  body: { display: 'flex', flex: 1, gap: 0 },
  sidebar: { width: 280, minWidth: 280, borderRight: '1px solid #1e3a5f', padding: 20, overflowY: 'auto', background: '#0a0e1a' },
  main: { flex: 1, padding: 20, overflowY: 'auto' },
  tabBar: { display: 'flex', gap: 0, borderBottom: '1px solid #1e3a5f', marginBottom: 20 },
  tab: (active) => ({
    padding: '10px 18px', fontSize: 12, fontFamily: 'IBM Plex Mono', cursor: 'pointer',
    borderBottom: active ? '2px solid #00d4ff' : '2px solid transparent',
    color: active ? '#00d4ff' : '#64748b',
    display: 'flex', alignItems: 'center', gap: 6,
    transition: 'all 0.15s', background: 'none', border: 'none',
    borderBottom: active ? '2px solid #00d4ff' : '2px solid transparent',
  }),
  ctrlRow: { display: 'flex', gap: 8, marginTop: 20 },
  badge: (color) => ({
    padding: '2px 8px', borderRadius: 3, fontSize: 10,
    fontFamily: 'IBM Plex Mono', background: `rgba(${color},0.12)`,
    color: `rgb(${color})`,
  }),
}

export default function App() {
  const [config, setConfig] = useState(DEFAULT_CONFIG)
  const [activeTab, setActiveTab] = useState('train')
  const [isTraining, setIsTraining] = useState(false)
  const [jobId, setJobId] = useState(null)
  const [chartData, setChartData] = useState([])
  const [logs, setLogs] = useState([])
  const [modelInfo, setModelInfo] = useState(null)
  const [finalMetrics, setFinalMetrics] = useState(null)
  const [reportMd, setReportMd] = useState('')
  const wsRef = useRef(null)

  const addLog = useCallback((msg) => {
    setLogs(prev => [...prev.slice(-80), msg])
  }, [])

  const startTraining = async () => {
    if (isTraining) return
    setIsTraining(true)
    setChartData([])
    setLogs([])
    setFinalMetrics(null)
    setReportMd('')

    try {
      const res = await fetch(`${API}/train`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      if (!res.ok) {
        const err = await res.text()
        throw new Error(`POST /train 失敗 (${res.status}): ${err}`)
      }
      const { job_id } = await res.json()
      setJobId(job_id)
      addLog(`[INFO] 訓練任務啟動 job_id=${job_id}`)
      addLog(`[INFO] 連接 WebSocket: ${WS_BASE}/api/ws/${job_id}`)

      // 連接 WebSocket
      const wsUrl = `${WS_BASE}/api/ws/${job_id}`
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => addLog('[INFO] WebSocket 已連線')

      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data)
        const { event, data, message } = msg

        if (event === 'ping') return

        if (event === 'status') {
          addLog(`[STATUS] ${message || JSON.stringify(data)}`)
        }
        if (event === 'model_info') {
          setModelInfo(data)
          addLog(`[MODEL] 參數量: ${data.param_count?.toLocaleString()} | 裝置: ${data.device}`)
        }
        if (event === 'epoch') {
          setChartData(prev => [...prev, {
            epoch: data.epoch,
            train_loss: data.train_loss,
            val_loss: data.val_loss,
            accuracy: data.accuracy
          }])
          addLog(`[${String(data.epoch).padStart(3,'0')}/${data.total_epochs}] loss=${data.train_loss} val=${data.val_loss} acc=${(data.accuracy*100).toFixed(1)}% (${data.elapsed_sec}s)`)
        }
        if (event === 'done') {
          setFinalMetrics({
            confusionMatrix: data.confusion_matrix,
            reportDict: data.classification_report
          })
          setReportMd(data.report_md || '')
          addLog(`[DONE] ✓ 最終準確率: ${(data.final_accuracy * 100).toFixed(2)}%`)
          setIsTraining(false)
          setActiveTab('metrics')
        }
        if (event === 'error') {
          addLog(`[ERROR] ${message || JSON.stringify(data)}`)
          setIsTraining(false)
        }
        if (event === 'stopped') {
          addLog('[STOP] 訓練已中止')
          setIsTraining(false)
        }
      }

      ws.onerror = (e) => {
        addLog(`[ERROR] WebSocket 連線失敗 — 請確認 VITE_WS_URL 是否設定正確`)
        addLog(`[DEBUG] 嘗試連線到: ${wsUrl}`)
        setIsTraining(false)
      }

      ws.onclose = (e) => {
        if (e.code !== 1000) addLog(`[WS] 連線關閉 code=${e.code}`)
      }

    } catch (err) {
      addLog(`[ERROR] ${err.message}`)
      setIsTraining(false)
    }
  }

  const stopTraining = async () => {
    if (!jobId) return
    wsRef.current?.close()
    await fetch(`${API}/stop/${jobId}`, { method: 'POST' }).catch(() => {})
    setIsTraining(false)
  }

  const downloadReport = () => {
    if (!reportMd) return
    const blob = new Blob([reportMd], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ECG_Report_${jobId || 'latest'}.md`
    a.click()
  }

  return (
    <div style={s.app}>
      {/* Header */}
      <header style={s.header}>
        <div style={s.headerLeft}>
          <div style={s.logo}>
            <Heart size={18} color="#ff6b35" />
            ECG-CNN Analyzer
          </div>
          <div style={s.subtitle}>即時心律分類平台 · 董事報告版</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isTraining && <span style={s.badge('0,255,157')}>訓練中</span>}
          {jobId && !isTraining && <span style={s.badge('0,212,255')}>JOB: {jobId}</span>}
          {reportMd && (
            <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
              onClick={downloadReport}>
              <Download size={13} /> 下載 .md 報告
            </button>
          )}
        </div>
      </header>

      <div style={s.body}>
        {/* Sidebar — Config */}
        <aside style={s.sidebar}>
          <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'IBM Plex Mono', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Settings size={12} /> 模型設定
          </div>
          <ConfigPanel config={config} onChange={setConfig} isTraining={isTraining} />
          <div style={s.ctrlRow}>
            <button className="btn-primary" onClick={startTraining} disabled={isTraining}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Play size={13} /> {isTraining ? '訓練中...' : '開始訓練'}
            </button>
            {isTraining && (
              <button className="btn-danger" onClick={stopTraining} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Square size={12} />
              </button>
            )}
          </div>
          {!isTraining && chartData.length > 0 && (
            <button className="btn-secondary" onClick={() => { setChartData([]); setLogs([]); setFinalMetrics(null) }}
              style={{ marginTop: 8, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12 }}>
              <RefreshCw size={12} /> 重置
            </button>
          )}
        </aside>

        {/* Main content */}
        <main style={s.main}>
          <div style={s.tabBar}>
            {TABS.map(tab => (
              <button key={tab.id} style={s.tab(activeTab === tab.id)} onClick={() => setActiveTab(tab.id)}>
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'train' && (
            <TrainingDashboard chartData={chartData} logs={logs} isTraining={isTraining} modelInfo={modelInfo} />
          )}
          {activeTab === 'metrics' && (
            <MetricsPanel
              confusionMatrix={finalMetrics?.confusionMatrix}
              reportDict={finalMetrics?.reportDict}
            />
          )}
          {activeTab === 'predict' && (
            <PredictionPanel jobId={jobId} />
          )}
        </main>
      </div>
    </div>
  )
}
