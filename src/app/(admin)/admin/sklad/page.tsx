'use client'
import { useState, useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { PortalLayout } from '@/components/layout/PortalLayout'
import { Plus, ShoppingCart, Package, Search, ChevronUp, ChevronDown, AlertTriangle, X, Check, Pencil, Trash2 } from 'lucide-react'

type MovementType = 'BUY' | 'SELL' | 'RETURN_FROM_CUSTOMER' | 'RETURN_TO_SUPPLIER' | 'WRITEOFF' | 'CORRECTION'
const MOVEMENT_LABELS: Record<MovementType, string> = { BUY:'Nakup', SELL:'Predaj', RETURN_FROM_CUSTOMER:'Vratenie od zakaznika', RETURN_TO_SUPPLIER:'Vratenie dodavatelovi', WRITEOFF:'Odpis', CORRECTION:'Korekcia' }
const MOVEMENT_COLORS: Record<MovementType, string> = { BUY:'bg-green-100 text-green-700', SELL:'bg-blue-100 text-blue-700', RETURN_FROM_CUSTOMER:'bg-teal-100 text-teal-700', RETURN_TO_SUPPLIER:'bg-orange-100 text-orange-700', WRITEOFF:'bg-red-100 text-red-700', CORRECTION:'bg-gray-100 text-gray-700' }

interface StockItem { id:string; name:string; sku:string|null; category:string|null; unit:string; vatRate:number; minStock:number; currentStock:number }
interface Supplier { id:string; name:string }
interface Client { id:string; name:string }
interface Movement { id:string; type:MovementType; quantity:number; pricePerUnit:number; totalPrice:number; vatRate:number; note:string|null; date:string; stockItem:StockItem; supplier:Supplier|null; client:{id:string;name:string}|null; addedBy:{id:string;name:string} }

function fmt(n:number){return n.toLocaleString('sk-SK',{minimumFractionDigits:2,maximumFractionDigits:2})}
function fmtDate(d:string){return new Date(d).toLocaleDateString('sk-SK')}
function toInputDate(d:string){return new Date(d).toISOString().slice(0,10)}

function Autocomplete({label,value,onChange,onSelect,suggestions,onNotFound,notFoundLabel,placeholder,required}:{label:string;value:string;onChange:(v:string)=>void;onSelect:(id:string,name:string,pp?:number|null)=>void;suggestions:{id:string;name:string;sub?:string}[];onNotFound?:(name:string)=>void;notFoundLabel?:string;placeholder?:string;required?:boolean}){
  const [open,setOpen]=useState(false)
  const filtered=value.length>0?suggestions.filter(s=>s.name.toLowerCase().includes(value.toLowerCase())):[]
  const exactMatch=suggestions.some(s=>s.name.toLowerCase()===value.toLowerCase())
  return(
    <div className="relative">
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}{required&&' *'}</label>
      <input type="text" value={value} onChange={e=>{onChange(e.target.value);setOpen(true)}} onFocus={()=>setOpen(true)} onBlur={()=>setTimeout(()=>setOpen(false),150)} placeholder={placeholder} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400"/>
      {open&&value.length>0&&(
        <div className="absolute z-20 mt-1 w-full border border-gray-200 rounded-xl overflow-hidden shadow-lg bg-white max-h-44 overflow-y-auto">
          {filtered.map(s=>(<button key={s.id} onMouseDown={()=>{onSelect(s.id,s.name,(s as any).purchasePrice??null);setOpen(false)}} className="w-full text-left px-3 py-2 text-sm hover:bg-sycom-50 transition-colors flex items-center justify-between"><span>{s.name}</span>{s.sub&&<span className="text-xs text-gray-400 ml-2">{s.sub}</span>}</button>))}
          {!exactMatch&&onNotFound&&(<button onMouseDown={()=>{onNotFound(value);setOpen(false)}} className="w-full text-left px-3 py-2 text-sm text-green-700 font-medium hover:bg-green-50 transition-colors border-t border-gray-100">+ {notFoundLabel??'Pridat'}: &quot;{value}&quot;</button>)}
          {filtered.length===0&&!onNotFound&&(<p className="px-3 py-2 text-sm text-gray-400">Ziadne vysledky.</p>)}
        </div>
      )}
    </div>
  )
}

export default function SkladPage(){
  const { data: session } = useSession()
  const role = (session?.user as any)?.role

  const [movements,setMovements]=useState<Movement[]>([])
  const [items,setItems]=useState<StockItem[]>([])
  const [suppliers,setSuppliers]=useState<Supplier[]>([])
  const [clients,setClients]=useState<Client[]>([])
  const [loading,setLoading]=useState(true)
  const [modal,setModal]=useState<'buy'|'sell'|null>(null)
  const [status,setStatus]=useState<{type:'success'|'error';msg:string}|null>(null)
  const [search,setSearch]=useState('')
  const [filterType,setFilterType]=useState('')
  const [filterSupplier,setFilterSupplier]=useState('')
  const [filterClient,setFilterClient]=useState('')
  const [filterFrom,setFilterFrom]=useState('')
  const [filterTo,setFilterTo]=useState('')
  const [sortCol,setSortCol]=useState('date')
  const [sortDir,setSortDir]=useState<'asc'|'desc'>('desc')

  // Buy form
  const [buyItemId,setBuyItemId]=useState('')
  const [buyItemName,setBuyItemName]=useState('')
  const [buyIsNew,setBuyIsNew]=useState(false)
  const [buyQty,setBuyQty]=useState('')
  const [buyPrice,setBuyPrice]=useState('')
  const [buyVat,setBuyVat]=useState('20')
  const [buySupplierId,setBuySupplierId]=useState('')
  const [buySupplierName,setBuySupplierName]=useState('')
  const [buyDate,setBuyDate]=useState(new Date().toISOString().slice(0,10))
  const [buyNote,setBuyNote]=useState('')
  const [buySubmitting,setBuySubmitting]=useState(false)

  // Sell form
  const [sellItemId,setSellItemId]=useState('')
  const [sellItemName,setSellItemName]=useState('')
  const [sellQty,setSellQty]=useState('')
  const [sellPrice,setSellPrice]=useState('')
  const [sellClientId,setSellClientId]=useState('')
  const [sellClientName,setSellClientName]=useState('')
  const [sellDate,setSellDate]=useState(new Date().toISOString().slice(0,10))
  const [sellNote,setSellNote]=useState('')
  const [sellPurchasePrice,setSellPurchasePrice]=useState('')
  const [sellMarkup,setSellMarkup]=useState('20')
  const [sellSubmitting,setSellSubmitting]=useState(false)

  useEffect(()=>{
    if(sellPurchasePrice){
      const pp=Number(sellPurchasePrice)
      const mu=Number(sellMarkup||20)
      setSellPrice((pp*(1+mu/100)).toFixed(2))
    }
  },[sellMarkup,sellPurchasePrice])

  // Edit movement (ADMIN only)
  const [editMovement,setEditMovement]=useState<Movement|null>(null)
  const [eQty,setEQty]=useState('')
  const [ePrice,setEPrice]=useState('')
  const [eVat,setEVat]=useState('')
  const [eNote,setENote]=useState('')
  const [eDate,setEDate]=useState('')
  const [eSubmitting,setESubmitting]=useState(false)
  const [eStatus,setEStatus]=useState<{type:'success'|'error';msg:string}|null>(null)

  const load=async()=>{
    setLoading(true)
    try{
      const p=new URLSearchParams()
      if(filterFrom)p.set('from',filterFrom)
      if(filterTo)p.set('to',filterTo)
      if(filterSupplier)p.set('supplierId',filterSupplier)
      if(filterClient)p.set('clientId',filterClient)
      if(filterType)p.set('type',filterType)
      const[m,it,su,cl]=await Promise.all([fetch('/api/stock/movements?'+p).then(r=>r.json()),fetch('/api/stock/items').then(r=>r.json()),fetch('/api/stock/suppliers').then(r=>r.json()),fetch('/api/clients').then(r=>r.json())])
      setMovements(Array.isArray(m)?m:[]);setItems(Array.isArray(it)?it:[]);setSuppliers(Array.isArray(su)?su:[]);setClients(Array.isArray(cl)?cl:[])
    }catch{}
    setLoading(false)
  }
  useEffect(()=>{load()},[filterFrom,filterTo,filterSupplier,filterClient,filterType])

  const showStatus=(type:'success'|'error',msg:string)=>{setStatus({type,msg});setTimeout(()=>setStatus(null),4000)}

  const filtered=useMemo(()=>{
    let data=[...movements]
    if(search){const q=search.toLowerCase();data=data.filter(m=>m.stockItem.name.toLowerCase().includes(q)||(m.supplier?.name??'').toLowerCase().includes(q)||(m.client?.name??'').toLowerCase().includes(q)||m.addedBy.name.toLowerCase().includes(q)||(m.note??'').toLowerCase().includes(q))}
    data.sort((a,b)=>{let av:any,bv:any;if(sortCol==='date'){av=new Date(a.date).getTime();bv=new Date(b.date).getTime()}else if(sortCol==='name'){av=a.stockItem.name;bv=b.stockItem.name}else if(sortCol==='qty'){av=a.quantity;bv=b.quantity}else if(sortCol==='price'){av=a.pricePerUnit;bv=b.pricePerUnit}else if(sortCol==='total'){av=a.totalPrice;bv=b.totalPrice}else if(sortCol==='type'){av=a.type;bv=b.type}else if(sortCol==='supplier'){av=a.supplier?.name??'';bv=b.supplier?.name??''}else if(sortCol==='client'){av=a.client?.name??'';bv=b.client?.name??''}else if(sortCol==='addedBy'){av=a.addedBy.name;bv=b.addedBy.name}else return 0;if(av<bv)return sortDir==='asc'?-1:1;if(av>bv)return sortDir==='asc'?1:-1;return 0})
    return data
  },[movements,search,sortCol,sortDir])

  function toggleSort(col:string){if(sortCol===col)setSortDir(d=>d==='asc'?'desc':'asc');else{setSortCol(col);setSortDir('asc')}}
  function SortIcon({col}:{col:string}){if(sortCol!==col)return <ChevronUp size={12} className="text-gray-300"/>;return sortDir==='asc'?<ChevronUp size={12} className="text-sycom-500"/>:<ChevronDown size={12} className="text-sycom-500"/>}

  const selectedSellItem=items.find(i=>i.id===sellItemId)
  const buyTotal=(parseFloat(buyQty)||0)*(parseFloat(buyPrice)||0)
  const sellTotal=(parseFloat(sellQty)||0)*(parseFloat(sellPrice)||0)
  const lowStock=items.filter(i=>i.minStock>0&&i.currentStock<=i.minStock)
  const itemSuggestions=items.map(i=>({id:i.id,name:i.name,sub:i.currentStock+' '+i.unit+' skladom'}))
  const supplierSuggestions=suppliers.map(s=>({id:s.id,name:s.name}))
  const clientSuggestions=clients.map(c=>({id:c.id,name:c.name}))

  async function handleBuy(){
    if(!buyItemName.trim()||!buyQty||!buyPrice)return
    setBuySubmitting(true)
    try{
      let stockItemId=buyItemId
      if(!stockItemId||buyIsNew){const r=await fetch('/api/stock/items',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:buyItemName.trim(),vatRate:parseFloat(buyVat)})});const ni=await r.json();if(!r.ok)throw new Error(ni.error||'Chyba');stockItemId=ni.id}
      const res=await fetch('/api/stock/movements',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'BUY',stockItemId,quantity:parseFloat(buyQty),pricePerUnit:parseFloat(buyPrice),vatRate:parseFloat(buyVat),supplierId:buySupplierId||null,newSupplierName:!buySupplierId&&buySupplierName.trim()?buySupplierName.trim():null,note:buyNote||null,date:buyDate})})
      const data=await res.json();if(!res.ok)throw new Error(data.error||'Chyba')
      setModal(null);setBuyItemId('');setBuyItemName('');setBuyIsNew(false);setBuyQty('');setBuyPrice('');setBuyVat('20');setBuySupplierId('');setBuySupplierName('');setBuyNote('');setBuyDate(new Date().toISOString().slice(0,10))
      load();showStatus('success','Tovar bol pridany na sklad.')
    }catch(e:any){showStatus('error',e.message)}finally{setBuySubmitting(false)}
  }

  async function handleSell(){
    if(!sellItemId||!sellQty||!sellPrice)return
    setSellSubmitting(true)
    try{
      const res=await fetch('/api/stock/movements',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'SELL',stockItemId:sellItemId,quantity:parseFloat(sellQty),pricePerUnit:parseFloat(sellPrice),vatRate:selectedSellItem?.vatRate??20,clientId:sellClientId||null,note:sellNote||null,date:sellDate})})
      const data=await res.json();if(!res.ok)throw new Error(data.error||'Chyba')
      setModal(null);setSellItemId('');setSellItemName('');setSellQty('');setSellPrice('');setSellPurchasePrice('');setSellMarkup('20');setSellClientId('');setSellClientName('');setSellNote('');setSellDate(new Date().toISOString().slice(0,10))
      load();showStatus('success','Predaj bol zaznamenanÃ½.')
    }catch(e:any){showStatus('error',e.message)}finally{setSellSubmitting(false)}
  }

  function openEdit(m:Movement){
    setEditMovement(m);setEQty(String(m.quantity));setEPrice(String(m.pricePerUnit));setEVat(String(m.vatRate));setENote(m.note||'');setEDate(toInputDate(m.date));setEStatus(null)
  }

  async function handleEditSave(){
    if(!editMovement)return
    setESubmitting(true)
    try{
      const res=await fetch('/api/stock/movements?id='+editMovement.id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({quantity:parseFloat(eQty),pricePerUnit:parseFloat(ePrice),vatRate:parseFloat(eVat),note:eNote||null,date:eDate})})
      const data=await res.json();if(!res.ok)throw new Error(data.error||'Chyba')
      setEStatus({type:'success',msg:'Ulozene.'})
      load();setTimeout(()=>{setEStatus(null);setEditMovement(null)},1000)
    }catch(e:any){setEStatus({type:'error',msg:e.message})}finally{setESubmitting(false)}
  }

  async function handleDelete(id:string){
    if(!confirm('Naozaj vymazat tento pohyb skladu? Stav skladu bude upraveny.'))return
    const res=await fetch('/api/stock/movements?id='+id,{method:'DELETE'})
    if(res.ok){load();showStatus('success','Zaznam bol vymazany.')}
    else showStatus('error','Chyba pri mazani.')
  }

  return(
    <PortalLayout>
      <div className="w-full max-w-7xl mx-auto py-8 px-6">
        <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
          <div><h1 className="text-2xl font-bold text-gray-900">Sklad</h1><p className="text-sm text-gray-500 mt-1">Evidencia pohybov tovaru na sklade.</p></div>
          <div className="flex items-center gap-2">
            <button onClick={()=>setModal('buy')} className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700 transition-colors"><Plus size={15}/> Prijem tovaru</button>
            <button onClick={()=>setModal('sell')} className="flex items-center gap-2 px-4 py-2.5 bg-sycom-500 text-white text-sm font-semibold rounded-xl hover:bg-sycom-600 transition-colors"><ShoppingCart size={15}/> Predaj tovaru</button>
          </div>
        </div>

        {status&&(<div className={'mb-4 flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm '+(status.type==='success'?'bg-green-50 border border-green-200 text-green-800':'bg-red-50 border border-red-200 text-red-800')}>{status.type==='success'?<Check size={16}/>:<X size={16}/>} {status.msg}</div>)}
        {lowStock.length>0&&(<div className="mb-4 flex items-start gap-2.5 px-4 py-3 bg-orange-50 border border-orange-200 text-orange-800 rounded-xl text-sm"><AlertTriangle size={16} className="shrink-0 mt-0.5"/><span><strong>Nizky stav skladu:</strong> {lowStock.map(i=>i.name+' ('+i.currentStock+' '+i.unit+')').join(', ')}</span></div>)}

        <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="relative sm:col-span-2"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/><input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Hladat..." className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400"/></div>
          <select value={filterType} onChange={e=>setFilterType(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none"><option value="">Vsetky typy</option>{(Object.keys(MOVEMENT_LABELS)as MovementType[]).map(v=><option key={v} value={v}>{MOVEMENT_LABELS[v]}</option>)}</select>
          <select value={filterSupplier} onChange={e=>setFilterSupplier(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none"><option value="">Vsetci dodavatelia</option>{suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>
          <select value={filterClient} onChange={e=>setFilterClient(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none"><option value="">Vsetci zakaznici</option>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <div className="flex items-center gap-1"><input type="date" value={filterFrom} onChange={e=>setFilterFrom(e.target.value)} className="flex-1 px-2 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none"/><span className="text-gray-400 text-xs">-</span><input type="date" value={filterTo} onChange={e=>setFilterTo(e.target.value)} className="flex-1 px-2 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none"/></div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {[['type','Typ'],['name','Nazov'],['qty','Mnozstvo'],['price','Cena bez DPH'],['total','Spolu bez DPH'],['date','Datum'],['supplier','Dodavatel'],['client','Zakaznik'],['addedBy','Zapisal'],['note','Poznamka']].map(([col,label])=>(<th key={col} onClick={()=>toggleSort(col)} className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-600 select-none whitespace-nowrap"><span className="flex items-center gap-1">{label} <SortIcon col={col}/></span></th>))}
                  {role==='ADMIN'&&<th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading?(<tr><td colSpan={role==='ADMIN'?11:10} className="px-4 py-8 text-center text-sm text-gray-400">Nacitavam...</td></tr>):filtered.length===0?(<tr><td colSpan={role==='ADMIN'?11:10} className="px-4 py-12 text-center"><Package size={32} className="mx-auto mb-2 text-gray-200"/><p className="text-sm text-gray-400">Ziadne pohyby skladu.</p></td></tr>):filtered.map(m=>(
                  <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap"><span className={'text-[11px] font-bold px-2 py-0.5 rounded-full '+MOVEMENT_COLORS[m.type]}>{MOVEMENT_LABELS[m.type]}</span></td>
                    <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{m.stockItem.name}{m.stockItem.sku&&<span className="ml-1 text-[10px] text-gray-400">({m.stockItem.sku})</span>}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{m.quantity} {m.stockItem.unit}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{fmt(m.pricePerUnit)} EUR</td>
                    <td className="px-4 py-3 font-semibold whitespace-nowrap">{fmt(m.totalPrice)} EUR</td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-500">{fmtDate(m.date)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600">{m.supplier?.name??'-'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600">{m.client?.name??'-'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-500">{m.addedBy.name}</td>
                    <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{m.note??'-'}</td>
                    {role==='ADMIN'&&(
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <button onClick={()=>openEdit(m)} className="p-1.5 text-gray-400 hover:text-sycom-500 hover:bg-sycom-50 rounded-lg transition-colors"><Pencil size={13}/></button>
                          <button onClick={()=>handleDelete(m.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={13}/></button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length>0&&(<div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400"><span>{filtered.length} zaznamov</span><span className="font-semibold text-gray-600">Celkom: {fmt(filtered.reduce((s,m)=>s+m.totalPrice,0))} EUR bez DPH</span></div>)}
        </div>

        <div className="mt-6 bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between"><h2 className="text-base font-semibold text-gray-900">Stav skladu</h2><span className="text-xs text-gray-400">{items.length} poloziek</span></div>
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-gray-100">{['Nazov','SKU','Kategoria','Jednotka','DPH','Min.stav','Aktualny stav'].map(h=>(<th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>))}</tr></thead><tbody className="divide-y divide-gray-100">{items.length===0?(<tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">Ziadne polozky.</td></tr>):items.map(item=>(<tr key={item.id} className={'hover:bg-gray-50 '+(item.minStock>0&&item.currentStock<=item.minStock?'bg-orange-50':'')}><td className="px-4 py-3 font-medium text-gray-900">{item.name}</td><td className="px-4 py-3 text-gray-500">{item.sku??'-'}</td><td className="px-4 py-3 text-gray-500">{item.category??'-'}</td><td className="px-4 py-3 text-gray-500">{item.unit}</td><td className="px-4 py-3 text-gray-500">{item.vatRate}%</td><td className="px-4 py-3 text-gray-500">{item.minStock}</td><td className="px-4 py-3 font-semibold"><span className={item.minStock>0&&item.currentStock<=item.minStock?'text-orange-600 flex items-center gap-1':'text-gray-900'}>{item.minStock>0&&item.currentStock<=item.minStock&&<AlertTriangle size={13}/>}{item.currentStock} {item.unit}</span></td></tr>))}</tbody></table></div>
        </div>
      </div>

      {/* BUY MODAL */}
      {modal==='buy'&&(
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10"><h2 className="text-base font-semibold text-gray-900">Prijem tovaru</h2><button onClick={()=>setModal(null)} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"><X size={16}/></button></div>
            <div className="p-6 space-y-4">
              <Autocomplete label="Nazov tovaru" value={buyItemName} onChange={v=>{setBuyItemName(v);setBuyItemId('');setBuyIsNew(false)}} onSelect={(id,name)=>{setBuyItemId(id);setBuyItemName(name);setBuyIsNew(false);const item=items.find(i=>i.id===id);if(item)setBuyVat(String(item.vatRate))}} suggestions={itemSuggestions} onNotFound={name=>{setBuyItemName(name);setBuyItemId('');setBuyIsNew(true)}} notFoundLabel="Vytvorit novy tovar" placeholder="Hladat alebo zadat novy tovar..." required/>
              {buyIsNew&&(<p className="text-xs text-green-700 bg-green-50 border border-green-200 px-3 py-2 rounded-xl">Novy tovar bude vytvoreny automaticky pri ulozeni.</p>)}
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-gray-500 mb-1">Mnozstvo *</label><input type="number" min="0.01" step="0.01" value={buyQty} onChange={e=>setBuyQty(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400"/></div>
                <div><label className="block text-xs font-medium text-gray-500 mb-1">Cena/ks bez DPH (EUR) *</label><input type="number" min="0" step="0.01" value={buyPrice} onChange={e=>setBuyPrice(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400"/></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-gray-500 mb-1">DPH (%)</label><input type="number" min="0" max="100" step="1" value={buyVat} onChange={e=>setBuyVat(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400"/></div>
                <div className="flex flex-col justify-end"><p className="text-xs text-gray-400 mb-1">Spolu bez DPH</p><p className="text-lg font-bold text-gray-900">{fmt(buyTotal)} EUR</p></div>
              </div>
              <Autocomplete label="Dodavatel" value={buySupplierName} onChange={v=>{setBuySupplierName(v);setBuySupplierId('')}} onSelect={(id,name)=>{setBuySupplierId(id);setBuySupplierName(name)}} suggestions={supplierSuggestions} onNotFound={name=>{setBuySupplierName(name);setBuySupplierId('')}} notFoundLabel="Pridat noveho dodavatela" placeholder="Hladat alebo zadat noveho dodavatela..."/>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-gray-500 mb-1">Datum nakupu</label><input type="date" value={buyDate} onChange={e=>setBuyDate(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400"/></div>
                <div><label className="block text-xs font-medium text-gray-500 mb-1">Poznamka</label><input type="text" value={buyNote} onChange={e=>setBuyNote(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400"/></div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2 sticky bottom-0 bg-white">
              <button onClick={()=>setModal(null)} className="px-4 py-2 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50">Zrusit</button>
              <button onClick={handleBuy} disabled={buySubmitting||!buyItemName.trim()||!buyQty||!buyPrice} className="flex items-center gap-2 px-5 py-2 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700 disabled:opacity-50 transition-colors"><Plus size={15}/> {buySubmitting?'Ukladam...':'Pridat na sklad'}</button>
            </div>
          </div>
        </div>
      )}

      {/* SELL MODAL */}
      {modal==='sell'&&(
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10"><h2 className="text-base font-semibold text-gray-900">Predaj tovaru</h2><button onClick={()=>setModal(null)} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"><X size={16}/></button></div>
            <div className="p-6 space-y-4">
              <Autocomplete label="Tovar" value={sellItemName} onChange={v=>{setSellItemName(v);setSellItemId('');setSellPrice('');setSellPurchasePrice('')}} onSelect={(id,name,pp)=>{setSellItemId(id);setSellItemName(name);const p=Number(pp||0);const mu=Number(sellMarkup||20);setSellPurchasePrice(pp!=null?String(pp):'');setSellPrice(p>0?(p*(1+mu/100)).toFixed(2):'');}} suggestions={itemSuggestions.filter(i=>{const item=items.find(x=>x.id===i.id);return(item?.currentStock??0)>0})} placeholder="Hladat tovar na sklade..." required/>
              {selectedSellItem&&<p className="text-xs text-gray-400">Skladom: <strong>{selectedSellItem.currentStock} {selectedSellItem.unit}</strong></p>}
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-gray-500 mb-1">Mnozstvo *</label><input type="number" min="0.01" step="0.01" value={sellQty} onChange={e=>setSellQty(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400"/></div>
                <div><label className="block text-xs font-medium text-gray-500 mb-1">Nákupná cena/ks (EUR)</label><input readOnly value={sellPurchasePrice} placeholder="Vyberte produkt..." className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-gray-50 text-gray-400 cursor-default"/></div><div><label className="block text-xs font-medium text-gray-500 mb-1">Prirážka (%)</label><input type="number" min="0" value={sellMarkup} onChange={e=>{setSellMarkup(e.target.value)}} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400"/></div><div><label className="block text-xs font-medium text-gray-500 mb-1">Predajná cena/ks bez DPH (EUR) *</label><input type="number" min="0" step="0.01" value={sellPrice} onChange={e=>setSellPrice(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400"/></div>
              </div>
              <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3"><p className="text-xs text-gray-500 font-medium">Spolu bez DPH</p><p className="text-lg font-bold text-gray-900">{fmt(sellTotal)} EUR</p></div>
              <Autocomplete label="Zakaznik" value={sellClientName} onChange={v=>{setSellClientName(v);setSellClientId('')}} onSelect={(id,name)=>{setSellClientId(id);setSellClientName(name)}} suggestions={clientSuggestions} placeholder="Hladat zakaznika..."/>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-gray-500 mb-1">Datum predaja</label><input type="date" value={sellDate} onChange={e=>setSellDate(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400"/></div>
                <div><label className="block text-xs font-medium text-gray-500 mb-1">Poznamka</label><input type="text" value={sellNote} onChange={e=>setSellNote(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400"/></div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2 sticky bottom-0 bg-white">
              <button onClick={()=>setModal(null)} className="px-4 py-2 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50">Zrusit</button>
              <button onClick={handleSell} disabled={sellSubmitting||!sellItemId||!sellQty||!sellPrice} className="flex items-center gap-2 px-5 py-2 bg-sycom-500 text-white text-sm font-semibold rounded-xl hover:bg-sycom-600 disabled:opacity-50 transition-colors"><ShoppingCart size={15}/> {sellSubmitting?'Ukladam...':'Zapisat predaj'}</button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MOVEMENT MODAL (ADMIN only) */}
      {editMovement&&(
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2"><Pencil size={16} className="text-sycom-500"/> Upravit pohyb</h2>
                <p className="text-xs text-gray-400 mt-0.5">{editMovement.stockItem.name} â <span className={'text-[11px] font-bold px-1.5 py-0.5 rounded-full '+MOVEMENT_COLORS[editMovement.type]}>{MOVEMENT_LABELS[editMovement.type]}</span></p>
              </div>
              <button onClick={()=>setEditMovement(null)} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"><X size={16}/></button>
            </div>
            <div className="p-6 space-y-4">
              {eStatus&&(<div className={'flex items-center gap-2 px-3 py-2 rounded-xl text-sm '+(eStatus.type==='success'?'bg-green-50 border border-green-200 text-green-700':'bg-red-50 border border-red-200 text-red-700')}>{eStatus.type==='success'?<Check size={14}/>:<X size={14}/>} {eStatus.msg}</div>)}
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-gray-500 mb-1">Mnozstvo *</label><input type="number" min="0.01" step="0.01" value={eQty} onChange={e=>setEQty(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400"/></div>
                <div><label className="block text-xs font-medium text-gray-500 mb-1">Cena/ks bez DPH (EUR)</label><input type="number" min="0" step="0.01" value={ePrice} onChange={e=>setEPrice(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400"/></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-gray-500 mb-1">DPH (%)</label><input type="number" min="0" max="100" step="1" value={eVat} onChange={e=>setEVat(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400"/></div>
                <div><label className="block text-xs font-medium text-gray-500 mb-1">Datum</label><input type="date" value={eDate} onChange={e=>setEDate(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400"/></div>
              </div>
              <div><label className="block text-xs font-medium text-gray-500 mb-1">Poznamka</label><input type="text" value={eNote} onChange={e=>setENote(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400"/></div>
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-3 py-2 rounded-xl flex items-center gap-1.5"><AlertTriangle size={13}/> Zmena mnozstva automaticky upravi stav skladu.</p>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={()=>setEditMovement(null)} className="px-4 py-2 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50">Zrusit</button>
              <button onClick={handleEditSave} disabled={eSubmitting||!eQty||!ePrice} className="flex items-center gap-2 px-5 py-2 bg-sycom-500 text-white text-sm font-semibold rounded-xl hover:bg-sycom-600 disabled:opacity-50 transition-colors"><Check size={15}/> {eSubmitting?'Ukladam...':'Ulozit zmeny'}</button>
            </div>
          </div>
        </div>
      )}
    </PortalLayout>
  )
              }
