import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BookOpen, CalendarDays, Check, ChevronRight, Clock3, GraduationCap, LayoutDashboard, LibraryBig, Menu, Search, ShieldCheck, Sparkles, Users, X, Armchair, MapPin, ArrowUpRight, BookMarked, Bell, Settings, LogOut } from 'lucide-react';
import './styles.css';
import Admin from './Admin.jsx';
import { supabase } from './supabase';


const books = [
  { title: 'Atomic Habits', author: 'James Clear', category: 'Self Growth', tag: 'Popular' },
  { title: 'The Psychology of Money', author: 'Morgan Housel', category: 'Finance', tag: 'Popular' },
  { title: 'Deep Work', author: 'Cal Newport', category: 'Productivity', tag: 'Recommended' },
  { title: 'Wings of Fire', author: 'A. P. J. Abdul Kalam', category: 'Biography', tag: 'Classic' },
  { title: 'Ikigai', author: 'Héctor García & Francesc Miralles', category: 'Self Growth', tag: 'Popular' },
  { title: 'Rich Dad Poor Dad', author: 'Robert T. Kiyosaki', category: 'Finance', tag: 'Classic' },
];
function App() {
  const [mobileMenu, setMobileMenu] = useState(false);
  const [query, setQuery] = useState('');
  const [books, setBooks] = useState([]);
  const [booksLoading, setBooksLoading] = useState(true);
  const [booksError, setBooksError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const loadBooks = async () => {
      setBooksLoading(true);
      setBooksError('');
      const { data, error } = await supabase
        .from('books')
        .select('id, title, author, category, total_copies, available_copies, cover_url, description, is_active')
        .eq('is_active', true)
        .order('title', { ascending: true });

      if (cancelled) return;
      if (error) {
        setBooksError('We could not load the live book inventory right now.');
        setBooks([]);
      } else {
        setBooks(data || []);
      }
      setBooksLoading(false);
    };

    loadBooks();
    return () => { cancelled = true; };
  }, []);

  const filteredBooks = useMemo(() => books.filter(book =>
    `${book.title || ''} ${book.author || ''} ${book.category || ''}`
      .toLowerCase().includes(query.trim().toLowerCase())
  ), [books, query]);

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMobileMenu(false);
  };
  return <div className="app-shell">
    <header className="topbar"><a className="brand" href="#home"><span className="brand-mark"><LibraryBig size={22}/></span><span>achievers<span className="brand-light">library</span><small>LEARN · FOCUS · ACHIEVE</small></span></a>
      <button className="mobile-toggle" onClick={() => setMobileMenu(!mobileMenu)} aria-label="Toggle menu">{mobileMenu ? <X/> : <Menu/>}</button>
      <div className="header-contact"><a href="tel:6267233797">6267233797</a><a href="https://wa.me/916267233797" target="_blank" rel="noreferrer">Call / WhatsApp</a></div><nav className={mobileMenu ? 'nav-links open' : 'nav-links'}><button onClick={() => scrollTo('home')}>Home</button><button onClick={() => scrollTo('facilities')}>Facilities</button><button onClick={() => scrollTo('membership')}>Membership</button><button onClick={() => scrollTo('books')}>Books</button><button onClick={() => scrollTo('gallery')}>Gallery</button><button className="nav-cta" onClick={() => scrollTo('membership')}>View membership <ArrowUpRight size={16}/></button></nav>
    </header>
    <main>
      <section className="hero section-wrap" id="home"><div className="hero-copy"><div className="eyebrow"><span className="pulse-dot"/> YOUR SPACE. YOUR GOALS. YOUR FUTURE.</div><h1>A quiet place<br/>for <span>big ambitions.</span></h1><p className="hero-desc">Make every hour count. Find your focus, build your future, and take one step closer to your goals at Achievers Library.</p><div className="hero-actions"><button className="btn-primary" onClick={() => scrollTo('membership')}>Explore membership <ChevronRight size={18}/></button><button className="btn-text" onClick={() => scrollTo('facilities')}>Discover our library <ArrowUpRight size={17}/></button></div><div className="hero-proof"><div className="avatar-stack"><i> S </i><i> A </i><i> R </i><i> + </i></div><div><strong>A space built for achievers</strong><small>Study better. Stay consistent.</small></div></div></div>
        <div className="hero-visual"><div className="visual-glow"/><div className="photo-card"><div className="photo-overlay"><span className="photo-label"><Sparkles size={14}/> YOUR STUDY SPACE</span><div><strong>Focus starts here.</strong><small>Welcome to Achievers Library</small></div></div><img className="hero-library-photo" src="/images/study-hall-1.png" alt="Study hall at Achievers Library, Umranala"/></div><div className="hero-stamp"><span>MAKE</span><b>IT</b><span>HAPPEN</span></div></div>
      </section>
      <section className="quick-stats section-wrap"><div className="stat"><span className="stat-icon"><Clock3/></span><div><strong>Full day</strong><small>Study access</small></div></div><div className="stat"><span className="stat-icon"><BookOpen/></span><div><strong>Library</strong><small>Books & resources</small></div></div><div className="stat"><span className="stat-icon"><MapPin/></span><div><strong>Umranala</strong><small>Chhindwara, MP</small></div></div></section>
      <section className="section section-wrap" id="facilities"><div className="section-heading"><div><span className="eyebrow">A BETTER WAY TO STUDY</span><h2>Everything you need<br/><span>to stay focused.</span></h2></div><p>Thoughtfully planned for students who value their time, comfort and goals.</p></div><div className="facility-grid"><article className="facility-card"><div className="facility-icon"><BookOpen/></div><span className="card-kicker">02 / BOOK COLLECTION</span><h3>Knowledge is<br/>within reach.</h3><p>Explore books across learning, productivity, finance and more.</p><button onClick={() => scrollTo('books')}>Browse books <ArrowUpRight size={16}/></button><div className="book-art"><i/><i/><i/><i/></div></article><article className="facility-card"><div className="facility-icon"><ShieldCheck/></div><span className="card-kicker">03 / MEMBERSHIP</span><h3>Stay committed<br/>to your goals.</h3><p>Membership information and fee plans will be updated soon.</p><button onClick={() => document.getElementById('membership').scrollIntoView({behavior:'smooth'})}>Know more <ArrowUpRight size={16}/></button><div className="membership-art"><GraduationCap size={76}/></div></article></div></section>
      <section className="section section-wrap gallery-section" id="gallery"><div className="section-heading"><div><span className="eyebrow">A LOOK INSIDE</span><h2>Our library, <span>your space.</span></h2></div><p>Real glimpses of Achievers Library in Umranala.</p></div><div className="photo-gallery"><img src="/images/study-hall-1.png" alt="Study hall seating"/><img src="/images/inspiration-wall.png" alt="Motivational inspiration wall"/><img src="/images/study-hall-2.png" alt="Library study cabins"/><img src="/images/discussion-area.png" alt="Library discussion area"/></div></section>
      
      <section className="section section-wrap" id="books">
        <div className="section-heading books-heading">
          <div>
            <span className="eyebrow">READ. LEARN. GROW.</span>
            <h2>Explore the <span>bookshelf.</span></h2>
            <p className="books-intro">Browse the books currently listed in Achievers Library.</p>
          </div>
          <label className="book-search" aria-label="Search books or authors">
            <Search size={18}/>
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search books or authors..."/>
          </label>
        </div>

        {booksLoading ? (
          <div className="books-state" role="status">Loading current library inventory…</div>
        ) : booksError ? (
          <div className="books-state books-state-error">{booksError} Please try again later.</div>
        ) : filteredBooks.length === 0 ? (
          <div className="books-state">
            <BookOpen size={28}/>
            <strong>{books.length === 0 ? 'Books will appear here soon.' : 'No books match your search.'}</strong>
            <span>{books.length === 0 ? 'The library team is updating the catalogue. Please check back soon.' : 'Try another title, author or category.'}</span>
          </div>
        ) : (
          <div className="books-grid">
            {filteredBooks.map((book, index) => {
              const available = Number(book.available_copies || 0);
              const total = Number(book.total_copies || 0);
              return (
                <article className="book-card" key={book.id}>
                  <div className={`book-cover cover-${index % 6}`}>
                    {book.cover_url ? <img src={book.cover_url} alt={`${book.title} cover`} loading="lazy"/> : <><BookOpen size={34}/><span className="book-cover-title">{book.title}</span></>}
                  </div>
                  <div className="book-info">
                    <span>{book.category || 'General'}</span>
                    <h3>{book.title}</h3>
                    <p>{book.author || 'Author not specified'}</p>
                    <small className={available > 0 ? 'availability-pill available' : 'availability-pill unavailable'}>
                      {available > 0 ? `${available} of ${total} available` : 'Currently unavailable'}
                    </small>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
      <section className="section section-wrap pricing-section" id="membership"><div className="section-heading"><div><span className="eyebrow">SIMPLE & CLEAR FEES</span><h2>Membership <span>plans.</span></h2></div><p>Choose the duration that works best for your study routine.</p></div><div className="pricing-grid"><article className="price-card featured"><span className="price-tag">WELCOME OFFER</span><strong>₹500</strong><h3>First Month Only</h3><p>1 Month</p></article><article className="price-card"><strong>₹600</strong><h3>Regular Monthly Fee</h3><p>1 Month</p></article><article className="price-card"><strong>₹1,700</strong><h3>3 Months Package</h3><p>3 Months</p></article><article className="price-card"><strong>₹3,000</strong><h3>6 Months Package</h3><p>6 Months</p></article></div></section>
      <section className="membership-band" id="membership-info"><div className="section-wrap membership-inner"><div><span className="eyebrow">YOUR NEXT CHAPTER STARTS HERE</span><h2>Make space for<br/><span>your ambition.</span></h2><p>Visit Achievers Library, Umranala, Chhindwara, or call us to ask about membership.</p></div><div className="membership-side"><div className="membership-badge"><GraduationCap size={32}/></div><strong>Become an Achiever</strong><small>Membership details coming soon</small><a className="btn-light" href="https://wa.me/916267233797?text=Hello%2C%20I%20want%20to%20know%20about%20Achievers%20Library%20membership.">Enquire on WhatsApp <ArrowUpRight size={16}/></a></div></div></section>
      <section className="contact section-wrap" id="contact"><div><span className="eyebrow">COME SAY HELLO</span><h2>We'll save you<br/><span>a place.</span></h2></div><div className="contact-detail"><div className="contact-line"><MapPin/><div><strong>Achievers Library</strong><span>Umranala, Chhindwara, Madhya Pradesh (M.P.)</span></div></div><div className="contact-line"><Clock3/><div><strong>Study access</strong><span>Full-day facility</span></div></div><div className="contact-line"><Users/><div><strong>Call / WhatsApp</strong><a href="tel:6267233797">+91 6267233797</a></div></div><a className="contact-whatsapp" href="https://wa.me/916267233797?text=Hello%2C%20I%20want%20to%20enquire%20about%20Achievers%20Library." target="_blank" rel="noreferrer">Chat on WhatsApp <ArrowUpRight size={16}/></a></div></section>
    </main>
    <footer className="footer"><div className="section-wrap footer-inner"><a className="brand footer-brand" href="#home"><span className="brand-mark"><LibraryBig size={20}/></span><span>achievers<span className="brand-light">library</span><small>LEARN · FOCUS · ACHIEVE</small></span></a><span>Achievers Library · Umranala, Chhindwara (M.P.) · +91 6267233797</span><a href="/admin" className="footer-admin-link" style={{ color: "#c28a3e", textDecoration: "none", fontWeight: 600, fontSize: "14px" }}>Admin Login 🔐</a><button onClick={()=>scrollTo('home')}>Back to top ↑</button></div></footer>
    
  </div>;
}

createRoot(document.getElementById('root')).render(window.location.pathname.startsWith('/admin') ? <Admin/> : <App/>);
