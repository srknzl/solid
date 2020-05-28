import Vue from "vue";
import Vuex from "vuex";
import auth from "solid-auth-client";
import solidFileClient from "solid-file-client";
import axios from "axios";
const $rdf = require("rdflib");

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
    user: "",
    users: [],
    userRoot: "",
    store: new $rdf.graph(),
  },
  mutations: {
    login(state, { user }) {
      state.loggedIn = true;
      state.user = user;
    },
    logout(state) {
      state.loggedIn = false;
    },
    updateUserUrl(state, { webId }) {
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
      commit("updateUserUrl", {
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
      const workflow_instance = `
      @prefix services: <http://web.cmpe.boun.edu.tr/soslab/ontologies/poc/services#> .
      @prefix poc: <http://soslab.cmpe.boun.edu.tr/ontologies/poc_core.ttl#> .
      @prefix dcterms: <http://purl.org/dc/terms/> .
      @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

      <> a poc:WorkflowInstance;
      poc:datatype <${workflow}>;
      poc:status "ongoing";
      dcterms:created "${new Date().toISOString()}"^^xsd:dateTime;
      dcterms:creator <${user}>;
      services:stepInstances <${randomString}_step_instances>.`;

      fc.postFile(
        state.userRoot +
          "/pocSolid/workflow_instances/workflow_instance_" +
          randomString,
        workflow_instance,
        "text/turtle"
      )
        .then((res) => console.log)
        .catch((err) => console.log);
      fc.createFolder(
        state.userRoot +
          "/pocSolid/workflow_instances/" +
          `${randomString}_step_instances`
      )
        .then((res) => console.log)
        .catch((err) => console.log);
    },
    async fetchAllUsers({ state, commit }) {
      const VCARD = new $rdf.Namespace("http://www.w3.org/2006/vcard/ns#");
      const pocUsers = state.store.sym(
        "https://serkanozel.me/pocUsers.ttl#poc"
      );
      const pocUsersDoc = pocUsers.doc();
      const fetcher = new $rdf.Fetcher(state.store);
      fetcher.load(pocUsersDoc).then(
        (response) => {
          const users = state.store.match(pocUsers, VCARD("hasMember"));
          commit("updateUsers", { users: users });
        },
        (err) => {
          console.log("Load failed " + err);
        }
      );
    },
    async initializeUser({ state }, { rootURI }) {
      const rootACL = `
      
        # Default ACL resource 

        @prefix acl: <http://www.w3.org/ns/auth/acl#>.
        @prefix foaf: <http://xmlns.com/foaf/0.1/>.

        <#owner>
        a acl:Authorization;

        acl:agent
        <${rootURI}/profile/card#me>;

        acl:accessTo <./>;
        acl:default <./>;

        acl:mode
        acl:Read, acl:Write, acl:Control.

        <#authorization>
        a               acl:Authorization;
        acl:accessTo    <${rootURI}/poc/>;
        acl:mode        acl:Read,
                        acl:Write;
        acl:agentGroup  <https://serkanozel.me/pocUsers.ttl#poc>.
      
      `;

      const fc = new solidFileClient(auth);
      fc.createFolder(rootURI + "/poc/")
        .then((res) => {
          fc.postFile(rootURI + "/poc/.acl", rootACL, "text/turtle").then(
            (res) => {
              console.log(res);
              axios
                .post(
                  "https://serkanozel.me/pocUsers.ttl",
                  {
                    userIRI: `${rootURI}/profile/card#me`,
                  },
                  {
                    headers: {
                      "Content-Type": "application/json",
                    },
                  }
                )
                .then((res) => {
                  console.log(res);
                })
                .catch((err) => {
                  console.log(err);
                });
            }
          );
        })
        .catch((err) => {
          console.log(err);
        });
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
          //dispatch("testAction", { rootURI: `${url.protocol}//${url.hostname}` })
        }
      });
    },
    logoutAction({ commit }) {
      auth.logout().then(() => {
        commit("logout");
      });
    },
  },
  modules: {},
});
