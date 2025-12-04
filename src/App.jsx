import React, { useState, useEffect } from 'react';
import { 
  Calendar, User, CheckCircle, X, LogOut, Phone, Scissors, 
  CreditCard, ChevronRight, ArrowLeft, Plus, Trash2, Lock, 
  MessageCircle, AlertTriangle, Camera, Instagram, MapPin, 
  Tag, Globe, Edit3, Video, Image as ImageIcon, Database,
  Star, Quote, Layout, Map
} from 'lucide-react';

// IMPORTAR FIREBASE
import { db } from './firebase';
import { 
  collection, addDoc, deleteDoc, updateDoc, doc, onSnapshot 
} from 'firebase/firestore';

// --- DATOS POR DEFECTO (Se usan si la BD está vacía) ---
const DEFAULT_CMS_DATA = {
  heroTitle: "Estilo Legendario",
  heroSubtitle: "Agenda tu cita en segundos. Elige a tu profesional, abona seguro y confirma al instante.",
  aboutTitle: "Más que una Barbería",
  aboutText: "En Barber Pro no solo cortamos cabello, creamos experiencias. Un ambiente relajado, buena música y los mejores profesionales de Talagante listos para asesorarte.",
  address: "Esmeralda 1062, Talagante",
  mapUrl: "https://maps.google.com/maps?q=Esmeralda+1062,+Talagante&t=&z=15&ie=UTF8&iwloc=&output=embed",
  instagramUser: "@BarberPro_Talagante",
  instagramLink: "https://instagram.com",
  gallery: [], // Instagram/Reels
  shopPhotos: [ // Fotos del Local
    { id: 1, url: "https://images.unsplash.com/photo-1503951914875-befbb711058c?auto=format&fit=crop&w=800&q=80" },
    { id: 2, url: "https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=800&q=80" }
  ],
  testimonials: [
    { id: 1, name: "Carlos M.", text: "El mejor degradado que me han hecho. Dani es un crack.", stars: 5 },
    { id: 2, name: "Felipe R.", text: "Excelente atención y el local es muy cómodo.", stars: 5 }
  ],
  offers: []
};

const SEED_USERS = [
  {
    name: "Dueño / Admin", username: "admin", password: "123", role: "admin",
    photo: "https://api.dicebear.com/7.x/avataaars/svg?seed=Admin", phone: "56900000000"
  },
  { 
    name: 'Dani "El Mago"', username: "dani", password: "123", role: "barber",
    photo: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix', phone: "56911111111", 
    services: [{ id: 101, name: 'Corte Degradado', price: 12000 }, { id: 102, name: 'Barba Terapia', price: 15000 }]
  },
  { 
    name: 'Jorge "Cortes"', username: "jorge", password: "123", role: "barber",
    photo: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka', phone: "56922222222", 
    services: [{ id: 201, name: 'Corte Clásico', price: 10000 }]
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
  const [newBarber, setNewBarber] = useState({ name: '', username: '', password: '', photo: '', phone: '' });
  const [newOffer, setNewOffer] = useState({ title: '', price: '', desc: '' });
  const [newGalleryItem, setNewGalleryItem] = useState({ type: 'image', url: '', link: '' });
  
  // NUEVOS ESTADOS ADMIN
  const [newTestimonial, setNewTestimonial] = useState({ name: '', text: '' });
  const [newShopPhoto, setNewShopPhoto] = useState('');

  // Barber States
  const [newService, setNewService] = useState({ name: '', price: '' });
  const [cancelReason, setCancelReason] = useState('');
  const [apptToCancel, setApptToCancel] = useState(null);

  // Client States
  const [bookingStep, setBookingStep] = useState(1);
  const [reservation, setReservation] = useState({ barber: null, service: null, date: '', time: '', client: '', phone: '' });

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
  // MANEJADORES CMS (ACTUALIZADOS)
  // =============================================================
  
  const handleUpdateCms = (field, value) => {
    const newData = { ...cmsData, [field]: value };
    setCmsData(newData);
    saveCms(newData);
  };

  // OFERTAS
  const handleAddOffer = (e) => {
    e.preventDefault();
    if(!newOffer.title) return;
    const updated = [...(cmsData.offers || []), { id: Date.now(), ...newOffer }];
    handleUpdateCms('offers', updated);
    setNewOffer({ title: '', price: '', desc: '' });
  };
  const handleDeleteOffer = (id) => handleUpdateCms('offers', cmsData.offers.filter(o => o.id !== id));

  // GALERÍA INSTAGRAM
  const handleAddGalleryItem = () => {
    if(!newGalleryItem.url) return;
    const linkToUse = newGalleryItem.link || (newGalleryItem.type === 'reel' ? newGalleryItem.url : cmsData.instagramLink);
    const updated = [...(cmsData.gallery || []), { id: Date.now(), ...newGalleryItem, link: linkToUse }];
    handleUpdateCms('gallery', updated);
    setNewGalleryItem({ type: 'image', url: '', link: '' });
  };
  const handleDeleteGalleryItem = (id) => handleUpdateCms('gallery', cmsData.gallery.filter(i => i.id !== id));

  // NUEVO: TESTIMONIOS
  const handleAddTestimonial = (e) => {
    e.preventDefault();
    if(!newTestimonial.name) return;
    const updated = [...(cmsData.testimonials || []), { id: Date.now(), ...newTestimonial, stars: 5 }];
    handleUpdateCms('testimonials', updated);
    setNewTestimonial({ name: '', text: '' });
  };
  const handleDeleteTestimonial = (id) => handleUpdateCms('testimonials', cmsData.testimonials.filter(t => t.id !== id));

  // NUEVO: FOTOS DEL LOCAL
  const handleAddShopPhoto = () => {
    if(!newShopPhoto) return;
    const updated = [...(cmsData.shopPhotos || []), { id: Date.now(), url: newShopPhoto }];
    handleUpdateCms('shopPhotos', updated);
    setNewShopPhoto('');
  };
  const handleDeleteShopPhoto = (id) => handleUpdateCms('shopPhotos', cmsData.shopPhotos.filter(p => p.id !== id));


  // =============================================================
  // GESTIÓN USUARIOS / CITAS
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

  const confirmReservation = async () => {
    await addDoc(collection(db, "appointments"), {
      barberId: reservation.barber.id,
      clientName: reservation.client,
      phone: reservation.phone,
      serviceName: reservation.service.name,
      price: reservation.service.price,
      date: reservation.date,
      time: reservation.time,
      status: 'confirmed',
      deposit: { paid: true, method: 'WebPay' }
    });
    alert("¡Pago Exitoso! Redirigiendo a WhatsApp...");
    const msg = `Hola ${reservation.barber.name}, soy ${reservation.client}. Reservé *${reservation.service.name}* el ${reservation.date} a las ${reservation.time}. Abono OK.`;
    window.open(`https://wa.me/${reservation.barber.phone}?text=${encodeURIComponent(msg)}`, '_blank');
    setView('landing');
    setBookingStep(1);
    setReservation({ barber: null, service: null, date: '', time: '', client: '', phone: '' });
  };

  const confirmCancellation = async () => {
    if (!cancelReason) return alert("Escribe un motivo");
    await updateDoc(doc(db, "appointments", apptToCancel.id), { status: 'cancelled' });
    let cleanPhone = apptToCancel.phone.replace(/\D/g, ''); 
    if (cleanPhone.length >= 8 && !cleanPhone.startsWith('56')) cleanPhone = '569' + cleanPhone; 
    const message = `Hola ${apptToCancel.clientName}. Cancelamos tu cita: ${cancelReason}.`;
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');
    setApptToCancel(null);
    setCancelReason('');
  };

  // Helpers para Admin de Barberos y Servicios
  const handleAddBarber = async (e) => {
    e.preventDefault();
    if (!newBarber.name) return;
    const photoUrl = newBarber.photo.trim() || `https://api.dicebear.com/7.x/avataaars/svg?seed=${newBarber.username}`;
    await addDoc(collection(db, "users"), { role: 'barber', ...newBarber, photo: photoUrl, services: [] });
    setNewBarber({ name: '', username: '', password: '', photo: '', phone: '' });
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
      <div className="min-h-screen font-sans flex flex-col relative bg-black overflow-x-hidden text-white">
        
        {/* BACKGROUND */}
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/50 to-black z-10"></div> 
          <img src="https://images.unsplash.com/photo-1585747860715-2ba37e788b70?ixlib=rb-1.2.1&auto=format&fit=crop&w=1950&q=80" className="w-full h-full object-cover opacity-50" alt="bg"/>
        </div>

        <div className="relative z-20 flex flex-col min-h-screen">
          
          {/* BOTÓN WHATSAPP */}
          <a href={`https://wa.me/56900000000`} target="_blank" className="fixed bottom-6 right-6 bg-green-500 p-4 rounded-full shadow-lg z-50 hover:scale-110 transition animate-bounce">
            <MessageCircle size={28} color="white" />
          </a>

          {/* NAVBAR */}
          <nav className="p-6 flex justify-between items-center border-b border-white/10 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="bg-yellow-500 p-2 rounded-lg text-black"><Scissors size={24}/></div>
              <span className="font-black text-2xl tracking-widest">BARBER PRO</span>
            </div>
            <button onClick={() => setView('login')} className="text-xs font-bold bg-white/10 py-2 px-4 rounded-full border border-white/10 flex items-center gap-2 hover:bg-white/20">
              <Lock size={12} /> ADMIN
            </button>
          </nav>

          {/* HERO */}
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 mt-10">
            <h1 className="text-5xl md:text-7xl font-black mb-4 uppercase leading-none tracking-tighter animate-fade-in-up">{cmsData.heroTitle}</h1>
            <p className="text-gray-300 mb-10 text-lg max-w-2xl mx-auto animate-fade-in-up delay-100">{cmsData.heroSubtitle}</p>
            <button onClick={() => setView('booking')} className="bg-yellow-500 text-black font-black py-5 px-10 rounded-full text-xl hover:bg-yellow-400 transition transform hover:scale-105 shadow-glow animate-bounce">
              <Calendar size={24} /> RESERVAR HORA
            </button>
          </div>

          {/* OFERTAS */}
          {cmsData.offers && cmsData.offers.length > 0 && (
            <section className="py-12 px-4 bg-white/5 backdrop-blur-sm border-y border-white/10">
              <div className="max-w-6xl mx-auto">
                <h3 className="text-center text-yellow-500 font-bold tracking-widest uppercase mb-8 flex items-center justify-center gap-2"><Tag size={20}/> Ofertas</h3>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {cmsData.offers.map(offer => (
                    <div key={offer.id} className="bg-black/50 border border-yellow-500/30 p-6 rounded-2xl relative overflow-hidden group hover:border-yellow-500 transition">
                      <div className="absolute top-0 right-0 bg-yellow-500 text-black font-bold text-xs px-3 py-1 rounded-bl-xl">OFERTA</div>
                      <h4 className="text-xl font-bold text-white mb-2">{offer.title}</h4>
                      <p className="text-gray-400 text-sm mb-4">{offer.desc}</p>
                      <p className="text-2xl font-black text-yellow-400">${offer.price}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* EQUIPO */}
          <section className="py-16 px-4">
            <div className="max-w-6xl mx-auto text-center">
              <h3 className="text-3xl font-black text-white mb-10 uppercase">Nuestro Equipo</h3>
              <div className="flex flex-wrap justify-center gap-8">
                {barbersList.length === 0 ? <p className="text-gray-500">Cargando equipo...</p> : barbersList.map(barber => (
                  <div key={barber.id} className="bg-white/5 p-6 rounded-3xl border border-white/10 w-64 hover:bg-white/10 transition cursor-pointer" onClick={() => setView('booking')}>
                    <img src={barber.photo} className="w-24 h-24 rounded-full mx-auto mb-4 border-2 border-yellow-500 object-cover" />
                    <h4 className="text-xl font-bold">{barber.name}</h4>
                    <p className="text-yellow-500 text-sm">Barber Pro</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* NUEVO: LA EXPERIENCIA (SOBRE NOSOTROS + FOTOS LOCAL) */}
          <section className="py-16 bg-white text-black">
            <div className="max-w-6xl mx-auto px-4 grid md:grid-cols-2 gap-12 items-center">
              <div>
                <h3 className="text-4xl font-black mb-6 uppercase">{cmsData.aboutTitle || "La Experiencia"}</h3>
                <p className="text-gray-600 text-lg mb-8 leading-relaxed">
                  {cmsData.aboutText || "Ven a vivir el mejor servicio de la zona."}
                </p>
                <div className="grid grid-cols-2 gap-4">
                  {cmsData.shopPhotos && cmsData.shopPhotos.map(photo => (
                    <img key={photo.id} src={photo.url} className="w-full h-32 object-cover rounded-xl shadow-lg hover:scale-105 transition" />
                  ))}
                </div>
              </div>
              <div className="bg-gray-100 p-8 rounded-3xl relative">
                <Quote className="absolute top-4 left-4 text-yellow-500 opacity-20" size={60} />
                <h4 className="text-2xl font-bold mb-6 text-center">Lo que dicen ellos</h4>
                <div className="space-y-4">
                  {cmsData.testimonials && cmsData.testimonials.map(t => (
                    <div key={t.id} className="bg-white p-4 rounded-xl shadow-sm">
                      <div className="flex text-yellow-400 mb-2">
                        {[...Array(t.stars)].map((_, i) => <Star key={i} size={14} fill="currentColor" />)}
                      </div>
                      <p className="text-gray-600 italic text-sm mb-2">"{t.text}"</p>
                      <p className="text-xs font-bold text-gray-900">- {t.name}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* UBICACIÓN & MAPA */}
          <section className="py-16 bg-black border-t border-white/10">
            <div className="max-w-6xl mx-auto px-4 grid md:grid-cols-2 gap-8 items-center">
              <div>
                <h3 className="text-3xl font-black mb-4 uppercase text-white">Ubicación</h3>
                <div className="flex items-center gap-3 mb-6">
                  <MapPin className="text-yellow-600" size={30} />
                  <p className="text-xl font-medium text-white">{cmsData.address}</p>
                </div>
                <button onClick={() => setView('booking')} className="bg-white text-black px-8 py-3 rounded-xl font-bold hover:bg-gray-200">Agendar Visita</button>
              </div>
              <div className="h-64 md:h-80 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/20">
                <iframe src={cmsData.mapUrl} width="100%" height="100%" style={{ border: 0 }} allowFullScreen="" loading="lazy"></iframe>
              </div>
            </div>
          </section>

          {/* GALERÍA INSTAGRAM */}
          <section className="py-12 bg-black border-t border-white/10">
            <div className="max-w-6xl mx-auto px-4">
              <div className="flex flex-col items-center mb-8">
                <a href={cmsData.instagramLink} target="_blank" className="flex items-center gap-2 text-white hover:text-pink-500 transition mb-2 group">
                  <Instagram size={24} /> <span className="text-2xl font-bold">{cmsData.instagramUser}</span>
                </a>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {cmsData.gallery && cmsData.gallery.map((item) => (
                  <div key={item.id} className="block relative group overflow-hidden rounded-xl h-80 border border-white/10 bg-gray-900">
                    {item.type === 'reel' ? (
                      <iframe src={getEmbedUrl(item.url)} className="w-full h-full" frameBorder="0" scrolling="no" allowTransparency="true"></iframe>
                    ) : (
                      <a href={item.link} target="_blank" className="block w-full h-full relative">
                        <img src={item.url} className="w-full h-full object-cover opacity-80 hover:opacity-100 transition" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>

          <div className="text-center p-6 bg-black text-white/30 text-xs border-t border-white/5">© 2025 Barber Pro System</div>
        </div>
      </div>
    );
  }

  // --- LOGIN ---
  if (view === 'login') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-sm rounded-2xl p-8 shadow-2xl text-center">
          <button onClick={() => setView('landing')} className="absolute top-4 left-4 text-gray-400"><ArrowLeft size={20}/></button>
          <h2 className="text-2xl font-black text-gray-900 mb-6">Acceso Staff</h2>
          <form onSubmit={handleLogin} className="space-y-4">
            <input type="text" className="w-full p-3 border rounded-lg" placeholder="Usuario" value={loginForm.user} onChange={e => setLoginForm({...loginForm, user: e.target.value})} />
            <input type="password" className="w-full p-3 border rounded-lg" placeholder="Contraseña" value={loginForm.pass} onChange={e => setLoginForm({...loginForm, pass: e.target.value})} />
            {loginForm.error && <p className="text-red-500 text-xs font-bold">{loginForm.error}</p>}
            <button className="w-full bg-black text-white font-bold py-3 rounded-xl hover:bg-gray-800">ENTRAR</button>
          </form>
          {users.length === 0 && <button onClick={seedDatabase} className="mt-4 text-xs text-blue-500 flex items-center justify-center gap-1 mx-auto"><Database size={12}/> Inicializar DB</button>}
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
          {/* TAB: AGENDA */}
          {(adminTab === 'agenda' || currentUser.role === 'barber') && (
            <div className="space-y-3">
              {visibleAppts.length === 0 ? <div className="text-center py-8 text-gray-400">Sin citas activas</div> : 
                visibleAppts.filter(a => a.status !== 'cancelled').map(app => (
                  <div key={app.id} className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-green-500 relative">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-gray-900 text-lg">{app.clientName}</h4>
                        <p className="text-sm text-blue-600 font-medium">{app.serviceName}</p>
                        <p className="text-xs text-gray-400 flex items-center gap-1 mt-1"><Phone size={12}/> {app.phone}</p>
                      </div>
                      <div className="text-right">
                        <span className="block text-2xl font-bold">{app.time}</span>
                        <span className="text-xs bg-gray-100 px-2 py-1 rounded font-bold">{app.date}</span>
                      </div>
                    </div>
                    <button onClick={() => setApptToCancel(app)} className="mt-4 w-full border border-red-100 text-red-500 text-xs font-bold py-2.5 rounded-lg hover:bg-red-50 flex items-center justify-center gap-2">
                      <X size={14}/> Cancelar y Avisar
                    </button>
                  </div>
                ))
              }
            </div>
          )}

          {/* TAB: WEB CMS (ADMIN) */}
          {currentUser.role === 'admin' && adminTab === 'website' && (
            <div className="space-y-6">
              
              {/* 1. TEXTOS PORTADA */}
              <section className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Edit3 size={18}/> Portada y Textos</h3>
                <div className="space-y-3">
                  <input type="text" className="w-full p-2 border rounded" value={cmsData.heroTitle} onChange={(e) => handleUpdateCms('heroTitle', e.target.value)} />
                  <textarea className="w-full p-2 border rounded h-16" value={cmsData.heroSubtitle} onChange={(e) => handleUpdateCms('heroSubtitle', e.target.value)} />
                </div>
              </section>

              {/* 2. SOBRE NOSOTROS Y FOTOS LOCAL */}
              <section className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Layout size={18}/> Sobre Nosotros y Local</h3>
                <div className="space-y-3 mb-4">
                  <input type="text" className="w-full p-2 border rounded font-bold" placeholder="Título (Ej: Más que una barbería)" value={cmsData.aboutTitle} onChange={(e) => handleUpdateCms('aboutTitle', e.target.value)} />
                  <textarea className="w-full p-2 border rounded h-20" placeholder="Descripción del local..." value={cmsData.aboutText} onChange={(e) => handleUpdateCms('aboutText', e.target.value)} />
                </div>
                
                <div className="bg-gray-50 p-3 rounded-lg border mb-3">
                   <p className="text-xs font-bold text-gray-400 mb-2 uppercase">Agregar Foto del Local</p>
                   <div className="flex gap-2">
                     <input type="text" className="flex-1 p-2 border rounded text-sm" placeholder="URL Foto" value={newShopPhoto} onChange={e => setNewShopPhoto(e.target.value)} />
                     <button onClick={handleAddShopPhoto} className="bg-blue-600 text-white px-4 rounded font-bold text-sm">+</button>
                   </div>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {cmsData.shopPhotos && cmsData.shopPhotos.map(p => (
                    <div key={p.id} className="relative group h-16"><img src={p.url} className="w-full h-full object-cover rounded"/><button onClick={() => handleDeleteShopPhoto(p.id)} className="absolute top-0 right-0 bg-red-500 text-white p-1 rounded-bl"><X size={10}/></button></div>
                  ))}
                </div>
              </section>

              {/* 3. TESTIMONIOS */}
              <section className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Star size={18}/> Testimonios Clientes</h3>
                <div className="bg-gray-50 p-3 rounded-lg border mb-4">
                   <div className="grid grid-cols-3 gap-2 mb-2">
                     <input type="text" className="col-span-1 p-2 border rounded text-sm" placeholder="Nombre Cliente" value={newTestimonial.name} onChange={e => setNewTestimonial({...newTestimonial, name: e.target.value})} />
                     <input type="text" className="col-span-2 p-2 border rounded text-sm" placeholder="Comentario..." value={newTestimonial.text} onChange={e => setNewTestimonial({...newTestimonial, text: e.target.value})} />
                   </div>
                   <button onClick={handleAddTestimonial} className="w-full bg-black text-white py-2 rounded text-sm font-bold">Agregar Testimonio</button>
                </div>
                <div className="space-y-2">
                  {cmsData.testimonials && cmsData.testimonials.map(t => (
                    <div key={t.id} className="flex justify-between items-center text-sm border-b py-2">
                      <div className="truncate pr-2"><span className="font-bold">{t.name}:</span> "{t.text}"</div>
                      <button onClick={() => handleDeleteTestimonial(t.id)} className="text-red-400"><Trash2 size={16}/></button>
                    </div>
                  ))}
                </div>
              </section>

              {/* 4. UBICACIÓN */}
              <section className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><MapPin size={18}/> Ubicación</h3>
                <div className="space-y-3">
                  <input type="text" className="w-full p-2 border rounded" placeholder="Dirección Texto" value={cmsData.address} onChange={(e) => handleUpdateCms('address', e.target.value)} />
                  <input type="text" className="w-full p-2 border rounded text-xs text-gray-500" placeholder="URL Google Maps Embed" value={cmsData.mapUrl} onChange={(e) => handleUpdateCms('mapUrl', e.target.value)} />
                </div>
              </section>

              {/* 5. INSTAGRAM */}
              <section className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Instagram size={18}/> Galería (Fotos & Reels)</h3>
                <div className="bg-gray-50 p-3 rounded-lg border mb-4">
                   <div className="flex gap-2 mb-2">
                     <button onClick={() => setNewGalleryItem({...newGalleryItem, type: 'image'})} className={`flex-1 text-xs py-1 rounded font-bold ${newGalleryItem.type === 'image' ? 'bg-black text-white' : 'bg-gray-200'}`}>FOTO</button>
                     <button onClick={() => setNewGalleryItem({...newGalleryItem, type: 'reel'})} className={`flex-1 text-xs py-1 rounded font-bold ${newGalleryItem.type === 'reel' ? 'bg-pink-600 text-white' : 'bg-gray-200'}`}>REEL</button>
                   </div>
                   <input type="text" className="w-full p-2 border rounded text-sm mb-2" placeholder="URL (Imagen o Reel Link)" value={newGalleryItem.url} onChange={e => setNewGalleryItem({...newGalleryItem, url: e.target.value})} />
                   <button onClick={handleAddGalleryItem} className="bg-black text-white px-4 py-2 rounded font-bold w-full text-xs">AGREGAR</button>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {cmsData.gallery && cmsData.gallery.map(item => (
                    <div key={item.id} className="relative group h-16 bg-gray-100 rounded overflow-hidden">
                      {item.type === 'reel' ? <div className="flex items-center justify-center h-full"><Video size={16}/></div> : <img src={item.url} className="w-full h-full object-cover"/>}
                      <button onClick={() => handleDeleteGalleryItem(item.id)} className="absolute top-0 right-0 bg-red-500 text-white p-1"><X size={10}/></button>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          {/* TAB: EQUIPO (ADMIN) */}
          {currentUser.role === 'admin' && adminTab === 'team' && (
            <section className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><User size={20} className="text-blue-600"/> Gestión de Equipo</h3>
              <form onSubmit={handleAddBarber} className="space-y-3 mb-6 bg-gray-50 p-4 rounded-xl border border-gray-200">
                <input type="text" placeholder="Nombre" className="w-full p-2 border rounded" value={newBarber.name} onChange={e => setNewBarber({...newBarber, name: e.target.value})} />
                <input type="tel" placeholder="Teléfono" className="w-full p-2 border rounded" value={newBarber.phone} onChange={e => setNewBarber({...newBarber, phone: e.target.value})} />
                <div className="grid grid-cols-2 gap-2">
                  <input type="text" placeholder="User" className="p-2 border rounded" value={newBarber.username} onChange={e => setNewBarber({...newBarber, username: e.target.value})} />
                  <input type="text" placeholder="Pass" className="p-2 border rounded" value={newBarber.password} onChange={e => setNewBarber({...newBarber, password: e.target.value})} />
                </div>
                <button className="w-full bg-black text-white font-bold py-2 rounded-lg">Crear Barbero</button>
              </form>
              <div className="space-y-2">
                 {users.filter(u => u.role === 'barber').map(b => (
                   <div key={b.id} className="flex justify-between items-center text-sm border-b py-2">
                     <span>{b.name}</span>
                     <button onClick={() => handleDeleteBarber(b.id)} className="text-red-400 hover:bg-red-50 p-2 rounded"><Trash2 size={16}/></button>
                   </div>
                 ))}
              </div>
            </section>
          )}

          {/* TAB: MIS SERVICIOS (BARBERO) */}
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
      </div>
    );
  }

  // --- BOOKING ---
  if (view === 'booking') {
    const activeBarbers = users.filter(u => u.role === 'barber');
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
                <button key={barber.id} onClick={() => { setReservation({...reservation, barber}); setBookingStep(2); }} className="w-full bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4 text-left">
                  <img src={barber.photo} className="w-16 h-16 rounded-full bg-gray-200 object-cover" />
                  <div><p className="font-bold text-lg text-gray-900">{barber.name}</p><p className="text-sm text-gray-500">{barber.services ? barber.services.length : 0} Servicios</p></div>
                </button>
              ))}
            </div>
          )}
          {bookingStep === 2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-2"><img src={reservation.barber.photo} className="w-8 h-8 rounded-full" /><h3 className="text-xl font-bold text-gray-800">Servicios</h3></div>
              {reservation.barber.services && reservation.barber.services.map(s => (
                <button key={s.id} onClick={() => { setReservation({...reservation, service: s}); setBookingStep(3); }} className="w-full bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center">
                  <span className="font-medium text-gray-800">{s.name}</span><span className="font-bold text-green-600">${s.price}</span>
                </button>
              ))}
            </div>
          )}
          {bookingStep === 3 && (
            <div className="space-y-6">
              <h3 className="text-xl font-bold text-gray-800">Elige Fecha</h3>
              <input type="date" className="w-full p-4 border rounded-xl bg-white text-lg font-bold" min={new Date().toISOString().split('T')[0]} onChange={e => setReservation({...reservation, date: e.target.value, time: ''})} />
              {reservation.date && (
                <div className="grid grid-cols-3 gap-3">
                  {getAvailableSlots(reservation.barber.id, reservation.date).map((slot, idx) => (
                    <button key={idx} disabled={!slot.available} onClick={() => setReservation({...reservation, time: slot.time})} className={`py-3 rounded-xl text-sm font-bold border-2 ${reservation.time === slot.time ? 'bg-black text-white border-black' : !slot.available ? 'bg-gray-100 text-gray-300' : 'bg-white'}`}>{slot.time}</button>
                  ))}
                </div>
              )}
              <button disabled={!reservation.time} onClick={() => setBookingStep(4)} className="w-full bg-black text-white py-4 rounded-xl font-bold text-lg disabled:opacity-50">Continuar</button>
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
              <div className="space-y-3">
                <input type="text" placeholder="Tu Nombre" className="w-full p-4 border rounded-xl" onChange={e => setReservation({...reservation, client: e.target.value})} />
                <input type="tel" placeholder="Celular" className="w-full p-4 border rounded-xl" onChange={e => setReservation({...reservation, phone: e.target.value})} />
              </div>
              <button disabled={!reservation.client || !reservation.phone} onClick={confirmReservation} className="w-full bg-green-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2">
                <CreditCard size={20} /> PAGAR Y CONFIRMAR
              </button>
            </div>
          )}
        </main>
      </div>
    );
  }
}