import Vue from "vue";
import VueRouter from "vue-router";
import Poc from "../views/Poc.vue";

Vue.use(VueRouter);

const routes = [
  {
    path: "/",
    name: "Poc",
    component: Poc,
  },
  {
    path: "/about",
    name: "About",
    component: () =>
      import(/* webpackChunkName: "about" */ "../views/About.vue"),
  },
  {
    path: "/profile",
    name: "Profile",
    component: () =>
      import(/* webpackChunkName: "about" */ "../views/Profile.vue"),
  },
];

const router = new VueRouter({
  mode: "history",
  base: process.env.BASE_URL,
  routes,
});

export default router;
