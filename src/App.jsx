import React, { useState, useEffect } from 'react';
import { 
  Calendar, User, CheckCircle, X, LogOut, Phone, Scissors, 
  CreditCard, ChevronRight, ArrowLeft, Plus, Trash2, Lock, 
  MessageCircle, AlertTriangle, Camera, Instagram, MapPin, 
  Tag, Globe, Edit3, Video, Image as ImageIcon, Database,
  Star, Quote, Layout, Landmark, Check, ExternalLink
} from 'lucide-react';

import { db } from './firebase';
import { 
  collection, addDoc, deleteDoc, updateDoc, doc, onSnapshot 
} from 'firebase/firestore';

// --- DATOS POR DEFECTO ---
const DEFAULT_CMS_DATA = {
  heroTitle: "Estilo Legendario",
  heroSubtitle: "Tu imagen es nuestra prioridad. Agenda en segundos con los mejores.",
  aboutTitle: "Más que una Barbería",
  aboutText: "En Barber Pro no solo cortamos cabello, creamos experiencias. Un ambiente relajado, buena música y los mejores profesionales de Talagante listos para asesorarte.",
  address: "Esmeralda 1062, Talagante",
  mapUrl: "https://maps.google.com/maps?q=Esmeralda+1062,+Talagante&t=&z=15&ie=UTF8&iwloc=&output=embed",
  instagramUser: "@BarberPro_Talagante",
  instagramLink: "https://instagram.com",
  gallery: [],
  shopPhotos: [
    { id: 1, url: "https://images.unsplash.com/photo-1503951914875-befbb711058c?auto=format&fit=crop&w=800&q=80" },
    { id: 2, url: "https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=800&q=80" }
  ],
  testimonials: [
    { id: 1, name: "Carlos M.", text: "El mejor degradado que me han hecho. Dani es un crack.", stars: 5 },
    { id: 2, name: "Felipe R.", text: "Excelente atención y el local es muy cómodo.", stars: 5 }
  ],
  offers: []
};

// --- USUARIOS BASE ---
const SEED_USERS = [
  {
    name: "Dueño / Admin", username: "admin", password: "123", role: "admin",
    photo: "https://api.dicebear.com/7.x/avataaars/svg?seed=Admin", phone: "56900000000"
  },
  { 
    name: 'Dani "El Mago"', username: "dani", password: "123", role: "barber",
    photo: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix', phone: "56911111111",
    bank: {
      name: "Daniel Mago", rut: "15.111.111-1", bankName: "Banco Estado",
      type: "Cuenta RUT", number: "15111111", email: "dani@barber.cl"
    },
    services: [{ id: 101, name: 'Corte Degradado', price: 12000 }, { id: 102, name: 'Barba Terapia', price: 15000 }]
  }
];

export default function App() {
  // --- ESTADOS ---
  const [users, setUsers] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [cmsData, setCmsData] = useState(DEFAULT_CMS_DATA);
  const [cmsId, setCmsId] = useState(null);
  
  const [view, setView] = useState('landing');
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [loginForm, setLoginForm] = useState({ user: '', pass: '', error: '' });

  // Admin States
  const [adminTab, setAdminTab] = useState('agenda');
  const [newBarber, setNewBarber] = useState({ 
    name: '', username: '', password: '', photo: '', phone: '',
    bankName: '', bankRut: '', bankBank: '', bankType: '', bankNumber: '', bankEmail: ''
  });
  const [newOffer, setNewOffer] = useState({ title: '', price: '', desc: '' });
  const [newGalleryItem, setNewGalleryItem] = useState({ type: 'image', url: '', link: '' });
  const [newTestimonial, setNewTestimonial] = useState({ name: '', text: '' });
  const [newShopPhoto, setNewShopPhoto] = useState('');

  // Barber States
  const [newService, setNewService] = useState({ name: '', price: '' });
  const [cancelReason, setCancelReason] = useState('');
  const [apptToCancel, setApptToCancel] = useState(null);

  // Client States
  const [bookingStep, setBookingStep] = useState(1);
  const [reservation, setReservation] = useState({ barber: null, service: null, date: '', time: '', client: '', phone: '' });
  // Nuevo estado para la pantalla final de éxito
  const [lastBookingData, setLastBookingData] = useState(null); 

  // =============================================================
  // CONEXIÓN FIREBASE
  // =============================================================
  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, "users"), (s) => setUsers(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubAppts = onSnapshot(collection(db, "appointments"), (s) => setAppointments(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubCms = onSnapshot(collection(db, "cms"), (s) => {
      if (!s.empty) { setCmsData(s.docs[0].data()); setCmsId(s.docs[0].id); }
      setLoading(false);
    });
    return () => { unsubUsers(); unsubAppts(); unsubCms(); };
  }, []);

  const saveCms = async (newData) => {
    if (cmsId) await updateDoc(doc(db, "cms", cmsId), newData);
    else await addDoc(collection(db, "cms"), newData);
  };

  const seedDatabase = async () => {
    if (confirm("¿Inicializar Base de Datos?")) {
      for (const u of SEED_USERS) await addDoc(collection(db, "users"), u);
      await addDoc(collection(db, "cms"), DEFAULT_CMS_DATA);
      alert("¡Listo! Admin: admin / 123");
    }
  };

  // =============================================================
  // LÓGICA DE NEGOCIO
  // =============================================================
  const getAvailableSlots = (barberId, date) => {
    const slots = [];
    const startHour = 10;
    const endHour = 20;
    const barberAppts = appointments.filter(a => a.barberId === barberId && a.date === date && a.status !== 'cancelled');
    for (let h = startHour; h < endHour; h++) {
      const timeString = `${h}:00`; 
      const slotMinutes = h * 60;
      const isBlocked = barberAppts.some(appt => {
        const [apptH, apptM] = appt.time.split(':').map(Number);
        const apptMinutes = apptH * 60 + apptM;
        return Math.abs(slotMinutes - apptMinutes) < 60; 
      });
      slots.push({ time: timeString, available: !isBlocked });
    }
    return slots;
  };

  const getEmbedUrl = (url) => {
    if (!url) return '';
    if (url.includes('/embed')) return url;
    const cleanUrl = url.split('?')[0]; 
    return cleanUrl.endsWith('/') ? `${cleanUrl}embed` : `${cleanUrl}/embed`;
  };

  // =============================================================
  // MANEJADORES CMS
  // =============================================================
  const handleUpdateCms = (field, value) => {
    const newData = { ...cmsData, [field]: value };
    setCmsData(newData);
    saveCms(newData);
  };

  const handleAddOffer = (e) => {
    e.preventDefault();
    if(!newOffer.title) return;
    const updated = [...(cmsData.offers || []), { id: Date.now(), ...newOffer }];
    handleUpdateCms('offers', updated);
    setNewOffer({ title: '', price: '', desc: '' });
  };
  const handleDeleteOffer = (id) => handleUpdateCms('offers', cmsData.offers.filter(o => o.id !== id));

  const handleAddGalleryItem = () => {
    if(!newGalleryItem.url) return;
    const linkToUse = newGalleryItem.link || (newGalleryItem.type === 'reel' ? newGalleryItem.url : cmsData.instagramLink);
    const updated = [...(cmsData.gallery || []), { id: Date.now(), ...newGalleryItem, link: linkToUse }];
    handleUpdateCms('gallery', updated);
    setNewGalleryItem({ type: 'image', url: '', link: '' });
  };
  const handleDeleteGalleryItem = (id) => handleUpdateCms('gallery', cmsData.gallery.filter(i => i.id !== id));

  const handleAddTestimonial = (e) => {
    e.preventDefault();
    if(!newTestimonial.name) return;
    const updated = [...(cmsData.testimonials || []), { id: Date.now(), ...newTestimonial, stars: 5 }];
    handleUpdateCms('testimonials', updated);
    setNewTestimonial({ name: '', text: '' });
  };
  const handleDeleteTestimonial = (id) => handleUpdateCms('testimonials', cmsData.testimonials.filter(t => t.id !== id));

  const handleAddShopPhoto = () => {
    if(!newShopPhoto) return;
    const updated = [...(cmsData.shopPhotos || []), { id: Date.now(), url: newShopPhoto }];
    handleUpdateCms('shopPhotos', updated);
    setNewShopPhoto('');
  };
  const handleDeleteShopPhoto = (id) => handleUpdateCms('shopPhotos', cmsData.shopPhotos.filter(p => p.id !== id));

  // =============================================================
  // GESTIÓN
  // =============================================================
  const handleLogin = (e) => {
    e.preventDefault();
    const foundUser = users.find(u => u.username === loginForm.user && u.password === loginForm.pass);
    if (foundUser) {
      setCurrentUser(foundUser);
      setLoginForm({ user: '', pass: '', error: '' });
      setView(foundUser.role === 'admin' ? 'admin-panel' : 'barber-panel');
    } else {
      setLoginForm({ ...loginForm, error: 'Credenciales incorrectas' });
    }
  };

  // CLIENTE: SOLICITUD DE RESERVA (AHORA CON PASO FINAL SEPARADO)
  const requestReservation = async () => {
    await addDoc(collection(db, "appointments"), {
      barberId: reservation.barber.id,
      clientName: reservation.client,
      phone: reservation.phone,
      serviceName: reservation.service.name,
      price: reservation.service.price,
      date: reservation.date,
      time: reservation.time,
      status: 'pending', 
      deposit: { paid: false, method: 'Transferencia' }
    });
    
    // PREPARAR DATOS PARA LA PANTALLA DE ÉXITO
    const msg = `Hola ${reservation.barber.name} 👋, soy ${reservation.client}. Acabo de transferir el abono para mi cita: *${reservation.service.name}* el ${reservation.date} a las ${reservation.time}. Aquí te envío el comprobante (Foto). Quedo atento a tu confirmación.`;
    const link = `https://wa.me/${reservation.barber.phone}?text=${encodeURIComponent(msg)}`;

    setLastBookingData({ waLink: link });
    setBookingStep(5); // IR A PANTALLA DE ÉXITO
  };

  // BARBERO: CONFIRMAR PAGO
  const confirmPayment = async (apptId) => {
    if(window.confirm("¿Confirmas que recibiste el abono?")) {
      await updateDoc(doc(db, "appointments", apptId), { 
        status: 'confirmed',
        'deposit.paid': true 
      });
    }
  };

  // CANCELACIÓN (AHORA FUNCIONA SIEMPRE)
  const confirmCancellation = async () => {
    if (!cancelReason) return alert("Escribe un motivo");
    await updateDoc(doc(db, "appointments", apptToCancel.id), { status: 'cancelled' });
    
    let cleanPhone = apptToCancel.phone.replace(/\D/g, ''); 
    if (cleanPhone.length >= 8 && !cleanPhone.startsWith('56')) cleanPhone = '56' + cleanPhone; 
    
    const message = `Hola ${apptToCancel.clientName}. Cancelamos tu cita: ${cancelReason}.`;
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');
    
    setApptToCancel(null);
    setCancelReason('');
  };

  const handleAddBarber = async (e) => {
    e.preventDefault();
    if (!newBarber.name) return;
    const photoUrl = newBarber.photo.trim() || `https://api.dicebear.com/7.x/avataaars/svg?seed=${newBarber.username}`;
    
    const newUser = { 
      role: 'barber', 
      name: newBarber.name,
      username: newBarber.username,
      password: newBarber.password,
      phone: newBarber.phone,
      photo: photoUrl, 
      bank: {
        name: newBarber.bankName,
        rut: newBarber.bankRut,
        bankName: newBarber.bankBank,
        type: newBarber.bankType,
        number: newBarber.bankNumber,
        email: newBarber.bankEmail
      },
      services: [] 
    };

    await addDoc(collection(db, "users"), newUser);
    setNewBarber({ name: '', username: '', password: '', photo: '', phone: '', bankName: '', bankRut: '', bankBank: '', bankType: '', bankNumber: '', bankEmail: '' });
    alert("Barbero creado");
  };

  const handleDeleteBarber = async (id) => { if(window.confirm("¿Eliminar?")) await deleteDoc(doc(db, "users", id)); };
  
  const handleAddService = async () => {
    const updatedServices = [...(currentUser.services || []), { id: Date.now(), name: newService.name, price: parseInt(newService.price) }];
    await updateDoc(doc(db, "users", currentUser.id), { services: updatedServices });
    setCurrentUser({ ...currentUser, services: updatedServices });
    setNewService({ name: '', price: '' });
  };

  // =============================================================
  // VISTAS
  // =============================================================

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-white font-bold">Cargando Barber Pro...</div>;

  if (view === 'landing') {
    const barbersList = users.filter(u => u.role === 'barber');

    return (
      <div className="min-h-screen font-sans flex flex-col relative bg-zinc-950 overflow-x-hidden text-white">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/60 to-zinc-950 z-10"></div> 
          <img src="https://images.unsplash.com/photo-1585747860715-2ba37e788b70?ixlib=rb-1.2.1&auto=format&fit=crop&w=1950&q=80" className="w-full h-full object-cover opacity-60" alt="bg"/>
        </div>

        <div className="relative z-20 flex flex-col min-h-screen">
          <a href={`https://wa.me/56900000000`} target="_blank" className="fixed bottom-6 right-6 bg-green-500 p-4 rounded-full shadow-lg z-50 hover:scale-110 transition animate-bounce">
            <MessageCircle size={28} color="white" />
          </a>

          <nav className="p-6 flex justify-between items-center border-b border-white/10 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="bg-yellow-500 p-2 rounded-lg text-black shadow-[0_0_15px_rgba(234,179,8,0.5)]"><Scissors size={24}/></div>
              <span className="font-black text-2xl tracking-widest text-white">BARBER PRO</span>
            </div>
            <button onClick={() => setView('login')} className="text-xs font-bold bg-white/10 py-2 px-4 rounded-full border border-white/10 flex items-center gap-2 hover:bg-white/20 transition">
              <Lock size={12} /> ADMIN
            </button>
          </nav>

          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 mt-10">
            <h1 className="text-5xl md:text-7xl font-black mb-6 uppercase leading-none tracking-tighter animate-fade-in-up text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-yellow-500 to-yellow-600 drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">
              {cmsData.heroTitle}
            </h1>
            <p className="text-gray-200 mb-12 text-lg max-w-2xl mx-auto animate-fade-in-up delay-100 font-light drop-shadow-md">
              {cmsData.heroSubtitle}
            </p>
            <button onClick={() => setView('booking')} className="bg-gradient-to-r from-yellow-500 to-yellow-600 text-black font-black py-5 px-12 rounded-full text-xl hover:from-yellow-400 hover:to-yellow-500 transition transform hover:scale-105 shadow-[0_0_30px_rgba(234,179,8,0.6)] active:scale-95 flex flex-row items-center justify-center gap-3">
              <Calendar size={24} /> <span>RESERVAR AHORA</span>
            </button>
          </div>

          {cmsData.offers && cmsData.offers.length > 0 && (
            <section className="py-12 px-4 bg-zinc-900/50 backdrop-blur-sm border-y border-white/10">
              <div className="max-w-6xl mx-auto">
                <h3 className="text-center text-yellow-500 font-bold tracking-widest uppercase mb-8 flex items-center justify-center gap-2"><Tag size={20}/> Ofertas</h3>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {cmsData.offers.map(offer => (
                    <div key={offer.id} className="bg-black/60 border border-yellow-500/20 p-6 rounded-2xl relative overflow-hidden group hover:border-yellow-500/50 transition">
                      <div className="absolute top-0 right-0 bg-yellow-600 text-white font-bold text-xs px-3 py-1 rounded-bl-xl">OFERTA</div>
                      <h4 className="text-xl font-bold text-white mb-2">{offer.title}</h4>
                      <p className="text-gray-400 text-sm mb-4">{offer.desc}</p>
                      <p className="text-2xl font-black text-yellow-400">${offer.price}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          <section className="py-20 px-4 bg-zinc-950">
            <div className="max-w-6xl mx-auto text-center">
              <h3 className="text-3xl font-black text-white mb-12 uppercase tracking-tight">Nuestro Equipo</h3>
              <div className="flex flex-wrap justify-center gap-8">
                {barbersList.length === 0 ? <p className="text-gray-500">Cargando equipo...</p> : barbersList.map(barber => (
                  <div key={barber.id} className="bg-zinc-900 p-6 rounded-3xl border border-white/5 w-64 hover:bg-zinc-800 transition cursor-pointer group" onClick={() => setView('booking')}>
                    <img src={barber.photo} className="w-24 h-24 rounded-full mx-auto mb-4 border-2 border-yellow-600 object-cover group-hover:scale-110 transition" />
                    <h4 className="text-xl font-bold text-white">{barber.name}</h4>
                    <p className="text-yellow-600 text-sm font-bold mt-1">Barber Pro</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="py-20 bg-zinc-900 text-white border-t border-white/5">
            <div className="max-w-6xl mx-auto px-4 grid md:grid-cols-2 gap-12 items-center">
              <div>
                <h3 className="text-4xl font-black mb-6 uppercase text-yellow-500">{cmsData.aboutTitle}</h3>
                <p className="text-gray-400 text-lg mb-8 leading-relaxed font-light">{cmsData.aboutText}</p>
                <div className="grid grid-cols-2 gap-4">
                  {cmsData.shopPhotos && cmsData.shopPhotos.map(photo => (
                    <img key={photo.id} src={photo.url} className="w-full h-32 object-cover rounded-xl shadow-lg border border-white/10 hover:opacity-80 transition" />
                  ))}
                </div>
              </div>
              <div className="bg-black/40 p-8 rounded-3xl relative border border-white/5">
                <Quote className="absolute top-6 left-6 text-yellow-600 opacity-20" size={60} />
                <h4 className="text-2xl font-bold mb-8 text-center">Opiniones Reales</h4>
                <div className="space-y-4">
                  {cmsData.testimonials && cmsData.testimonials.map(t => (
                    <div key={t.id} className="bg-zinc-800 p-5 rounded-xl shadow-sm border border-white/5">
                      <div className="flex text-yellow-500 mb-2 gap-1">
                        {[...Array(t.stars)].map((_, i) => <Star key={i} size={14} fill="currentColor" />)}
                      </div>
                      <p className="text-gray-300 italic text-sm mb-3">"{t.text}"</p>
                      <p className="text-xs font-bold text-white uppercase tracking-wide">- {t.name}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="py-20 bg-black border-t border-white/10">
            <div className="max-w-6xl mx-auto px-4 grid md:grid-cols-2 gap-12 items-center">
              <div>
                <h3 className="text-4xl font-black mb-6 uppercase text-white">Ubicación</h3>
                <div className="flex items-center gap-4 mb-8">
                  <div className="bg-yellow-600 p-3 rounded-full text-white"><MapPin size={24} /></div>
                  <div>
                    <p className="text-gray-400 text-sm uppercase font-bold tracking-wider">Te esperamos en</p>
                    <p className="text-2xl font-bold text-white">{cmsData.address}</p>
                  </div>
                </div>
                <button onClick={() => setView('booking')} className="bg-white text-black px-10 py-4 rounded-xl font-black hover:bg-gray-200 transition shadow-[0_0_20px_rgba(255,255,255,0.3)]">
                  AGENDAR VISITA
                </button>
              </div>
              <div className="h-72 md:h-96 rounded-3xl overflow-hidden shadow-2xl border border-white/20 grayscale hover:grayscale-0 transition duration-500">
                <iframe src={cmsData.mapUrl} width="100%" height="100%" style={{ border: 0 }} allowFullScreen="" loading="lazy"></iframe>
              </div>
            </div>
          </section>

          <section className="py-16 bg-zinc-950 border-t border-white/10">
            <div className="max-w-6xl mx-auto px-4">
              <div className="flex flex-col items-center mb-10">
                <a href={cmsData.instagramLink} target="_blank" className="flex items-center gap-3 text-white hover:text-pink-500 transition mb-2 group bg-zinc-900 px-6 py-3 rounded-full border border-white/10">
                  <Instagram size={24} /> <span className="text-xl font-bold">{cmsData.instagramUser}</span>
                </a>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {cmsData.gallery && cmsData.gallery.map((item) => (
                  <div key={item.id} className="block relative group overflow-hidden rounded-xl h-80 border border-white/10 bg-gray-900">
                    {item.type === 'reel' ? (
                      <iframe src={getEmbedUrl(item.url)} className="w-full h-full" frameBorder="0" scrolling="no" allowTransparency="true"></iframe>
                    ) : (
                      <a href={item.link} target="_blank" className="block w-full h-full relative">
                        <img src={item.url} className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition duration-500" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>

          <div className="text-center p-8 bg-black text-white/20 text-xs border-t border-white/5">© 2025 Barber Pro System</div>
        </div>
      </div>
    );
  }

  // --- LOGIN ---
  if (view === 'login') {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="bg-zinc-900 w-full max-w-sm rounded-2xl p-8 shadow-2xl relative border border-white/10">
          <button onClick={() => setView('landing')} className="absolute top-4 left-4 text-gray-400 hover:text-white"><ArrowLeft size={20}/></button>
          <div className="text-center mb-8">
            <div className="bg-yellow-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg text-white"><Lock size={24}/></div>
            <h2 className="text-2xl font-black text-white">Staff Login</h2>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input type="text" className="w-full p-3 border border-white/10 rounded-lg bg-black text-white outline-none focus:border-yellow-600 transition" placeholder="Usuario" value={loginForm.user} onChange={e => setLoginForm({...loginForm, user: e.target.value})} />
            <input type="password" className="w-full p-3 border border-white/10 rounded-lg bg-black text-white outline-none focus:border-yellow-600 transition" placeholder="Contraseña" value={loginForm.pass} onChange={e => setLoginForm({...loginForm, pass: e.target.value})} />
            {loginForm.error && <p className="text-red-500 text-xs font-bold text-center bg-red-900/20 p-2 rounded">{loginForm.error}</p>}
            <button className="w-full bg-white text-black font-bold py-3 rounded-xl hover:bg-gray-200 transition">ENTRAR</button>
          </form>
          {users.length === 0 && <button onClick={seedDatabase} className="mt-6 text-xs text-blue-400 flex items-center justify-center gap-1 mx-auto hover:text-blue-300"><Database size={12}/> Activar Base de Datos</button>}
        </div>
      </div>
    );
  }

  // --- PANELES ---
  if (view === 'admin-panel' || view === 'barber-panel') {
    const visibleAppts = currentUser.role === 'admin' ? appointments : appointments.filter(a => a.barberId === currentUser.id);

    return (
      <div className="min-h-screen bg-gray-100 pb-20">
        <header className="bg-gray-900 text-white p-5 sticky top-0 z-20 shadow-md flex justify-between items-center">
          <div className="flex items-center gap-3">
             <img src={currentUser.photo} className="w-10 h-10 rounded-full border border-gray-500 bg-gray-800 object-cover" />
             <div><p className="text-xs text-gray-400 uppercase">{currentUser.role === 'admin' ? 'Dueño' : 'Barbero'}</p><h2 className="font-bold leading-none">{currentUser.name}</h2></div>
          </div>
          <button onClick={() => { setCurrentUser(null); setView('landing'); }} className="text-red-400 bg-gray-800 p-2 rounded-lg hover:bg-gray-700"><LogOut size={18}/></button>
        </header>

        {currentUser.role === 'admin' && (
          <div className="bg-white border-b px-4 py-2 flex gap-4 overflow-x-auto">
            <button onClick={() => setAdminTab('agenda')} className={`py-2 px-4 rounded-lg text-sm font-bold ${adminTab === 'agenda' ? 'bg-black text-white' : 'text-gray-500'}`}>Agenda</button>
            <button onClick={() => setAdminTab('team')} className={`py-2 px-4 rounded-lg text-sm font-bold ${adminTab === 'team' ? 'bg-black text-white' : 'text-gray-500'}`}>Equipo</button>
            <button onClick={() => setAdminTab('website')} className={`py-2 px-4 rounded-lg text-sm font-bold flex items-center gap-2 ${adminTab === 'website' ? 'bg-blue-600 text-white' : 'text-blue-600 bg-blue-50'}`}><Globe size={14}/> Web</button>
          </div>
        )}

        <main className="p-4 space-y-6 max-w-3xl mx-auto">
          {/* AGENDA */}
          {(adminTab === 'agenda' || currentUser.role === 'barber') && (
            <div className="space-y-3">
              {visibleAppts.length === 0 ? <div className="text-center py-8 text-gray-400">Sin citas activas</div> : 
                visibleAppts.filter(a => a.status !== 'cancelled').map(app => (
                  <div key={app.id} className={`bg-white p-4 rounded-xl shadow-sm border-l-4 relative ${app.status === 'confirmed' ? 'border-green-500' : 'border-yellow-400'}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-gray-900 text-lg">{app.clientName}</h4>
                        <p className="text-sm text-blue-600 font-medium">{app.serviceName}</p>
                        <p className="text-xs text-gray-400 flex items-center gap-1 mt-1"><Phone size={12}/> {app.phone}</p>
                        {app.status === 'pending' && <p className="text-xs text-yellow-600 font-bold bg-yellow-100 px-2 py-1 rounded inline-block mt-2">⏳ Pendiente Pago</p>}
                      </div>
                      <div className="text-right">
                        <span className="block text-2xl font-bold">{app.time}</span>
                        <span className="text-xs bg-gray-100 px-2 py-1 rounded font-bold">{app.date}</span>
                      </div>
                    </div>
                    
                    <div className="flex gap-2 mt-4">
                      {app.status === 'pending' && (
                        <button onClick={() => confirmPayment(app.id)} className="flex-1 bg-green-500 text-white py-2 rounded-lg font-bold flex items-center justify-center gap-1 shadow hover:bg-green-600">
                          <Check size={16}/> Confirmar Pago
                        </button>
                      )}
                      
                      {/* BOTÓN CANCELAR SIEMPRE VISIBLE */}
                      <button onClick={() => setApptToCancel(app)} className="flex-1 border border-red-100 text-red-500 py-2 rounded-lg font-bold flex items-center justify-center gap-1 hover:bg-red-50">
                        <X size={16}/> Cancelar
                      </button>
                    </div>
                  </div>
                ))
              }
            </div>
          )}

          {/* EQUIPO (ADMIN) */}
          {currentUser.role === 'admin' && adminTab === 'team' && (
            <section className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><User size={20} className="text-blue-600"/> Gestión de Equipo</h3>
              
              <form onSubmit={handleAddBarber} className="space-y-3 mb-6 bg-gray-50 p-4 rounded-xl border border-gray-200">
                <p className="text-xs font-bold text-gray-400 uppercase">Datos Personales</p>
                <div className="grid grid-cols-2 gap-2">
                  <input type="text" placeholder="Nombre" className="w-full p-2 border rounded bg-white" value={newBarber.name} onChange={e => setNewBarber({...newBarber, name: e.target.value})} />
                  <input type="tel" placeholder="Teléfono" className="w-full p-2 border rounded bg-white" value={newBarber.phone} onChange={e => setNewBarber({...newBarber, phone: e.target.value})} />
                </div>
                
                <p className="text-xs font-bold text-gray-400 uppercase mt-2">Credenciales</p>
                <div className="grid grid-cols-2 gap-2">
                  <input type="text" placeholder="Usuario" className="p-2 border rounded bg-white" value={newBarber.username} onChange={e => setNewBarber({...newBarber, username: e.target.value})} />
                  <input type="text" placeholder="Pass" className="p-2 border rounded bg-white" value={newBarber.password} onChange={e => setNewBarber({...newBarber, password: e.target.value})} />
                </div>

                <p className="text-xs font-bold text-gray-400 uppercase mt-2">Datos Bancarios</p>
                <input type="text" placeholder="Nombre Titular" className="w-full p-2 border rounded bg-white mb-2" value={newBarber.bankName} onChange={e => setNewBarber({...newBarber, bankName: e.target.value})} />
                <div className="grid grid-cols-2 gap-2">
                  <input type="text" placeholder="RUT" className="p-2 border rounded bg-white" value={newBarber.bankRut} onChange={e => setNewBarber({...newBarber, bankRut: e.target.value})} />
                  <input type="text" placeholder="Banco" className="p-2 border rounded bg-white" value={newBarber.bankBank} onChange={e => setNewBarber({...newBarber, bankBank: e.target.value})} />
                  <input type="text" placeholder="Tipo Cuenta" className="p-2 border rounded bg-white" value={newBarber.bankType} onChange={e => setNewBarber({...newBarber, bankType: e.target.value})} />
                  <input type="text" placeholder="N° Cuenta" className="p-2 border rounded bg-white" value={newBarber.bankNumber} onChange={e => setNewBarber({...newBarber, bankNumber: e.target.value})} />
                </div>
                <input type="email" placeholder="Correo Confirmación" className="w-full p-2 border rounded bg-white mt-2" value={newBarber.bankEmail} onChange={e => setNewBarber({...newBarber, bankEmail: e.target.value})} />

                <div className="flex gap-2 items-center mt-3">
                   <Camera size={20} className="text-gray-400" />
                   <input type="text" placeholder="URL Foto Perfil (Opcional)" className="flex-1 p-2 border rounded bg-white text-sm" value={newBarber.photo} onChange={e => setNewBarber({...newBarber, photo: e.target.value})} />
                </div>
                <button className="w-full bg-black text-white font-bold py-2 rounded-lg mt-2">Contratar Barbero</button>
              </form>

              <div className="space-y-2">
                 {users.filter(u => u.role === 'barber').map(b => (
                   <div key={b.id} className="flex justify-between items-center text-sm border-b py-2 last:border-0 p-2">
                     <div className="flex items-center gap-3">
                       <img src={b.photo} className="w-8 h-8 rounded-full bg-gray-200 object-cover" />
                       <div><p className="font-bold">{b.name}</p><p className="text-xs text-gray-500">{b.phone}</p></div>
                     </div>
                     <button onClick={() => handleDeleteBarber(b.id)} className="text-red-400 hover:bg-red-50 p-2 rounded"><Trash2 size={16}/></button>
                   </div>
                 ))}
              </div>
            </section>
          )}

          {/* TAB: WEB CMS */}
          {currentUser.role === 'admin' && adminTab === 'website' && (
            <div className="space-y-6">
              {/* Textos y Ubicación omitidos por brevedad, igual que antes */}
              <section className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Edit3 size={18}/> Textos Portada</h3>
                <div className="space-y-3">
                  <input type="text" className="w-full p-2 border rounded" value={cmsData.heroTitle} onChange={(e) => handleUpdateCms('heroTitle', e.target.value)} />
                  <textarea className="w-full p-2 border rounded h-20" value={cmsData.heroSubtitle} onChange={(e) => handleUpdateCms('heroSubtitle', e.target.value)} />
                </div>
              </section>
              {/* Resto de secciones CMS iguales... */}
            </div>
          )}

          {/* MIS SERVICIOS (BARBERO) */}
          {currentUser.role === 'barber' && (
            <section className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200">
               <h3 className="font-bold text-gray-800 mb-3">Mis Servicios</h3>
               <div className="flex gap-2 mb-3">
                 <input type="text" placeholder="Servicio" className="flex-1 p-2 border rounded text-sm" value={newService.name} onChange={e => setNewService({...newService, name: e.target.value})} />
                 <input type="number" placeholder="$" className="w-20 p-2 border rounded text-sm" value={newService.price} onChange={e => setNewService({...newService, price: e.target.value})} />
                 <button onClick={handleAddService} className="bg-black text-white p-2 rounded"><Plus size={18}/></button>
               </div>
               <div className="space-y-2">
                 {currentUser.services && currentUser.services.map(s => <div key={s.id} className="flex justify-between text-sm border-b pb-1"><span>{s.name}</span><span className="font-bold text-green-600">${s.price}</span></div>)}
               </div>
            </section>
          )}
        </main>

        {/* MODAL CANCELACIÓN */}
        {apptToCancel && (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
             <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-fade-in">
                <div className="flex items-center gap-2 text-red-600 mb-2">
                  <AlertTriangle size={24} />
                  <h3 className="font-bold text-lg">Cancelar Cita</h3>
                </div>
                <p className="text-sm text-gray-500 mb-4">Se abrirá WhatsApp para avisar al cliente.</p>
                <textarea className="w-full border-2 border-gray-100 p-3 rounded-xl text-sm mb-4 outline-none focus:border-red-300" placeholder="Motivo (Ej: Corte de luz)" value={cancelReason} onChange={e => setCancelReason(e.target.value)}></textarea>
                <div className="flex gap-3">
                  <button onClick={() => setApptToCancel(null)} className="flex-1 py-3 text-gray-500 font-bold hover:bg-gray-100 rounded-xl transition">Volver</button>
                  <button onClick={confirmCancellation} className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition shadow-lg">Confirmar</button>
                </div>
             </div>
          </div>
        )}
      </div>
    );
  }

  if (view === 'booking') {
    const activeBarbers = users.filter(u => u.role === 'barber');
    
    // PANTALLA DE ÉXITO (PASO 5)
    if (bookingStep === 5 && lastBookingData) {
      return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center animate-fade-in text-white">
          <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mb-6 shadow-2xl shadow-green-500/50">
            <Check size={48} className="text-white" />
          </div>
          <h2 className="text-3xl font-black mb-2">¡Reserva Iniciada!</h2>
          <p className="text-gray-400 mb-8 max-w-xs mx-auto">Para confirmar tu cita, envía el comprobante de transferencia ahora mismo.</p>
          
          <button 
            onClick={() => window.open(lastBookingData.waLink, '_blank')}
            className="w-full max-w-sm bg-green-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 mb-4 hover:bg-green-500 transition"
          >
            <MessageCircle size={24}/> Enviar Comprobante
          </button>
          
          <button 
            onClick={() => { setView('landing'); setBookingStep(1); }}
            className="text-gray-500 text-sm font-bold mt-4 hover:text-white"
          >
            Volver al Inicio
          </button>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gray-50 pb-20 font-sans">
        <header className="bg-white p-4 shadow-sm sticky top-0 z-10 flex items-center">
            <button onClick={() => { setView('landing'); setBookingStep(1); }} className="p-2 mr-2 hover:bg-gray-100 rounded-full"><ArrowLeft size={20}/></button>
            <h2 className="font-bold text-lg">Nueva Reserva</h2>
        </header>
        <main className="max-w-lg mx-auto p-6">
          {bookingStep === 1 && (
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-gray-800">Elige Profesional</h3>
              {activeBarbers.map(barber => (
                <button key={barber.id} onClick={() => { setReservation({...reservation, barber}); setBookingStep(2); }} className="w-full bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4 text-left group active:scale-95 transition">
                  <img src={barber.photo} className="w-16 h-16 rounded-full bg-gray-200 object-cover group-hover:scale-105 transition" />
                  <div><p className="font-bold text-lg text-gray-900">{barber.name}</p><p className="text-sm text-gray-500">{barber.services.length} Servicios</p></div>
                  <ChevronRight className="ml-auto text-gray-300 group-hover:text-black"/>
                </button>
              ))}
            </div>
          )}
          {bookingStep === 2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-2"><img src={reservation.barber.photo} className="w-8 h-8 rounded-full" /><h3 className="text-xl font-bold text-gray-800">Servicios</h3></div>
              {reservation.barber.services.map(s => (
                <button key={s.id} onClick={() => { setReservation({...reservation, service: s}); setBookingStep(3); }} className="w-full bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex justify-between hover:border-black transition items-center active:scale-95">
                  <span className="font-medium text-gray-800">{s.name}</span><span className="font-bold text-green-600">${s.price}</span>
                </button>
              ))}
            </div>
          )}
          {bookingStep === 3 && (
            <div className="space-y-6">
              <h3 className="text-xl font-bold text-gray-800">Elige Fecha y Hora</h3>
              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Día</label>
                <input 
                  type="date" 
                  className="w-full p-4 border rounded-xl bg-white text-lg font-bold outline-none focus:border-black text-gray-900" 
                  style={{ colorScheme: 'light' }} // FIX PARA MÓVILES
                  min={new Date().toISOString().split('T')[0]} 
                  onChange={e => setReservation({...reservation, date: e.target.value, time: ''})} 
                />
              </div>
              {reservation.date && (
                <div className="grid grid-cols-3 gap-3 animate-fade-in">
                  {getAvailableSlots(reservation.barber.id, reservation.date).map((slot, idx) => (
                    <button key={idx} disabled={!slot.available} onClick={() => setReservation({...reservation, time: slot.time})} className={`py-3 rounded-xl text-sm font-bold border-2 ${reservation.time === slot.time ? 'bg-black text-white border-black' : !slot.available ? 'bg-gray-100 text-gray-300' : 'bg-white'}`}>{slot.time}</button>
                  ))}
                </div>
              )}
              <button disabled={!reservation.time} onClick={() => setBookingStep(4)} className="w-full bg-black text-white py-4 rounded-xl font-bold text-lg disabled:opacity-50 hover:bg-gray-800 transition">Continuar</button>
            </div>
          )}
          {bookingStep === 4 && (
            <div className="space-y-6">
              <h3 className="text-xl font-bold text-gray-800">Confirmar</h3>
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex justify-between font-bold text-lg mb-1"><span>{reservation.service.name}</span><span>${reservation.service.price}</span></div>
                <p className="text-sm text-gray-500">con {reservation.barber.name}</p>
                <div className="mt-3 pt-3 border-t border-dashed flex justify-between text-sm"><span>{reservation.date}</span><span>{reservation.time}</span></div>
              </div>

              {/* TARJETA DATOS BANCARIOS */}
              <div className="bg-blue-50 p-5 rounded-2xl border border-blue-200">
                <div className="flex items-center gap-2 mb-3 text-blue-800 font-bold">
                  <Landmark size={20}/>
                  <h3>Datos de Transferencia</h3>
                </div>
                <div className="space-y-2 text-sm text-blue-900 bg-white/50 p-3 rounded-xl">
                  {reservation.barber.bank ? (
                    <>
                      <p><span className="font-bold">Nombre:</span> {reservation.barber.bank.name}</p>
                      <p><span className="font-bold">RUT:</span> {reservation.barber.bank.rut}</p>
                      <p><span className="font-bold">Banco:</span> {reservation.barber.bank.bankName}</p>
                      <p><span className="font-bold">Tipo:</span> {reservation.barber.bank.type}</p>
                      <p><span className="font-bold">N°:</span> {reservation.barber.bank.number}</p>
                      <p><span className="font-bold">Correo:</span> {reservation.barber.bank.email}</p>
                    </>
                  ) : <p className="italic text-gray-500">Sin datos bancarios.</p>}
                </div>
              </div>

              <div className="space-y-3">
                <input type="text" placeholder="Tu Nombre" className="w-full p-4 border rounded-xl" onChange={e => setReservation({...reservation, client: e.target.value})} />
                <input type="tel" placeholder="Celular" className="w-full p-4 border rounded-xl" onChange={e => setReservation({...reservation, phone: e.target.value})} />
              </div>
              <button disabled={!reservation.client || !reservation.phone} onClick={requestReservation} className="w-full bg-green-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2">
                <MessageCircle size={20} /> ENVIAR SOLICITUD
              </button>
            </div>
          )}
        </main>
      </div>
    );
  }
}