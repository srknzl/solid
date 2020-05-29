import Vue from "vue";
import Vuex from "vuex";
import auth from "solid-auth-client";
import solidFileClient from "solid-file-client";
import axios from "axios";
import constants from "./constants";
const N3 = require("n3");
const df = N3.DataFactory;

Vue.use(Vuex);

const generateRandomString = () => {
  return Math.random()
    .toString(36)
    .replace(/[^a-z]+/g, "")
    .substr(0, 5);
};

export default new Vuex.Store({
  state: {
    loggedIn: false,
    user: "", // holds the webid of the user with card#me
    users: [],
    userRoot: "", // holds root hostname the webid of the user
    store: new N3.Store(),
  },
  mutations: {
    login(state, { user }) {
      state.loggedIn = true;
      state.user = user;
    },
    logout(state) {
      state.loggedIn = false;
    },
    updateUserRootUrl(state, { webId }) {
      const url = new URL(webId);
      state.userRoot = `${url.protocol}//${url.hostname}`;
    },
    updateUsers(state, { users }) {
      state.users = users;
    },
  },
  actions: {
    async login({ dispatch, commit }) {
      let session = await auth.currentSession();
      if (!session) session = await auth.login("https://solid.community");
      commit("updateUserRootUrl", {
        webId: session.webId,
      });
      const url = new URL(session.webId);
      commit("login", {
        user: session.webId,
      });
      dispatch("initializeUser", {
        rootURI: `${url.protocol}//${url.hostname}`,
      });
    },
    async createWorkflowInstance({ state }, { workflow, user }) {
      if (!state.loggedIn) {
        alert("You should be logged in to create workflow.");
        return;
      }
      const fc = new solidFileClient(auth);
      const randomString = generateRandomString();
      const workflow_instance = constants.workflowInstanceACL(
        workflow,
        user,
        randomString
      );
      try {
        const res = await fc.postFile(
          state.userRoot +
            "/pocSolid/workflow_instances/workflow_instance_" +
            randomString,
          workflow_instance,
          "text/turtle"
        );
        console.log(res);
        const res2 = await fc.createFolder(
          state.userRoot +
            "/pocSolid/workflow_instances/" +
            `${randomString}_step_instances`
        );
        console.log(res2);
      } catch (error) {
        console.log(error);
      }
    },
    async fetchAllUsers({ state, commit }) {
      // Updates all users info

      try {
        const res = await axios.get("https://serkanozel.me/pocUsers.ttl");
        console.log(res.data);
        const parser = new N3.Parser({
          baseIRI: "http://serkanozel.me/pocUsers.ttl",
        });
        parser.parse(res.data, (err, quad, prefixes) => {
          if (err) console.log(err);
          if (quad) {
            console.log(quad);
            state.store.addQuad(quad);
          } else {
            console.log("Prefixes used: ", prefixes);
            const userQuads = state.store.getQuads(
              df.namedNode("http://serkanozel.me/pocUsers.ttl#poc"),
              df.namedNode(prefixes.vcard + "hasMember")
            );
            commit("updateUsers", { users: userQuads });
          }
        });
      } catch (error) {
        console.log(error);
      }
    },
    async initializeUser({ state }, { rootURI }) {
      const rootACL = constants.rootACL(rootURI);

      const fc = new solidFileClient(auth);

      try {
        const res = await fc.readFolder(rootURI + "/poc/"); // if this folder does not exist then init user
        console.log(res);
      } catch (error) {
        // 404 user is not initialized before
        console.log(error);
        const res = await fc.createFolder(rootURI + "/poc/");
        console.log(res);
        const res2 = await fc.postFile(
          rootURI + "/poc/.acl",
          rootACL,
          "text/turtle"
        );
        console.log(res2);
        const res3 = await axios.post(
          "https://serkanozel.me/pocUsers.ttl",
          {
            userIRI: `${rootURI}/profile/card#me`,
          },
          {
            headers: {
              "Content-Type": "application/json",
            },
          }
        );
        console.log(res3);
        const res4 = await this.dispatch("fetchAllUsers");
        console.log(res4);
      }
    },
    async checkLogin({ commit, dispatch }) {
      auth.trackSession((session) => {
        if (!session) {
          dispatch("login");
        } else {
          const url = new URL(session.webId);
          commit("login", {
            user: session.webId,
          });
          dispatch("initializeUser", {
            rootURI: `${url.protocol}//${url.hostname}`,
          });
        }
      });
    },
    async logoutAction({ commit }) {
      try {
        await auth.logout();
        commit("logout");
      } catch (error) {
        console.log("Cannot logout");
      }
    },
  },
});
