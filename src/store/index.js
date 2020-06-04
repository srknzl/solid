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
    workflows: [],
    workflowInstances: [],
    lists: [],
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
    addList(state, { list, listName }) {
      state.lists.push({ list: list, listName: listName });
    },
    addQuad(state, { quad }) {
      state.store.addQuad(quad);
    },
    setAppUri(state, { appUri }) {
      state.appUri = appUri;
    },
    setAppDesc(state, { appDesc }) {
      state.appDesc = appDesc;
    },
    setCompositeDatatypes(state, { compositeDatatypes }) {
      state.compositeDatatypes = compositeDatatypes;
    },
    setDerivedDatatypes(state, { derivedDatatypes }) {
      state.derivedDatatypes = derivedDatatypes;
    },
    setWorkflows(state, { workflows }) {
      state.workflows = workflows;
    },
    setWorkflowInstances(state, { workflowInstances }) {
      state.workflowInstances = workflowInstances;
    }
  },
  actions: {
    async login({ dispatch, commit }, { vue }) {
      let session = await auth.currentSession();
      if (!session) session = await auth.login("https://solid.community");
      const url = new URL(session.webId);
      commit("login", {
        user: session.webId,
      });
      dispatch("initializeUser", {
        rootURI: `${url.protocol}//${url.hostname}`,
        webId: session.webId,
        vue: vue
      });
    },
    async createWorkflowInstance({ state }, { workflowURI, userWebID, vue }) {
      if (!state.loggedIn) {
        vue.$bvToast.toast("You should be logged in to create workflow.");
        return;
      }
      const fc = new solidFileClient(auth);
      const randomString = generateRandomString();
      const workflow_instance = constants.workflowInstanceACL(
        workflowURI,
        userWebID,
        randomString
      );
      try {
        const res = await fc.postFile(
          state.userRoot +
          "/poc/workflow_instances/workflow_instance_" +
          randomString,
          workflow_instance,
          "text/turtle"
        );
        const res2 = await fc.createFolder(
          state.userRoot +
          "/poc/workflow_instances/" +
          `${randomString}_step_instances`
        );
        vue.$bvToast.toast("Workflow instance created!");
      } catch (error) {
        vue.$bvToast.toast("Can't create workflow make sure to give permission to this website's url");
      }
    },
    async fetchAllUsers({ state, commit }) {
      // Updates all users info
      const res = await axios.get("https://serkanozel.me/pocUsers.ttl");
      //console.log(res.data);
      const parser = new N3.Parser({
        baseIRI: "http://serkanozel.me/pocUsers.ttl",
      });
      parser.parse(res.data, (err, quad, prefixes) => {
        if (err) console.log(err);
        if (quad) {
          commit("addQuad", { quad: quad });
        } else {
          const userQuads = state.store.getQuads(
            df.namedNode("http://serkanozel.me/pocUsers.ttl#poc"),
            df.namedNode(prefixes.vcard + "hasMember")
          );
          commit("updateUsers", { users: userQuads });
        }
      });
    },
    async initializeUser({ state, dispatch, commit }, { rootURI, webId, vue }) {
      commit("updateUserRootUrl", {
        webId: webId,
      });
      const rootACL = constants.rootACL(rootURI);

      const fc = new solidFileClient(auth);
      // Create poc folder along with good permissions if not exists.
      try {
        if (!(await fc.itemExists(rootURI + "/poc/"))) {
          const res = await fc.createFolder(rootURI + "/poc/");
          const res2 = await fc.postFile(
            rootURI + "/poc/.acl",
            rootACL,
            "text/turtle"
          );
        }
      } catch (error) {
        vue.$bvToast.toast("Could not create poc folder in your solid pod make sure you give permission to the app while you login");
      }

      // Bring all users info
      try {
        const res4 = await this.dispatch("fetchAllUsers");
      } catch (error) {
        vue.$bvToast.toast("Could not get all users info from http://serkanozel.me/pocUsers.ttl");
      }


      // If I am not in poc group, add me
      let meIncluded = false;

      state.users.forEach(u => {
        if (u.object.value == webId) meIncluded = true;
      });
      if (!meIncluded) {
        try {
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
        } catch (error) {
          vue.$bvToast.toast("Cannot add user to poc list at http://serkanozel.me/pocUsers.ttl. This is an important error app won't work. Make sure the site is working. Contact serkan.ozel@boun.edu.tr");
        }
      }


      // Fetch specification info

      try {
        await dispatch("fetchSpec");
      } catch (error) {
        vue.$bvToast.toast("Could not fetch specification info from http://134.122.65.239:3030/ds/query, make sure it is working");
      }
      // Write lists to user's pod

      let listQuads = state.store.getQuads(
        null,
        null,
        df.namedNode("http://web.cmpe.boun.edu.tr/soslab/ontologies/poc#List")
      );

      listQuads.forEach((x) => {
        const value = x.subject.value;
        const relatedQuads = state.store.getQuads(
          df.namedNode(x.subject.value),
          null,
          null
        );

        const writer = new N3.Writer({
          prefixes: {
            poc: "http://web.cmpe.boun.edu.tr/soslab/ontologies/poc#",
            dcterms: "http://purl.org/dc/terms/",
            rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
            xsd: "http://www.w3.org/2001/XMLSchema#",
            rdfs: "http://www.w3.org/2000/01/rdf-schema#",
            owl: "http://www.w3.org/2002/07/owl#",
            storytelling:
              "http://web.cmpe.boun.edu.tr/soslab/ontologies/storytelling#",
          },
        });
        writer.addQuads(relatedQuads);
        writer.addQuad(
          df.namedNode(x.subject.value),
          df.namedNode("http://purl.org/dc/terms/created"),
          df.literal(
            new Date().toISOString(),
            df.namedNode("http://www.w3.org/2001/XMLSchema#datetime")
          )
        );
        writer.addQuad(
          df.namedNode(x.subject.value),
          df.namedNode("http://purl.org/dc/terms/creator"),
          df.namedNode(state.user)
        );
        writer.addQuad(
          df.namedNode(x.subject.value),
          df.namedNode(
            "http://web.cmpe.boun.edu.tr/soslab/ontologies/poc#items"
          ),
          writer.list([])
        );
        writer.end(async (end, result) => {
          if (
            !(await fc.itemExists(
              rootURI +
              "/poc/data_instances/" +
              value.substring(value.lastIndexOf("#") + 1) +
              ".ttl"
            ))
          ) {
            await fc.createFile(
              rootURI +
              "/poc/data_instances/" +
              value.substring(value.lastIndexOf("#") + 1) +
              ".ttl",
              result,
              "text/turtle"
            );
          }
        });
      });

      // Fetch all lists from all users
      const listUris = listQuads.map(x => x.subject.value);
      state.lists = [];
      listUris.forEach((x) => {
        const list = [];
        const listName = x.substring(
          x.lastIndexOf("#") + 1
        );
        state.users.forEach(async (u) => {
          const url = new URL(u.object.value);
          const userRoot = `${url.protocol}//${url.hostname}`;
          try {
            const res = await fc.readFile(userRoot + "/poc/data_instances/" + listName + ".ttl");
            const parser = new N3.Parser();
            let headsOfLists = [];
            const miniStore = new N3.Store();
            parser.parse(res, (error, quad, prefixes) => {
              if (quad) {
                miniStore.addQuad(quad);
                /* if (quad.predicate.value == "http://www.w3.org/1999/02/22-rdf-syntax-ns#first" || quad.predicate.value == "http://www.w3.org/1999/02/22-rdf-syntax-ns#rest") {
                  console.log(JSON.stringify(quad));
                } */
                if (quad.predicate.value == "http://www.w3.org/1999/02/22-rdf-syntax-ns#first") {
                  headsOfLists.push(quad.subject.value);
                }
              } else {
                // Filter out the ones that are rest of some node to find real head of lists
                headsOfLists = headsOfLists.filter(item => {
                  return miniStore.getQuads(null, df.namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#rest"), df.blankNode(item)).length == 0;
                });
                headsOfLists.forEach(x => {
                  let current = x;
                  let quads = miniStore.getQuads(df.blankNode(current), df.namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#first"), null);
                  while (quads.length > 0 && quads[0].object.value != "http://www.w3.org/1999/02/22-rdf-syntax-ns#nil") {
                    const obj = quads[0].object;
                    obj["from"] = u.object.value;
                    list.push(obj);
                    let rest = miniStore.getQuads(df.blankNode(current), df.namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#rest"), null);
                    current = rest[0].object.value;
                    quads = miniStore.getQuads(df.blankNode(current), df.namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#first"), null);
                  }
                });
              }
            });

          } catch (error) {
            vue.$bvToast.toast(`Can't read ${userRoot + "/poc/data_instances/" + listName + ".ttl"}`);
            console.log(error);
          }
        });
        commit("addList", {
          listName: "http://web.cmpe.boun.edu.tr/soslab/ontologies/poc#" + listName,
          list: list
        });

      });

      // Fetch all workflows instances from all users

      state.workflowInstances = [];
      const workflowInstancesPool = []
      state.users.forEach(async (u, index) => {
        const url = new URL(u.object.value);
        const userRoot = `${url.protocol}//${url.hostname}`;
        let res;
        try {
          res = await fc.readFolder(userRoot + "/poc/workflow_instances/");
        } catch (error) {
          vue.$bvToast.toast("Cannot read " + userRoot + "/poc/workflow_instances/");
        }

        res.files.forEach(file => {
          workflowInstancesPool.push(file);
        });
      });
      commit("setWorkflowInstances", { workflowInstances: workflowInstancesPool })
    },
    async checkLogin({ commit, dispatch }, { vue }) {
      auth.trackSession((session) => {
        if (!session) {
          dispatch("login", { vue: vue });
        } else {
          const url = new URL(session.webId);
          commit("login", {
            user: session.webId,
          });
          dispatch("initializeUser", {
            rootURI: `${url.protocol}//${url.hostname}`,
            webId: session.webId,
            vue: vue
          });
        }
      });
    },
    async logoutAction({ commit }, { vue }) {
      try {
        await auth.logout();
        commit("logout");
      } catch (error) {
        vue.$bvToast.toast("Error while logout");
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

      // Preprocessing, from sparql endpoint result to store
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
        commit("addQuad", { quad: quad });
      });
      // Extract application name and description
      const ontologyQuad = state.store.getQuads(
        null,
        null,
        df.namedNode("http://www.w3.org/2002/07/owl#Ontology")
      );
      if (ontologyQuad.length > 0) {
        commit("setAppUri", { appUri: ontologyQuad[0].subject.value });
        const ontologyCommentQuad = state.store.getQuads(
          df.namedNode(state.appUri),
          df.namedNode("http://www.w3.org/2000/01/rdf-schema#comment"),
          null
        );
        commit("setAppDesc", {
          appDesc: ontologyCommentQuad.length > 0
            ? ontologyCommentQuad[0].object.value
            : ""
        })
      }
      // Composite Datatype Extraction
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
            fieldtype:
              fieldTypeQuad.length > 0 ? fieldTypeQuad[0].object.value : "",
            description:
              descriptionQuad.length > 0 ? descriptionQuad[0].object.value : "",
          };
        });
        return {
          uri: x.subject.value,
          datafields: dataFields,
        };
      });
      commit("setCompositeDatatypes", { compositeDatatypes: compositeDatatypeQuads });

      // Derived Datatypes Extraction
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
        const maxFrameWidth = state.store.getQuads(
          df.namedNode(x.subject.value),
          df.namedNode(
            "http://web.cmpe.boun.edu.tr/soslab/ontologies/poc#maxFrameWidth"
          ),
          null
        );
        const minFrameWidth = state.store.getQuads(
          df.namedNode(x.subject.value),
          df.namedNode(
            "http://web.cmpe.boun.edu.tr/soslab/ontologies/poc#minFrameWidth"
          ),
          null
        );
        const maxFrameHeight = state.store.getQuads(
          df.namedNode(x.subject.value),
          df.namedNode(
            "http://web.cmpe.boun.edu.tr/soslab/ontologies/poc#maxFrameHeight"
          ),
          null
        );
        const minFrameHeight = state.store.getQuads(
          df.namedNode(x.subject.value),
          df.namedNode(
            "http://web.cmpe.boun.edu.tr/soslab/ontologies/poc#minFrameHeight"
          ),
          null
        );
        const maxTrackLength = state.store.getQuads(
          df.namedNode(x.subject.value),
          df.namedNode(
            "http://web.cmpe.boun.edu.tr/soslab/ontologies/poc#maxTrackLength"
          ),
          null
        );
        const minTrackLength = state.store.getQuads(
          df.namedNode(x.subject.value),
          df.namedNode(
            "http://web.cmpe.boun.edu.tr/soslab/ontologies/poc#minTrackLength"
          ),
          null
        );
        const maxFileSize = state.store.getQuads(
          df.namedNode(x.subject.value),
          df.namedNode(
            "http://web.cmpe.boun.edu.tr/soslab/ontologies/poc#maxFileSize"
          ),
          null
        );
        const minFileSize = state.store.getQuads(
          df.namedNode(x.subject.value),
          df.namedNode(
            "http://web.cmpe.boun.edu.tr/soslab/ontologies/poc#minFileSize"
          ),
          null
        );
        const scaleWidth = state.store.getQuads(
          df.namedNode(x.subject.value),
          df.namedNode(
            "http://web.cmpe.boun.edu.tr/soslab/ontologies/poc#scaleWidth"
          ),
          null
        );
        const scaleHeight = state.store.getQuads(
          df.namedNode(x.subject.value),
          df.namedNode(
            "http://web.cmpe.boun.edu.tr/soslab/ontologies/poc#scaleHeight"
          ),
          null
        );
        const maxSize = state.store.getQuads(
          df.namedNode(x.subject.value),
          df.namedNode(
            "http://web.cmpe.boun.edu.tr/soslab/ontologies/poc#maxSize"
          ),
          null
        );

        return {
          uri: x.subject.value,
          baseDatatype:
            baseDatatypeQuad.length > 0 ? baseDatatypeQuad[0].object.value : "",
          limitations: {
            maxFrameWidth:
              maxFrameWidth.length > 0 ? maxFrameWidth[0].object.value : "",
            minFrameWidth:
              minFrameWidth.length > 0 ? minFrameWidth[0].object.value : "",
            maxFrameHeight:
              maxFrameHeight.length > 0 ? maxFrameHeight[0].object.value : "",
            minFrameHeight:
              minFrameHeight.length > 0 ? minFrameHeight[0].object.value : "",
            maxTrackLength:
              maxTrackLength.length > 0 ? maxTrackLength[0].object.value : "",
            minTrackLength:
              minTrackLength.length > 0 ? minTrackLength[0].object.value : "",
            maxFileSize:
              maxFileSize.length > 0 ? maxFileSize[0].object.value : "",
            minFileSize:
              minFileSize.length > 0 ? minFileSize[0].object.value : "",
            scaleWidth: scaleWidth.length > 0 ? scaleWidth[0].object.value : "",
            scaleHeight:
              scaleHeight.length > 0 ? scaleHeight[0].object.value : "",
            maxSize: maxSize.length > 0 ? maxSize[0].object.value : "",
          },
        };
      });
      commit("setDerivedDatatypes", { derivedDatatypes: derivedDatatypeQuads });

      // Workflows Extraction
      let workflowQuads = state.store.getQuads(
        null,
        null,
        df.namedNode(
          "http://web.cmpe.boun.edu.tr/soslab/ontologies/poc#Workflow"
        )
      );
      workflowQuads = workflowQuads.map((x) => {
        const labelQuad = state.store.getQuads(
          df.namedNode(x.subject.value),
          df.namedNode("http://www.w3.org/2000/01/rdf-schema#label"),
          null
        );
        const descriptionQuad = state.store.getQuads(
          df.namedNode(x.subject.value),
          df.namedNode("http://purl.org/dc/terms/description"),
          null
        );
        return {
          uri: x.subject.value,
          description:
            descriptionQuad.length > 0 ? descriptionQuad[0].object.value : "",
          label: labelQuad.length > 0 ? labelQuad[0].object.value : "",
        };
      });
      commit("setWorkflows", { workflows: workflowQuads });
    },
    async deleteUserInfo({ state }, { vue }) {
      const fc = new solidFileClient(auth);
      try {
        await fc.deleteFolder(state.userRoot + "/poc/");
        vue.$bvToast.toast("All user info deleted");
      } catch (error) {
        vue.$bvToast.toast("Cannot delete user info");
      }
    }
  },
});
