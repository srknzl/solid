import Vue from "vue";
import Vuex from "vuex";
import auth from "solid-auth-client";
import solidFileClient from "solid-file-client";
import axios from "axios";
import constants from "./constants";
import qs from "querystring";
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
    store: new N3.Store(), // holds the spec,
    compositeDatatypes: [],
    derivedDatatypes: [],
    appUri: "",
    appDesc: "",
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
    async fetchSpec({ state, commit }) {
      const data = {
        query: "SELECT ?s ?p ?o WHERE { GRAPH<http://poc.core>{ ?s ?p ?o}}",
      };
      const res = await axios.post(
        "http://134.122.65.239:3030/ds/query",
        qs.stringify(data)
      );

      // Preprocessing, from sparql result to store
      res.data.results.bindings.forEach((x) => {
        let s, p, o;
        if (x.s.type == "uri") {
          s = df.namedNode(x.s.value);
        } else if (x.s.type == "literal") {
          if (x.s.datatype) {
            s = df.literal(x.s.value, df.namedNode(x.s.datatype));
          } else if (x.s["xml:lang"]) {
            s = df.literal(x.s.value, x.s["xml:lang"]);
          } else {
            s = df.literal(x.s.value);
          }
        } else if (x.s.type == "bnode") {
          s = df.blankNode(x.s.value);
        }
        if (x.p.type == "uri") {
          p = df.namedNode(x.p.value);
        } else if (x.p.type == "literal") {
          if (x.p.datatype) {
            p = df.literal(x.p.value, df.namedNode(x.p.datatype));
          } else if (x.p["xml:lang"]) {
            p = df.literal(x.p.value, x.p["xml:lang"]);
          } else {
            p = df.literal(x.p.value);
          }
        } else if (x.p.type == "bnode") {
          p = df.blankNode(x.p.value);
        }
        if (x.o.type == "uri") {
          o = df.namedNode(x.o.value);
        } else if (x.o.type == "literal") {
          if (x.o.datatype) {
            o = df.literal(x.o.value, df.namedNode(x.o.datatype));
          } else if (x.o["xml:lang"]) {
            o = df.literal(x.o.value, x.o["xml:lang"]);
          } else {
            o = df.literal(x.o.value);
          }
        } else if (x.o.type == "bnode") {
          o = df.blankNode(x.o.value);
        }
        const quad = df.quad(s, p, o);
        state.store.addQuad(quad);
      });
      // Extract application name and description
      const ontologyQuad = state.store.getQuads(
        null,
        null,
        df.namedNode("http://www.w3.org/2002/07/owl#Ontology")
      );
      if (ontologyQuad.length > 0) {
        state.appUri = ontologyQuad[0].subject.value;
        const ontologyCommentQuad = state.store.getQuads(
          df.namedNode(state.appUri),
          df.namedNode("http://www.w3.org/2000/01/rdf-schema#comment"),
          null
        );
        if (ontologyCommentQuad.length > 0) {
          state.appDesc = ontologyCommentQuad[0].object.value;
        }
      }
      // Composite Datatype Extract
      let compositeDatatypeQuads = state.store.getQuads(
        null,
        null,
        df.namedNode(
          "http://web.cmpe.boun.edu.tr/soslab/ontologies/poc#CompositeDatatype"
        )
      );

      compositeDatatypeQuads = compositeDatatypeQuads.map((x) => {
        let dataFields = state.store.getQuads(
          df.namedNode(x.subject.value),
          df.namedNode(
            "http://web.cmpe.boun.edu.tr/soslab/ontologies/poc#dataField"
          ),
          null
        );
        dataFields = dataFields.map((y) => {
          const fieldTypeQuad = state.store.getQuads(
            df.namedNode(y.object.value),
            df.namedNode(
              "http://web.cmpe.boun.edu.tr/soslab/ontologies/poc#fieldType"
            ),
            null
          );
          const descriptionQuad = state.store.getQuads(
            df.namedNode(y.object.value),
            df.namedNode("http://purl.org/dc/terms/description"),
            null
          );
          return {
            name: y.subject.value,
            fieldtype: fieldTypeQuad[0].object.value,
            description: descriptionQuad[0].object.value,
          };
        });
        return {
          uri: x.subject.value,
          datafields: dataFields,
        };
      });
      state.compositeDatatypes = compositeDatatypeQuads;

      let derivedDatatypeQuads = state.store.getQuads(
        null,
        null,
        df.namedNode(
          "http://web.cmpe.boun.edu.tr/soslab/ontologies/poc#DerivedDatatype"
        )
      );
      derivedDatatypeQuads = derivedDatatypeQuads.map((x) => {
        const baseDatatypeQuad = state.store.getQuads(
          df.namedNode(x.subject.value),
          df.namedNode(
            "http://web.cmpe.boun.edu.tr/soslab/ontologies/poc#baseDatatype"
          ),
          null
        );
        const maxFrameWidth = state.store.getQuads(df.namedNode(x.subject.value), df.namedNode("http://web.cmpe.boun.edu.tr/soslab/ontologies/poc#maxFrameWidth"),null);
        const minFrameWidth = state.store.getQuads(df.namedNode(x.subject.value), df.namedNode("http://web.cmpe.boun.edu.tr/soslab/ontologies/poc#minFrameWidth"),null);
        const maxFrameHeight = state.store.getQuads(df.namedNode(x.subject.value), df.namedNode("http://web.cmpe.boun.edu.tr/soslab/ontologies/poc#maxFrameHeight"),null);
        const minFrameHeight = state.store.getQuads(df.namedNode(x.subject.value), df.namedNode("http://web.cmpe.boun.edu.tr/soslab/ontologies/poc#minFrameHeight"),null);
        const maxTrackLength = state.store.getQuads(df.namedNode(x.subject.value), df.namedNode("http://web.cmpe.boun.edu.tr/soslab/ontologies/poc#maxTrackLength"),null);
        const minTrackLength = state.store.getQuads(df.namedNode(x.subject.value), df.namedNode("http://web.cmpe.boun.edu.tr/soslab/ontologies/poc#minTrackLength"),null);
        const maxFileSize = state.store.getQuads(df.namedNode(x.subject.value), df.namedNode("http://web.cmpe.boun.edu.tr/soslab/ontologies/poc#maxFileSize"),null);
        const minFileSize = state.store.getQuads(df.namedNode(x.subject.value), df.namedNode("http://web.cmpe.boun.edu.tr/soslab/ontologies/poc#minFileSize"),null);
        const scaleWidth = state.store.getQuads(df.namedNode(x.subject.value), df.namedNode("http://web.cmpe.boun.edu.tr/soslab/ontologies/poc#scaleWidth"),null);
        const scaleHeight = state.store.getQuads(df.namedNode(x.subject.value), df.namedNode("http://web.cmpe.boun.edu.tr/soslab/ontologies/poc#scaleHeight"),null);
        const maxSize = state.store.getQuads(df.namedNode(x.subject.value), df.namedNode("http://web.cmpe.boun.edu.tr/soslab/ontologies/poc#maxSize"),null);

        return {
          uri: x.subject.value,
          baseDatatype: baseDatatypeQuad[0].object.value,
          limitations: {
            maxFrameWidth: maxFrameWidth.length>0 ? maxFrameWidth[0].object.value : "",
            minFrameWidth: minFrameWidth.length>0 ? minFrameWidth[0].object.value : "",
            maxFrameHeight: maxFrameHeight.length>0 ? maxFrameHeight[0].object.value : "",
            minFrameHeight: minFrameHeight.length>0 ? minFrameHeight[0].object.value : "",
            maxTrackLength: maxTrackLength.length>0 ? maxTrackLength[0].object.value : "",
            minTrackLength: minTrackLength.length>0 ? minTrackLength[0].object.value : "",
            maxFileSize: maxFileSize.length>0 ? maxFileSize[0].object.value : "",
            minFileSize: minFileSize.length>0 ? minFileSize[0].object.value : "",
            scaleWidth: scaleWidth.length>0 ? scaleWidth[0].object.value : "",
            scaleHeight: scaleHeight.length>0 ? scaleHeight[0].object.value : "",
            maxSize: maxSize.length>0 ? maxSize[0].object.value : ""
          }
        };
      });
      state.derivedDatatypes = derivedDatatypeQuads;
    },
  },
});
