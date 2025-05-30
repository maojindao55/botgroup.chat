import axios from 'axios';

// IMPORTANT: baseURL should be configured based on your actual backend API address.
// If your Django backend runs on http://localhost:8000,
// and your newsfeed API is at /api/newsfeed/, then baseURL might be 'http://localhost:8000/api/'
// Or, if you have a general /api/ prefix for all apps: 'http://localhost:8000/api/'
// For development, you might also use Vite/Vue CLI proxy settings to avoid CORS issues.
const apiClient = axios.create({
  baseURL: 'http://localhost:8000/api/', // ADJUST THIS TO YOUR BACKEND
  timeout: 10000, // 10 second timeout
  headers: {
    'Content-Type': 'application/json',
    // You can add other default headers here, e.g., Authorization tokens
  }
});

// --- Newsfeed API ---
/**
 * Fetches news items from the backend.
 * @param {object} params - Query parameters for filtering and pagination.
 * Example: { page: 1, page_size: 10, published_at__date: 'YYYY-MM-DD', evaluation_rating: 'A', ordering: '-published_at' }
 * @returns {Promise} Axios promise with the API response.
 */
export const getNewsItems = (params) => {
  return apiClient.get('newsfeed/newsitems/', { params });
};

/**
 * Fetches a single news item by its ID.
 * @param {string|number} id - The ID of the news item.
 * @returns {Promise} Axios promise with the API response.
 */
export const getNewsItemById = (id) => {
  return apiClient.get(`newsfeed/newsitems/${id}/`);
};


// --- AI Tools API (to be implemented further) ---

/**
 * Fetches AI tool categories.
 * @param {object} params - Query parameters (if any).
 * @returns {Promise} Axios promise with the API response.
 */
export const getToolCategories = (params) => {
  return apiClient.get('aitools/categories/', { params });
  // Example: apiClient.get('aitools/categories/', { params: { ordering: 'name' } });
};

/**
 * Fetches AI tools.
 * @param {object} params - Query parameters for filtering, searching, and pagination.
 * Example: { page: 1, categories__slug: 'text-to-video', search: 'Image generation', ordering: 'click_count' }
 * @returns {Promise} Axios promise with the API response.
 */
export const getAiTools = (params) => {
  return apiClient.get('aitools/tools/', { params });
};

/**
 * Increments the click count for a specific AI tool.
 * @param {string|number} id - The ID of the AI tool.
 * @returns {Promise} Axios promise with the API response.
 */
export const incrementToolClickCount = (id) => {
  return apiClient.post(`aitools/tools/${id}/increment-click/`);
};

export default apiClient; // Exporting the instance can be useful for direct use or further configuration
