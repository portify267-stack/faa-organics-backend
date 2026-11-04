const crypto = require('crypto');

let bcrypt;
try {
  bcrypt = require('bcryptjs');
} catch {
  // Built-in fallback using standard PBKDF2 if bcryptjs is not yet installed
  bcrypt = {
    genSalt: async (rounds = 10) => {
      return crypto.randomBytes(16).toString('hex');
    },
    hash: async (password, salt) => {
      const derivedKey = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512');
      return `pbkdf2$${salt}$${derivedKey.toString('hex')}`;
    },
    compare: async (candidatePassword, hash) => {
      if (!hash || typeof hash !== 'string') return false;

      // Handle standard PBKDF2 hash fallback
      if (hash.startsWith('pbkdf2$')) {
        const parts = hash.split('$');
        if (parts.length !== 3) return false;
        const salt = parts[1];
        const originalKey = parts[2];
        const derivedKey = crypto
          .pbkdf2Sync(candidatePassword, salt, 10000, 64, 'sha512')
          .toString('hex');
        return crypto.timingSafeEqual(
          Buffer.from(derivedKey, 'hex'),
          Buffer.from(originalKey, 'hex')
        );
      }

      return false;
    },
  };
}

module.exports = bcrypt;

