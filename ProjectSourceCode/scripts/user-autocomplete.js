class UserAutocomplete {
  constructor(inputEl, menuEl, onSelect = null) {
    if (!inputEl || !menuEl) return;
    this.input = inputEl;
    this.menu = menuEl;
    this.onSelect = onSelect;
    this.allUsers = [];
    this.init();
  }

  async init() {
    this.allUsers = await this.fetchUsers();
    this.input.addEventListener('input', () => {
      this.input.setCustomValidity('');
      this.render();
    });
    this.input.addEventListener('focus', () => this.render());
    this.input.addEventListener('blur', () => setTimeout(() => this.hide(), 200));
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.hide();
        this.input.blur();
      }
    });
  }

  async fetchUsers() {
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch('/api/users', { headers });
      return res.ok ? await res.json() : [];
    } catch {
      return [];
    }
  }

  render() {
    const q = this.input.value.toLowerCase().trim();
    const matches = this.allUsers.filter(u => !q || u.username.toLowerCase().includes(q));
    this.menu.innerHTML = '';
    
    if (matches.length === 0 && q) {
      this.hide();
      return;
    }

    matches.slice(0, 8).forEach(u => {
      const li = document.createElement('li');
      li.textContent = u.username;
      li.addEventListener('mousedown', (e) => {
        e.preventDefault();
        this.input.value = u.username;
        this.input.setCustomValidity('');
        this.input.classList.remove('is-invalid');
        this.hide();
        if (this.onSelect) this.onSelect(u);
      });
      this.menu.appendChild(li);
    });
    this.menu.style.display = matches.length ? 'block' : 'none';
  }

  hide() {
    this.menu.style.display = 'none';
  }

  isValid() {
    const val = this.input.value.trim();
    if (!val) return true; 
    return this.allUsers.some(u => u.username === val);
  }

  setUsers(users) {
    this.allUsers = users;
  }
}

window.UserAutocomplete = UserAutocomplete;
