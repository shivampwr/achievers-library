import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  LayoutDashboard, Users, BookOpen, Armchair, Wallet, FileBarChart,
  Settings, LogOut, Plus, Search, Pencil, Trash2, X, CheckCircle2,
  Clock3, IndianRupee, ArrowLeft, Download
} from 'lucide-react';
import './admin.css';

const KEY = 'achievers_library_members_v1';
const SEAT_KEY = 'achievers_library_seats_v1';
const BOOK_KEY = 'achievers_library_books_v1';
const ISSUE_KEY = 'achievers_library_book_issues_v1';

const read = (k, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(k)) ?? fallback;
  } catch {
    return fallback;
  }
};

const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));

// Automatically generate unused IDs between 1 and 1000
const nextId = (records) => {
  const used = new Set(records.map(r => Number(r.id)));

  for (let id = 1; id <= 1000; id++) {
    if (!used.has(id)) return id;
  }

  return null;
};

const plans = [
  { name: 'Welcome Offer', months: 1, fee: 500 },
  { name: 'Monthly', months: 1, fee: 600 },
  { name: '3 Months', months: 3, fee: 1700 },
  { name: '6 Months', months: 6, fee: 3000 }
];

const blank = {
  name: '',
  phone: '',
  age: '',
  gender: '',
  joinDate: new Date().toISOString().slice(0, 10),
  seat: '',
  plan: 'Monthly',
  fee: 600,
  paid: 0,
  paymentStatus: 'Pending'
};

function expiryDate(join, months) {
  const d = new Date(join + 'T12:00:00');
  d.setMonth(d.getMonth() + Number(months));
  return d.toISOString().slice(0, 10);
}

function Admin() {
  const [logged, setLogged] = useState(
    sessionStorage.getItem('achievers_admin') === 'yes'
  );

  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [loginErr, setLoginErr] = useState('');

  const [members, setMembers] = useState(() => read(KEY, []));
  const [seats, setSeats] = useState(() => read(SEAT_KEY, {}));
  const [books, setBooks] = useState(() => read(BOOK_KEY, []));
  const [issues, setIssues] = useState(() => read(ISSUE_KEY, []));

  const [tab, setTab] = useState('Dashboard');
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blank);
  const [notice, setNotice] = useState('');

  const updateMembers = v => {
    setMembers(v);
    save(KEY, v);
  };

  const updateSeats = v => {
    setSeats(v);
    save(SEAT_KEY, v);
  };

  const updateBooks = v => {
    setBooks(v);
    save(BOOK_KEY, v);
  };

  const updateIssues = v => {
    setIssues(v);
    save(ISSUE_KEY, v);
  };

  const active = members.filter(
    m => m.status !== 'Inactive' &&
    m.expiry >= new Date().toISOString().slice(0, 10)
  );

  const collected = members.reduce(
    (s, m) => s + Number(m.paid || 0), 0
  );

  const pending = members.reduce(
    (s, m) => s + Math.max(0, Number(m.fee || 0) - Number(m.paid || 0)), 0
  );

  const filtered = useMemo(
    () => members.filter(m =>
      `${m.name} ${m.phone} ${m.seat} ${m.id}`
        .toLowerCase().includes(search.toLowerCase())
    ),
    [members, search]
  );

  const openAdd = () => {
    setEditing(null);
    setForm(blank);
    setModal(true);
  };

  const openEdit = m => {
    setEditing(m.id);
    setForm({ ...m });
    setModal(true);
  };

  // ADD / UPDATE MEMBER
  const submit = e => {
    e.preventDefault();

    if (!/^\d{10}$/.test(form.phone)) {
      setNotice('Enter a valid 10-digit mobile number.');
      return;
    }

    if (!form.seat || Number(form.seat) < 1 || Number(form.seat) > 34) {
      setNotice('Choose a seat between 1 and 34.');
      return;
    }

    const conflict = members.find(m =>
      m.id !== editing &&
      String(m.seat) === String(form.seat) &&
      m.status !== 'Inactive' &&
      m.expiry >= new Date().toISOString().slice(0, 10)
    );

    if (conflict) {
      setNotice('This seat is already assigned.');
      return;
    }

    const p = plans.find(p => p.name === form.plan) || plans[1];

    const generatedId = editing || nextId(members);

    if (generatedId === null) {
      setNotice('Member ID limit reached. Maximum ID is 1000.');
      return;
    }

    const row = {
      ...form,
      id: generatedId,
      fee: Number(form.fee || p.fee),
      paid: Number(form.paid || 0),
      months: p.months,
      expiry: expiryDate(form.joinDate, p.months),
      status: 'Active'
    };

    const next = editing
      ? members.map(m => m.id === editing ? row : m)
      : [row, ...members];

    updateMembers(next);
    setModal(false);

    setNotice(
      editing
        ? 'Member updated successfully.'
        : `Member added successfully. Member ID: ${generatedId}`
    );
  };

  const remove = id => {
    if (confirm('Delete this member record?')) {
      updateMembers(members.filter(m => m.id !== id));
      setNotice('Member deleted.');
    }
  };

  // COLLECT FEES
  const collect = m => {
    const amount = prompt(
      `Enter fee received from ${m.name}. Pending: ₹${Math.max(0, m.fee - m.paid)}`
    );

    if (amount === null) return;

    const n = Number(amount);

    if (!Number.isFinite(n) || n <= 0) {
      setNotice('Enter a valid amount.');
      return;
    }

    updateMembers(members.map(x =>
      x.id === m.id
        ? {
            ...x,
            paid: Number(x.paid || 0) + n,
            paymentStatus:
              Number(x.paid || 0) + n >= Number(x.fee)
                ? 'Paid'
                : 'Partial'
          }
        : x
    ));

    setNotice('Payment recorded.');
  };

  // ADD BOOK: BOOK ID 1 TO 1000
  const addBook = () => {
    const id = nextId(books);

    if (id === null) {
      setNotice('Book ID limit reached. Maximum ID is 1000.');
      return;
    }

    const title = prompt('Book title:');
    if (!title?.trim()) return;

    const author = prompt('Author name:') || 'Unknown';
    const category = prompt('Category:') || 'General';
    const copies = Number(prompt('Total copies:', '1'));

    if (!Number.isInteger(copies) || copies < 1) {
      setNotice('Enter a valid number of copies.');
      return;
    }

    updateBooks([
      {
        id,
        title: title.trim(),
        author,
        category,
        total: copies,
        available: copies
      },
      ...books
    ]);

    setNotice(`Book added successfully. Book ID: ${id}`);
  };

  // ISSUE BOOK USING BOOK ID AND MEMBER ID
  const issueBook = () => {
    if (!active.length) {
      setNotice('Add an active member before issuing a book.');
      return;
    }

    const availableBooks = books.filter(b => b.available > 0);

    if (!availableBooks.length) {
      setNotice('No books are currently available.');
      return;
    }

    const bookId = prompt(
      'Available Books:\n' +
      availableBooks.map(b =>
        `${b.id}: ${b.title} (${b.available} available)`
      ).join('\n') +
      '\n\nEnter Book ID:'
    );

    if (bookId === null) return;

    const book = books.find(b => String(b.id) === bookId.trim());

    if (!book || book.available < 1) {
      setNotice('Invalid Book ID or no copies available.');
      return;
    }

    const memberId = prompt(
      'Active Members:\n' +
      active.map(m => `${m.id}: ${m.name}`).join('\n') +
      '\n\nEnter Member ID:'
    );

    if (memberId === null) return;

    const member = active.find(
      m => String(m.id) === memberId.trim()
    );

    if (!member) {
      setNotice('Invalid active Member ID.');
      return;
    }

    const today = new Date().toISOString().slice(0, 10);

    const due = prompt(
      'Due date (YYYY-MM-DD):',
      new Date(Date.now() + 14 * 86400000)
        .toISOString().slice(0, 10)
    );

    if (!due) return;

    updateBooks(books.map(b =>
      b.id === book.id
        ? { ...b, available: b.available - 1 }
        : b
    ));

    updateIssues([
      {
        id: Date.now(),
        bookId: book.id,
        bookTitle: book.title,
        memberId: member.id,
        memberName: member.name,
        issueDate: today,
        dueDate: due,
        returnDate: '',
        status: 'Issued'
      },
      ...issues
    ]);

    setNotice(`Book issued to ${member.name}.`);
  };

  // RETURN BOOK
  const returnBook = id => {
    const issue = issues.find(x => x.id === id);

    if (!issue || issue.status === 'Returned') return;

    updateIssues(issues.map(x =>
      x.id === id
        ? {
            ...x,
            status: 'Returned',
            returnDate: new Date().toISOString().slice(0, 10)
          }
        : x
    ));

    updateBooks(books.map(b =>
      b.id === issue.bookId
        ? {
            ...b,
            available: Math.min(b.total, b.available + 1)
          }
        : b
    ));

    setNotice('Book returned successfully.');
  };

  const exportCsv = () => {
    const rows = [
      ['Member ID', 'Name', 'Mobile', 'Seat', 'Join Date', 'Plan', 'Fee', 'Paid', 'Pending', 'Expiry'],
      ...members.map(m => [
        m.id, m.name, m.phone, m.seat, m.joinDate,
        m.plan, m.fee, m.paid,
        Math.max(0, m.fee - m.paid), m.expiry
      ])
    ];

    const csv = rows.map(r =>
      r.map(v => '"' + String(v ?? '').replaceAll('"', '""') + '"').join(',')
    ).join('\n');

    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'achievers-library-members.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // LOGIN
  if (!logged) {
    return (
      <div className="admin-login-wrap">
        <form className="admin-login" onSubmit={e => {
          e.preventDefault();

          if (user === 'admin' && pass === 'Achievers@123') {
            sessionStorage.setItem('achievers_admin', 'yes');
            setLogged(true);
            setLoginErr('');
          } else {
            setLoginErr('Incorrect username or password');
          }
        }}>
          <div className="admin-logo">AL</div>
          <span className="admin-eyebrow">ACHIEVERS LIBRARY · UMRANALA</span>
          <h1>Admin Login</h1>
          <p>Sign in to manage members, books, seats and fees.</p>

          <label>
            Username
            <input value={user} onChange={e => setUser(e.target.value)} required />
          </label>

          <label>
            Password
            <input type="password" value={pass} onChange={e => setPass(e.target.value)} required />
          </label>

          {loginErr && <div className="admin-error">{loginErr}</div>}

          <button className="admin-primary">Sign in to dashboard</button>
          <a href="/" className="back-site">
            <ArrowLeft size={16}/> Back to website
          </a>
          <small>Demo login: admin / Achievers@123</small>
        </form>
      </div>
    );
  }

  const nav = [
    ['Dashboard', LayoutDashboard],
    ['Members', Users],
    ['Books', BookOpen],
    ['Seat Management', Armchair],
    ['Fee Management', Wallet],
    ['Reports', FileBarChart],
    ['Settings', Settings]
  ];

  return (
    <div className="admin-app">
      <aside className="admin-sidebar">
        <a className="admin-brand" href="/">
          <span>AL</span>
          <b>ACHIEVERS<small>LIBRARY ADMIN</small></b>
        </a>

        <div className="admin-side-label">WORKSPACE</div>

        {nav.map(([n, I]) => (
          <button
            key={n}
            className={tab === n ? 'active' : ''}
            onClick={() => setTab(n)}
          >
            <I size={18}/>{n}
          </button>
        ))}

        <div className="sidebar-bottom">
          <a href="/">← View website</a>
          <button onClick={() => {
            sessionStorage.removeItem('achievers_admin');
            setLogged(false);
          }}>
            <LogOut size={17}/> Logout
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-top">
          <div>
            <span className="admin-eyebrow">ACHIEVERS LIBRARY / ADMIN</span>
            <h1>{tab}</h1>
          </div>
          <div className="admin-user">
            <span>KS</span>
            <div><b>Kunal Sahu</b><small>Library Administrator</small></div>
          </div>
        </header>

        {notice && (
          <div className="admin-notice">
            <CheckCircle2 size={17}/>{notice}
            <button onClick={() => setNotice('')}><X size={16}/></button>
          </div>
        )}

        {tab === 'Dashboard' && (
          <>
            <div className="admin-welcome">
              <div>
                <h2>Welcome back, Admin 👋</h2>
                <p>Here is what's happening at your library today.</p>
              </div>
              <button className="admin-primary" onClick={openAdd}>
                <Plus size={17}/> Add new member
              </button>
            </div>

            <div className="admin-stats">
              <article><span><Users/></span><small>Total Members</small><strong>{members.length}</strong></article>
              <article><span><CheckCircle2/></span><small>Active Members</small><strong>{active.length}</strong></article>
              <article><span><IndianRupee/></span><small>Fees Collected</small><strong>₹{collected.toLocaleString('en-IN')}</strong></article>
              <article><span><Clock3/></span><small>Pending Fees</small><strong>₹{pending.toLocaleString('en-IN')}</strong></article>
              <article><span><BookOpen/></span><small>Total Book Titles</small><strong>{books.length}</strong></article>
              <article><span><BookOpen/></span><small>Books Issued</small><strong>{issues.filter(i => i.status === 'Issued').length}</strong></article>
            </div>

            <div className="admin-panels">
              <section className="admin-card">
                <div className="admin-card-head">
                  <div><h3>Recent Members</h3><p>Latest admissions</p></div>
                  <button onClick={() => setTab('Members')}>View all →</button>
                </div>
                <MemberTable rows={members.slice(0, 5)} edit={openEdit} collect={collect} remove={remove}/>
              </section>

              <section className="admin-card seat-summary">
                <h3>Seat overview</h3>
                <p>34 total seats · Full-day membership</p>
                <div className="seat-summary-num">
                  <b>{active.length}</b><span>/ 34 assigned</span>
                </div>
                <div className="admin-seat-mini">
                  {Array.from({ length: 34 }, (_, i) => {
                    const m = active.find(x => Number(x.seat) === i + 1);
                    return <span key={i} className={m ? 'taken' : ''}>{i + 1}</span>;
                  })}
                </div>
              </section>
            </div>
          </>
        )}

        {tab === 'Members' && (
          <section className="admin-card full-card">
            <div className="admin-card-head">
              <div><h3>All Members</h3><p>Manage student admission and membership details.</p></div>
              <button className="admin-primary" onClick={openAdd}><Plus size={17}/> Add Member</button>
            </div>

            <div className="admin-toolbar">
              <div className="admin-search">
                <Search size={17}/>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search ID, name, mobile or seat"/>
              </div>
              <span>{filtered.length} records</span>
            </div>

            <MemberTable rows={filtered} edit={openEdit} collect={collect} remove={remove}/>
          </section>
        )}

        {tab === 'Books' && (
          <>
            <section className="admin-card full-card">
              <div className="admin-card-head">
                <div>
                  <h3>Books Inventory</h3>
                  <p>
                    {books.length} titles ·
                    {books.reduce((n, b) => n + Number(b.total), 0)} total copies ·
                    {books.reduce((n, b) => n + Number(b.available), 0)} available
                  </p>
                </div>

                <div>
                  <button className="admin-secondary" onClick={issueBook}>Issue Book</button>
                  {' '}
                  <button className="admin-primary" onClick={addBook}>
                    <Plus size={17}/> Add Book
                  </button>
                </div>
              </div>

              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Book ID</th><th>Book</th><th>Author</th>
                      <th>Category</th><th>Total Copies</th><th>Available</th>
                    </tr>
                  </thead>

                  <tbody>
                    {books.length === 0 ? (
                      <tr><td colSpan="6" className="empty-row">No books added yet.</td></tr>
                    ) : books.map(b => (
                      <tr key={b.id}>
                        <td><span className="seat-pill">#{b.id}</span></td>
                        <td><b>{b.title}</b></td>
                        <td>{b.author}</td>
                        <td>{b.category}</td>
                        <td>{b.total}</td>
                        <td>{b.available}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="admin-card full-card">
              <h3>Issue History</h3>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Book ID</th><th>Book</th><th>Member ID</th>
                      <th>Member</th><th>Issue Date</th><th>Due Date</th>
                      <th>Status</th><th>Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {issues.length === 0 ? (
                      <tr><td colSpan="8" className="empty-row">No books issued yet.</td></tr>
                    ) : issues.map(i => (
                      <tr key={i.id}>
                        <td>#{i.bookId}</td>
                        <td>{i.bookTitle}</td>
                        <td>#{i.memberId}</td>
                        <td>{i.memberName}</td>
                        <td>{i.issueDate}</td>
                        <td>{i.dueDate}</td>
                        <td>{i.status}</td>
                        <td>
                          {i.status === 'Issued'
                            ? <button className="admin-primary" onClick={() => returnBook(i.id)}>Return Book</button>
                            : i.returnDate}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {tab === 'Seat Management' && (
          <section className="admin-card full-card">
            <h3>Seat Management</h3>
            <p className="muted">34 seats · Active memberships reserve their assigned seat.</p>
            <div className="admin-seat-grid">
              {Array.from({ length: 34 }, (_, i) => {
                const m = active.find(x => Number(x.seat) === i + 1);
                return (
                  <div className={m ? 'assigned' : ''} key={i}>
                    <b>{String(i + 1).padStart(2, '0')}</b>
                    <small>{m ? m.name : 'Available'}</small>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {tab === 'Fee Management' && (
          <section className="admin-card full-card">
            <h3>Fee Management</h3>
            <div className="admin-stats compact">
              <article><small>Total collected</small><strong>₹{collected.toLocaleString('en-IN')}</strong></article>
              <article><small>Total pending</small><strong>₹{pending.toLocaleString('en-IN')}</strong></article>
            </div>
            <MemberTable rows={members} edit={openEdit} collect={collect} remove={remove}/>
          </section>
        )}

        {tab === 'Reports' && (
          <section className="admin-card full-card">
            <div className="admin-card-head">
              <div><h3>Library Reports</h3><p>Download member and fee summary as CSV.</p></div>
              <button className="admin-primary" onClick={exportCsv}><Download size={17}/> Export CSV</button>
            </div>

            <div className="report-grid">
              <div><small>Total admissions</small><b>{members.length}</b></div>
              <div><small>Active members</small><b>{active.length}</b></div>
              <div><small>Fees received</small><b>₹{collected.toLocaleString('en-IN')}</b></div>
              <div><small>Fees pending</small><b>₹{pending.toLocaleString('en-IN')}</b></div>
            </div>
          </section>
        )}

        {tab === 'Settings' && (
          <section className="admin-card full-card">
            <h3>Settings</h3>
            <div className="settings-list">
              <div><b>Library name</b><span>Achievers Library</span></div>
              <div><b>Address</b><span>Umranala, Chhindwara, Madhya Pradesh</span></div>
              <div><b>Contact</b><span>6267233797</span></div>
              <div><b>Total seats</b><span>34</span></div>
              <div><b>Membership plans</b><span>₹500 welcome · ₹600 monthly · ₹1,700 / 3 months · ₹3,000 / 6 months</span></div>
            </div>
            <p className="admin-warning">
              Records are currently saved in this browser only.
            </p>
          </section>
        )}
      </main>

      {modal && (
        <div className="admin-modal-bg">
          <form className="admin-modal" onSubmit={submit}>
            <button type="button" className="admin-modal-close" onClick={() => setModal(false)}><X/></button>
            <span className="admin-eyebrow">MEMBER MANAGEMENT</span>
            <h2>{editing ? 'Edit member' : 'Add new member'}</h2>

            {!editing && <p>New Member ID: <b>{nextId(members) ?? 'Limit reached'}</b></p>}

            <div className="admin-form-grid">
              <label>Full name *
                <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}/>
              </label>

              <label>Mobile number *
                <input required maxLength="10" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value.replace(/\D/g, '') })}/>
              </label>

              <label>Age
                <input type="number" min="1" max="100" value={form.age} onChange={e => setForm({ ...form, age: e.target.value })}/>
              </label>

              <label>Gender
                <select value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })}>
                  <option value="">Select</option><option>Male</option><option>Female</option><option>Other</option>
                </select>
              </label>

              <label>Joining date *
                <input type="date" required value={form.joinDate} onChange={e => setForm({ ...form, joinDate: e.target.value })}/>
              </label>

              <label>Seat number *
                <select required value={form.seat} onChange={e => setForm({ ...form, seat: e.target.value })}>
                  <option value="">Select seat</option>
                  {Array.from({ length: 34 }, (_, i) => {
                    const n = i + 1;
                    const busy = members.some(m =>
                      m.id !== editing &&
                      Number(m.seat) === n &&
                      m.status !== 'Inactive' &&
                      m.expiry >= new Date().toISOString().slice(0, 10)
                    );
                    return <option key={n} value={n} disabled={busy}>Seat {n}{busy ? ' (Assigned)' : ''}</option>;
                  })}
                </select>
              </label>

              <label>Membership plan
                <select value={form.plan} onChange={e => {
                  const p = plans.find(p => p.name === e.target.value);
                  setForm({ ...form, plan: e.target.value, fee: p.fee });
                }}>
                  {plans.map(p => <option key={p.name}>{p.name}</option>)}
                </select>
              </label>

              <label>Total fee (₹)
                <input type="number" min="0" required value={form.fee} onChange={e => setForm({ ...form, fee: e.target.value })}/>
              </label>

              <label>Amount paid (₹)
                <input type="number" min="0" value={form.paid} onChange={e => setForm({ ...form, paid: e.target.value })}/>
              </label>
            </div>

            <div className="admin-modal-actions">
              <button type="button" className="admin-secondary" onClick={() => setModal(false)}>Cancel</button>
              <button className="admin-primary">{editing ? 'Save changes' : 'Add member'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function MemberTable({ rows, edit, collect, remove }) {
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Member ID</th><th>Member</th><th>Mobile</th>
            <th>Seat</th><th>Plan / Expiry</th><th>Fee status</th><th>Actions</th>
          </tr>
        </thead>

        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan="7" className="empty-row">No members found. Add your first member.</td></tr>
          ) : rows.map(m => (
            <tr key={m.id}>
              <td><span className="seat-pill">#{m.id}</span></td>
              <td><b>{m.name}</b><small>{m.gender || 'Student'} {m.age ? `· ${m.age} yrs` : ''}</small></td>
              <td>{m.phone}</td>
              <td><span className="seat-pill">{m.seat}</span></td>
              <td>{m.plan}<small>Expires {m.expiry}</small></td>
              <td>
                <span className={`status-pill ${Number(m.paid) >= Number(m.fee) ? 'paid' : 'pending'}`}>
                  {Number(m.paid) >= Number(m.fee) ? 'Paid' : `₹${Math.max(0, m.fee - m.paid)} due`}
                </span>
              </td>
              <td>
                <div className="row-actions">
                  <button title="Collect fee" onClick={() => collect(m)}><IndianRupee size={15}/></button>
                  <button title="Edit" onClick={() => edit(m)}><Pencil size={15}/></button>
                  <button title="Delete" onClick={() => remove(m.id)}><Trash2 size={15}/></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Admin;