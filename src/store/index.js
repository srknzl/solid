import Vue from 'vue'
import Vuex from 'vuex'
import auth from "solid-auth-client";

Vue.use(Vuex)

export default new Vuex.Store({
  state: {
    loggedIn: false,
    user: ""
  },
  mutations: {
    login(state, { user }) {
      state.loggedIn = true;
      state.user = user;
    },
    logout(state) {
      state.loggedIn = false;
    }
  },
  actions: {
    async popupLogin({ commit }) {
      let session = await auth.currentSession();
      let popupUri = "https://solid.community/common/popup.html";
      if (!session) session = await auth.popupLogin({ popupUri });
      // alert(`Logged in as ${session.webId}`);
      commit("login", {
        user: session.webId
      });
    },
    async checkLogin({ commit, dispatch }) {
      auth.trackSession(session => {
        if (!session) {
          dispatch("popupLogin");
        }
        else {
          // alert(`Logged in as ${session.webId}`);
          commit("login", { user: session.webId });
        }
      });
    },
    logoutAction({commit}) {
      auth.logout().then(() => {
        // alert("Goodbye!");
        commit("logout");
      });
    }
  },
  modules: {
  }
})
