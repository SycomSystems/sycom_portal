'use client'

import { useEffect, useState, useMemo } from 'react'
import { PortalLayout } from '@/components/layout/PortalLayout'
import { Plus, Edit2, Trash2, ToggleLeft, ToggleRight, Clock, Search } from 'lucide-react'

interface RecurringTicket {
  id: string; subject: string; description: string | null; priority: string
  isActive: boolean; scheduleType: string; intervalDays: number | null
  weekday: number | null; monthDay: number | null; nextRunAt: string; lastRunAt: string | null
  assignedTo: { id: string; name: string } | null
  client: { id: string; name: string } | null
  createdBy: { id: string; name: string }
}
interface RecurringReport {
  id: string; name: string; hoursType: string; hours: number; note: string | null
  isService: boolean; quantity: number; unitPrice: number; isActive: boolean; scheduleType: string; intervalDays: number | null
  weekday: number | null; monthDay: number | null; nextRunAt: string; lastRunAt: string | null
  user: { id: string; name: string }
  client: { id: string; name: string } | null
  createdBy: { id: string; name: string }
}
interface User { id: string; name: string; email: string }
interface Client { id: string; name: string }

const WEEKDAYS = ['Nedeľa','Pondelok','Utorok','Streda','Štvrtok','Piatok','Sobota']
const HOURS_TYPES = [
  { value: 'STANDARD', label: 'Standard' },
  { value: 'STANDARD_MIMO', label: 'Standard mimo prac. casu' },
  { value: 'SERVER', label: 'Server' },
  { value: 'SERVER_MIMO', label: 'Server mimo prac. casu' },
]
const PRIORITIES = ['LOW','MEDIUM','HIGH','URGENT']
const PRIORITY_LABELS: Record<string,string> = {LOW:'Nízka',MEDIUM:'Stredná',HIGH:'Vysoká',URGENT:'Urgentná'}
const PRIORITY_COLORS: Record<string,string> = {LOW:'bg-gray-100 text-gray-600',MEDIUM:'bg-blue-100 text-blue-700',HIGH:'bg-orange-100 text-orange-700',URGENT:'bg-red-100 text-red-700'}

function scheduleLabel(r:{scheduleType:string;intervalDays:number|null;weekday:number|null;monthDay:number|null}) {
  if (r.scheduleType==='INTERVAL') return `Každých ${r.intervalDays} dní`
  if (r.scheduleType==='WEEKDAY') return `Každý ${WEEKDAYS[r.weekday??0]}`
  if (r.scheduleType==='MONTHDAY') return `${r.monthDay}. v mesiaci`
  return r.scheduleType
}

const emptyTF = {subject:'',description:'',priority:'MEDIUM',assignedToId:'',clientId:'',scheduleType:'WEEKDAY',intervalDays:7,weekday:0,monthDay:1,firstRunAt:''}
const emptyRF = {name:'',hoursType:'STANDARD',hours:1,quantity:1,unitPrice:0,note:'',isService:false,assignedUserId:'',clientId:'',scheduleType:'WEEKDAY',intervalDays:7,weekday:0,monthDay:1,firstRunAt:''}

type Tab = 'tickets'|'work'|'service'

function ScheduleFields({form,setForm}:{form:any;setForm:any}) {
  return <>
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">Frekvencia</label>
      <select value={form.scheduleType} onChange={e=>setForm((f:any)=>({...f,scheduleType:e.target.value}))}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
        <option value="WEEKDAY">Každý týždeň (deň v týždni)</option>
        <option value="MONTHDAY">Každý mesiac (deň v mesiaci)</option>
        <option value="INTERVAL">Každých N dní</option>
      </select>
    </div>
    {form.scheduleType==='WEEKDAY'&&<div>
      <label className="block text-xs font-medium text-gray-700 mb-1">Deň v týždni</label>
      <select value={form.weekday} onChange={e=>setForm((f:any)=>({...f,weekday:parseInt(e.target.value)}))}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
        {WEEKDAYS.map((d,i)=><option key={i} value={i}>{d}</option>)}
      </select>
    </div>}
    {form.scheduleType==='MONTHDAY'&&<div>
      <label className="block text-xs font-medium text-gray-700 mb-1">Deň v mesiaci (1–28)</label>
      <input type="number" min="1" max="28" value={form.monthDay} onChange={e=>setForm((f:any)=>({...f,monthDay:parseInt(e.target.value)||1}))}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
    </div>}
    {form.scheduleType==='INTERVAL'&&<div>
      <label className="block text-xs font-medium text-gray-700 mb-1">Počet dní</label>
      <input type="number" min="1" value={form.intervalDays} onChange={e=>setForm((f:any)=>({...f,intervalDays:parseInt(e.target.value)||7}))}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
    </div>}
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">Prvý / ďalší beh</label>
      <input type="datetime-local" value={form.firstRunAt} onChange={e=>setForm((f:any)=>({...f,firstRunAt:e.target.value}))}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
    </div>
  </>
}

export default function RecurringReportsPage() {
  const [tab,setTab]=useState<Tab>('tickets')
  const [tickets,setTickets]=useState<RecurringTicket[]>([])
  const [reports,setReports]=useState<RecurringReport[]>([])
  const [users,setUsers]=useState<User[]>([])
  const [clients,setClients]=useState<Client[]>([])
  const [loading,setLoading]=useState(true)
  const [search,setSearch]=useState('')
  const [filterClient,setFilterClient]=useState('')
  const [filterUser,setFilterUser]=useState('')
  const [filterSchedule,setFilterSchedule]=useState('')
  const [filterActive,setFilterActive]=useState('')
  const [showTM,setShowTM]=useState(false)
  const [editTId,setEditTId]=useState<string|null>(null)
  const [tf,setTf]=useState({...emptyTF})
  const [showRM,setShowRM]=useState(false)
  const [editRId,setEditRId]=useState<string|null>(null)
  const [rf,setRf]=useState({...emptyRF})
  const [saving,setSaving]=useState(false)
  const [delTarget,setDelTarget]=useState<{id:string;type:'ticket'|'report'}|null>(null)

  async function load(){
    setLoading(true)
    const [rt,rr,ru,rc]=await Promise.all([
      fetch('/api/admin/recurring-tickets').then(r=>r.json()),
      fetch('/api/admin/recurring-reports').then(r=>r.json()),
      fetch('/api/users').then(r=>r.json()),
      fetch('/api/clients').then(r=>r.json()),
    ])
    setTickets(Array.isArray(rt)?rt:[])
    setReports(Array.isArray(rr)?rr:[])
    setUsers(Array.isArray(ru)?ru:[])
    setClients(Array.isArray(rc)?rc:[])
    setLoading(false)
  }
  useEffect(()=>{load()},[])

  function switchTab(t:Tab){setTab(t);setSearch('');setFilterClient('');setFilterUser('');setFilterSchedule('');setFilterActive('')}

  const filteredTickets=useMemo(()=>tickets.filter(t=>{
    const q=search.toLowerCase()
    if(q&&!t.subject.toLowerCase().includes(q)&&!(t.description??'').toLowerCase().includes(q)&&!(t.client?.name??'').toLowerCase().includes(q)&&!(t.assignedTo?.name??'').toLowerCase().includes(q))return false
    if(filterClient&&t.client?.id!==filterClient)return false
    if(filterUser&&t.assignedTo?.id!==filterUser)return false
    if(filterSchedule&&t.scheduleType!==filterSchedule)return false
    if(filterActive==='active'&&!t.isActive)return false
    if(filterActive==='inactive'&&t.isActive)return false
    return true
  }),[tickets,search,filterClient,filterUser,filterSchedule,filterActive])

  const filteredReports=useMemo(()=>reports.filter(r=>{
    if(r.isService!==(tab==='service'))return false
    const q=search.toLowerCase()
    if(q&&!r.name.toLowerCase().includes(q)&&!(r.note??'').toLowerCase().includes(q)&&!(r.client?.name??'').toLowerCase().includes(q)&&!r.user.name.toLowerCase().includes(q))return false
    if(filterClient&&r.client?.id!==filterClient)return false
    if(filterUser&&r.user.id!==filterUser)return false
    if(filterSchedule&&r.scheduleType!==filterSchedule)return false
    if(filterActive==='active'&&!r.isActive)return false
    if(filterActive==='inactive'&&r.isActive)return false
    return true
  }),[reports,tab,search,filterClient,filterUser,filterSchedule,filterActive])

  function nextDay(h:number){const d=new Date();d.setDate(d.getDate()+1);d.setHours(h,0,0,0);return d.toISOString().slice(0,16)}

  function openCreateTicket(){setEditTId(null);setTf({...emptyTF,firstRunAt:nextDay(8)});setShowTM(true)}
  function openEditTicket(t:RecurringTicket){
    setEditTId(t.id)
    setTf({subject:t.subject,description:t.description??'',priority:t.priority,assignedToId:t.assignedTo?.id??'',clientId:t.client?.id??'',scheduleType:t.scheduleType,intervalDays:t.intervalDays??7,weekday:t.weekday??0,monthDay:t.monthDay??1,firstRunAt:t.nextRunAt?new Date(t.nextRunAt).toISOString().slice(0,16):''})
    setShowTM(true)
  }
  async function saveTicket(){
    if(!tf.subject.trim())return
    setSaving(true)
    const body={subject:tf.subject.trim(),description:tf.description||null,priority:tf.priority,assignedToId:tf.assignedToId||null,clientId:tf.clientId||null,scheduleType:tf.scheduleType,intervalDays:tf.scheduleType==='INTERVAL'?Number(tf.intervalDays):null,weekday:tf.scheduleType==='WEEKDAY'?Number(tf.weekday):null,monthDay:tf.scheduleType==='MONTHDAY'?Number(tf.monthDay):null,firstRunAt:tf.firstRunAt||null}
    await fetch(editTId?`/api/admin/recurring-tickets/${editTId}`:'/api/admin/recurring-tickets',{method:editTId?'PATCH':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
    setSaving(false);setShowTM(false);load()
  }
  async function toggleTicket(t:RecurringTicket){await fetch(`/api/admin/recurring-tickets/${t.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({isActive:!t.isActive})});load()}

  function openCreateReport(isService:boolean){setEditRId(null);setRf({...emptyRF,isService,firstRunAt:nextDay(20)});setShowRM(true)}
  function openEditReport(r:RecurringReport){
    setEditRId(r.id)
    setRf({name:r.name,hoursType:r.hoursType,hours:r.hours,quantity:r.quantity??1,unitPrice:r.unitPrice??0,note:r.note??'',isService:r.isService,assignedUserId:r.user.id,clientId:r.client?.id??'',scheduleType:r.scheduleType,intervalDays:r.intervalDays??7,weekday:r.weekday??0,monthDay:r.monthDay??1,firstRunAt:r.nextRunAt?new Date(r.nextRunAt).toISOString().slice(0,16):''})
    setShowRM(true)
  }
  async function saveReport(){
    if(!rf.name.trim()||!rf.assignedUserId)return
    setSaving(true)
    const body={name:rf.name.trim(),hoursType:rf.hoursType,hours:Number(rf.hours),quantity:Number(rf.quantity),unitPrice:Number(rf.unitPrice),note:rf.note||null,isService:rf.isService,assignedUserId:rf.assignedUserId,clientId:rf.clientId||null,scheduleType:rf.scheduleType,intervalDays:rf.scheduleType==='INTERVAL'?Number(rf.intervalDays):null,weekday:rf.scheduleType==='WEEKDAY'?Number(rf.weekday):null,monthDay:rf.scheduleType==='MONTHDAY'?Number(rf.monthDay):null,firstRunAt:rf.firstRunAt||null}
    await fetch(editRId?`/api/admin/recurring-reports/${editRId}`:'/api/admin/recurring-reports',{method:editRId?'PATCH':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
    setSaving(false);setShowRM(false);load()
  }
  async function toggleReport(r:RecurringReport){await fetch(`/api/admin/recurring-reports/${r.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({isActive:!r.isActive})});load()}

  async function confirmDelete(){
    if(!delTarget)return
    await fetch(delTarget.type==='ticket'?`/api/admin/recurring-tickets/${delTarget.id}`:`/api/admin/recurring-reports/${delTarget.id}`,{method:'DELETE'})
    setDelTarget(null);load()
  }

  const inputCls="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
  const thCls="px-4 py-3 text-left"
  const tdCls="px-4 py-3"

  return (
    <PortalLayout>
      <div className="w-full py-4 px-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Opakujúce sa záznamy</h1>
            <p className="text-sm text-gray-500 mt-0.5">Automatické tikety, výkazy práce a paušálne služby</p>
          </div>
          <button onClick={()=>tab==='tickets'?openCreateTicket():openCreateReport(tab==='service')}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium">
            <Plus size={16}/>Pridať
          </button>
        </div>

        <div className="flex gap-1 border-b border-gray-200 mb-4">
          {([['tickets','Tikety'],['work','Výkazy práce'],['service','Paušály / Služby']] as [Tab,string][]).map(([key,label])=>(
            <button key={key} onClick={()=>switchTab(key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab===key?'border-blue-600 text-blue-600':'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {label}
              <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">
                {key==='tickets'?tickets.length:reports.filter(r=>r.isService===(key==='service')).length}
              </span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
            <input type="text" placeholder="Hľadať..." value={search} onChange={e=>setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"/>
          </div>
          <select value={filterClient} onChange={e=>setFilterClient(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Všetci klienti</option>
            {clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={filterUser} onChange={e=>setFilterUser(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Všetci technici</option>
            {users.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <select value={filterSchedule} onChange={e=>setFilterSchedule(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Všetky frekvencie</option>
            <option value="WEEKDAY">Týždenné</option>
            <option value="MONTHDAY">Mesačné</option>
            <option value="INTERVAL">Intervalové</option>
          </select>
          <select value={filterActive} onChange={e=>setFilterActive(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Aktívne aj nie</option>
            <option value="active">Len aktívne</option>
            <option value="inactive">Len neaktívne</option>
          </select>
        </div>

        {loading?(
          <div className="flex items-center justify-center py-20 text-gray-400">Načítavam...</div>
        ):(
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {tab==='tickets'&&(filteredTickets.length===0?(
              <div className="py-16 text-center text-gray-400 text-sm">Žiadne záznamy</div>
            ):(
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <tr>
                    <th className={thCls}>Predmet</th><th className={thCls}>Klient</th><th className={thCls}>Technik</th>
                    <th className={thCls}>Priorita</th><th className={thCls}>Plán</th><th className={thCls}>Ďalší beh</th>
                    <th className={thCls}>Aktívny</th><th className="px-4 py-3 text-right">Akcie</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredTickets.map(t=>(
                    <tr key={t.id} className={`hover:bg-gray-50 ${!t.isActive?'opacity-50':''}`}>
                      <td className={tdCls}>
                        <div className="font-medium text-gray-900">{t.subject}</div>
                        {t.description&&<div className="text-xs text-gray-400 mt-0.5 max-w-xs truncate">{t.description}</div>}
                      </td>
                      <td className={`${tdCls} text-gray-600`}>{t.client?.name??'—'}</td>
                      <td className={`${tdCls} text-gray-600`}>{t.assignedTo?.name??'—'}</td>
                      <td className={tdCls}>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[t.priority]??'bg-gray-100 text-gray-600'}`}>
                          {PRIORITY_LABELS[t.priority]??t.priority}
                        </span>
                      </td>
                      <td className={tdCls}>
                        <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                          <Clock size={10}/>{scheduleLabel(t)}
                        </span>
                      </td>
                      <td className={`${tdCls} text-gray-500 text-xs`}>
                        {new Date(t.nextRunAt).toLocaleString('sk-SK',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}
                      </td>
                      <td className={tdCls}>
                        <button onClick={()=>toggleTicket(t)}>
                          {t.isActive?<ToggleRight size={22} className="text-green-500"/>:<ToggleLeft size={22} className="text-gray-400"/>}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button onClick={()=>openEditTicket(t)} className="text-gray-400 hover:text-blue-600 p-1 rounded"><Edit2 size={15}/></button>
                          <button onClick={()=>setDelTarget({id:t.id,type:'ticket'})} className="text-gray-400 hover:text-red-600 p-1 rounded"><Trash2 size={15}/></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ))}

            {(tab==='work'||tab==='service')&&(filteredReports.length===0?(
              <div className="py-16 text-center text-gray-400 text-sm">Žiadne záznamy</div>
            ):(
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <tr>
                    <th className={thCls}>Názov</th><th className={thCls}>Klient</th><th className={thCls}>Technik</th>
                    <th className={thCls}>Hodiny</th><th className={thCls}>Cena</th><th className={thCls}>Spolu</th><th className={thCls}>Plán</th><th className={thCls}>Ďalší beh</th>
                    <th className={thCls}>Aktívny</th><th className="px-4 py-3 text-right">Akcie</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredReports.map(r=>(
                    <tr key={r.id} className={`hover:bg-gray-50 ${!r.isActive?'opacity-50':''}`}>
                      <td className={tdCls}>
                        <div className="font-medium text-gray-900">{r.name}</div>
                        {r.note&&<div className="text-xs text-gray-400 mt-0.5">{r.note}</div>}
                      </td>
                      <td className={`${tdCls} text-gray-600`}>{r.client?.name??'—'}</td>
                      <td className={`${tdCls} text-gray-600`}>{r.user.name}</td>
                      <td className={`${tdCls} text-gray-600`}>{r.hours}h{!r.isService&&<span className="ml-1 text-xs text-gray-400">({HOURS_TYPES.find(t=>t.value===r.hoursType)?.label??r.hoursType})</span>}</td>
                      <td className={`${tdCls} text-gray-600`}>{r.isService?`${r.quantity}× ${r.unitPrice.toFixed(2)}€`:'—'}</td>
                      <td className={`${tdCls} font-medium text-gray-800`}>{r.isService?(r.quantity*r.unitPrice).toFixed(2)+'€':'—'}</td>
                      <td className={tdCls}>
                        <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                          <Clock size={10}/>{scheduleLabel(r)}
                        </span>
                      </td>
                      <td className={`${tdCls} text-gray-500 text-xs`}>
                        {new Date(r.nextRunAt).toLocaleString('sk-SK',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}
                      </td>
                      <td className={tdCls}>
                        <button onClick={()=>toggleReport(r)}>
                          {r.isActive?<ToggleRight size={22} className="text-green-500"/>:<ToggleLeft size={22} className="text-gray-400"/>}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button onClick={()=>openEditReport(r)} className="text-gray-400 hover:text-blue-600 p-1 rounded"><Edit2 size={15}/></button>
                          <button onClick={()=>setDelTarget({id:r.id,type:'report'})} className="text-gray-400 hover:text-red-600 p-1 rounded"><Trash2 size={15}/></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ))}
          </div>
        )}
      </div>

      {showTM&&(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">{editTId?'Upraviť tiket':'Nový opakujúci sa tiket'}</h2>
              <button onClick={()=>setShowTM(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Predmet *</label>
                <input type="text" value={tf.subject} onChange={e=>setTf(f=>({...f,subject:e.target.value}))} placeholder="napr. Mesačná záloha servera" className={inputCls}/>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Popis</label>
                <textarea value={tf.description} onChange={e=>setTf(f=>({...f,description:e.target.value}))} rows={2} className={`${inputCls} resize-none`}/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Technik</label>
                  <select value={tf.assignedToId} onChange={e=>setTf(f=>({...f,assignedToId:e.target.value}))} className={inputCls}>
                    <option value="">— bez technika —</option>
                    {users.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Priorita</label>
                  <select value={tf.priority} onChange={e=>setTf(f=>({...f,priority:e.target.value}))} className={inputCls}>
                    {PRIORITIES.map(p=><option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Klient</label>
                <select value={tf.clientId} onChange={e=>setTf(f=>({...f,clientId:e.target.value}))} className={inputCls}>
                  <option value="">— bez klienta —</option>
                  {clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <ScheduleFields form={tf} setForm={setTf}/>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button onClick={()=>setShowTM(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Zrušiť</button>
              <button onClick={saveTicket} disabled={saving||!tf.subject.trim()} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {saving?'Ukladám...':(editTId?'Uložiť':'Vytvoriť')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showRM&&(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">{editRId?'Upraviť záznam':(rf.isService?'Nová paušálna služba':'Nový výkaz práce')}</h2>
              <button onClick={()=>setShowRM(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Názov *</label>
                <input type="text" value={rf.name} onChange={e=>setRf(f=>({...f,name:e.target.value}))} placeholder={rf.isService?'napr. Mesačný monitoring':'napr. Kontrola servera'} className={inputCls}/>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Technik *</label>
                <select value={rf.assignedUserId} onChange={e=>setRf(f=>({...f,assignedUserId:e.target.value}))} className={inputCls}>
                  <option value="">— vybrať technika —</option>
                  {users.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Klient</label>
                <select value={rf.clientId} onChange={e=>setRf(f=>({...f,clientId:e.target.value}))} className={inputCls}>
                  <option value="">— bez klienta —</option>
                  {clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Hodiny *</label>
                  <input type="number" min="0.25" step="0.25" value={rf.hours} onChange={e=>setRf(f=>({...f,hours:parseFloat(e.target.value)||1}))} className={inputCls}/>
                </div>
                {!rf.isService&&<div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Typ hodín</label>
                  <select value={rf.hoursType} onChange={e=>setRf(f=>({...f,hoursType:e.target.value}))} className={inputCls}>
                    {HOURS_TYPES.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>}
              </div>
              {rf.isService&&<div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Počet</label>
                  <input type="number" min="0" step="0.01" value={rf.quantity} onChange={e=>setRf(f=>({...f,quantity:parseFloat(e.target.value)||0}))} className={inputCls}/>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Cena / MJ (€)</label>
                  <input type="number" min="0" step="0.01" value={rf.unitPrice} onChange={e=>setRf(f=>({...f,unitPrice:parseFloat(e.target.value)||0}))} className={inputCls}/>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Spolu</label>
                  <div className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm font-semibold text-gray-800">
                    {(rf.quantity*rf.unitPrice).toFixed(2)} €
                  </div>
                </div>
              </div>}
              <ScheduleFields form={rf} setForm={setRf}/>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Poznámka</label>
                <textarea value={rf.note} onChange={e=>setRf(f=>({...f,note:e.target.value}))} rows={2} className={`${inputCls} resize-none`}/>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button onClick={()=>setShowRM(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Zrušiť</button>
              <button onClick={saveReport} disabled={saving||!rf.name.trim()||!rf.assignedUserId} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {saving?'Ukladám...':(editRId?'Uložiť':'Vytvoriť')}
              </button>
            </div>
          </div>
        </div>
      )}

      {delTarget&&(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Zmazať záznam?</h3>
            <p className="text-sm text-gray-500 mb-6">Táto akcia je nezvratná. Vytvorené záznamy zostanú zachované.</p>
            <div className="flex justify-end gap-3">
              <button onClick={()=>setDelTarget(null)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Zrušiť</button>
              <button onClick={confirmDelete} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">Zmazať</button>
            </div>
          </div>
        </div>
      )}
    </PortalLayout>
  )
}
