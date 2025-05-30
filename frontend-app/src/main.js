import { createApp } from 'vue';
import App from './App.vue'; // Assuming you have a root App.vue
import router from './router'; // Import the router configuration

// Import Element Plus
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css'; // Import Element Plus styles

// Optional: Import Pinia if you set it up during project creation
// import { createPinia } from 'pinia';
// const pinia = createPinia();

const app = createApp(App);

app.use(router); // Use Vue Router
app.use(ElementPlus); // Use Element Plus

// if (pinia) {
//   app.use(pinia); // Use Pinia if initialized
// }

app.mount('#app');

// Note: A basic App.vue would typically look like this:
/*
<template>
  <div id="app">
    <header>
      <nav>
        <router-link to="/">Newsfeed</router-link> |
        <router-link to="/tools">AI Tools</router-link> // Example link
      </nav>
    </header>
    <main>
      <router-view />
    </main>
  </div>
</template>

<script setup>
// No specific script needed for a simple App.vue wrapper usually
</script>

<style>
/* Global styles or App.vue specific styles */
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #2c3e50;
}

header {
  background-color: #f8f9fa;
  padding: 15px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  margin-bottom: 20px;
}

nav {
  text-align: center;
}

nav a {
  font-weight: bold;
  color: #2c3e50;
  margin: 0 10px;
  text-decoration: none;
}

nav a.router-link-exact-active {
  color: #42b983;
}

main {
  padding: 0 15px;
}
</style>
*/
