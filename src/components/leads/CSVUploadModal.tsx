'use client'

import { useState, useRef } from 'react'
import { Upload, FileText, AlertCircle, CheckCircle, Loader2, Download } from 'lucide-react'
import toast from 'react-hot-toast'
import Modal from '@/components/ui/Modal'

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function CSVUploadModal({ open, onClose, onSuccess }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<{ inserted: number; errors: string[] } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = (f: File) => {
    if (!f.name.endsWith('.csv')) { toast.error('Please upload a .csv file'); return }
    setFile(f)
    setResult(null)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  const handleUpload = async () => {
    if (!file) return
    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch('/api/leads/upload', { method: 'POST', body: formData })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error ?? 'Upload failed'); setUploading(false); return }
    setResult(data)
    setUploading(false)
    if (data.inserted > 0) { toast.success(`${data.inserted} leads imported!`); onSuccess() }
    else toast.error('0 leads imported. Check errors below.')
  }

  const downloadTemplate = () => {
    const csv = 'name,phone,email,trip_interest,travel_date,budget,agent_name\nRahul Sharma,9876543210,rahul@gmail.com,Goa Trip,2025-12-15,50000,Priya Singh\nSneha Patel,9123456789,sneha@gmail.com,Manali,2026-01-10,75000,\n'
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'leads_template.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const reset = () => { setFile(null); setResult(null) }

  return (
    <Modal open={open} onClose={() => { reset(); onClose() }} title="Import Leads from CSV">
      <div className="space-y-4">
        <div className="flex items-center justify-between bg-brand-50 rounded-lg px-4 py-3">
          <div>
            <p className="text-sm font-medium text-brand-800">Template download karo</p>
            <p className="text-xs text-brand-600 mt-0.5">agent_name column mein employee ka naam likho</p>
          </div>
          <button onClick={downloadTemplate} className="btn-secondary text-xs gap-1.5">
            <Download className="w-3.5 h-3.5" /> Template
          </button>
        </div>

        <div className="bg-slate-50 rounded-lg p-3">
          <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">CSV Columns</p>
          <div className="flex flex-wrap gap-1.5">
            {['name *', 'phone *', 'email', 'trip_interest', 'travel_date', 'budget', 'agent_name'].map(col => (
              <span key={col} className={`text-xs px-2 py-0.5 rounded font-mono ${col.includes('*') ? 'bg-brand-100 text-brand-700' : 'bg-slate-200 text-slate-600'}`}>
                {col}
              </span>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-2">* required · agent_name = employee ka exact naam (profiles table wala)</p>
        </div>

        {!file ? (
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => inputRef.current?.click()}
            className="border-2 border-dashed border-slate-200 rounded-xl p-10 flex flex-col items-center cursor-pointer hover:border-brand-400 hover:bg-brand-50/30 transition-all"
          >
            <Upload className="w-10 h-10 text-slate-300 mb-3" />
            <p className="font-medium text-slate-700">CSV file yahan drop karo ya click karo</p>
            <p className="text-xs text-slate-400 mt-1">Max 5,000 rows</p>
            <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }} />
          </div>
        ) : (
          <div className="border border-slate-200 rounded-xl p-4 flex items-center gap-3">
            <FileText className="w-8 h-8 text-brand-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-slate-800 truncate">{file.name}</p>
              <p className="text-xs text-slate-400">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
            <button onClick={reset} className="text-xs text-slate-400 hover:text-red-500">Remove</button>
          </div>
        )}

        {result && (
          <div className={`rounded-xl p-4 ${result.inserted > 0 ? 'bg-brand-50' : 'bg-red-50'}`}>
            <div className="flex items-center gap-2 mb-2">
              {result.inserted > 0
                ? <CheckCircle className="w-4 h-4 text-brand-600" />
                : <AlertCircle className="w-4 h-4 text-red-500" />}
              <span className="font-medium text-sm">{result.inserted} leads import hue</span>
            </div>
            {result.errors.length > 0 && (
              <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                {result.errors.slice(0, 10).map((err, i) => (
                  <p key={i} className="text-xs text-red-600">{err}</p>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={handleUpload} className="btn-primary flex-1 justify-center" disabled={!file || uploading}>
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {uploading ? 'Uploading…' : 'Import Leads'}
          </button>
          <button onClick={() => { reset(); onClose() }} className="btn-secondary">Cancel</button>
        </div>
      </div>
    </Modal>
  )
}
