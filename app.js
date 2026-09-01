// =========================================================
// MIZA PWA — offline-first, stores everything in IndexedDB
// on the device. No server required.
// =========================================================
(function () {
  const DB_NAME = 'miza';
  const DB_VERSION = 1;
  const STARTER_CATEGORIES = [
    ['Groceries', 'expense'], ['Rent', 'expense'], ['Utilities', 'expense'],
    ['Transport', 'expense'], ['Dining', 'expense'], ['Subscriptions', 'expense'],
    ['Other expense', 'expense'],
    ['Salary', 'income'], ['Freelance', 'income'], ['Other income', 'income'],
  ];

  const fmt = (cents) => (cents < 0 ? '-' : '') + '$' + (Math.abs(cents) / 100).toFixed(2);
  const todayISO = () => new Date().toISOString().slice(0, 10);
  const uid = () => 'id_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

  let db;
  let accounts = [];
  let categories = [];
  let transactions = [];
  let selectedAccountId = null;
  let currentTxType = 'expense';

  // ---- IndexedDB wrapper ----
  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const idb = req.result;
        if (!idb.objectStoreNames.contains('accounts')) idb.createObjectStore('accounts', { keyPath: 'id' });
        if (!idb.objectStoreNames.contains('categories')) idb.createObjectStore('categories', { keyPath: 'id' });
        if (!idb.objectStoreNames.contains('transactions')) {
          const store = idb.createObjectStore('transactions', { keyPath: 'id' });
          store.createIndex('accountId', 'accountId');
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function txStore(name, mode) {
    return db.transaction(name, mode).objectStore(name);
  }
  function getAll(name) {
    return new Promise((resolve, reject) => {
      const req = txStore(name, 'readonly').getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  function put(name, value) {
    return new Promise((resolve, reject) => {
      const req = txStore(name, 'readwrite').put(value);
      req.onsuccess = () => resolve(value);
      req.onerror = () => reject(req.error);
    });
  }
  function del(name, id) {
    return new Promise((resolve, reject) => {
      const req = txStore(name, 'readwrite').delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async function seedIfEmpty() {
    const existingAccounts = await getAll('accounts');
    if (existingAccounts.length > 0) return;

    const seedAccountId = uid();
    await put('accounts', { id: seedAccountId, name: 'Everyday checking', type: 'checking', startingBalanceCents: 0, createdAt: Date.now() });

    for (const [name, kind] of STARTER_CATEGORIES) {
      await put('categories', { id: uid(), name, kind });
    }
    selectedAccountId = seedAccountId;
  }

  function accountBalanceCents(accountId) {
    const acct = accounts.find((a) => a.id === accountId);
    let bal = acct ? acct.startingBalanceCents : 0;
    for (const t of transactions) {
      if (t.accountId !== accountId) continue;
      bal += t.type === 'income' ? t.amountCents : -t.amountCents;
    }
    return bal;
  }

  function setStatus(msg, isError) {
    const bar = document.getElementById('status-bar');
    bar.textContent = msg || '';
    bar.className = 'status-bar' + (isError ? ' error' : '');
  }

  async function loadAll() {
    try {
      db = await openDB();
      await seedIfEmpty();
      accounts = await getAll('accounts');
      categories = await getAll('categories');
      transactions = await getAll('transactions');
      if (!selectedAccountId && accounts.length) selectedAccountId = accounts[0].id;
      setStatus('');
      render();
    } catch (e) {
      setStatus('Could not open local storage on this device: ' + e.message, true);
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function render() {
    const dateEl = document.getElementById('tx-date');
    if (!dateEl.value) dateEl.value = todayISO();

    document.getElementById('account-count').textContent = accounts.length;
    const totalCents = accounts.reduce((sum, a) => sum + accountBalanceCents(a.id), 0);
    document.getElementById('total-balance').textContent = fmt(totalCents);

    const strip = document.getElementById('accounts-strip');
    strip.innerHTML = '';
    accounts.forEach((a) => {
      const pill = document.createElement('div');
      pill.className = 'acct-pill' + (a.id === selectedAccountId ? ' selected' : '');
      pill.innerHTML = `<div class="acct-name">${escapeHtml(a.name)}</div><div class="acct-bal">${fmt(accountBalanceCents(a.id))}</div>`;
      pill.onclick = () => { selectedAccountId = a.id; render(); };
      strip.appendChild(pill);
    });

    const catSelect = document.getElementById('tx-category');
    const relevantCats = categories.filter((c) => c.kind === currentTxType);
    catSelect.innerHTML = relevantCats.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');

    const ledger = document.getElementById('ledger');
    const rows = transactions
      .filter((t) => t.accountId === selectedAccountId)
      .sort((a, b) => (b.transactionDate || '').localeCompare(a.transactionDate || '') || b.createdAt - a.createdAt);
    ledger.innerHTML = '';
    if (rows.length === 0) {
      ledger.innerHTML = '<div class="empty">No transactions yet for this account. Add one above.</div>';
    } else {
      rows.forEach((t) => {
        const cat = categories.find((c) => c.id === t.categoryId);
        const row = document.createElement('div');
        row.className = 'ledger-row';
        row.innerHTML = `
          <div>
            <div class="lr-desc">${escapeHtml(t.description || '(no description)')}</div>
            <div class="lr-meta">${escapeHtml(cat ? cat.name : 'Uncategorized')} · ${t.transactionDate}</div>
          </div>
          <div style="display:flex; align-items:center; gap:10px;">
            <div class="lr-amt ${t.type}">${t.type === 'income' ? '+' : '-'}${fmt(t.amountCents)}</div>
            <button class="del-btn" aria-label="Delete transaction">&times;</button>
          </div>`;
        row.querySelector('.del-btn').onclick = async () => {
          await del('transactions', t.id);
          transactions = transactions.filter((x) => x.id !== t.id);
          render();
        };
        ledger.appendChild(row);
      });
    }
  }

  document.getElementById('type-expense').onclick = () => setType('expense');
  document.getElementById('type-income').onclick = () => setType('income');
  function setType(t) {
    currentTxType = t;
    document.getElementById('type-expense').className = 'type-btn' + (t === 'expense' ? ' active-expense' : '');
    document.getElementById('type-income').className = 'type-btn' + (t === 'income' ? ' active-income' : '');
    render();
  }

  document.getElementById('toggle-acct-form').onclick = () => {
    const f = document.getElementById('acct-form');
    f.style.display = f.style.display === 'none' ? 'block' : 'none';
  };

  document.getElementById('acct-save').onclick = async () => {
    const nameEl = document.getElementById('acct-name');
    const startEl = document.getElementById('acct-start');
    const errEl = document.getElementById('acct-err');
    errEl.textContent = '';
    if (!nameEl.value.trim()) { errEl.textContent = 'Enter an account name first'; return; }
    const newAcct = {
      id: uid(),
      name: nameEl.value.trim(),
      type: document.getElementById('acct-type').value,
      startingBalanceCents: Math.round((parseFloat(startEl.value) || 0) * 100),
      createdAt: Date.now(),
    };
    await put('accounts', newAcct);
    accounts.push(newAcct);
    selectedAccountId = newAcct.id;
    nameEl.value = ''; startEl.value = '';
    document.getElementById('acct-form').style.display = 'none';
    render();
  };

  document.getElementById('tx-save').onclick = async () => {
    const descEl = document.getElementById('tx-desc');
    const amtEl = document.getElementById('tx-amount');
    const dateEl = document.getElementById('tx-date');
    const catEl = document.getElementById('tx-category');
    const errEl = document.getElementById('tx-err');
    errEl.textContent = '';
    const amount = parseFloat(amtEl.value);
    if (!amount || amount <= 0) { errEl.textContent = 'Enter an amount first'; return; }
    if (!selectedAccountId) { errEl.textContent = 'Add an account first'; return; }
    const tx = {
      id: uid(),
      accountId: selectedAccountId,
      categoryId: catEl.value || null,
      description: descEl.value.trim(),
      type: currentTxType,
      amountCents: Math.round(amount * 100),
      transactionDate: dateEl.value || todayISO(),
      status: 'completed',
      source: 'manual',
      createdAt: Date.now(),
    };
    await put('transactions', tx);
    transactions.push(tx);
    descEl.value = ''; amtEl.value = '';
    render();
  };

  loadAll();
})();
