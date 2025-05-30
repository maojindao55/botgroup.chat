import { createRouter, createWebHistory } from 'vue-router';
import NewsfeedView from '../views/NewsfeedView.vue';
import ToolsView from '../views/ToolsView.vue'; // Import ToolsView

const routes = [
  {
    path: '/',
    name: 'Newsfeed',
    component: NewsfeedView,
  },
  {
    path: '/tools',
    name: 'Tools',
    component: ToolsView, // Add the route for ToolsView
  },
  // Example of a detail view route if needed later:
  // {
  //   path: '/news/:id', // Example for news detail page
  //   name: 'NewsDetail',
  //   component: () => import('../views/NewsDetailView.vue'), // Lazy load
  //   props: true,
  // },
  // {
  //   path: '/tools/:id', // Example for tool detail page (if you create one)
  //   name: 'ToolDetail',
  //   component: () => import('../views/ToolDetailView.vue'), // Lazy load
  //   props: true,
  // }
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL || '/'), // import.meta.env.BASE_URL is for Vite
  routes,
});

export default router;
