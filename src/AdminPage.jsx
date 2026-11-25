import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, Check, X, Calendar, Clock, User, Phone, Mail,
  FileText, CheckCircle2, XCircle, AlertCircle, RefreshCw,
  Search, DollarSign, ExternalLink, Wrench,
} from 'lucide-react';

import { supabase } from './supabase';
import AdminMaintenance from './AdminMaintenance';

const STATUS = {
  pending: {
    label: { en: 'Pending', ms: 'Menunggu', zh: '待确认' },
    bg: 'bg-amber-100 text-amber-800 border-amber-200',
    icon: AlertCircle,
  },
  confirmed: {
    label: { en: 'Confirmed', ms: 'Disahkan', zh: '已确认' },
    bg: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    icon: CheckCircle2,
  },
  cancelled: {
    label: { en: 'Cancelled', ms: 'Dibatalkan', zh: '已取消' },
    bg: 'bg-red-100 text-red-800 border-red-200',
    icon: XCircle,
  },
  completed: {
    label: { en: 'Completed', ms: 'Selesai', zh: '已完成' },
    bg: 'bg-blue-100 text-blue-800 border-blue-200',
    icon: Check,
  },
};

export default function AdminPage({ onBack, lang = 'en' }) {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingId, setUpdatingId] = useState(null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('bookings');

  const t = {
    en: {
      title: 'Admin Panel', subtitle: 'Manage all court bookings',
      back: 'Back to Home', refresh: 'Refresh',
      search: 'Search by name, email or phone...',
      totalBookings: 'Total Bookings', pending: 'Pending',
      confirmed: 'Confirmed', revenue: 'Confirmed Revenue',
      all: 'All', noBookings: 'No bookings found',
      noBookingsDesc: 'New bookings will appear here',
      viewReceipt: 'View Receipt', confirm: 'Confirm',
      cancel: 'Cancel', markCompleted: 'Complete',
      confirmDelete: 'Delete this booking permanently?',
      loading: 'Loading bookings...',
      tabBookings: 'Bookings',
      tabMaintenance: 'Maintenance',
    },
    ms: {
      title: 'Panel Admin', subtitle: 'Urus semua tempahan gelanggang',
      back: 'Kembali ke Utama', refresh: 'Muat Semula',
      search: 'Cari nama, emel atau telefon...',
      totalBookings: 'Jumlah Tempahan', pending: 'Menunggu',
      confirmed: 'Disahkan', revenue: 'Hasil Disahkan',
      all: 'Semua', noBookings: 'Tiada tempahan',
      noBookingsDesc: 'Tempahan baru akan muncul di sini',
      viewReceipt: 'Lihat Resit', confirm: 'Sahkan',
      cancel: 'Batal', markCompleted: 'Selesai',
      confirmDelete: 'Padam tempahan ini secara kekal?',
      loading: 'Memuatkan tempahan...',
      tabBookings: 'Tempahan',
      tabMaintenance: 'Selenggara',
    },
    zh: {
      title: '管理员后台', subtitle: '管理所有球场预订',
      back: '返回首页', refresh: '刷新',
      search: '搜索姓名、邮箱或电话...',
      totalBookings: '预订总数', pending: '待确认',
      confirmed: '已确认', revenue: '已确认收入',
      all: '全部', noBookings: '暂无预订',
      noBookingsDesc: '新预订会显示在这里',
      viewReceipt: '查看收据', confirm: '确认',
      cancel: '取消', markCompleted: '完成',
      confirmDelete: '确定永久删除此预订？',
      loading: '加载中...',
      tabBookings: '预订列表',
      tabMaintenance: '球场维护',
    },
  }[lang] || {};

  const fetchBookings = async () => {
    setLoading(true);
    setError('');
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      setError(error.message);
    } else {
      setBookings(data || []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchBookings(); }, []);

  const updateStatus = async (id, status) => {
    setUpdatingId(id);
    const { error } = await supabase
      .from('bookings')
      .update({ status })
      .eq('id', id);

    if (error) {
      alert(error.message);
    } else {
      setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status } : b)));
    }
    setUpdatingId(null);
  };

  const filtered = bookings.filter(b => {
    if (filter !== 'all' && b.status !== filter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        (b.user_name || '').toLowerCase().includes(q) ||
        (b.user_email || '').toLowerCase().includes(q) ||
        (b.phone || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const stats = {
    total: bookings.length,
    pending: bookings.filter(b => b.status === 'pending').length,
    confirmed: bookings.filter(b => b.status === 'confirmed').length,
    revenue: bookings
      .filter(b => b.status === 'confirmed' || b.status === 'completed')
      .reduce((sum, b) => sum + Number(b.total_price || 0), 0),
  };

  const renderSlots = (slots) => {
    if (!Array.isArray(slots) || slots.length === 0) return '-';
    const courtMap = {};
    slots.forEach(s => {
      const [courtId, hour] = s.split('-');
      if (!courtMap[courtId]) courtMap[courtId] = [];
      courtMap[courtId].push(parseInt(hour, 10));
    });
    return Object.entries(courtMap).map(([courtId, hours]) => {
      const letter = { '1': 'A', '2': 'B', '3': 'C', '4': 'D' }[courtId] || courtId;
      hours.sort((a, b) => a - b);
      const fmt = (h) => {
        const ampm = h >= 12 ? 'PM' : 'AM';
        let hour = h % 12; hour = hour === 0 ? 12 : hour;
        return `${hour}:00 ${ampm}`;
      };
      const ranges = [];
      let start = hours[0], end = hours[0];
      for (let i = 1; i < hours.length; i++) {
        if (hours[i] === end + 1) end = hours[i];
        else { ranges.push([start, end]); start = end = hours[i]; }
      }
      ranges.push([start, end]);
      const text = ranges.map(([s, e]) => `${fmt(s)} - ${fmt(e + 1)}`).join(', ');
      return `Court ${letter}: ${text}`;
    }).join(' | ');
  };

  const formatDate = (iso) => {
    if (!iso) return '-';
    return new Date(iso).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] pb-12">
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 px-4 py-2 rounded-full text-sm font-bold transition cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{t.back}</span>
            </button>
            <div>
              <h1 className="text-xl font-black text-slate-900">{t.title}</h1>
              <p className="text-xs text-slate-500 font-medium">{t.subtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-full">
              <button
                onClick={() => setActiveTab('bookings')}
                className={`px-4 py-2 rounded-full text-xs font-bold transition cursor-pointer inline-flex items-center gap-1.5 ${
                  activeTab === 'bookings'
                    ? 'bg-[#2563EB] text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                {t.tabBookings}
              </button>
              <button
                onClick={() => setActiveTab('maintenance')}
                className={`px-4 py-2 rounded-full text-xs font-bold transition cursor-pointer inline-flex items-center gap-1.5 ${
                  activeTab === 'maintenance'
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Wrench className="w-3.5 h-3.5" />
                {t.tabMaintenance}
              </button>
            </div>

            {activeTab === 'bookings' && (
              <button
                onClick={fetchBookings}
                disabled={loading}
                className="inline-flex items-center gap-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-4 py-2 rounded-full text-sm font-bold shadow-md transition cursor-pointer disabled:opacity-60"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span>{t.refresh}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {activeTab === 'maintenance' ? (
        <AdminMaintenance lang={lang} />
      ) : (
        <div className="max-w-[1400px] mx-auto px-6 pt-6 space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={FileText} label={t.totalBookings} value={stats.total} color="blue" />
            <StatCard icon={AlertCircle} label={t.pending} value={stats.pending} color="amber" />
            <StatCard icon={CheckCircle2} label={t.confirmed} value={stats.confirmed} color="emerald" />
            <StatCard icon={DollarSign} label={t.revenue} value={`RM ${stats.revenue}`} color="purple" />
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-full flex-wrap">
              {['all', 'pending', 'confirmed', 'cancelled', 'completed'].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-2 rounded-full text-xs font-bold transition cursor-pointer ${
                    filter === f
                      ? 'bg-[#2563EB] text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {f === 'all' ? t.all : (STATUS[f]?.label[lang] || f)}
                </button>
              ))}
            </div>
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.search}
                className="w-full pl-9 pr-3 py-2 border border-slate-200 bg-slate-50 rounded-full text-sm focus:bg-white focus:ring-2 focus:ring-[#2563EB] focus:outline-none transition"
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-700 font-bold">
              {error}
            </div>
          )}

          {loading && (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
              <RefreshCw className="w-8 h-8 text-slate-400 animate-spin mx-auto mb-3" />
              <p className="text-sm text-slate-500 font-semibold">{t.loading}</p>
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-slate-100 mx-auto mb-4 flex items-center justify-center">
                <FileText className="w-8 h-8 text-slate-300" />
              </div>
              <p className="text-base font-bold text-slate-700 mb-1">{t.noBookings}</p>
              <p className="text-sm text-slate-400">{t.noBookingsDesc}</p>
            </div>
          )}

          {!loading && filtered.length > 0 && (
            <div className="space-y-3">
              {filtered.map((b) => {
                const s = STATUS[b.status] || STATUS.pending;
                const Icon = s.icon;
                const isUpdating = updatingId === b.id;
                return (
                  <div key={b.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:shadow-md transition">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                      <div className="lg:col-span-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-slate-400" />
                          <span className="font-bold text-slate-900 truncate">
                            {b.user_name || 'Unknown'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="truncate">{b.user_email}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <Phone className="w-3.5 h-3.5" />
                          <span>{b.phone || '-'}</span>
                        </div>
                      </div>

                      <div className="lg:col-span-6 space-y-2">
                        <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                          <Calendar className="w-4 h-4 text-[#2563EB]" />
                          <span>{formatDate(b.booking_date)}</span>
                        </div>
                        <div className="flex items-start gap-2 text-xs text-slate-600">
                          <Clock className="w-3.5 h-3.5 mt-0.5 text-slate-400 flex-shrink-0" />
                          <span className="font-medium">{renderSlots(b.slots)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-slate-400">Total:</span>
                          <span className="font-black text-[#2563EB]">RM {b.total_price}</span>
                        </div>
                      </div>

                      <div className="lg:col-span-3 flex flex-col items-end gap-3">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${s.bg}`}>
                          <Icon className="w-3.5 h-3.5" />
                          {s.label[lang]}
                        </span>

                        {b.receipt_url && (
                          <a
                            href={b.receipt_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-bold text-[#2563EB] hover:underline"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            {t.viewReceipt}
                          </a>
                        )}

                        <div className="flex flex-wrap gap-2 justify-end">
                          {b.status === 'pending' && (
                            <>
                              <button
                                onClick={() => updateStatus(b.id, 'confirmed')}
                                disabled={isUpdating}
                                className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-full transition cursor-pointer disabled:opacity-60 inline-flex items-center gap-1"
                              >
                                <Check className="w-3.5 h-3.5" />
                                {t.confirm}
                              </button>
                              <button
                                onClick={() => updateStatus(b.id, 'cancelled')}
                                disabled={isUpdating}
                                className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-full transition cursor-pointer disabled:opacity-60 inline-flex items-center gap-1"
                              >
                                <X className="w-3.5 h-3.5" />
                                {t.cancel}
                              </button>
                            </>
                          )}
                          {b.status === 'confirmed' && (
                            <button
                              onClick={() => updateStatus(b.id, 'completed')}
                              disabled={isUpdating}
                              className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold rounded-full transition cursor-pointer disabled:opacity-60 inline-flex items-center gap-1"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              {t.markCompleted}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    amber: 'bg-amber-50 text-amber-600 border-amber-200',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    purple: 'bg-purple-50 text-purple-600 border-purple-200',
  };
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</span>
        <div className={`w-9 h-9 rounded-xl border flex items-center justify-center ${colors[color]}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-2xl font-black text-slate-900">{value}</p>
    </div>
  );
}