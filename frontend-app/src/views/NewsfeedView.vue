<template>
  <div class="newsfeed-view">
    <h1>AI Telegram Newsfeed</h1>

    <div class="filters">
      <el-date-picker
        v-model="selectedDate"
        type="date"
        placeholder="Pick a day for published date"
        format="YYYY-MM-DD"
        value-format="YYYY-MM-DD"
        @change="handleDateChange"
        clearable
        style="margin-bottom: 20px;"
      />
      <!-- Add more filters here if needed (e.g., for rating) -->
    </div>

    <div v-if="isLoading" class="loading">Loading news items...</div>
    <div v-if="error" class="error-message">Error loading news: {{ error }}</div>

    <div v-if="!isLoading && !error && newsItems.length === 0" class="no-items">
      No news items found for the selected criteria.
    </div>

    <div class="news-list" v-if="!isLoading && newsItems.length > 0">
      <div v-for="item in newsItems" :key="item.id" class="news-card">
        <h2>{{ item.title }}</h2>
        <p><strong>Source:</strong> {{ item.source_name }}</p>
        <p><strong>Published:</strong> {{ formatDate(item.published_at) }}</p>
        <p><strong>Rating:</strong> {{ item.evaluation_rating }}</p>
        <p v-if="item.evaluation_notes"><strong>Notes:</strong> {{ item.evaluation_notes }}</p>
        <p class="summary">{{ item.content_summary }}</p>
        <a :href="item.original_url" target="_blank" class="read-more">Read Original</a>
      </div>
    </div>

    <el-pagination
      v-if="totalPages > 1 && !isLoading"
      background
      layout="prev, pager, next"
      :total="totalItems"
      :page-size="pageSize"
      :current-page="currentPage"
      @current-change="handlePageChange"
      style="margin-top: 20px; display: flex; justify-content: center;"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { getNewsItems } from '../services/api';
// Assuming Element Plus is globally registered or import components if needed
// import { ElDatePicker, ElPagination } from 'element-plus';

const newsItems = ref([]);
const currentPage = ref(1);
const totalPages = ref(1); // Will be derived from API response's count and page_size
const totalItems = ref(0); // Total number of items from API (response.data.count)
const pageSize = ref(10); // Default page size, should match backend or be a param

const selectedDate = ref(null); // For date filtering (published_at__date)
const isLoading = ref(false);
const error = ref(null);

async function fetchNews(page = 1) {
  isLoading.value = true;
  error.value = null;
  console.log(`Fetching news for page: ${page}, date: ${selectedDate.value}`);
  try {
    const params = {
      page: page,
      page_size: pageSize.value,
      // Add other static filters if needed
    };
    if (selectedDate.value) {
      params.published_at__date = selectedDate.value;
    }
    // Add other dynamic filters like rating, ordering etc.
    // params.ordering = '-published_at'; // Example default ordering

    const response = await getNewsItems(params);
    
    // Assuming DRF PageNumberPagination response structure:
    // {
    //   "count": 123,
    //   "next": "http://localhost:8000/api/newsfeed/newsitems/?page=2",
    //   "previous": null,
    //   "results": [ ...news items... ]
    // }
    newsItems.value = response.data.results || [];
    totalItems.value = response.data.count || 0;
    totalPages.value = Math.ceil(totalItems.value / pageSize.value); // Calculate total pages
    currentPage.value = page;

    if (newsItems.value.length === 0 && totalItems.value > 0 && page > 1) {
        // If current page has no items but there are items in total (e.g. after deleting last item on a page)
        // go to previous page or first page.
        handlePageChange(Math.max(1, page -1));
    }


  } catch (err) {
    console.error('Error fetching news items:', err);
    error.value = err.message || 'Failed to load news items.';
    if (err.response) {
      // More specific error from API
      error.value += ` (Status: ${err.response.status})`;
    }
    newsItems.value = []; // Clear items on error
    totalItems.value = 0;
    totalPages.value = 1;
  } finally {
    isLoading.value = false;
  }
}

onMounted(() => {
  fetchNews(currentPage.value);
});

function handleDateChange() {
  currentPage.value = 1; // Reset to first page when date changes
  fetchNews(currentPage.value);
}

function handlePageChange(newPage) {
  if (newPage >= 1 && newPage <= totalPages.value) {
    fetchNews(newPage);
  }
}

// Optional: Watch for changes in selectedDate if you prefer that over @change
// watch(selectedDate, () => {
//   handleDateChange();
// });

// Helper to format date if needed, though often done by libraries or backend
function formatDate(dateString) {
  if (!dateString) return 'N/A';
  const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
  return new Date(dateString).toLocaleDateString(undefined, options);
}

</script>

<style scoped>
.newsfeed-view {
  max-width: 900px;
  margin: 20px auto;
  padding: 20px;
  font-family: sans-serif;
}

.filters {
  margin-bottom: 20px;
  display: flex;
  gap: 10px;
  align-items: center;
}

.news-list {
  display: grid;
  gap: 20px;
}

.news-card {
  border: 1px solid #eee;
  padding: 15px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  background-color: #fff;
}

.news-card h2 {
  margin-top: 0;
  font-size: 1.4em;
  color: #333;
}

.news-card p {
  margin-bottom: 8px;
  color: #555;
  font-size: 0.95em;
  line-height: 1.5;
}
.news-card p.summary {
    color: #666;
    white-space: pre-wrap; /* Respect newlines in summary if any */
}
.news-card strong {
  color: #444;
}

.read-more {
  display: inline-block;
  margin-top: 10px;
  color: #007bff;
  text-decoration: none;
  font-weight: bold;
}
.read-more:hover {
  text-decoration: underline;
}

.loading, .error-message, .no-items {
  text-align: center;
  padding: 20px;
  font-size: 1.2em;
  color: #777;
}
.error-message {
    color: red;
}
</style>
