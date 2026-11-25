import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Globe, Lock, Check, Calendar, Clock, ShieldCheck, User, UserPlus, X,
  ShoppingBag, Upload, CreditCard, ChevronRight, Eye, ArrowLeft, Wind,
  Trophy, MapPin, Zap, AlertCircle, Sun, Sunrise, Moon, Sparkles, Wrench, Download
} from 'lucide-react';

import en from './locales/en.json';
import ms from './locales/ms.json';
import zh from './locales/zh.json';

import AdminPage from './AdminPage';
import { supabase } from './supabase';

const translations = { en, ms, zh };

const ADMIN_EMAILS = [
  'simontan0525@gmail.com',
  'admin@jkktunku.com',
];

const PAYMENT_INFO = {
  bankName: 'Bank Muamalat',
  accountName: 'JKKK KPG TUNKU',
  accountNumber: '11010002047716',
};

const PRICING = {
  peakHour: { from: 17, price: 30 },
  weekend: 25,
  weekday: 20,
};

const TOTAL_SLOTS_PER_DAY = 16;

const TIME_GROUPS = [
  {
    key: 'morning',
    icon: <Sunrise className="w-5 h-5 text-amber-500" />,
    iconBg: 'bg-amber-100 border-amber-200',
    label: { en: 'Morning Slots', ms: 'Slot Pagi', zh: '上午场次' },
    hours: [7, 8, 9, 10, 11],
  },
  {
    key: 'afternoon',
    icon: <Sun className="w-5 h-5 text-orange-500" />,
    iconBg: 'bg-orange-100 border-orange-200',
    label: { en: 'Afternoon Slots', ms: 'Slot Tengah Hari', zh: '下午场次' },
    hours: [12, 13, 14, 15, 16],
  },
  {
    key: 'evening',
    icon: <Moon className="w-5 h-5 text-indigo-500" />,
    iconBg: 'bg-indigo-100 border-indigo-200',
    label: { en: 'Evening Slots (Peak)', ms: 'Slot Petang (Puncak)', zh: '晚间场次（黄金时段）' },
    hours: [17, 18, 19, 20, 21, 22],
  },
];

const getLocalDateStr = (d = new Date()) => {
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().split('T')[0];
};

const parseLocalDate = (str) => {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const formatHourPoint = (h) => {
  const ampm = h >= 12 ? 'PM' : 'AM';
  let hour = h % 12;
  hour = hour === 0 ? 12 : hour;
  return `${hour}:00 ${ampm}`;
};

const formatFullTimeRange = (hour) =>
  `${formatHourPoint(hour)} - ${formatHourPoint(hour + 1)}`;

// 🌟 新增：生成 Booking ID (格式: 20231025-XYZ123)
const generateBookingId = () => {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, ''); 
  const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase(); 
  return `${dateStr}-${randomStr}`;
};

function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(onClose, 3500);
    return () => clearTimeout(timer);
  }, [toast, onClose]);

  if (!toast) return null;

  const styles = {
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
  };

  return (
    <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[60] animate-in slide-in-from-top-4 duration-300 print:hidden">
      <div
        className={`flex items-center space-x-3 px-5 py-3 rounded-2xl border shadow-xl ${
          styles[toast.type] || styles.info
        }`}
      >
        {toast.type === 'success' ? (
          <Check className="w-5 h-5" />
        ) : (
          <AlertCircle className="w-5 h-5" />
        )}
        <span className="text-sm font-bold">{toast.message}</span>
        <button onClick={onClose} className="ml-2 hover:opacity-70 cursor-pointer">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function App() {
  const [lang, setLang] = useState('en');
  const t = translations[lang];

  const [currentPage, setCurrentPage] = useState('home');
  const [bookingStep, setBookingStep] = useState(1);

  const [user, setUser] = useState(null);
  const [, setAuthLoading] = useState(true);

  const [completedBooking, setCompletedBooking] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email,
          name: session.user.user_metadata?.name || session.user.email,
          phone: session.user.user_metadata?.phone || '',
        });
      }
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email,
          name: session.user.user_metadata?.name || session.user.email,
          phone: session.user.user_metadata?.phone || '',
        });
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const [toast, setToast] = useState(null);
  const showToast = useCallback(
    (message, type = 'info') => setToast({ message, type, id: Date.now() }),
    []
  );

  const [selectedDate, setSelectedDate] = useState(getLocalDateStr());
  const [baseDateStr, setBaseDateStr] = useState(getLocalDateStr());

  const [bookedSlots, setBookedSlots] = useState([]);
  const [blockedSlots, setBlockedSlots] = useState([]);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [availabilityVersion, setAvailabilityVersion] = useState(0);
  const [selectedSlots, setSelectedSlots] = useState([]);

  useEffect(() => {
    setSelectedSlots([]);
  }, [selectedDate]);

  useEffect(() => {
    let cancelled = false;
    setLoadingAvailability(true);

    (async () => {
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select('slots, status')
        .eq('booking_date', selectedDate)
        .in('status', ['pending', 'confirmed', 'completed']);

      const { data: blocksData, error: blocksError } = await supabase
        .from('court_blocks')
        .select('court_id, start_hour, end_hour, reason')
        .eq('block_date', selectedDate);

      if (cancelled) return;

      if (bookingsError) {
        console.error('Error fetching bookings:', bookingsError);
        setBookedSlots([]);
      } else {
        const flat = [];
        (bookingsData || []).forEach((row) => {
          (row.slots || []).forEach((s) => {
            const [courtId, hour] = s.split('-');
            flat.push({
              court_id: parseInt(courtId, 10),
              start_hour: parseInt(hour, 10),
            });
          });
        });
        setBookedSlots(flat);
      }

      if (blocksError) {
        console.error('Error fetching blocks:', blocksError);
        setBlockedSlots([]);
      } else {
        setBlockedSlots(blocksData || []);
      }

      setLoadingAvailability(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedDate, availabilityVersion]);

  const refreshAvailability = useCallback(
    () => setAvailabilityVersion((v) => v + 1),
    []
  );

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login');

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [receiptFile, setReceiptFile] = useState(null);
  const [agreedTerms, setAgreedTerms] = useState(false);

  const [detailModalCourt, setDetailModalCourt] = useState(null);

  const [activeCourtId, setActiveCourtId] = useState(1);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    password: '',
  });

  const uiText = {
    en: {
      tagline: 'Premier Pickleball Venue in Town',
      hero_title_1: 'World-Class Courts,',
      hero_title_2: 'Unmatched Experience.',
      hero_desc:
        'Featuring 4 professional indoor & air-conditioned pickleball courts with premium tournament flooring, optimal lighting, and lounge areas.',
      btn_book_now_hero: 'Book Court Now',
      stat_courts: '4 Courts',
      stat_courts_sub: 'Indoor & Air-Con',
      stat_hours: '7 AM - 11 PM',
      stat_hours_sub: 'Daily Operating Slots',
      stat_climate: '23°C',
      stat_climate_sub: 'Climate Control',
      stat_parking: 'Free Parking',
      stat_parking_sub: 'Ample Spaces',
      section_explore: 'Explore Our Pickleball Courts',
      section_explore_sub:
        'Select a court to view specification highlights or directly book available slots.',
      btn_view_photo: 'View Details',
      btn_book_this: 'Book Court',
      btn_back_showcase: 'Back to Court Overview',
      booking_title: 'Select Date',
      booking_title_step2: 'Select Time Slots',
      booking_sub: 'Pick your preferred date to continue.',
      booking_sub_step2: 'Choose your court and the time slots you want to book.',
      court: 'Court',
      status_available: 'Available',
      status_selected: 'Selected',
      status_booked: 'Booked',
      status_maintenance: 'Maintenance',
      modal_features_title: 'Court Features & Amenities',
      btn_proceed_book: 'Proceed to Book',
      summary_title: 'Booking Summary',
      summary_empty: 'No slots selected yet',
      summary_total: 'Total',
      full_label: 'FULL',
      selected_label: 'selected',
      step_select_time: 'STEP 2: SELECT TIME SLOTS',
      step_select_time_sub: 'Click on any available time card below to add to your booking',
      pickleball_court: 'Pickleball Court',
      maint_label: 'MAINT',
      toast_maintenance: 'Some selected slots are under maintenance, please pick again',
      btn_next_time: 'Select Time Slots',
      btn_back_date: 'Change Date',
    },
    ms: {
      tagline: 'Gelanggang Pickleball Utama di Bandar',
      hero_title_1: 'Gelanggang Kelas Dunia,',
      hero_title_2: 'Pengalaman Luar Biasa.',
      hero_desc:
        'Menawarkan 4 gelanggang pickleball dalam bangunan & berhawa dingin profesional dengan lantai kejohanan premium, pencahayaan optimum, dan ruang rehat.',
      btn_book_now_hero: 'Tempah Gelanggang Sekarang',
      stat_courts: '4 Gelanggang',
      stat_courts_sub: 'Dalam Bangunan & AC',
      stat_hours: '7 AM - 11 PM',
      stat_hours_sub: 'Slot Waktu Harian',
      stat_climate: '23°C',
      stat_climate_sub: 'Kawalan Suhu',
      stat_parking: 'Tempat Letak Kereta',
      stat_parking_sub: 'Percuma & Luas',
      section_explore: 'Terokai Gelanggang Pickleball Kami',
      section_explore_sub:
        'Pilih gelanggang untuk melihat spesifikasi atau terus menempah slot waktu.',
      btn_view_photo: 'Lihat Detail',
      btn_book_this: 'Tempah Gelanggang',
      btn_back_showcase: 'Kembali ke Ringkasan Gelanggang',
      booking_title: 'Pilih Tarikh',
      booking_title_step2: 'Pilih Masa Slot',
      booking_sub: 'Pilih tarikh pilihan anda untuk meneruskan.',
      booking_sub_step2: 'Pilih gelanggang dan slot masa yang ingin anda tempah.',
      court: 'Gelanggang',
      status_available: 'Tersedia',
      status_selected: 'Dipilih',
      status_booked: 'Ditempah',
      status_maintenance: 'Selenggara',
      modal_features_title: 'Ciri & Kemudahan Gelanggang',
      btn_proceed_book: 'Teruskan Mempamer',
      summary_title: 'Ringkasan Tempahan',
      summary_empty: 'Belum ada slot dipilih',
      summary_total: 'Jumlah',
      full_label: 'PENUH',
      selected_label: 'dipilih',
      step_select_time: 'LANGKAH 2: PILIH MASA SLOT',
      step_select_time_sub: 'Klik kad masa di bawah untuk menambah tempahan',
      pickleball_court: 'Gelanggang Pickleball',
      maint_label: 'SELENGGARA',
      toast_maintenance: 'Sebahagian slot sedang diselenggara, sila pilih semula',
      btn_next_time: 'Pilih Masa Slot',
      btn_back_date: 'Tukar Tarikh',
    },
    zh: {
      tagline: '城中首选匹克球场馆',
      hero_title_1: '世界级专业球场，',
      hero_title_2: '打造非凡打球体验。',
      hero_desc:
        '拥有 4 块专业室内及冷气匹克球场，配备顶级防滑防震地垫、防眩光专业照明及舒适休息区。',
      btn_book_now_hero: '立即预约球场',
      stat_courts: '4 块专业场地',
      stat_courts_sub: '普通室内 & 冷气场',
      stat_hours: '07:00 - 23:00',
      stat_hours_sub: '全天开放预订',
      stat_climate: '23°C 恒温',
      stat_climate_sub: '全天候舒适冷气',
      stat_parking: '免费停车',
      stat_parking_sub: '车位充足方便',
      section_explore: '探索我们的专业匹克球场',
      section_explore_sub:
        '您可以先预览球场详细配置，或直接选择球场预约可用的时段。',
      btn_view_photo: '查看配置详情',
      btn_book_this: '预约此场地',
      btn_back_showcase: '返回场地概览',
      booking_title: '选择日期',
      booking_title_step2: '选择时间段',
      booking_sub: '请先选择您想打球的日期。',
      booking_sub_step2: '选择球场及您想预订的时间段。',
      court: '球场',
      status_available: '可预约',
      status_selected: '已选择',
      status_booked: '已被占用',
      status_maintenance: '维修中',
      modal_features_title: '球场亮点与设施配置',
      btn_proceed_book: '去预约',
      summary_title: '预订摘要',
      summary_empty: '尚未选择时段',
      summary_total: '总计',
      full_label: '已满',
      selected_label: '已选',
      step_select_time: '第二步：点击卡片选择打球时段',
      step_select_time_sub: '下方高亮卡片皆可点击，支持多选不同时间段',
      pickleball_court: '匹克球场',
      maint_label: '维修',
      toast_maintenance: '部分时段正在维修，请重新选择',
      btn_next_time: '下一步：选择时段',
      btn_back_date: '返回修改日期',
    },
  };

  const ui = uiText[lang] || uiText.en;

  const courts = [
    {
      id: 1,
      shortName: 'A',
      name: { en: 'Court A', ms: 'Gelanggang A', zh: '球场 A' },
      tag: 'Standard Indoor',
      badgeBg: 'bg-blue-100 text-blue-800 border-blue-200',
      image:
        'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRSJMFssMIi3Ym-ju6uP7SsOlDpP1ns8Kkzcs2Qc7RPD7hAvZWbuJ1ibMs&s=10',
      description: {
        en: 'Indoor court with professional PVC flooring and anti-glare LED lighting.',
        ms: 'Gelanggang dalam bangunan dengan lantai PVC profesional dan pencahayaan LED anti-silau.',
        zh: '室内球场，配备专业 PVC 地垫与 LED 防眩光照明。',
      },
      features: {
        en: ['Professional PVC Floor', 'High Ceiling', 'Ventilation Fans', 'Free Parking'],
        ms: ['Lantai PVC Profesional', 'Siling Tinggi', 'Kipas Pengudaraan', 'Tempat Letak Kereta Percuma'],
        zh: ['专业 PVC 运动地垫', '超高挑高空间', '工业排风扇通风', '免费停车位'],
      },
    },
    {
      id: 2,
      shortName: 'B',
      name: { en: 'Court B', ms: 'Gelanggang B', zh: '球场 B' },
      tag: 'Standard Indoor',
      badgeBg: 'bg-slate-100 text-slate-800 border-slate-200',
      image:
        'https://firstclasse.com.my/wp-content/uploads/2024/10/FC-In-article-horizontal-6.jpg',
      description: {
        en: 'Spacious indoor court with HVLS industrial fans for steady airflow.',
        ms: 'Gelanggang dalam bangunan yang luas dengan kipas industri HVLS untuk pengudaraan stabil.',
        zh: '宽敞的室内球场，配备 HVLS 工业吊扇保持空气流通。',
      },
      features: {
        en: ['HVLS Industrial Fan', 'Tournament Nets', 'Locker Room Access', 'Rest Area'],
        ms: ['Kipas Industri HVLS', 'Jaring Kejohanan', 'Akses Bilik Salin', 'Kawasan Rehat'],
        zh: ['HVLS 工业大风扇', '比赛级球网', '更衣室设施', '球员休息区'],
      },
    },
    {
      id: 3,
      shortName: 'C',
      name: { en: 'Court C', ms: 'Gelanggang C', zh: '球场 C' },
      tag: 'Full Air-Con',
      badgeBg: 'bg-sky-100 text-sky-800 border-sky-200',
      image:
        'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT4HZysjLIJMFVEK1lM7Oqy0VVljKtsqAQC_cKyQRr7raz86i3CgWoU0Jiv&s=10',
      description: {
        en: 'Fully air-conditioned at 23°C with acoustic panels for zero wind disturbance.',
        ms: 'Berhawa dingin sepenuhnya pada 23°C dengan panel akustik untuk sifar gangguan angin.',
        zh: '全冷气覆盖，维持 23°C 恒温，配吸音墙板，零风速干扰。',
      },
      features: {
        en: ['Full Air-Conditioning', 'Zero Wind Disturbance', 'Acoustic Wall Panels', 'Premium Seating'],
        ms: ['Penuh Berhawa Dingin', 'Sifar Gangguan Angin', 'Panel Dinding Akustik', 'Tempat Duduk Premium'],
        zh: ['全场中央空调', '零风速干扰环境', '吸音隔音墙板', '高端舒适座椅'],
      },
    },
    {
      id: 4,
      shortName: 'D',
      name: { en: 'Court D', ms: 'Gelanggang D', zh: '球场 D' },
      tag: 'VIP Air-Con',
      badgeBg: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      image:
        'https://activelifeconditioning.com/wp-content/uploads/2025/03/img_3276.jpg',
      description: {
        en: 'VIP air-conditioned court with match recording setup and lounge access.',
        ms: 'Gelanggang berhawa dingin VIP dengan persediaan rakaman perlawanan dan akses ruang rehat.',
        zh: 'VIP 级全冷气球场，配备比赛录像系统及贵宾休息室。',
      },
      features: {
        en: ['Full Air-Conditioning', 'Match Recording Setup', 'VIP Lounge Access', 'Chilled Water Station'],
        ms: ['Penuh Berhawa Dingin', 'Persediaan Rakaman Perlawanan', 'Akses Ruang VIP', 'Stesen Air Sejuk'],
        zh: ['全场中央空调', '高清比赛录像机位', 'VIP 休息室权限', '冰饮补给站'],
      },
    },
  ];

  const dynamicSevenDays = useMemo(() => {
    const days = [];
    const base = parseLocalDate(baseDateStr);
    const todayStr = getLocalDateStr();

    for (let i = 0; i < 7; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      const isoDate = getLocalDateStr(d);
      const dayName =
        isoDate === todayStr
          ? lang === 'zh'
            ? '今天'
            : lang === 'ms'
            ? 'Hari Ini'
            : 'Today'
          : d.toLocaleDateString('en-US', { weekday: 'short' });
      const monthDay = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      const dayOfWeek = d.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const startingPrice = isWeekend ? PRICING.weekend : PRICING.weekday;

      days.push({ isoDate, dayName, monthDay, isWeekend, startingPrice });
    }
    return days;
  }, [baseDateStr, lang]);

  const getSlotPrice = (dateStr, hour) => {
    if (hour >= PRICING.peakHour.from) return PRICING.peakHour.price;
    const dayOfWeek = parseLocalDate(dateStr).getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    return isWeekend ? PRICING.weekend : PRICING.weekday;
  };

  const totalPrice = useMemo(
    () =>
      selectedSlots.reduce((sum, slotKey) => {
        const [, hourStr] = slotKey.split('-');
        const hour = parseInt(hourStr, 10);
        return sum + getSlotPrice(selectedDate, hour);
      }, 0),
    [selectedSlots, selectedDate]
  );

  const isSlotPast = (hour) => {
    const todayStr = getLocalDateStr();
    if (selectedDate !== todayStr) return false;

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const slotStartMinutes = hour * 60;

    return currentMinutes >= slotStartMinutes;
  };

  const isSlotBooked = (courtId, hour) =>
    bookedSlots.some((s) => s.court_id === courtId && s.start_hour === hour);

  const isSlotBlocked = (courtId, hour) =>
    blockedSlots.some(
      (b) =>
        b.court_id === courtId &&
        hour >= b.start_hour &&
        hour < b.end_hour
    );

  const getBlockReason = (courtId, hour) => {
    const block = blockedSlots.find(
      (b) =>
        b.court_id === courtId &&
        hour >= b.start_hour &&
        hour < b.end_hour
    );
    return block?.reason || '';
  };

  const handleSlotClick = (courtId, hour) => {
    if (isSlotBooked(courtId, hour)) return;
    if (isSlotBlocked(courtId, hour)) return;
    if (isSlotPast(hour)) return;
    const key = `${courtId}-${hour}`;
    setSelectedSlots((prev) =>
      prev.includes(key) ? prev.filter((s) => s !== key) : [...prev, key]
    );
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    try {
      if (authMode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              name: formData.name,
              phone: formData.phone,
            },
          },
        });
        if (error) throw error;
        showToast(
          lang === 'zh'
            ? '注册成功！请登录'
            : lang === 'ms'
            ? 'Pendaftaran berjaya! Sila log masuk.'
            : 'Registration successful! Please log in.',
          'success'
        );
        setAuthMode('login');
        setFormData({ ...formData, password: '' });
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });
        if (error) throw error;
        setUser({
          id: data.user.id,
          email: data.user.email,
          name: data.user.user_metadata?.name || data.user.email,
          phone: data.user.user_metadata?.phone || '',
        });
        setIsAuthModalOpen(false);
        showToast(
          lang === 'zh'
            ? '登录成功'
            : lang === 'ms'
            ? 'Log masuk berjaya'
            : 'Logged in successfully',
          'success'
        );
        if (selectedSlots.length > 0) {
          setTimeout(() => handleCheckoutClick(), 100);
        }
      }
    } catch (err) {
      showToast(
        err.message ||
          (lang === 'zh' ? '认证失败，请重试' : 'Authentication failed'),
        'error'
      );
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const handleCheckoutClick = async () => {
    if (!user) {
      setAuthMode('login');
      setIsAuthModalOpen(true);
      return;
    }

    try {
      const hasBlocked = selectedSlots.some((slotKey) => {
        const [courtIdStr, hourStr] = slotKey.split('-');
        return isSlotBlocked(parseInt(courtIdStr, 10), parseInt(hourStr, 10));
      });
      if (hasBlocked) {
        showToast(ui.toast_maintenance, 'error');
        refreshAvailability();
        setSelectedSlots([]);
        return;
      }

      const { data, error } = await supabase
        .from('bookings')
        .select('slots, user_id')
        .eq('booking_date', selectedDate)
        .in('status', ['pending', 'confirmed', 'completed']);

      if (error) throw error;

      const slotArray = selectedSlots;
      const hourArray = slotArray.map((s) => parseInt(s.split('-')[1], 10));
      const myCourtIds = [...new Set(slotArray.map((s) => s.split('-')[0]))];

      const conflict = [];
      (data || []).forEach((b) => {
        if (b.user_id === user.id) return;
        (b.slots || []).forEach((s) => {
          const [courtId, hour] = s.split('-');
          if (myCourtIds.includes(courtId) && hourArray.includes(parseInt(hour, 10))) {
            conflict.push({ courtId, hour: parseInt(hour, 10) });
          }
        });
      });

      if (conflict.length > 0) {
        showToast(
          lang === 'zh'
            ? '部分时段已被他人预订，请重新选择'
            : lang === 'ms'
            ? 'Sebahagian slot telah ditempah, sila pilih semula'
            : 'Some slots were just taken, please pick again',
          'error'
        );
        refreshAvailability();
        setSelectedSlots([]);
        return;
      }

      setIsPaymentModalOpen(true);
    } catch (err) {
      console.error('check conflict failed:', err);
      setIsPaymentModalOpen(true);
    }
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    if (!receiptFile) {
      showToast(
        lang === 'zh' ? '请上传付款收据' : 'Please upload your payment receipt',
        'error'
      );
      return;
    }
    
    const MAX_FILE_SIZE = 5 * 1024 * 1024; 
    if (receiptFile.size > MAX_FILE_SIZE) {
      showToast(
        lang === 'zh' ? '文件太大，请上传小于 5MB 的文件' : 'File too large, please upload a file smaller than 5MB',
        'error'
      );
      return;
    }

    if (!agreedTerms) {
      showToast(
        lang === 'zh' ? '请先同意条款' : 'Please agree to the terms first',
        'error'
      );
      return;
    }

    setSubmittingPayment(true);
    try {
      const { data: freshBlocks } = await supabase
        .from('court_blocks')
        .select('court_id, start_hour, end_hour, reason')
        .eq('block_date', selectedDate);

      const hasBlockedFinal = selectedSlots.some((slotKey) => {
        const [courtIdStr, hourStr] = slotKey.split('-');
        const courtId = parseInt(courtIdStr, 10);
        const hour = parseInt(hourStr, 10);
        return (freshBlocks || []).some(
          (b) => b.court_id === courtId && hour >= b.start_hour && hour < b.end_hour
        );
      });

      if (hasBlockedFinal) {
        showToast(ui.toast_maintenance, 'error');
        refreshAvailability();
        setSelectedSlots([]);
        setIsPaymentModalOpen(false);
        return;
      }

      const fileExt = receiptFile.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(fileName, receiptFile, {
          contentType: receiptFile.type,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('receipts')
        .getPublicUrl(fileName);

      const newBookingId = generateBookingId();

      const { error: insertError } = await supabase
        .from('bookings')
        .insert({
          booking_id: newBookingId,
          user_id: user.id,
          user_email: user.email,
          user_name: user.name || user.email,
          phone: user.phone || '',
          booking_date: selectedDate,
          slots: selectedSlots,
          total_price: totalPrice,
          receipt_url: urlData.publicUrl,
          status: 'pending',
        });

      if (insertError) throw insertError;

      setCompletedBooking({
        booking_id: newBookingId,
        booking_date: selectedDate,
        slots: selectedSlots,
        total_price: totalPrice,
      });

      showToast(
        lang === 'zh'
          ? '预订成功！'
          : lang === 'ms'
          ? 'Tempahan berjaya dihantar!'
          : 'Booking submitted successfully!',
        'success'
      );
      refreshAvailability();
      setSelectedSlots([]);
      setReceiptFile(null);
      setAgreedTerms(false);
      setIsPaymentModalOpen(false);
    } catch (err) {
      showToast(
        err.message ||
          (lang === 'zh' ? '提交失败，请重试' : 'Submission failed, please retry'),
        'error'
      );
    } finally {
      setSubmittingPayment(false);
    }
  };

  const goToBookingPage = (courtId = 1) => {
    setActiveCourtId(courtId);
    setCurrentPage('booking');
    setBookingStep(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goToHomePage = () => {
    setCurrentPage('home');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const activeCourt = courts.find((c) => c.id === activeCourtId) || courts[0];

  const courtSelectedCount = (courtId) =>
    selectedSlots.filter((s) => s.startsWith(`${courtId}-`)).length;

  const isCourtFull = (courtId) =>
    bookedSlots.filter((s) => s.court_id === courtId).length >= TOTAL_SLOTS_PER_DAY;

  const isAdmin = user && ADMIN_EMAILS.includes(user.email);

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-slate-800 font-sans pb-36 lg:pb-24">
      
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: absolute; left: 0; top: 0; width: 100%; padding: 20px; }
          .print-hidden { display: none !important; }
        }
      `}</style>

      <Toast toast={toast} onClose={() => setToast(null)} />

      <nav className="sticky top-0 z-30 bg-[#2563EB] text-white shadow-md border-b border-blue-400/30 px-3 sm:px-6 py-3 sm:py-4 transition-all print-hidden">
        <div className="max-w-[1400px] mx-auto flex justify-between items-center gap-2">
          <div
            onClick={goToHomePage}
            className="flex items-center gap-2 sm:gap-3 cursor-pointer group flex-shrink min-w-0"
          >
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-white/10 flex items-center justify-center border border-white/20 group-hover:bg-white/20 transition shadow-sm flex-shrink-0">
              <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-[#A3E635] fill-[#A3E635]" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-lg md:text-xl font-extrabold tracking-tight text-white leading-tight truncate">
                {t.header_title}
              </h1>
              <p className="text-[9px] sm:text-[11px] text-blue-200 font-semibold tracking-wide truncate">
                Pickleball Court Booking
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            {isAdmin && (
              <button
                onClick={() => setCurrentPage('admin')}
                className="flex items-center gap-1 bg-white/10 hover:bg-white/20 text-white px-2 sm:px-4 py-1.5 sm:py-2 rounded-full text-[10px] sm:text-sm font-extrabold border border-white/20 transition cursor-pointer whitespace-nowrap"
              >
                <ShieldCheck className="w-3 h-3 sm:w-4 sm:h-4 text-[#A3E635]" />
                <span>Admin</span>
              </button>
            )}

            {user ? (
              <div className="flex items-center gap-1 bg-white/10 px-2 sm:px-4 py-1.5 sm:py-2 rounded-full border border-white/20 text-[10px] sm:text-sm font-bold text-white shadow-sm whitespace-nowrap max-w-[110px] sm:max-w-none">
                <User className="w-3 h-3 sm:w-4 sm:h-4 text-[#A3E635] flex-shrink-0" />
                <span className="truncate">{user?.name || user?.email}</span>
                <button
                  onClick={handleLogout}
                  className="ml-0.5 text-blue-200 hover:text-white text-[10px] cursor-pointer flex-shrink-0"
                  title="Logout"
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setAuthMode('login');
                  setIsAuthModalOpen(true);
                }}
                className="flex items-center gap-1 bg-[#A3E635] hover:bg-[#8ee01d] text-slate-900 px-2.5 sm:px-5 py-1.5 sm:py-2 rounded-full transition text-[10px] sm:text-sm font-extrabold shadow-md cursor-pointer active:scale-95 whitespace-nowrap"
              >
                <User className="w-3 h-3 sm:w-4 sm:h-4" />
                <span>{t.btn_login_nav || t.btn_login}</span>
              </button>
            )}

            <div className="flex items-center gap-1 bg-white/10 px-2 sm:px-4 py-1.5 sm:py-2 rounded-full border border-white/20 transition shadow-sm">
              <Globe className="w-3 h-3 sm:w-4 sm:h-4 text-blue-200 flex-shrink-0" />
              <select
                value={lang}
                onChange={(e) => setLang(e.target.value)}
                className="bg-transparent text-[10px] sm:text-sm text-white font-bold focus:outline-none cursor-pointer"
              >
                <option value="en" className="bg-[#2563EB] text-white">EN</option>
                <option value="ms" className="bg-[#2563EB] text-white">MS</option>
                <option value="zh" className="bg-[#2563EB] text-white">中文</option>
              </select>
            </div>
          </div>
        </div>
      </nav>

      {currentPage === 'home' && (
        <div className="animate-in fade-in duration-300">
          <header className="relative text-white py-10 px-6 overflow-hidden bg-slate-900">
            <div
              className="absolute inset-0 bg-cover bg-center filter brightness-110 saturate-125 transition-all duration-700"
              style={{
                backgroundImage: `url('https://syntheticsportsgroup.com.au/wp-content/uploads/2023/11/panania-pickleball-courts-2023-11-03-at-3.41.53-PM-1.png')`,
              }}
            ></div>

            <div className="absolute inset-0 bg-gradient-to-r from-blue-950/60 via-blue-900/45 to-blue-950/60"></div>

            <div className="max-w-7xl mx-auto relative z-10">
              <div className="max-w-3xl mx-auto text-center space-y-4">
                <div className="inline-flex items-center space-x-2 bg-white/15 backdrop-blur-md border border-white/25 px-3.5 py-1 rounded-full text-xs sm:text-sm font-bold text-[#A3E635] shadow-md">
                  <Zap className="w-3.5 h-3.5 text-[#A3E635] fill-[#A3E635]" />
                  <span>{ui.tagline}</span>
                </div>

                <h2 className="text-2xl sm:text-4xl md:text-5xl font-black tracking-tight leading-tight text-white drop-shadow-2xl">
                  <span>{ui.hero_title_1}</span>
                  <span className="text-[#A3E635] block sm:inline sm:ml-2.5">
                    {ui.hero_title_2}
                  </span>
                </h2>

                <p className="text-xs sm:text-sm md:text-base text-blue-50 font-medium leading-relaxed max-w-2xl mx-auto drop-shadow-lg">
                  {ui.hero_desc}
                </p>

                <div className="pt-1 flex justify-center">
                  <button
                    onClick={() => goToBookingPage(1)}
                    className="px-7 py-2.5 bg-[#A3E635] hover:bg-[#8ee01d] text-slate-900 font-extrabold text-xs sm:text-sm rounded-full shadow-xl transition transform active:scale-95 flex items-center space-x-2 cursor-pointer"
                  >
                    <span>{ui.btn_book_now_hero}</span>
                    <ChevronRight className="w-4 h-4 stroke-[3]" />
                  </button>
                </div>
              </div>

              <div className="mt-8 max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-3.5">
                <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/20 shadow-lg flex items-center space-x-3.5 hover:bg-white/20 transition">
                  <div className="w-10 h-10 rounded-xl bg-[#A3E635]/20 border border-[#A3E635]/40 flex items-center justify-center text-[#A3E635] flex-shrink-0">
                    <Trophy className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{ui.stat_courts}</p>
                    <p className="text-[11px] text-blue-200 font-semibold">
                      {ui.stat_courts_sub}
                    </p>
                  </div>
                </div>

                <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/20 shadow-lg flex items-center space-x-3.5 hover:bg-white/20 transition">
                  <div className="w-10 h-10 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center text-white flex-shrink-0">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{ui.stat_hours}</p>
                    <p className="text-[11px] text-blue-200 font-semibold">
                      {ui.stat_hours_sub}
                    </p>
                  </div>
                </div>

                <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/20 shadow-lg flex items-center space-x-3.5 hover:bg-white/20 transition">
                  <div className="w-10 h-10 rounded-xl bg-[#A3E635]/20 border border-[#A3E635]/40 flex items-center justify-center text-[#A3E635] flex-shrink-0">
                    <Wind className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{ui.stat_climate}</p>
                    <p className="text-[11px] text-blue-200 font-semibold">
                      {ui.stat_climate_sub}
                    </p>
                  </div>
                </div>

                <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/20 shadow-lg flex items-center space-x-3.5 hover:bg-white/20 transition">
                  <div className="w-10 h-10 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center text-white flex-shrink-0">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{ui.stat_parking}</p>
                    <p className="text-[11px] text-blue-200 font-semibold">
                      {ui.stat_parking_sub}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </header>

          <section className="max-w-7xl mx-auto px-6 py-12">
            <div className="mb-8 text-center max-w-xl mx-auto space-y-1.5">
              <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                {ui.section_explore}
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 font-medium">
                {ui.section_explore_sub}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {courts.map((court) => (
                <div
                  key={court.id}
                  className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden hover:shadow-xl transition duration-300 flex flex-col group"
                >
                  <div className="relative h-48 bg-slate-200 overflow-hidden">
                    <img
                      src={court.image}
                      alt={court.name[lang]}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent"></div>

                    <div className="absolute top-3 left-3 right-3 flex justify-between items-center z-10">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${court.badgeBg} backdrop-blur-md shadow-sm`}
                      >
                        {court.tag}
                      </span>
                    </div>

                    <div className="absolute bottom-3 left-4 right-4 z-10 text-white">
                      <p className="text-[11px] font-semibold text-slate-300 drop-shadow">
                        {ui.pickleball_court}
                      </p>
                      <p className="text-lg font-extrabold tracking-tight drop-shadow-md">
                        {court.shortName}
                      </p>
                    </div>
                  </div>

                  <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm sm:text-base">
                        {court.name[lang]}
                      </h4>
                      <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed font-medium min-h-[2.5rem]">
                        {court.description[lang]}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <button
                        onClick={() => setDetailModalCourt(court)}
                        className="inline-flex items-center space-x-1 text-xs font-bold text-slate-500 hover:text-[#2563EB] transition cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>{ui.btn_view_photo}</span>
                      </button>

                      <button
                        onClick={() => goToBookingPage(court.id)}
                        className="px-3.5 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-full text-xs font-bold transition shadow-sm cursor-pointer inline-flex items-center space-x-1.5 whitespace-nowrap"
                      >
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{ui.btn_book_this}</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {currentPage === 'booking' && (
        <main className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-10 pt-6 sm:pt-10 animate-in fade-in duration-300 print-hidden">
          
          {bookingStep === 1 && (
            <div className="max-w-3xl mx-auto animate-in slide-in-from-right-4 duration-300">
              <div className="relative mb-8 pb-6 border-b border-slate-200 flex flex-col items-center justify-center min-h-[88px]">
                <button
                  onClick={goToHomePage}
                  className="absolute left-0 top-1/2 -translate-y-1/2 inline-flex items-center space-x-1 sm:space-x-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 px-3 sm:px-5 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-bold transition cursor-pointer shadow-sm"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">{ui.btn_back_showcase}</span>
                </button>

                <div className="text-center px-4">
                  <h2 className="text-xl sm:text-3xl font-extrabold text-slate-900 leading-tight">
                    {ui.booking_title}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
                    {ui.booking_sub}
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-4 sm:p-7 shadow-sm border border-slate-200 mb-8">
                <div className="flex justify-between items-center mb-4 sm:mb-6 flex-wrap gap-3">
                  <h2 className="text-sm font-bold text-slate-800 flex items-center space-x-2.5">
                    <Calendar className="w-5 h-5 text-[#2563EB]" />
                    <span className="text-base sm:text-lg">
                      {t.label_select_date || 'Select Date'}
                    </span>
                  </h2>
                  <input
                    type="date"
                    value={selectedDate}
                    min={getLocalDateStr()}
                    onChange={(e) => {
                      const newDateStr = e.target.value;
                      setSelectedDate(newDateStr);
                      
                      const today = parseLocalDate(getLocalDateStr());
                      const selected = parseLocalDate(newDateStr);
                      const daysFromToday = Math.round((selected - today) / 86400000);
                      
                      if (daysFromToday >= 0 && daysFromToday < 7) {
                        setBaseDateStr(getLocalDateStr());
                      } else {
                        const d = new Date(selected);
                        d.setDate(d.getDate() - 3);
                        setBaseDateStr(getLocalDateStr(d));
                      }
                    }}
                    className="text-sm bg-slate-50 border border-slate-300 rounded-lg px-3 sm:px-4 py-2 font-bold text-slate-700 focus:outline-none cursor-pointer"
                  />
                </div>

                <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 sm:gap-3">
                  {dynamicSevenDays.map((d) => {
                    const isSelected = selectedDate === d.isoDate;
                    return (
                      <button
                        key={d.isoDate}
                        onClick={() => setSelectedDate(d.isoDate)}
                        className={`py-2.5 sm:py-3.5 px-1 sm:px-2 rounded-2xl border flex flex-col items-center justify-center transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#2563EB] border-[#2563EB] text-white shadow-md scale-[1.02]'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-blue-50 hover:border-blue-200'
                        }`}
                      >
                        <span
                          className={`text-[10px] sm:text-[11px] font-bold ${
                            isSelected ? 'text-blue-100' : 'text-slate-400'
                          }`}
                        >
                          {d.dayName}
                        </span>
                        <span className="text-sm sm:text-base font-bold mt-1">{d.monthDay}</span>
                        <span
                          className={`text-[9px] sm:text-[10px] font-black mt-1 ${
                            isSelected
                              ? 'text-blue-100'
                              : d.isWeekend
                              ? 'text-amber-600'
                              : 'text-slate-400'
                          }`}
                        >
                          RM {d.startingPrice}+
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                onClick={() => {
                  setBookingStep(2);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="w-full py-4 bg-[#2563EB] hover:bg-[#1D4ED8] active:scale-[0.98] text-white rounded-full text-base font-black shadow-xl transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>{ui.btn_next_time}</span>
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}

          {bookingStep === 2 && (
            <div className="animate-in slide-in-from-left-4 duration-300">
              <div className="relative mb-8 pb-6 border-b border-slate-200 flex flex-col items-center justify-center min-h-[88px]">
                <button
                  onClick={() => {
                    setBookingStep(1);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="absolute left-0 top-1/2 -translate-y-1/2 inline-flex items-center space-x-1 sm:space-x-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 px-3 sm:px-5 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-bold transition cursor-pointer shadow-sm"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">{ui.btn_back_date}</span>
                </button>

                <div className="text-center px-4">
                  <h2 className="text-xl sm:text-3xl font-extrabold text-slate-900 leading-tight">
                    {ui.booking_title_step2}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
                    {ui.booking_sub_step2}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_400px] xl:grid-cols-[minmax(0,1fr)_440px] gap-6 sm:gap-8">
                <div className="space-y-6 sm:space-y-8 min-w-0">
                  <div className="flex items-center justify-between flex-wrap gap-3 sm:gap-4">
                    
                    <div className="flex items-center space-x-1.5 bg-slate-200/80 p-1.5 rounded-full border border-slate-300/80 flex-wrap">
                      {courts.map((court) => {
                        const count = courtSelectedCount(court.id);
                        const isActive = activeCourtId === court.id;
                        return (
                          <button
                            key={court.id}
                            onClick={() => setActiveCourtId(court.id)}
                            className={`relative px-3 sm:px-5 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-bold transition cursor-pointer flex items-center space-x-1 sm:space-x-2 ${
                              isActive
                                ? 'bg-[#2563EB] text-white shadow-sm'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            <span>
                              {ui.court} {court.shortName}
                            </span>
                            {count > 0 && (
                              <span
                                className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                                  isActive
                                    ? 'bg-white text-[#2563EB]'
                                    : 'bg-[#2563EB] text-white'
                                }`}
                              >
                                {count}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex items-center space-x-3 sm:space-x-4 text-xs sm:text-sm font-bold text-slate-600 flex-wrap">
                      <div className="flex items-center space-x-2">
                        <span className="w-4 h-4 rounded-md bg-emerald-50/40 border-2 border-emerald-400/80 shadow-sm"></span>
                        <span>{ui.status_available}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="w-4 h-4 rounded-md bg-[#2563EB] shadow-md"></span>
                        <span>{ui.status_selected}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="w-4 h-4 rounded-md bg-slate-200 border border-slate-300"></span>
                        <span>{ui.status_booked}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="w-4 h-4 rounded-md bg-orange-100 border-2 border-orange-400"></span>
                        <span>{ui.status_maintenance}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-3xl shadow-lg ring-4 ring-blue-500/10 overflow-hidden transition-all">
                    <div className="bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 text-white px-4 sm:px-7 py-4 sm:py-5 flex justify-between items-center flex-wrap gap-2 sm:gap-3 shadow-md">
                      <div>
                        <div className="flex items-center space-x-2 sm:space-x-2.5">
                          <div className="px-2 sm:px-2.5 py-0.5 rounded-full bg-[#A3E635] text-slate-950 font-black text-[10px] sm:text-xs uppercase tracking-wider shadow-sm flex items-center space-x-1">
                            <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-slate-950" />
                            <span>Step 2</span>
                          </div>
                          <h3 className="font-black text-base sm:text-lg text-white tracking-wide">
                            {activeCourt.name[lang]}
                          </h3>
                        </div>
                        <p className="text-[11px] sm:text-xs text-blue-100 font-medium mt-1">
                          {ui.step_select_time_sub}
                        </p>
                      </div>

                      <span className="px-3 sm:px-3.5 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-bold border bg-white/10 text-white border-white/20 backdrop-blur-md">
                        {activeCourt.tag}
                      </span>
                    </div>

                    {loadingAvailability ? (
                      <div className="p-4 sm:p-7 space-y-5 sm:space-y-7">
                        {[0, 1, 2].map((g) => (
                          <div key={g}>
                            <div className="h-5 w-40 bg-slate-200 rounded animate-pulse mb-4"></div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                              {[0, 1, 2, 3, 4, 5].map((i) => (
                                <div
                                  key={i}
                                  className="h-20 bg-slate-100 rounded-xl animate-pulse"
                                ></div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 sm:p-7 space-y-6 sm:space-y-8 bg-slate-50/50">
                        {TIME_GROUPS.map((group) => (
                          <div
                            key={group.key}
                            className="bg-white p-3 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm"
                          >
                            <div className="flex items-center justify-between mb-3 sm:mb-4 pb-2 sm:pb-3 border-b border-slate-100">
                              <div className="flex items-center space-x-2 sm:space-x-3">
                                <div className={`p-1.5 sm:p-2 rounded-xl border ${group.iconBg} shadow-sm`}>
                                  {group.icon}
                                </div>
                                <div>
                                  <h4 className="text-sm sm:text-base font-extrabold text-slate-900">
                                    {group.label[lang]}
                                  </h4>
                                  <p className="text-[10px] sm:text-xs text-slate-400 font-semibold">
                                    {formatHourPoint(group.hours[0])} –{' '}
                                    {formatHourPoint(group.hours[group.hours.length - 1] + 1)}
                                  </p>
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3.5">
                              {group.hours.map((hour) => {
                                const booked = isSlotBooked(activeCourt.id, hour);
                                const blocked = isSlotBlocked(activeCourt.id, hour);
                                const past = isSlotPast(hour);
                                const isSelected = selectedSlots.includes(
                                  `${activeCourt.id}-${hour}`
                                );
                                const price = getSlotPrice(selectedDate, hour);
                                const isPeak = hour >= PRICING.peakHour.from;
                                const disabled = booked || past || blocked;
                                const blockReason = blocked
                                  ? getBlockReason(activeCourt.id, hour)
                                  : '';

                                return (
                                  <button
                                    key={hour}
                                    disabled={disabled}
                                    onClick={() => handleSlotClick(activeCourt.id, hour)}
                                    title={blocked ? blockReason : ''}
                                    className={`relative py-2.5 sm:py-3.5 px-2 sm:px-3 rounded-2xl text-xs sm:text-sm font-extrabold transition-all duration-200 flex flex-col items-center justify-center border-2 cursor-pointer group ${
                                      booked
                                        ? 'bg-slate-100/80 border-slate-200 text-slate-400 cursor-not-allowed opacity-60'
                                        : blocked
                                        ? 'bg-orange-50 border-orange-300 text-orange-800 cursor-not-allowed'
                                        : past
                                        ? 'bg-slate-50 border-slate-200 text-slate-300 cursor-not-allowed opacity-50'
                                        : isSelected
                                        ? 'bg-[#2563EB] border-[#2563EB] text-white shadow-xl shadow-blue-500/30 scale-[1.02] ring-4 ring-blue-500/20'
                                        : 'bg-emerald-50/40 border-emerald-400/80 hover:border-emerald-500 text-slate-800 hover:bg-emerald-100/60 shadow-sm hover:shadow-md hover:-translate-y-0.5'
                                    }`}
                                  >
                                    {isPeak && !disabled && (
                                      <span
                                        className={`absolute top-1 sm:top-1.5 right-1 sm:right-1.5 text-[8px] sm:text-[9px] font-black px-1 sm:px-1.5 py-0.5 rounded-full shadow-sm ${
                                          isSelected
                                            ? 'bg-[#A3E635] text-slate-950'
                                            : 'bg-rose-500 text-white'
                                        }`}
                                      >
                                        PEAK
                                      </span>
                                    )}

                                    {past && !booked && !blocked && (
                                      <span className="absolute top-1 sm:top-1.5 right-1 sm:right-1.5 text-[8px] sm:text-[9px] font-black px-1 sm:px-1.5 py-0.5 rounded-full shadow-sm bg-slate-200 text-slate-500">
                                        {lang === 'zh' ? '已过' : lang === 'ms' ? 'TAMAT' : 'PAST'}
                                      </span>
                                    )}

                                    {blocked && (
                                      <span className="absolute top-1 sm:top-1.5 right-1 sm:right-1.5 text-[8px] sm:text-[9px] font-black px-1 sm:px-1.5 py-0.5 rounded-full shadow-sm bg-orange-500 text-white">
                                        {ui.maint_label}
                                      </span>
                                    )}

                                    <div className="flex items-center space-x-1 sm:space-x-1.5 my-0.5">
                                      {booked ? (
                                        <Lock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 flex-shrink-0" />
                                      ) : blocked ? (
                                        <Wrench className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-orange-600 flex-shrink-0" />
                                      ) : past ? (
                                        <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-300 flex-shrink-0" />
                                      ) : isSelected ? (
                                        <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white stroke-[3] flex-shrink-0" />
                                      ) : (
                                        <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600 group-hover:scale-110 transition flex-shrink-0" />
                                      )}
                                      <span
                                        className={`tracking-tight text-[10px] sm:text-sm font-extrabold ${
                                          booked ? 'line-through' : ''
                                        }`}
                                      >
                                        {formatFullTimeRange(hour)}
                                      </span>
                                    </div>

                                    {blocked && blockReason && (
                                      <span className="text-[9px] sm:text-[10px] text-orange-700 font-bold mt-0.5 line-clamp-1 max-w-full px-1">
                                        {blockReason}
                                      </span>
                                    )}

                                    <span
                                      className={`text-[10px] sm:text-xs font-black mt-1 px-2 sm:px-2.5 py-0.5 rounded-full ${
                                        isSelected
                                          ? 'bg-white/20 text-white'
                                          : booked || past
                                          ? 'text-slate-400'
                                          : blocked
                                          ? 'bg-orange-100 text-orange-800'
                                          : 'bg-emerald-100 text-emerald-800 font-extrabold'
                                      }`}
                                    >
                                      RM {price}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <aside className="lg:col-span-1">
                  <div className="lg:sticky lg:top-28 bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6 space-y-5">
                    <div className="flex items-center space-x-2.5 pb-4 border-b border-slate-100">
                      <ShoppingBag className="w-5 h-5 text-[#2563EB]" />
                      <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                        {ui.summary_title}
                      </h3>
                    </div>

                    {selectedSlots.length === 0 ? (
                      <div className="text-center py-10">
                        <div className="w-14 h-14 mx-auto rounded-full bg-slate-100 flex items-center justify-center mb-4">
                          <ShoppingBag className="w-7 h-7 text-slate-300" />
                        </div>
                        <p className="text-sm text-slate-400 font-semibold">
                          {ui.summary_empty}
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                          {selectedSlots.map((slotKey) => {
                            const [courtId, hourStr] = slotKey.split('-');
                            const hour = parseInt(hourStr, 10);
                            const courtObj = courts.find(
                              (c) => c.id === parseInt(courtId, 10)
                            );
                            const slotPrice = getSlotPrice(selectedDate, hour);
                            return (
                              <div
                                key={slotKey}
                                className="flex justify-between items-center text-sm bg-slate-50 p-3 rounded-xl border border-slate-200"
                              >
                                <div>
                                  <p className="font-bold text-slate-800">
                                    {ui.court} {courtObj?.shortName}
                                  </p>
                                  <p className="text-slate-500 text-xs mt-0.5">
                                    {formatFullTimeRange(hour)}
                                  </p>
                                </div>
                                <div className="flex items-center space-x-2.5">
                                  <span className="font-black text-[#2563EB] text-sm">
                                    RM {slotPrice}
                                  </span>
                                  <button
                                    onClick={() =>
                                      handleSlotClick(parseInt(courtId, 10), hour)
                                    }
                                    className="text-slate-400 hover:text-rose-500 cursor-pointer"
                                    title="Remove"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <div className="pt-4 border-t border-slate-200 flex justify-between items-center">
                          <span className="text-sm font-bold text-slate-600 uppercase tracking-wider">
                            {ui.summary_total}
                          </span>
                          <span className="text-3xl font-black text-[#2563EB]">
                            RM {totalPrice}
                          </span>
                        </div>

                        <button
                          onClick={handleCheckoutClick}
                          className="w-full py-4 bg-[#2563EB] hover:bg-[#1D4ED8] active:scale-95 text-white rounded-full text-base font-black shadow-md transition cursor-pointer"
                        >
                          {t.btn_book_now}
                        </button>
                      </>
                    )}
                  </div>
                </aside>
              </div>
            </div>
          )}
        </main>
      )}

      {currentPage === 'admin' && (
        <AdminPage onBack={goToHomePage} lang={lang} />
      )}

      {selectedSlots.length > 0 && bookingStep === 2 && (
        <div className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-xl w-[92%] sm:w-[90%] bg-slate-900 text-white p-3 sm:p-4 rounded-3xl shadow-2xl border border-slate-800 transition-all animate-in slide-in-from-bottom-5 duration-300 lg:hidden print-hidden">
          <div className="flex justify-between items-center gap-2">
            <div className="flex items-center space-x-2 sm:space-x-3.5 min-w-0">
              <div className="p-2 sm:p-2.5 bg-[#2563EB]/20 text-[#A3E635] rounded-xl border border-[#2563EB]/30 flex-shrink-0">
                <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-slate-300 font-medium">
                  {selectedSlots.length}{' '}
                  {selectedSlots.length === 1 ? 'slot' : 'slots'}
                </p>
                <p className="text-base sm:text-lg font-extrabold text-[#A3E635]">
                  RM {totalPrice}
                </p>
              </div>
            </div>

            <button
              onClick={handleCheckoutClick}
              className="px-4 sm:px-6 py-2 sm:py-2.5 bg-[#A3E635] hover:bg-[#8ee01d] active:scale-95 text-slate-900 text-xs font-extrabold rounded-full shadow-md transition cursor-pointer whitespace-nowrap"
            >
              {t.btn_book_now}
            </button>
          </div>
        </div>
      )}

      {detailModalCourt && (
        <div
          onClick={() => setDetailModalCourt(null)}
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex justify-center items-center p-4 z-50 animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden max-w-lg w-full transform transition-all"
          >
            <button
              onClick={() => setDetailModalCourt(null)}
              className="absolute top-4 right-4 z-10 p-2 rounded-full bg-slate-900/60 text-white hover:bg-slate-900 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="relative h-60 bg-slate-200 overflow-hidden">
              <img
                src={detailModalCourt.image}
                alt={detailModalCourt.name[lang]}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent"></div>

              <div className="absolute bottom-4 left-6 right-6 text-white">
                <span
                  className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${detailModalCourt.badgeBg} mb-2 shadow-sm`}
                >
                  {detailModalCourt.tag}
                </span>
                <h3 className="text-2xl font-black drop-shadow-md">
                  {detailModalCourt.name[lang]}
                </h3>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600 leading-relaxed font-medium">
                {detailModalCourt.description[lang]}
              </p>

              <div className="pt-2">
                <h4 className="text-sm font-bold text-slate-900 mb-2.5">
                  {ui.modal_features_title}
                </h4>
                <div className="grid grid-cols-2 gap-2.5">
                  {detailModalCourt.features[lang].map((feat) => (
                    <div
                      key={feat}
                      className="flex items-center space-x-2 text-xs sm:text-sm font-bold text-slate-700 bg-slate-100 p-2.5 rounded-xl border border-slate-200"
                    >
                      <Check className="w-4 h-4 text-[#2563EB] flex-shrink-0" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  onClick={() => {
                    setDetailModalCourt(null);
                    goToBookingPage(detailModalCourt.id);
                  }}
                  className="w-full py-3.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-full text-sm font-bold transition shadow-md cursor-pointer"
                >
                  {ui.btn_proceed_book} {detailModalCourt.shortName}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isAuthModalOpen && (
        <div
          onClick={() => setIsAuthModalOpen(false)}
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex justify-center items-center p-4 z-50 animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative bg-white rounded-3xl shadow-2xl border border-slate-200 p-7 max-w-sm w-full transform transition-all"
          >
            <button
              onClick={() => setIsAuthModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3 mb-5 pr-6">
              <div className="p-2.5 bg-blue-50 text-[#2563EB] rounded-xl border border-blue-100">
                {authMode === 'login' ? (
                  <ShieldCheck className="w-6 h-6" />
                ) : (
                  <UserPlus className="w-6 h-6" />
                )}
              </div>
              <h2 className="text-lg font-bold text-slate-800">
                {authMode === 'login' ? t.login_title : t.signup_title}
              </h2>
            </div>

            <form onSubmit={handleAuthSubmit}>
              {authMode === 'signup' && (
                <>
                  <div className="mb-3.5">
                    <label className="block text-xs sm:text-sm font-bold text-slate-600 mb-1">
                      {t.full_name}
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="John Doe"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      className="w-full border border-slate-200 bg-slate-50 rounded-xl p-3 text-sm focus:bg-white focus:ring-2 focus:ring-[#2563EB] focus:outline-none transition font-medium"
                    />
                  </div>
                  <div className="mb-3.5">
                    <label className="block text-xs sm:text-sm font-bold text-slate-600 mb-1">
                      {t.phone}
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="+60 12-345 6789"
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData({ ...formData, phone: e.target.value })
                      }
                      className="w-full border border-slate-200 bg-slate-50 rounded-xl p-3 text-sm focus:bg-white focus:ring-2 focus:ring-[#2563EB] focus:outline-none transition font-medium"
                    />
                  </div>
                </>
              )}

              <div className="mb-3.5">
                <label className="block text-xs sm:text-sm font-bold text-slate-600 mb-1">
                  {t.email}
                </label>
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className="w-full border border-slate-200 bg-slate-50 rounded-xl p-3 text-sm focus:bg-white focus:ring-2 focus:ring-[#2563EB] focus:outline-none transition font-medium"
                />
              </div>

              <div className="mb-5">
                <label className="block text-xs sm:text-sm font-bold text-slate-600 mb-1">
                  {t.password}
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  className="w-full border border-slate-200 bg-slate-50 rounded-xl p-3 text-sm focus:bg-white focus:ring-2 focus:ring-[#2563EB] focus:outline-none transition font-medium"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 text-sm bg-[#2563EB] hover:bg-[#1D4ED8] active:scale-95 text-white rounded-full font-bold shadow-md transition mb-4 cursor-pointer"
              >
                {authMode === 'login' ? t.btn_login : t.btn_signup}
              </button>

              <div className="text-center text-xs sm:text-sm text-slate-500 font-medium">
                {authMode === 'login' ? (
                  <p>
                    {t.no_account}{' '}
                    <button
                      type="button"
                      onClick={() => setAuthMode('signup')}
                      className="text-[#2563EB] font-bold hover:underline cursor-pointer ml-1"
                    >
                      {t.btn_signup}
                    </button>
                  </p>
                ) : (
                  <p>
                    {t.has_account}{' '}
                    <button
                      type="button"
                      onClick={() => setAuthMode('login')}
                      className="text-[#2563EB] font-bold hover:underline cursor-pointer ml-1"
                    >
                      {t.btn_login}
                    </button>
                  </p>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {isPaymentModalOpen && (
        <div
          onClick={() => setIsPaymentModalOpen(false)}
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex justify-center items-center p-4 z-50 animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 max-w-md w-full transform transition-all max-h-[90vh] overflow-y-auto"
          >
            <button
              onClick={() => setIsPaymentModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2.5 bg-blue-50 text-[#2563EB] rounded-xl border border-blue-100">
                <CreditCard className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-bold text-slate-800">Complete Payment</h2>
            </div>

            <div className="bg-slate-100 border border-slate-200 rounded-2xl p-4 mb-4 text-xs sm:text-sm">
              <p className="font-bold text-slate-900 mb-1">
                {PAYMENT_INFO.bankName} Transfer Info:
              </p>
              <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-200 mb-2">
                <div>
                  <p className="text-[10px] text-slate-400 font-semibold">
                    ACCOUNT NAME
                  </p>
                  <p className="font-bold text-slate-800 text-sm">
                    {PAYMENT_INFO.accountName}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-400 font-semibold">
                    ACCOUNT NUMBER
                  </p>
                  <p className="font-mono font-bold text-[#2563EB] text-base">
                    {PAYMENT_INFO.accountNumber}
                  </p>
                </div>
              </div>
              <p className="text-xs sm:text-sm text-slate-700">
                Total Amount Due:{' '}
                <strong className="text-[#2563EB] font-bold text-base ml-1">
                  RM {totalPrice}
                </strong>
              </p>
            </div>

            <form onSubmit={handlePaymentSubmit}>
              <div className="mb-4">
                <label className="block text-xs sm:text-sm font-bold text-slate-600 mb-1.5">
                  Upload Bank Slip / Receipt (PDF or Image)
                </label>
                <div className="border-2 border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 hover:border-[#2563EB] rounded-2xl p-4 text-center cursor-pointer transition">
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => setReceiptFile(e.target.files[0])}
                    className="hidden"
                    id="receipt-upload"
                  />
                  <label
                    htmlFor="receipt-upload"
                    className="cursor-pointer flex flex-col items-center"
                  >
                    <Upload className="w-6 h-6 text-slate-400 mb-1" />
                    <span className="text-xs sm:text-sm font-bold text-[#2563EB]">
                      {receiptFile
                        ? receiptFile.name
                        : 'Click to select or drag receipt here'}
                    </span>
                    <span className="text-[10px] text-slate-400 mt-0.5">
                      Max file size: 5MB
                    </span>
                  </label>
                </div>
              </div>

              <div className="mb-5 bg-slate-100 p-3.5 rounded-2xl border border-slate-200">
                <label className="flex items-start space-x-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreedTerms}
                    onChange={(e) => setAgreedTerms(e.target.checked)}
                    className="mt-0.5 rounded text-[#2563EB] focus:ring-[#2563EB] cursor-pointer"
                  />
                  <span className="text-xs text-slate-600 leading-tight">
                    I agree to the terms: Cancellations must be made at least{' '}
                    <strong>2 days before</strong> the date of booking to receive a
                    refund.
                  </span>
                </label>
              </div>

              <button
                type="submit"
                disabled={submittingPayment}
                className="w-full py-3.5 text-sm bg-[#2563EB] hover:bg-[#1D4ED8] active:scale-95 text-white rounded-full font-bold shadow-md transition cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submittingPayment ? 'Submitting...' : 'Submit Booking & Slip'}
              </button>
            </form>
          </div>
        </div>
      )}

      {completedBooking && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex justify-center items-center p-4 z-50 animate-in zoom-in-95 duration-200 print:bg-white print:p-0">
          
          <div className="bg-white rounded-3xl shadow-2xl p-6 sm:p-8 max-w-md w-full relative print:shadow-none print:max-w-none print:w-full print-area">
            
            <button 
              onClick={() => setCompletedBooking(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 print-hidden cursor-pointer"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Check className="w-8 h-8 text-emerald-600" />
              </div>
              <h2 className="text-2xl font-black text-slate-900">Your booking is confirmed! 🎉</h2>
              <p className="text-sm text-slate-500 mt-2">Thank you for booking with us.</p>
            </div>

            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 mb-6 space-y-3 text-sm">
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-500 font-semibold">Booking ID</span>
                <span className="font-mono font-bold text-[#2563EB]">{completedBooking.booking_id}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-500 font-semibold">Date</span>
                <span className="font-bold text-slate-800">{completedBooking.booking_date}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-500 font-semibold">Total Paid</span>
                <span className="font-black text-[#2563EB]">RM {completedBooking.total_price}</span>
              </div>
              <div className="flex justify-between pt-1">
                <span className="text-slate-500 font-semibold">Status</span>
                <span className="font-bold text-amber-500 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">Pending Approval</span>
              </div>
            </div>

            <div className="space-y-3 print-hidden">
              <button 
                onClick={() => alert("Extend Session feature will be implemented next.")}
                className="w-full py-3 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold text-sm transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Clock className="w-4 h-4" /> Extend My Session (+1 Hour)
              </button>

              <div className="flex gap-3">
                <button 
                  onClick={() => window.print()} 
                  className="flex-1 py-3 bg-blue-50 text-[#2563EB] border border-blue-200 hover:bg-blue-100 rounded-xl font-bold text-sm transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" /> Download PDF
                </button>
                
                <button 
                  onClick={() => {
                    setCompletedBooking(null);
                    goToHomePage();
                  }}
                  className="flex-1 py-3 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl font-bold text-sm transition shadow-md cursor-pointer"
                >
                  Back to Home
                </button>
              </div>
            </div>

            <div className="hidden print:block text-center mt-8 pt-4 border-t border-slate-200 text-xs text-slate-400">
              Generated by Pickleball Booking System
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

export default App;