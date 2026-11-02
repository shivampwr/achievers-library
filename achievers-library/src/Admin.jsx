import { supabase } from './supabase';
import { useState, useMemo, useEffect } from 'react';
import {
  LayoutDashboard, Users, BookOpen, Armchair, Wallet, FileBarChart,
  Settings, LogOut, Plus, Search, Pencil, Trash2, X, CheckCircle2,
  Clock3, IndianRupee, ArrowLeft, Download
} from 'lucide-react';
import './admin.css';

const KEY = 'achievers_library_members_v1';
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
  { name: '6 Months', months: 6, fee: 3000 },
  { name: '1 Year', months: 12, fee: 5500 }
];

const blank = {
  name: '',
  phone: '',
  age: '',
  gender: '',
  joinDate: new Date().toISOString().slice(0, 10),
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
  const [logged, setLogged] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [membersLoading, setMembersLoading] = useState(false);
  const [booksLoading, setBooksLoading] = useState(false);

  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [loginErr, setLoginErr] = useState('');

  const [members, setMembers] = useState(() => read(KEY, []));
  const [books, setBooks] = useState(() => read(BOOK_KEY, []));
  const [issues, setIssues] = useState(() => read(ISSUE_KEY, []));

  const [tab, setTab] = useState('Dashboard');
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blank);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let alive = true;

    const verifyAdmin = async (session) => {
      if (!session) {
        if (alive) {
          setLogged(false);
          setAuthLoading(false);
        }
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .maybeSingle();

      if (!alive) return;

      if (error || data?.role !== 'admin') {
        await supabase.auth.signOut();
        setLogged(false);
      } else {
        setLogged(true);
      }
      setAuthLoading(false);
    };

    supabase.auth.getSession().then(({ data }) => verifyAdmin(data.session));

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        verifyAdmin(session);
      }
    );

    return () => {
      alive = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Load member records from Supabase after an admin session is verified.
  useEffect(() => {
    if (!logged) return;
    let cancelled = false;

    const loadMembers = async () => {
      setMembersLoading(true);
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .order('id', { ascending: false });

      if (cancelled) return;
      if (error) {
        setNotice(`Could not load members: ${error.message}`);
      } else {
        // One-time safe migration: preserve existing browser records if DB is empty.
        let databaseRows = data || [];
        const cachedMembers = read(KEY, []);
        if (databaseRows.length === 0 && cachedMembers.length > 0) {
          const legacyRows = cachedMembers.map(m => ({
            full_name: String(m.name || '').trim(),
            phone: String(m.phone || ''),
            age: m.age ? Number(m.age) : null,
            gender: m.gender || null,
            joining_date: m.joinDate || new Date().toISOString().slice(0, 10),
            membership_plan: m.plan || 'Monthly',
            membership_end: m.expiry || null,
            status: m.status || 'Active',
            fee: Number(m.fee || 0),
            paid: Number(m.paid || 0),
            payment_status: m.paymentStatus || (Number(m.paid || 0) >= Number(m.fee || 0) ? 'Paid' : 'Pending')
          })).filter(m => m.full_name && /^\d{10}$/.test(m.phone));
          if (legacyRows.length) {
            const migrated = await supabase.from('members').insert(legacyRows).select('*');
            if (migrated.error) {
              setNotice(`Existing browser members were not migrated: ${migrated.error.message}`);
            } else {
              databaseRows = migrated.data || [];
            }
          }
        }
        const mapped = databaseRows.map(row => ({
          id: row.id,
          name: row.full_name || '',
          phone: row.phone || '',
          age: row.age ?? '',
          gender: row.gender || '',
          joinDate: row.joining_date || '',
          plan: row.membership_plan || 'Monthly',
          fee: Number(row.fee || 0),
          paid: Number(row.paid || 0),
          paymentStatus: row.payment_status || 'Pending',
          expiry: row.membership_end || '',
          status: row.status || 'Active'
        }));
        setMembers(mapped);
        save(KEY, mapped);
      }
      setMembersLoading(false);
    };

    loadMembers();
    return () => { cancelled = true; };
  }, [logged]);

  const updateMembers = v => {
    setMembers(v);
    save(KEY, v);
  };

  // Load books and issue history from Supabase. Existing browser records are
  // migrated once when the corresponding database table is empty.
  useEffect(() => {
    if (!logged) return;
    let cancelled = false;

    const loadLibrary = async () => {
      setBooksLoading(true);

      const { data: bookRows, error: bookError } = await supabase
        .from('books')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: true });

      if (cancelled) return;
      if (bookError) {
        setNotice(`Could not load books: ${bookError.message}`);
        setBooksLoading(false);
        return;
      }

      let dbBooks = bookRows || [];
      const cachedBooks = read(BOOK_KEY, []);

      if (dbBooks.length === 0 && cachedBooks.length > 0) {
        const legacyBooks = cachedBooks.map(b => ({
          title: String(b.title || '').trim(),
          author: String(b.author || 'Unknown'),
          category: String(b.category || 'General'),
          total_copies: Math.max(1, Number(b.total || 1)),
          available_copies: Math.max(0, Math.min(Number(b.available ?? b.total ?? 1), Number(b.total || 1))),
          is_active: true
        })).filter(b => b.title);

        if (legacyBooks.length) {
          const migrated = await supabase.from('books').insert(legacyBooks).select('*');
          if (migrated.error) {
            setNotice(`Books are not yet in Supabase: ${migrated.error.message}`);
          } else {
            dbBooks = migrated.data || [];
          }
        }
      }

      const mappedBooks = dbBooks.map(row => ({
        id: row.id,
        title: row.title || '',
        author: row.author || 'Unknown',
        category: row.category || 'General',
        total: Number(row.total_copies || 0),
        available: Number(row.available_copies || 0)
      }));

      setBooks(mappedBooks);
      save(BOOK_KEY, mappedBooks);

      let issueQuery = await supabase
        .from('book_issues')
        .select('*, books(title), members(full_name)')
        .order('issue_date', { ascending: false });

      if (cancelled) return;

      // Migrate old issue history only when the database has no issue rows.
      const cachedIssues = read(ISSUE_KEY, []);
      if (!issueQuery.error && (issueQuery.data || []).length === 0 && cachedIssues.length > 0) {
        const cachedBooksForIssues = read(BOOK_KEY, []);
        const legacyIssues = cachedIssues.map(issue => {
          const oldBook = cachedBooksForIssues.find(b => String(b.id) === String(issue.bookId));
          const newBook = mappedBooks.find(b => b.title === oldBook?.title);
          const member = (data || []).find(m => String(m.id) === String(issue.memberId));
          if (!newBook || !member) return null;
          return {
            book_id: newBook.id,
            member_id: member.id,
            issue_date: issue.issueDate || new Date().toISOString().slice(0, 10),
            due_date: issue.dueDate || new Date().toISOString().slice(0, 10),
            return_date: issue.returnDate || null,
            status: issue.status || 'Issued'
          };
        }).filter(Boolean);

        if (legacyIssues.length) {
          const migratedIssues = await supabase.from('book_issues').insert(legacyIssues).select('*, books(title), members(full_name)');
          if (!migratedIssues.error) issueQuery = { data: migratedIssues.data, error: null };
          else setNotice(`Books migrated, but old issue history could not be migrated: ${migratedIssues.error.message}`);
        }
      }

      const { data: issueRows, error: issueError } = issueQuery;
      if (issueError) {
        setNotice(`Books loaded, but issue history could not load: ${issueError.message}`);
        setIssues([]);
      } else {
        const mappedIssues = (issueRows || []).map(row => ({
          id: row.id,
          bookId: row.book_id,
          bookTitle: row.books?.title || 'Book',
          memberId: row.member_id,
          memberName: row.members?.full_name || 'Member',
          issueDate: row.issue_date,
          dueDate: row.due_date,
          returnDate: row.return_date || '',
          status: row.status || 'Issued'
        }));
        setIssues(mappedIssues);
        save(ISSUE_KEY, mappedIssues);
      }

      setBooksLoading(false);
    };

    loadLibrary();
    return () => { cancelled = true; };
  }, [logged]);

  const refreshLibrary = async () => {
    const { data: bookRows, error: bookError } = await supabase
      .from('books').select('*').eq('is_active', true).order('created_at', { ascending: true });
    if (bookError) throw bookError;

    const mappedBooks = (bookRows || []).map(row => ({
      id: row.id,
      title: row.title || '',
      author: row.author || 'Unknown',
      category: row.category || 'General',
      total: Number(row.total_copies || 0),
      available: Number(row.available_copies || 0)
    }));
    setBooks(mappedBooks);
    save(BOOK_KEY, mappedBooks);

    const { data: issueRows, error: issueError } = await supabase
      .from('book_issues')
      .select('*, books(title), members(full_name)')
      .order('issue_date', { ascending: false });
    if (issueError) throw issueError;

    const mappedIssues = (issueRows || []).map(row => ({
      id: row.id,
      bookId: row.book_id,
      bookTitle: row.books?.title || 'Book',
      memberId: row.member_id,
      memberName: row.members?.full_name || 'Member',
      issueDate: row.issue_date,
      dueDate: row.due_date,
      returnDate: row.return_date || '',
      status: row.status || 'Issued'
    }));
    setIssues(mappedIssues);
    save(ISSUE_KEY, mappedIssues);
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
      `${m.name} ${m.phone} ${m.id}`
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

  // ADD / UPDATE MEMBER in Supabase.
  const submit = async e => {
    e.preventDefault();

    if (!/^\d{10}$/.test(form.phone)) {
      setNotice('Enter a valid 10-digit mobile number.');
      return;
    }

    const p = plans.find(item => item.name === form.plan) || plans[1];
    const fee = Number(form.fee || p.fee);
    const paid = Number(form.paid || 0);
    const expiry = expiryDate(form.joinDate, p.months);
    const payload = {
      full_name: form.name.trim(),
      phone: form.phone,
      age: form.age ? Number(form.age) : null,
      gender: form.gender || null,
      joining_date: form.joinDate,
      membership_plan: form.plan,
      membership_end: expiry,
      status: 'Active',
      fee,
      paid,
      payment_status: paid >= fee ? 'Paid' : paid > 0 ? 'Partial' : 'Pending'
    };

    const result = editing
      ? await supabase.from('members').update(payload).eq('id', editing).select().single()
      : await supabase.from('members').insert(payload).select().single();

    if (result.error) {
      setNotice(`Could not save member: ${result.error.message}`);
      return;
    }

    const row = result.data;
    const mapped = {
      id: row.id,
      name: row.full_name || '',
      phone: row.phone || '',
      age: row.age ?? '',
      gender: row.gender || '',
      joinDate: row.joining_date || '',
      plan: row.membership_plan || 'Monthly',
      fee: Number(row.fee || 0),
      paid: Number(row.paid || 0),
      paymentStatus: row.payment_status || 'Pending',
      expiry: row.membership_end || '',
      status: row.status || 'Active'
    };

    const next = editing
      ? members.map(m => String(m.id) === String(editing) ? mapped : m)
      : [mapped, ...members];
    setMembers(next);
    save(KEY, next);
    setModal(false);
    setNotice(editing ? 'Member updated in database.' : `Member saved in database. Member ID: ${row.id}`);
  };

  const remove = async id => {
    if (!confirm('Delete this member record? This cannot be undone.')) return;
    const { error } = await supabase.from('members').delete().eq('id', id);
    if (error) {
      setNotice(`Could not delete member: ${error.message}`);
      return;
    }
    const next = members.filter(m => String(m.id) !== String(id));
    setMembers(next);
    save(KEY, next);
    setNotice('Member deleted from database.');
  };

  // COLLECT FEES: update member's paid balance in Supabase.
  const collect = async m => {
    const amount = prompt(`Enter fee received from ${m.name}. Pending: ₹${Math.max(0, Number(m.fee) - Number(m.paid))}`);
    if (amount === null) return;
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) {
      setNotice('Enter a valid amount.');
      return;
    }
    const paid = Number(m.paid || 0) + n;
    const paymentStatus = paid >= Number(m.fee) ? 'Paid' : 'Partial';
    const { error } = await supabase.from('members').update({ paid, payment_status: paymentStatus }).eq('id', m.id);
    if (error) {
      setNotice(`Could not record fee: ${error.message}`);
      return;
    }
    const next = members.map(x => String(x.id) === String(m.id) ? { ...x, paid, paymentStatus } : x);
    setMembers(next);
    save(KEY, next);
    setNotice('Fee balance updated in database. Payment ledger entry will be integrated next.');
  };

  // BOOKS: persistent Supabase CRUD.
  const addBook = async () => {
    const title = prompt('Book title:');
    if (!title?.trim()) return;
    const author = prompt('Author name:') || 'Unknown';
    const category = prompt('Category:') || 'General';
    const copies = Number(prompt('Total copies:', '1'));

    if (!Number.isInteger(copies) || copies < 1) {
      setNotice('Enter a valid number of copies.');
      return;
    }

    const { error } = await supabase.from('books').insert({
      title: title.trim(),
      author,
      category,
      total_copies: copies,
      available_copies: copies,
      is_active: true
    });

    if (error) {
      setNotice(`Could not add book: ${error.message}`);
      return;
    }

    try {
      await refreshLibrary();
      setNotice('Book saved in Supabase successfully.');
    } catch (refreshError) {
      setNotice(`Book was saved, but refresh failed: ${refreshError.message}`);
    }
  };

  const editBook = async book => {
    const title = prompt('Book title:', book.title);
    if (!title?.trim()) return;
    const author = prompt('Author name:', book.author) ?? book.author;
    const category = prompt('Category:', book.category) ?? book.category;
    const total = Number(prompt('Total copies:', String(book.total)));

    if (!Number.isInteger(total) || total < 1 || total < (book.total - book.available)) {
      setNotice('Total copies cannot be less than the number of issued copies.');
      return;
    }

    const available = total - (book.total - book.available);
    const { error } = await supabase.from('books').update({
      title: title.trim(), author, category,
      total_copies: total, available_copies: available
    }).eq('id', book.id);

    if (error) {
      setNotice(`Could not update book: ${error.message}`);
      return;
    }

    try {
      await refreshLibrary();
      setNotice('Book updated in Supabase.');
    } catch (refreshError) {
      setNotice(`Book updated, but refresh failed: ${refreshError.message}`);
    }
  };

  const deleteBook = async book => {
    if (!confirm(`Delete "${book.title}" from the inventory?`)) return;

    const { count, error: checkError } = await supabase
      .from('book_issues')
      .select('id', { count: 'exact', head: true })
      .eq('book_id', book.id);

    if (checkError) {
      setNotice(`Could not check issue history: ${checkError.message}`);
      return;
    }
    if (count > 0) {
      setNotice('This book has issue history, so it cannot be deleted. Keep it in inventory instead.');
      return;
    }

    const { error } = await supabase.from('books').delete().eq('id', book.id);
    if (error) {
      setNotice(`Could not delete book: ${error.message}`);
      return;
    }

    try {
      await refreshLibrary();
      setNotice('Book deleted from Supabase.');
    } catch (refreshError) {
      setNotice(`Book deleted, but refresh failed: ${refreshError.message}`);
    }
  };

  // Issue a book using UUID book IDs and BIGINT member IDs.
  const issueBook = async () => {
    if (!active.length) {
      setNotice('Add an active member before issuing a book.');
      return;
    }

    const availableBooks = books.filter(b => b.available > 0);
    if (!availableBooks.length) {
      setNotice('No books are currently available.');
      return;
    }

    const bookChoice = prompt(
      'Available Books:\n' +
      availableBooks.map(b => `#${books.findIndex(item => item.id === b.id) + 1}: ${b.title} (${b.available} available)`).join('\n') +
      '\n\nEnter the short Book ID (for example 1):'
    );
    if (bookChoice === null) return;

    const shortBookId = Number(bookChoice.trim().replace(/^#/, ''));
    const book = Number.isInteger(shortBookId) && shortBookId > 0
      ? books[shortBookId - 1]
      : availableBooks.find(b => b.id === bookChoice.trim());
    if (!book || book.available < 1) {
      setNotice('Invalid Book ID or no available copy.');
      return;
    }

    const memberChoice = prompt(
      'Active Members:\n' +
      active.map(m => `${m.id}: ${m.name}`).join('\n') +
      '\n\nEnter Member ID:'
    );
    if (memberChoice === null) return;

    const member = active.find(m => String(m.id) === memberChoice.trim());
    if (!member) {
      setNotice('Invalid active Member ID.');
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const due = prompt(
      'Due date (YYYY-MM-DD):',
      new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)
    );
    if (!due) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(due) || due < today) {
      setNotice('Enter a valid due date in YYYY-MM-DD format.');
      return;
    }

    const { data: currentBook, error: readError } = await supabase
      .from('books').select('available_copies').eq('id', book.id).single();
    if (readError || !currentBook || currentBook.available_copies < 1) {
      setNotice(readError?.message || 'No available copy remains for this book.');
      return;
    }

    const { error: issueError } = await supabase.from('book_issues').insert({
      book_id: book.id,
      member_id: member.id,
      issue_date: today,
      due_date: due,
      status: 'Issued'
    });
    if (issueError) {
      setNotice(`Could not issue book: ${issueError.message}`);
      return;
    }

    const { error: stockError } = await supabase.from('books')
      .update({ available_copies: currentBook.available_copies - 1 })
      .eq('id', book.id);
    if (stockError) {
      setNotice(`Issue record saved, but stock update failed: ${stockError.message}. Please check inventory.`);
      return;
    }

    try {
      await refreshLibrary();
      setNotice(`Book issued to ${member.name}.`);
    } catch (refreshError) {
      setNotice(`Book issued, but refresh failed: ${refreshError.message}`);
    }
  };

  const returnBook = async id => {
    const issue = issues.find(x => String(x.id) === String(id));
    if (!issue || issue.status === 'Returned') return;
    if (!confirm(`Mark "${issue.bookTitle}" as returned by ${issue.memberName}?`)) return;

    const today = new Date().toISOString().slice(0, 10);
    const { data: bookRow, error: bookError } = await supabase
      .from('books').select('available_copies, total_copies').eq('id', issue.bookId).single();
    if (bookError || !bookRow) {
      setNotice(bookError?.message || 'Could not find this book in inventory.');
      return;
    }

    const { error: issueError } = await supabase.from('book_issues')
      .update({ status: 'Returned', return_date: today })
      .eq('id', id);
    if (issueError) {
      setNotice(`Could not return book: ${issueError.message}`);
      return;
    }

    const { error: stockError } = await supabase.from('books')
      .update({ available_copies: Math.min(bookRow.total_copies, bookRow.available_copies + 1) })
      .eq('id', issue.bookId);
    if (stockError) {
      setNotice(`Return was recorded, but stock update failed: ${stockError.message}. Please check inventory.`);
      return;
    }

    try {
      await refreshLibrary();
      setNotice('Book returned successfully and inventory updated.');
    } catch (refreshError) {
      setNotice(`Book returned, but refresh failed: ${refreshError.message}`);
    }
  };

  const exportCsv = () => {
    const rows = [
      ['Member ID', 'Name', 'Mobile', 'Join Date', 'Plan', 'Fee', 'Paid', 'Pending', 'Expiry'],
      ...members.map(m => [
        m.id, m.name, m.phone, m.joinDate,
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

  const exportPdf = () => {
    const reportWindow = window.open('', '_blank', 'width=1000,height=750');
    if (!reportWindow) {
      setNotice('Please allow pop-ups to download the PDF report.');
      return;
    }

    const safe = value => String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
    const money = value => `₹${Number(value || 0).toLocaleString('en-IN')}`;
    const reportRows = members.map(m => `
      <tr>
        <td>#${safe(m.id)}</td><td>${safe(m.name)}</td><td>${safe(m.phone)}</td>
        <td>${safe(m.plan)}</td><td>${money(m.fee)}</td><td>${money(m.paid)}</td>
        <td>${money(Math.max(0, Number(m.fee || 0) - Number(m.paid || 0)))}</td>
        <td>${safe(m.expiry)}</td>
      </tr>`).join('');

    reportWindow.document.write(`<!doctype html><html><head><title>Achievers Library Report</title>
      <meta charset="utf-8"><style>
      *{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#17233b;padding:28px}
      h1{margin:0 0 6px;font-size:25px}p{color:#64748b;margin:0 0 22px}
      .summary{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:20px 0 26px}
      .card{border:1px solid #dbe2ec;border-radius:8px;padding:13px}
      .card small{display:block;color:#64748b;margin-bottom:8px}.card strong{font-size:19px}
      table{width:100%;border-collapse:collapse;font-size:11px}th,td{padding:10px 8px;border-bottom:1px solid #e2e8f0;text-align:left}
      th{background:#f1f5f9;color:#475569}footer{margin-top:25px;color:#64748b;font-size:11px}
      @media print{body{padding:0}.no-print{display:none}}
      </style></head><body>
      <h1>Achievers Library</h1><p>Member & Fee Summary · Generated ${safe(new Date().toLocaleString('en-IN'))}</p>
      <div class="summary">
        <div class="card"><small>Total admissions</small><strong>${members.length}</strong></div>
        <div class="card"><small>Active members</small><strong>${active.length}</strong></div>
        <div class="card"><small>Fees received</small><strong>${money(collected)}</strong></div>
        <div class="card"><small>Fees pending</small><strong>${money(pending)}</strong></div>
      </div>
      <h3>Member Details</h3><table><thead><tr>
      <th>Member ID</th><th>Name</th><th>Mobile</th><th>Plan</th><th>Fee</th><th>Paid</th><th>Pending</th><th>Expiry</th>
      </tr></thead><tbody>${reportRows || '<tr><td colspan="8">No members found.</td></tr>'}</tbody></table>
      <footer>Achievers Library · Umranala, Chhindwara, Madhya Pradesh</footer>
      <script>window.onload=()=>{window.focus();window.print();};</script>
      </body></html>`);
    reportWindow.document.close();
  };

  // LOGIN: Supabase Auth + admin role check.
  if (authLoading) {
    return <div className="admin-login-wrap"><p>Checking admin session...</p></div>;
  }

  if (!logged) {
    return (
      <div className="admin-login-wrap">
        <form className="admin-login" onSubmit={async e => {
          e.preventDefault();
          setLoginErr('');

          const { data, error } = await supabase.auth.signInWithPassword({
            email: user.trim(),
            password: pass
          });

          if (error) {
            setLoginErr(error.message || 'Email or password is incorrect.');
            return;
          }

          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', data.user.id)
            .maybeSingle();

          if (profileError || profile?.role !== 'admin') {
            await supabase.auth.signOut();
            setLoginErr('This account does not have library admin access.');
            return;
          }

          setLogged(true);
          setPass('');
        }}>
          <div className="admin-logo">AL</div>
          <span className="admin-eyebrow">ACHIEVERS LIBRARY · UMRANALA</span>
          <h1>Admin Login</h1>
          <p>Kunal Sahu · Manage members, books and fees.</p>

          <label>
            Email address
            <input type="email" value={user} onChange={e => setUser(e.target.value)} required autoComplete="username" />
          </label>

          <label>
            Password
            <input type="password" value={pass} onChange={e => setPass(e.target.value)} required autoComplete="current-password" />
          </label>

          {loginErr && <div className="admin-error">{loginErr}</div>}

          <button className="admin-primary" type="submit">Sign in to dashboard</button>
          <a href="/" className="back-site">
            <ArrowLeft size={16}/> Back to website
          </a>
          <small>Sign in with an authorized library admin account.</small>
        </form>
      </div>
    );
  }

  const nav = [
    ['Dashboard', LayoutDashboard],
    ['Members', Users],
    ['Books', BookOpen],
    ['Fee Management', Wallet],
    ['Reports', FileBarChart],
    ['Settings', Settings]
  ];

  return (
    <div className="admin-app">
      <aside className="admin-sidebar">
        <a className="admin-brand" href="/">
          <span>AL</span>
          <b>KUNAL SAHU<small>LIBRARY ADMIN</small></b>
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
          <button onClick={async () => {
            await supabase.auth.signOut();
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
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search ID, name or mobile"/>
              </div>
              <span>{membersLoading ? 'Loading from database…' : `${filtered.length} records · Supabase`}</span>
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
                    ) : books.map((b, index) => (
                      <tr key={b.id}>
                        <td><span className="seat-pill">#{index + 1}</span></td>
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
                        <td>#{Math.max(0, books.findIndex(b => b.id === i.bookId) + 1)}</td>
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
              <div><h3>Library Reports</h3><p>Download member and fee summary as CSV or PDF.</p></div>
              <div className="admin-report-actions">
                <button className="admin-secondary" onClick={exportPdf}><Download size={17}/> Download PDF</button>
                <button className="admin-primary" onClick={exportCsv}><Download size={17}/> Export CSV</button>
              </div>
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
              
              <div><b>Membership plans</b><span>₹500 welcome · ₹600 monthly · ₹1,700 / 3 months · ₹3,000 / 6 months · ₹5,500 / year</span></div>
            </div>
            <p className="admin-warning">
              Members, books and issue history are saved in the Supabase database.
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
            <th>Plan / Expiry</th><th>Fee status</th><th>Actions</th>
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