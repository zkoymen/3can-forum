import { createRouter, createWebHistory } from "vue-router";
import HomeView from "../views/HomeView.vue";
import ThreadView from "../views/ThreadView.vue";
import ProfileView from "../views/ProfileView.vue";
import SettingsView from "../views/SettingsView.vue";

export default createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", name: "home", component: HomeView },
    { path: "/thread/:id", name: "thread", component: ThreadView },
    {
      path: "/profile/:address",
      name: "profile",
      component: ProfileView,
    },
    { path: "/settings", name: "settings", component: SettingsView },
  ],
});
