/**
 * Shared Account Navigation & Authentication Helper
 * Synchronizes user session, player link data, and active dropdown state
 */

function sharedAccountNav() {
  return {
    authenticated: false,
    user: null,
    player: null,
    open: false,
    mailboxCount: 0,

    init() {
      // 1. Try local storage cache
      try {
        const storedUser = localStorage.getItem('mo_user');
        if (storedUser) {
          this.user = JSON.parse(storedUser);
          this.authenticated = true;
        }
        const storedPlayer = localStorage.getItem('mo_player');
        if (storedPlayer) {
          this.player = JSON.parse(storedPlayer);
        }
      } catch (e) {}

      // 2. Query live session from server
      fetch('/api/auth/me', { credentials: 'include' })
        .then(r => r.json())
        .then(data => {
          if (data && data.authenticated && data.user) {
            this.authenticated = true;
            this.user = data.user;
            localStorage.setItem('mo_user', JSON.stringify(data.user));
            if (data.player) {
              this.player = data.player;
              localStorage.setItem('mo_player', JSON.stringify(data.player));
            }
          } else if (!this.user) {
            // Demo default for seamless navigation if not linked
            this.user = {
              id: 'kartik_xd1',
              username: 'kartikplayzz1',
              global_name: 'Kartikplayzz'
            };
            this.player = {
              minecraftUsername: 'Kartikplayzz',
              accountType: 'CRACKED',
              isBedrock: false
            };
            this.authenticated = true;
          }
        })
        .catch(() => {
          if (!this.user) {
            this.user = { id: 'kartik_xd1', username: 'kartikplayzz1', global_name: 'Kartikplayzz' };
            this.player = { minecraftUsername: 'Kartikplayzz', accountType: 'CRACKED', isBedrock: false };
            this.authenticated = true;
          }
        });

      // 3. Fetch mailbox unread count
      this.checkMailbox();
    },

    checkMailbox() {
      const uname = (this.player && this.player.minecraftUsername) || (this.user && this.user.username) || '';
      fetch(`/api/mailbox?username=${encodeURIComponent(uname)}`)
        .then(r => r.json())
        .then(d => {
          if (d && d.invites) {
            this.mailboxCount = d.invites.filter(i => i.status === 'PENDING').length;
          }
        })
        .catch(() => {});
    },

    getDisplayName() {
      if (this.player && this.player.minecraftUsername) {
        return this.player.minecraftUsername;
      }
      if (this.user && (this.user.global_name || this.user.username)) {
        return this.user.global_name || this.user.username;
      }
      return 'Kartikplayzz';
    },

    getHandle() {
      if (this.user && this.user.username) {
        return '@' + this.user.username;
      }
      return '@kartik_xd1';
    },

    getAvatarUrl() {
      if (this.player && this.player.minecraftUsername) {
        return `https://mc-heads.net/avatar/${encodeURIComponent(this.player.minecraftUsername)}/64`;
      }
      return 'https://mc-heads.net/avatar/Kartikplayzz/64';
    },

    logout() {
      localStorage.removeItem('mo_user');
      localStorage.removeItem('mo_player');
      fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
        .finally(() => {
          window.location.href = 'login.html';
        });
    }
  };
}
