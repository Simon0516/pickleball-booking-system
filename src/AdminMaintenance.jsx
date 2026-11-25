import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import {
  Wrench, Plus, Trash2, AlertCircle, RefreshCw, Calendar, Clock, Check,
} from 'lucide-react';

const COURTS = [
  { id: 1, letter: 'A' },
  { id: 2, letter: 'B' },
  { id: 3, letter: 'C' },
  { id: 4, letter: 'D' },
];

const HOURS_START = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];
const HOURS_END = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];

const getLocalDateStr = (d = new Date()) => {
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().split('T')[0];
};

const formatHour = (h) => {
  const ampm = h >= 12 ? 'PM' : 'AM';
  let hour = h % 12;
  hour = hour === 0 ? 12 : hour;
  return `${hour}:00 ${ampm}`;
};

export default function AdminMaintenance({ lang = 'en' }) {
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    courtIds: [1],
    block_date: getLocalDateStr(),
    start_hour: 9,
    end_hour: 11,
    reason: '',
  });

  const t = {
    en: {
      title: 'Court Maintenance Blocks',
      subtitle: 'Block time slots for maintenance, cleaning or events',
      addNew: 'Add New Block',
      courts: 'Courts',
      selectAll: 'All',
      selectNone: 'Clear',
      date: 'Date',
      startHour: 'Start',
      endHour: 'End',
      reason: 'Reason',
      reasonPlaceholder: 'e.g. Floor repair, Cleaning, Private event',
      addBtn: 'Add Block',
      adding: 'Adding...',
      existing: 'Existing Blocks',
      noBlocks: 'No maintenance blocks',
      noBlocksDesc: 'Add one above to block a court slot',
      deleteConfirm: 'Delete this maintenance block?',
      loading: 'Loading...',
      errReason: 'Please fill in the reason',
      errEndBeforeStart: 'End time must be after start time',
      errPastDate: 'Cannot block past dates',
      errNoCourt: 'Please select at least one court',
      delete: 'Delete',
    },
    ms: {
      title: 'Sekatan Selenggara Gelanggang',
      subtitle: 'Sekat slot masa untuk selenggara, pembersihan atau acara',
      addNew: 'Tambah Sekatan Baru',
      courts: 'Gelanggang',
      selectAll: 'Semua',
      selectNone: 'Kosongkan',
      date: 'Tarikh',
      startHour: 'Mula',
      endHour: 'Tamat',
      reason: 'Sebab',
      reasonPlaceholder: 'cth. Baiki lantai, Pembersihan, Acara peribadi',
      addBtn: 'Tambah Sekatan',
      adding: 'Menambah...',
      existing: 'Sekatan Sedia Ada',
      noBlocks: 'Tiada sekatan',
      noBlocksDesc: 'Tambah di atas untuk sekat slot',
      deleteConfirm: 'Padam sekatan ini?',
      loading: 'Memuatkan...',
      errReason: 'Sila isi sebab',
      errEndBeforeStart: 'Masa tamat mesti selepas masa mula',
      errPastDate: 'Tidak boleh sekat tarikh lalu',
      errNoCourt: 'Sila pilih sekurang-kurangnya satu gelanggang',
      delete: 'Padam',
    },
    zh: {
      title: '球场维修封锁',
      subtitle: '封锁时段用于维修、清洁或活动',
      addNew: '添加新封锁',
      courts: '球场',
      selectAll: '全选',
      selectNone: '清空',
      date: '日期',
      startHour: '开始',
      endHour: '结束',
      reason: '原因',
      reasonPlaceholder: '例如：地板维修、清洁、私人活动',
      addBtn: '添加封锁',
      adding: '添加中...',
      existing: '现有封锁记录',
      noBlocks: '暂无封锁记录',
      noBlocksDesc: '在上方添加以封锁球场时段',
      deleteConfirm: '确认删除这条封锁记录？',
      loading: '加载中...',
      errReason: '请填写原因',
      errEndBeforeStart: '结束时间必须晚于开始时间',
      errPastDate: '不能封锁过去的日期',
      errNoCourt: '请至少选择一个球场',
      delete: '删除',
    },
  }[lang] || {};

  const fetchBlocks = async () => {
    setLoading(true);
    setError('');
    const { data, error } = await supabase
      .from('court_blocks')
      .select('*')
      .gte('block_date', getLocalDateStr())
      .order('block_date', { ascending: true })
      .order('start_hour', { ascending: true });

    if (error) {
      setError(error.message);
      setBlocks([]);
    } else {
      setBlocks(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchBlocks();
  }, []);

  const toggleCourt = (courtId) => {
    setForm((prev) => {
      const has = prev.courtIds.includes(courtId);
      return {
        ...prev,
        courtIds: has
          ? prev.courtIds.filter((id) => id !== courtId)
          : [...prev.courtIds, courtId],
      };
    });
  };

  const selectAllCourts = () => {
    setForm((prev) => ({ ...prev, courtIds: COURTS.map((c) => c.id) }));
  };

  const clearAllCourts = () => {
    setForm((prev) => ({ ...prev, courtIds: [] }));
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    setError('');

    if (form.courtIds.length === 0) {
      setError(t.errNoCourt);
      return;
    }
    if (!form.reason.trim()) {
      setError(t.errReason);
      return;
    }
    if (form.end_hour <= form.start_hour) {
      setError(t.errEndBeforeStart);
      return;
    }
    if (form.block_date < getLocalDateStr()) {
      setError(t.errPastDate);
      return;
    }

    setSubmitting(true);

    const rowsToInsert = form.courtIds.map((courtId) => ({
      court_id: courtId,
      block_date: form.block_date,
      start_hour: form.start_hour,
      end_hour: form.end_hour,
      reason: form.reason.trim(),
      created_by: 'admin',
    }));

    const { error } = await supabase.from('court_blocks').insert(rowsToInsert);
    setSubmitting(false);

    if (error) {
      setError(error.message);
      return;
    }

    setForm((prev) => ({ ...prev, reason: '' }));
    fetchBlocks();
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t.deleteConfirm)) return;
    const { error } = await supabase.from('court_blocks').delete().eq('id', id);
    if (error) {
      alert(error.message);
      return;
    }
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  };

  const formatDate = (iso) => {
    if (!iso) return '-';
    return new Date(iso).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className="max-w-[1400px] mx-auto px-6 pt-6 space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center space-x-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-orange-100 border border-orange-200 flex items-center justify-center">
            <Wrench className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900">{t.title}</h2>
            <p className="text-xs text-slate-500 font-medium">{t.subtitle}</p>
          </div>
        </div>

        <form onSubmit={handleAdd} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-slate-600 uppercase">
                {t.courts}
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={selectAllCourts}
                  className="text-[11px] font-bold text-[#2563EB] hover:underline cursor-pointer"
                >
                  {t.selectAll}
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={clearAllCourts}
                  className="text-[11px] font-bold text-slate-500 hover:underline cursor-pointer"
                >
                  {t.selectNone}
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {COURTS.map((c) => {
                const isSelected = form.courtIds.includes(c.id);
                return (
                  <button
                    type="button"
                    key={c.id}
                    onClick={() => toggleCourt(c.id)}
                    className={`relative inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border-2 transition cursor-pointer ${
                      isSelected
                        ? 'bg-orange-500 border-orange-500 text-white shadow-md'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-orange-50 hover:border-orange-300'
                    }`}
                  >
                    {isSelected && <Check className="w-4 h-4 stroke-[3]" />}
                    <span>Court {c.letter}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1 uppercase">
                {t.date}
              </label>
              <input
                type="date"
                value={form.block_date}
                min={getLocalDateStr()}
                onChange={(e) => setForm({ ...form, block_date: e.target.value })}
                className="w-full border border-slate-200 bg-slate-50 rounded-xl p-2.5 text-sm font-bold focus:bg-white focus:ring-2 focus:ring-[#2563EB] focus:outline-none cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1 uppercase">
                {t.startHour}
              </label>
              <select
                value={form.start_hour}
                onChange={(e) => setForm({ ...form, start_hour: parseInt(e.target.value, 10) })}
                className="w-full border border-slate-200 bg-slate-50 rounded-xl p-2.5 text-sm font-bold focus:bg-white focus:ring-2 focus:ring-[#2563EB] focus:outline-none cursor-pointer"
              >
                {HOURS_START.map((h) => (
                  <option key={h} value={h}>{formatHour(h)}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1 uppercase">
                {t.endHour}
              </label>
              <select
                value={form.end_hour}
                onChange={(e) => setForm({ ...form, end_hour: parseInt(e.target.value, 10) })}
                className="w-full border border-slate-200 bg-slate-50 rounded-xl p-2.5 text-sm font-bold focus:bg-white focus:ring-2 focus:ring-[#2563EB] focus:outline-none cursor-pointer"
              >
                {HOURS_END.map((h) => (
                  <option key={h} value={h}>{formatHour(h)}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1 uppercase">
                {t.reason}
              </label>
              <input
                type="text"
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                placeholder={t.reasonPlaceholder}
                className="w-full border border-slate-200 bg-slate-50 rounded-xl p-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-[#2563EB] focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-6 py-2.5 rounded-full text-sm font-bold shadow-md transition cursor-pointer disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  {t.adding}
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  {t.addBtn}
                </>
              )}
            </button>
          </div>
        </form>

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700 font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h3 className="text-base font-black text-slate-900 mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-[#2563EB]" />
          {t.existing}
          <span className="text-xs font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full ml-1">
            {blocks.length}
          </span>
        </h3>

        {loading && (
          <div className="text-center py-10">
            <RefreshCw className="w-6 h-6 text-slate-400 animate-spin mx-auto mb-2" />
            <p className="text-sm text-slate-500 font-semibold">{t.loading}</p>
          </div>
        )}

        {!loading && blocks.length === 0 && (
          <div className="text-center py-10 bg-slate-50 rounded-xl">
            <div className="w-14 h-14 rounded-full bg-orange-100 mx-auto mb-3 flex items-center justify-center">
              <Wrench className="w-7 h-7 text-orange-400" />
            </div>
            <p className="text-sm font-bold text-slate-700 mb-1">{t.noBlocks}</p>
            <p className="text-xs text-slate-400">{t.noBlocksDesc}</p>
          </div>
        )}

        {!loading && blocks.length > 0 && (
          <div className="space-y-2">
            {blocks.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between gap-3 bg-orange-50 border border-orange-200 rounded-xl p-3 hover:bg-orange-100/60 transition"
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-white border border-orange-200 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-black text-orange-700">
                      {COURTS.find((c) => c.id === b.court_id)?.letter || '?'}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-800 flex-wrap">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      <span>{formatDate(b.block_date)}</span>
                      <span className="text-slate-300">•</span>
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      <span>{formatHour(b.start_hour)} - {formatHour(b.end_hour)}</span>
                    </div>
                    <p className="text-xs text-orange-800 font-semibold mt-0.5 truncate">
                      {b.reason}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(b.id)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-full transition cursor-pointer flex-shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {t.delete}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}