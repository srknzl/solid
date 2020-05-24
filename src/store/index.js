import Vue from 'vue'
import Vuex from 'vuex'
import auth from "solid-auth-client";
import axios from 'axios';

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
      console.log("Woppps");
      axios.post("http://localhost:3000/api/registerUser", {
        userIRI: session.webId
      }).then(res => {
        console.log(res);
        console.log("Wopppsres");
      }).catch(err => {
        console.log(err);
      });
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
          axios.post("http://localhost:3000/api/registerUser", {
            userIRI: session.webId
          }).then(res => {
            console.log(res);
          }).catch(err => {
            console.log(err);
          });
          commit("login", { user: session.webId });
        }
      });
    },
    logoutAction({ commit }) {
      auth.logout().then(() => {
        commit("logout");
      });
    }
  },
  modules: {
  }
})
