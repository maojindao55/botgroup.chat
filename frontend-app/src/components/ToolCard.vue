<template>
  <el-card class="tool-card" shadow="hover">
    <template #header v-if="tool.logo_url || tool.name">
      <div class="card-header">
        <el-image
          v-if="tool.logo_url"
          :src="tool.logo_url"
          fit="contain"
          class="tool-logo"
          :alt="`${tool.name} logo`"
        >
          <template #error>
            <div class="image-slot-error">Logo</div>
          </template>
        </el-image>
        <span class="tool-name">{{ tool.name }}</span>
      </div>
    </template>
    
    <p class="tool-description">{{ tool.short_description }}</p>
    
    <div v-if="tool.tags && tool.tags.length" class="tags-container">
      <el-tag
        v-for="tag in tool.tags.slice(0, 5)"
        :key="tag"
        type="info"
        size="small"
        class="tool-tag"
      >
        {{ tag }}
      </el-tag>
      <el-tooltip v-if="tool.tags.length > 5" content="More tags exist" placement="top">
         <el-tag type="info" size="small" class="tool-tag">...</el-tag>
      </el-tooltip>
    </div>
    
    <!-- The entire card can be made clickable by wrapping it in a <a> or a @click handler -->
    <!-- Or provide an explicit button -->
    <!-- Emitting an event is often cleaner than direct window.open here -->
    <el-button 
      type="primary" 
      plain 
      @click="handleVisitWebsite" 
      class="visit-button"
      title="Visit tool website"
    >
      Visit Website
    </el-button>
  </el-card>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue';
// Assuming Element Plus components are globally registered
// import { ElCard, ElImage, ElTag, ElButton, ElTooltip } from 'element-plus';

const props = defineProps({
  tool: {
    type: Object,
    required: true,
    default: () => ({
      id: null,
      name: 'Unknown Tool',
      logo_url: '',
      short_description: 'No description available.',
      website_url: '#',
      tags: [],
    })
  }
});

const emit = defineEmits(['tool-clicked']);

function handleVisitWebsite() {
  emit('tool-clicked', props.tool);
}
</script>

<style scoped>
.tool-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: 100%; /* Ensure cards in a grid have same height if needed */
  transition: box-shadow 0.3s ease-in-out;
}

.tool-card:hover {
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}

.card-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.tool-logo {
  width: 40px;
  height: 40px;
  border-radius: 4px;
  background-color: #f0f2f5; /* Placeholder bg for logo area */
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 0.7em;
  color: #909399;
}
.image-slot-error{
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    height: 100%;
    background: #f5f7fa;
    color: #c0c4cc;
    font-size: 12px;
}

.tool-name {
  font-weight: bold;
  font-size: 1.1em;
  color: #303133;
}

.tool-description {
  font-size: 0.9em;
  color: #606266;
  margin-top: 10px;
  margin-bottom: 15px;
  line-height: 1.5;
   /* Limit text to a few lines and add ellipsis if it overflows */
  display: -webkit-box;
  -webkit-line-clamp: 3; /* Number of lines to show */
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  min-height: calc(3 * 1.5em); /* Ensure space for 3 lines */
}

.tags-container {
  margin-bottom: 15px;
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.tool-tag {
  cursor: default;
}

.visit-button {
  width: 100%;
  margin-top: auto; /* Pushes button to the bottom if card is flex column */
}
</style>
