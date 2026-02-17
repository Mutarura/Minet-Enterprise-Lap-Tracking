import CryptoJS from 'crypto-js';

/**
 * Generates a secure random temporary password
 * Format: 3 words + 2 digits (e.g., "blue-tiger-sky-42")
 */
export const generateSecureTempPassword = (): string => {
    const adjectives = ['red', 'blue', 'green', 'fast', 'slow', 'big', 'small', 'bright', 'dark', 'cool'];
    const nouns = ['tiger', 'eagle', 'shark', 'wolf', 'bear', 'lion', 'hawk', 'fox', 'owl', 'lynx'];
    const words = ['sky', 'sea', 'fire', 'ice', 'wind', 'star', 'moon', 'sun', 'cloud', 'storm'];

    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const word = words[Math.floor(Math.random() * words.length)];
    const num = Math.floor(Math.random() * 100);

    return `${adj}-${noun}-${word}-${num}`;
};

/**
 * Hashes a password using SHA-256
 * @param password - Plain text password
 * @returns Hashed password string
 */
export const hashPassword = (password: string): string => {
    return CryptoJS.SHA256(password).toString();
};

/**
 * Verifies a password against a hash
 * @param password - Plain text password to verify
 * @param hash - Stored hash to compare against
 * @returns true if password matches hash
 */
export const verifyPassword = (password: string, hash: string): boolean => {
    return hashPassword(password) === hash;
};

/**
 * Validates password strength
 * @param password - Password to validate
 * @returns Object with isValid and error message
 */
export const validatePasswordStrength = (password: string): { isValid: boolean; error?: string } => {
    if (password.length < 8) {
        return { isValid: false, error: 'Password must be at least 8 characters long' };
    }

    if (!/[A-Z]/.test(password)) {
        return { isValid: false, error: 'Password must contain at least one uppercase letter' };
    }

    if (!/[a-z]/.test(password)) {
        return { isValid: false, error: 'Password must contain at least one lowercase letter' };
    }

    if (!/[0-9]/.test(password)) {
        return { isValid: false, error: 'Password must contain at least one number' };
    }

    return { isValid: true };
};
