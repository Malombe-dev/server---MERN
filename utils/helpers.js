const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

class Helpers {
  // Generate JWT token
  static generateToken(payload, expiresIn = '24h') {
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
  }

  // Verify JWT token
  static verifyToken(token) {
    try {
      return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  // Hash password
  static async hashPassword(password) {
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
  }

  // Compare password
  static async comparePassword(password, hashedPassword) {
    return await bcrypt.compare(password, hashedPassword);
  }

  // Generate random string
  static generateRandomString(length = 32) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
  }

  // Format phone number for Kenya
  static formatKenyanPhone(phone) {
    // Remove all non-numeric characters
    phone = phone.replace(/\D/g, '');
    
    // Handle different formats
    if (phone.startsWith('254')) {
      return `+${phone}`;
    } else if (phone.startsWith('0')) {
      return `+254${phone.substring(1)}`;
    } else if (phone.length === 9) {
      return `+254${phone}`;
    }
    
    return phone;
  }

  // Validate Kenyan phone number
  static isValidKenyanPhone(phone) {
    const kenyanPhoneRegex = /^(\+254|254|0)?[17]\d{8}$/;
    return kenyanPhoneRegex.test(phone.replace(/\s/g, ''));
  }

  // Generate pagination metadata
  static generatePagination(page, limit, total) {
    const totalPages = Math.ceil(total / limit);
    const currentPage = Math.max(1, Math.min(page, totalPages));
    const hasNext = currentPage < totalPages;
    const hasPrev = currentPage > 1;

    return {
      currentPage,
      totalPages,
      totalItems: total,
      itemsPerPage: limit,
      hasNext,
      hasPrev,
      nextPage: hasNext ? currentPage + 1 : null,
      prevPage: hasPrev ? currentPage - 1 : null
    };
  }

  // Sanitize string for search
  static sanitizeSearchQuery(query) {
    if (!query || typeof query !== 'string') return '';
    
    return query
      .trim()
      .replace(/[^\w\s-_.]/gi, '') // Remove special characters except word chars, spaces, hyphens, underscores, dots
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .substring(0, 100); // Limit length
  }

  // Generate slug from title
  static generateSlug(title) {
    return title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
  }

  // Format date for Kenya timezone
  static formatKenyanDate(date, options = {}) {
    const defaultOptions = {
      timeZone: 'Africa/Nairobi',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    };

    return new Date(date).toLocaleDateString('en-KE', { ...defaultOptions, ...options });
  }

  // Format date with time for Kenya
  static formatKenyanDateTime(date) {
    return new Date(date).toLocaleString('en-KE', {
      timeZone: 'Africa/Nairobi',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // Calculate reading time for text
  static calculateReadingTime(text) {
    const wordsPerMinute = 200;
    const words = text.trim().split(/\s+/).length;
    const minutes = Math.ceil(words / wordsPerMinute);
    return minutes;
  }

  // Generate excerpt from text
  static generateExcerpt(text, maxLength = 150) {
    if (text.length <= maxLength) return text;
    
    const excerpt = text.substring(0, maxLength);
    const lastSpace = excerpt.lastIndexOf(' ');
    
    return lastSpace > 0 ? excerpt.substring(0, lastSpace) + '...' : excerpt + '...';
  }

  // Validate email
  static isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Clean HTML content
  static cleanHtml(html) {
    // Basic HTML cleaning - in production, use a library like DOMPurify
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/on\w+="[^"]*"/gi, '')
      .replace(/javascript:/gi, '');
  }

  // Generate cache key
  static generateCacheKey(prefix, ...args) {
    const key = args
      .filter(arg => arg !== null && arg !== undefined)
      .map(arg => String(arg).toLowerCase())
      .join(':');
    return `${prefix}:${key}`;
  }

  // Check if date is in the past
  static isPastDate(date) {
    return new Date(date) < new Date();
  }

  // Check if date is today
  static isToday(date) {
    const today = new Date();
    const checkDate = new Date(date);
    return checkDate.toDateString() === today.toDateString();
  }

  // Get Kenya counties list
  static getKenyaCounties() {
    return [
      'Baringo', 'Bomet', 'Bungoma', 'Busia', 'Elgeyo-Marakwet', 'Embu',
      'Garissa', 'Homa Bay', 'Isiolo', 'Kajiado', 'Kakamega', 'Kericho',
      'Kiambu', 'Kilifi', 'Kirinyaga', 'Kisii', 'Kisumu', 'Kitui',
      'Kwale', 'Laikipia', 'Lamu', 'Machakos', 'Makueni', 'Mandera',
      'Marsabit', 'Meru', 'Migori', 'Mombasa', 'Murang\'a', 'Nairobi',
      'Nakuru', 'Nandi', 'Narok', 'Nyamira', 'Nyandarua', 'Nyeri',
      'Samburu', 'Siaya', 'Taita-Taveta', 'Tana River', 'Tharaka-Nithi',
      'Trans Nzoia', 'Turkana', 'Uasin Gishu', 'Vihiga', 'Wajir', 'West Pokot'
    ];
  }

  // Validate Kenya county
  static isValidKenyaCounty(county) {
    return this.getKenyaCounties().includes(county);
  }

  // Generate API response format
  static apiResponse(success, message, data = null, meta = null) {
    const response = {
      success,
      message,
      timestamp: new Date().toISOString()
    };

    if (data !== null) {
      response.data = data;
    }

    if (meta !== null) {
      response.meta = meta;
    }

    return response;
  }

  // Handle async errors
  static asyncHandler(fn) {
    return (req, res, next) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }

  // Convert to title case
  static toTitleCase(str) {
    return str.replace(/\w\S*/g, (txt) => 
      txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
    );
  }

  // Remove duplicates from array
  static removeDuplicates(arr, key = null) {
    if (!key) {
      return [...new Set(arr)];
    }
    
    const seen = new Set();
    return arr.filter(item => {
      const value = item[key];
      if (seen.has(value)) {
        return false;
      }
      seen.add(value);
      return true;
    });
  }

  // Deep clone object
    static deepClone(obj) {
      return JSON.parse(JSON.stringify(obj));
    }
  }



module.exports = Helpers;