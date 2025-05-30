<template>
  <div class="tools-view">
    <el-row :gutter="20">
      <!-- Sidebar for Categories -->
      <el-col :xs="24" :sm="8" :md="6" :lg="5" class="sidebar">
        <h2>Categories</h2>
        <el-menu
          :default-active="selectedCategorySlug || 'all'"
          class="category-menu"
          @select="handleCategorySelect"
        >
          <el-menu-item index="all">
            <el-icon><MenuIcon /></el-icon> <!-- Placeholder for actual Element Plus icon -->
            <span>All Tools</span>
          </el-menu-item>
          <el-menu-item v-for="category in categories" :key="category.slug" :index="category.slug">
            <span>{{ category.name }}</span>
          </el-menu-item>
        </el-menu>
      </el-col>

      <!-- Main Content Area for Tools -->
      <el-col :xs="24" :sm="16" :md="18" :lg="19" class="main-content">
        <div class="toolbar">
          <el-input
            v-model="searchTerm"
            placeholder="Search tools by name, description, or tags..."
            clearable
            @input="debouncedFetchTools"
            class="search-input"
          >
            <template #prepend>
              <el-button :icon="SearchIcon" /> <!-- Placeholder for actual Element Plus icon -->
            </template>
          </el-input>
          <!-- Add ordering select if needed -->
        </div>

        <div v-if="isLoading" class="loading">Loading tools...</div>
        <div v-if="error" class="error-message">Error loading tools: {{ error }}</div>
        <div v-if="!isLoading && !error && tools.length === 0" class="no-items">
          No tools found for the selected criteria.
        </div>

        <el-row :gutter="20" class="tools-grid" v-if="!isLoading && tools.length > 0">
          <el-col v-for="tool in tools" :key="tool.id" :xs="24" :sm="12" :md="8" :lg="6">
            <ToolCard :tool="tool" @tool-clicked="handleToolClick" />
          </el-col>
        </el-row>

        <el-pagination
          v-if="totalPages > 1 && !isLoading"
          background
          layout="prev, pager, next"
          :total="totalItems"
          :page-size="pageSize"
          :current-page="currentPage"
          @current-change="handlePageChange"
          class="pagination-controls"
        />
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { getToolCategories, getAiTools, incrementToolClickCount } from '../services/api';
import ToolCard from '../components/ToolCard.vue';
// Assuming Element Plus is globally registered. For icons, you might need:
// import { Menu as MenuIcon, Search as SearchIcon } from '@element-plus/icons-vue';

// Placeholder icons if not using @element-plus/icons-vue
const MenuIcon = 'Menu'; 
const SearchIcon = 'Search';

const categories = ref([]);
const selectedCategorySlug = ref(''); // Empty string for 'All Categories' initially
const tools = ref([]);
const currentPage = ref(1);
const totalPages = ref(1);
const totalItems = ref(0);
const pageSize = ref(12); // Adjust as needed for grid layout

const searchTerm = ref('');
const isLoading = ref(false);
const error = ref(null);
let searchDebounceTimer = null;

async function fetchCategories() {
  try {
    const response = await getToolCategories({ ordering: 'name' }); // Order categories by name
    categories.value = response.data.results || response.data || []; // Handle paginated or non-paginated response
  } catch (err) {
    console.error('Error fetching categories:', err);
    // categories.value = []; // Keep existing categories or clear them
  }
}

async function fetchTools(page = 1, keepCurrentPageOnEmpty = false) {
  isLoading.value = true;
  error.value = null;
  console.log(`Fetching tools: page=${page}, category=${selectedCategorySlug.value}, search=${searchTerm.value}`);
  try {
    const params = {
      page: page,
      page_size: pageSize.value,
    };
    if (selectedCategorySlug.value) {
      params.categories__slug = selectedCategorySlug.value;
    }
    if (searchTerm.value.trim()) {
      params.search = searchTerm.value.trim();
    }
    // params.ordering = '-created_at'; // Default or make it user-selectable

    const response = await getAiTools(params);
    tools.value = response.data.results || [];
    totalItems.value = response.data.count || 0;
    totalPages.value = Math.ceil(totalItems.value / pageSize.value);
    
    if (tools.value.length === 0 && totalItems.value > 0 && page > 1 && !keepCurrentPageOnEmpty) {
        // If current page has no items (e.g. after filter change), go to page 1
        currentPage.value = 1; 
        // Or, if you want to go to previous page: handlePageChange(Math.max(1, page -1));
    } else {
        currentPage.value = page;
    }

  } catch (err) {
    console.error('Error fetching tools:', err);
    error.value = err.message || 'Failed to load tools.';
    tools.value = [];
    totalItems.value = 0;
    totalPages.value = 1;
  } finally {
    isLoading.value = false;
  }
}

onMounted(() => {
  fetchCategories();
  fetchTools(currentPage.value);
});

function handleCategorySelect(slug) {
  selectedCategorySlug.value = (slug === 'all') ? '' : slug;
  currentPage.value = 1; // Reset to first page
  fetchTools(currentPage.value);
}

// Debounce search input
function debouncedFetchTools() {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    currentPage.value = 1; // Reset to first page
    fetchTools(currentPage.value);
  }, 500); // 500ms debounce
}

watch(searchTerm, (newValue, oldValue) => {
  // Optional: if you want instant search on clear or specific conditions
  // For now, debouncedFetchTools handles it via @input
  if(newValue.trim() === '' && oldValue.trim() !== '') {
      debouncedFetchTools(); // Fetch immediately if search term is cleared
  }
});


async function handleToolClick(tool) {
  try {
    await incrementToolClickCount(tool.id);
    console.log(`Click count incremented for ${tool.name}`);
    // Update tool.click_count locally if needed, or refetch data
    // const foundTool = tools.value.find(t => t.id === tool.id);
    // if (foundTool) foundTool.click_count++; 
  } catch (err) {
    console.error(`Error incrementing click count for ${tool.name}:`, err);
  }
  // Open website in a new tab
  if (tool.website_url) {
    window.open(tool.website_url, '_blank', 'noopener,noreferrer');
  }
}

function handlePageChange(newPage) {
   if (newPage >= 1 && (totalPages.value === 0 || newPage <= totalPages.value) ) { // Allow paging even if totalPages is 0 initially
    fetchTools(newPage, true); // keepCurrentPageOnEmpty = true to prevent page reset if current page becomes empty due to paging
  }
}

</script>

<style scoped>
.tools-view {
  padding: 20px;
}

.sidebar {
  background-color: #f8f9fa;
  padding: 15px;
  border-radius: 4px;
  height: calc(100vh - 40px); /* Example height, adjust as needed */
  overflow-y: auto;
}
.sidebar h2 {
  margin-top: 0;
  margin-bottom: 15px;
  font-size: 1.4em;
  color: #333;
}
.category-menu .el-menu-item {
  font-size: 1em;
}
.category-menu .el-menu-item.is-active {
  font-weight: bold;
  background-color: #e6f7ff; /* Element Plus active color or similar */
}

.main-content {
  padding-left: 20px; /* Add some space between sidebar and main content */
}

.toolbar {
  margin-bottom: 20px;
  display: flex;
  align-items: center;
}

.search-input {
  max-width: 400px;
}

.tools-grid {
  margin-top: 20px;
}

.tools-grid .el-col {
  margin-bottom: 20px; /* Space between rows of cards */
  display: flex; /* To make ToolCard take full height if cards vary */
}

.pagination-controls {
  margin-top: 30px;
  display: flex;
  justify-content: center;
}

.loading, .error-message, .no-items {
  text-align: center;
  padding: 30px;
  font-size: 1.2em;
  color: #777;
}
.error-message {
    color: red;
}
</style>
