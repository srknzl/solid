import Vue from "vue";
import Vuex from "vuex";
import auth from "solid-auth-client";
import solidFileClient from "solid-file-client";
import axios from "axios";
import constants from "./constants";
import qs from "querystring";

const N3 = require("n3");
const df = N3.DataFactory;

const poc = "http://web.cmpe.boun.edu.tr/soslab/ontologies/poc#";
const dcterms = "http://purl.org/dc/terms/";
const rdfs = "http://www.w3.org/2000/01/rdf-schema#";
const rdf = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
const applicationName = "storytelling"; // Application name, this is used to store the users in a graph named accordingly in the sparql server 
const appOntology = `http://web.cmpe.boun.edu.tr/soslab/ontologies/${applicationName}#`; // change to your application's uri 
const owl = "http://www.w3.org/2002/07/owl#";
const xsd = "http://www.w3.org/2001/XMLSchema#";
const vcard = "http://www.w3.org/2006/vcard/ns#";

const fusekiEndpoint = "http://134.122.65.239:3030"; // This is where the spec and users is stored actually 
const datasetName = "ds";
const specGraph = "http://poc.core"; // typically you do not need to change this
const groupURL = "https://serkanozel.me/pocUsers.ttl";

const addUsersGroupQuery = `
BASE <http://serkanozel.me/pocUsers.ttl>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX poc: <http://web.cmpe.boun.edu.tr/soslab/ontologies/poc#>
PREFIX vcard: <http://www.w3.org/2006/vcard/ns#>
PREFIX dc: <http://purl.org/dc/elements/1.1/>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
PREFIX acl:  <http://www.w3.org/ns/auth/acl#>

INSERT DATA {
GRAPH <http://${applicationName}.users> {
    <#poc> a                vcard:Group;
    vcard:hasUID     <urn:uuid:8831CBAD-1111-2222-8563-F0F4787E5398:ABGroup>;
    dc:created       "${new Date().toISOString()}"^^xsd:dateTime;
    dc:modified      "${new Date().toISOString()}"^^xsd:dateTime.
  }
}
`;




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
    fetching: true
  },
  mutations: {
    login(state, { user }) {
      state.loggedIn = true;
      state.user = user;
    },
    setFetchingFalse(state) {
      state.fetching = false;
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
    async init({ dispatch, commit }, { vue }) {
      // check if users graph exists in the fuseki database
      try {
        const res = await axios.get(groupURL);
        const miniStore = new N3.Store();
        const parser = new N3.Parser();
        parser.parse(res.data, async (err, quad, prefixes) => {
          if (quad) {
            miniStore.addQuad(quad);
          } else {
            if (miniStore.size == 0) {
              const data = {
                update: addUsersGroupQuery
              };
              try {
                const resp = await axios.post(fusekiEndpoint + `/${datasetName}/update`, qs.stringify(data));
              } catch (error) {
                vue.$bvToast.toast("An error occured while trying to create user group, check fuseki server is up");
              }
            }
            dispatch("checkLogin", { vue: vue });

          }
        });
      } catch (error) {
        vue.$bvToast.toast("Error while initialize " + JSON.stringify(error));
      }

    },
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
    async createWorkflowInstance({ state, dispatch }, { workflowURI, userWebID, vue }) {
      if (!state.loggedIn) {
        vue.$bvToast.toast("You should be logged in to create workflow.");
        return;
      }
      const fc = new solidFileClient(auth);
      const randomString = generateRandomString();
      const workflow_instance = constants.workflowInstanceTTL(
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
        const stepsQuads = state.store.getQuads(df.namedNode(workflowURI), df.namedNode(poc + "step"), null);
        for (const q of stepsQuads) {
          const stepURI = q.object.value;
          const stepName = stepURI.substring(stepURI.lastIndexOf("#") + 1);
          const stepInstanceTTL = constants.stepInstanceTTL(stepURI, userWebID);

          await fc.postFile(
            state.userRoot +
            "/poc/workflow_instances/" +
            `${randomString}_step_instances/` + stepName + ".ttl",
            stepInstanceTTL,
            "text/turtle"
          );
        }

        const pipesQuads = state.store.getQuads(df.namedNode(workflowURI), df.namedNode(poc + "pipe"), null);
        const pipes = [];
        pipesQuads.forEach(el => {
          pipes.push(el.object.value);
        });

        for (const pipe of pipes) {
          //const isHuman = state.store.getQuads(df.namedNode(pipe), df.namedNode(rdf+"type"), df.namedNode(poc+"HumanPipe"));
          const isDirect = state.store.getQuads(df.namedNode(pipe), df.namedNode(rdf + "type"), df.namedNode(poc + "DirectPipe"));
          //const isPort = state.store.getQuads(df.namedNode(pipe), df.namedNode(rdf + "type"), df.namedNode(poc + "PortPipe"));
          //const isControl = state.store.getQuads(df.namedNode(pipe), df.namedNode(rdf + "type"), df.namedNode(poc + "ControlPipe"));
          if (isDirect.length == 0) {
            const pipeName = pipe.substring(pipe.lastIndexOf("#") + 1);
            await fc.postFile(
              state.userRoot +
              "/poc/workflow_instances/" +
              `${randomString}_step_instances/` + pipeName + ".ttl",
              "",
              "text/turtle"
            );
          }
        }
        dispatch("executeWorkflowInstance", { workflowURI: workflowURI, workflowInstanceID: randomString, vue: vue });
        vue.$bvToast.toast("Workflow instance created! Its execution started!");
      } catch (error) {
        vue.$bvToast.toast("Can't create workflow make sure to give permission to this website's url");
      }
    },
    async executeWorkflowInstance({ state }, { workflowURI, workflowInstanceID, vue }) {
      const fc = new solidFileClient(auth);

      if (!(await fc.itemExists(state.userRoot + "/poc/workflow_instances/workflow_instance_" + workflowInstanceID + ".ttl"))) {// check if workflow exists
        vue.$bvToast.toast("Workflow instance not found while trying to execute it!");
        return;
      }


      // sort the steps according to their dependencies and find a step that has zero dependency or only human pipes

      const stepQuads = state.store.getQuads(df.namedNode(workflowURI), df.namedNode(poc + "step"), null);

      // get pipes
      const res = await fc.readFolder(state.userRoot + "/poc/workflow_instances/" + workflowInstanceID + "_step_instances/");



      const pipes = [];
      res.files.forEach(file => {
        const url = file.url;
        // if there is a need for human input, return 
        if (file.url.includes("human_input")) {
          vue.$bvToast.toast("The workflow instance with id " + workflowInstanceID + " needs your input to be able execute, please go to profile and enter the necessary inputs");
          return;
        }
        const fileName = url.substring(url.lastIndexOf("/") + 1);
        const fileNameWithoutExtension = fileName.substring(0, fileName.length - 4);
        const isPipe = state.store.getQuads(df.namedNode(appOntology + fileNameWithoutExtension), df.namedNode(rdf + "type"), df.namedNode(poc + "Pipe"));
        if (isPipe.length > 0) {
          const isHumanPipe = state.store.getQuads(df.namedNode(appOntology + fileNameWithoutExtension), df.namedNode(rdf + "type"), df.namedNode(poc + "HumanPipe"));
          const isPortPipe = state.store.getQuads(df.namedNode(appOntology + fileNameWithoutExtension), df.namedNode(rdf + "type"), df.namedNode(poc + "PortPipe"));
          const isControlPipe = state.store.getQuads(df.namedNode(appOntology + fileNameWithoutExtension), df.namedNode(rdf + "type"), df.namedNode(poc + "ControlPipe"));
          const targetStep = state.store.getQuads(df.namedNode(appOntology + fileNameWithoutExtension), df.namedNode(poc + "targetStep"), null);
          if (isHumanPipe.length > 0) {
            pipes.push({
              name: fileNameWithoutExtension,
              type: "human",
              step: targetStep[0].object.value
            });
          } else if (isPortPipe.length > 0) {
            pipes.push({
              name: fileNameWithoutExtension,
              type: "port",
              step: targetStep[0].object.value
            });
          } else if (isControlPipe.length > 0) {
            pipes.push({
              name: fileNameWithoutExtension,
              type: "control",
              step: targetStep[0].object.value
            });
          } else {
            vue.$bvToast.toast("Warning! Pipe named " + fileNameWithoutExtension + " is not human, port or control pipe. ");
          }
        }
      });
      const steps = {};
      let counter = 0;
      for (const s of stepQuads) {
        // check if step status is not completed before adding to steps that will be considered to run 
        const stepName = s.object.value.substring(s.object.value.lastIndexOf("#") + 1);
        const res = await fc.readFile(state.userRoot + "/poc/workflow_instances/" + workflowInstanceID + "_step_instances/" + stepName + ".ttl");
        const miniStore = new N3.Store();
        const parser = new N3.Parser();
        parser.parse(res, (err, quad, prefixes) => {
          if (quad) {
            miniStore.addQuad(quad);
          } else {
            const status = miniStore.getQuads(null, df.namedNode(poc + "status"), null);
            if (status.length > 0) {
              const statusText = status[0].object.value;
              if (statusText != "completed") {
                steps[s.object.value] = {
                  humanDependency: 0,
                  executionDependency: 0
                };
              }
              counter++;

              if (counter == stepQuads.length) {
                pipes.forEach(pipe => {
                  console.log(pipe, steps[pipe.step]);
                  if (pipe.type == "port") {
                    steps[pipe.step].executionDependency++;
                  } else if (pipe.type == "human") {
                    steps[pipe.step].humanDependency++;
                  } else if (pipe.type == "control") {
                    steps[pipe.step].executionDependency++;
                  } else {
                    vue.$bvToast.toast("Warning a pipe named " + pipe.name + " has a wrong type! Not port, human and control");
                  }
                });

                let continueExecution = true;
                // stop when a human step is selected to run, in this case create human_input_${pipeName} file in the step
                // instances folder. Using the pipeName extract what is needed to be inputted by the user and display the 
                // necessary forms to the user. 

                while (continueExecution) {
                  // check if there is a step with no dependency and execute it
                  let stepToRun = "";
                  for (let key in steps) {
                    if (steps[key].humanDependency == 0 && steps[key].executionDependency == 0) {
                      stepToRun = key;
                      break;
                    }
                  }
                  if (stepToRun == "") { // there is not a step to run directly 
                    for (let key in steps) {
                      if (steps[key].executionDependency == 0) {
                        stepToRun = key;
                        break;
                      }
                    }
                  }
                  if (stepToRun == "") {
                    vue.$bvToast.toast("Workflow is malformed as there are not any step to be able to run! Possibly there is a cycle in the workflow.");
                    return;
                  }
                  // stepToRun holds step URI like appOntology:S0
                  // todo: startExecution 
                  console.log(stepToRun);
                  continueExecution = false;

                }
              }



            } else {
              vue.$bvToast.toast(`Warning a step named ${s.object.value} in workflow instance ${workflowInstanceID} does not have status`);
              return;
            }
          }
        });
      }



    },
    async fetchAllUsers({ state, commit }) {
      // Updates all users info
      const res = await axios.get(groupURL);
      const parser = new N3.Parser({
        baseIRI: `http://serkanozel.me/pocUsers.ttl`,
      });
      parser.parse(res.data, (err, quad, prefixes) => {
        if (err) console.log(err);
        if (quad) {
          commit("addQuad", { quad: quad });
        } else {
          const userQuads = state.store.getQuads(
            df.namedNode(`http://serkanozel.me/pocUsers.ttl#poc`),
            df.namedNode(vcard + "hasMember")
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
        await dispatch("fetchAllUsers");
      } catch (error) {
        console.log(error);
        vue.$bvToast.toast(`Could not get all users info from group server`);
      }


      // If the user is not in the poc group, add her

      let meIncluded = false;

      state.users.forEach(u => {
        if (u.object.value == webId) meIncluded = true;
      });
      if (!meIncluded) {
        try {

          const data = {
            update: `
            BASE <http://serkanozel.me/pocUsers.ttl>
            PREFIX vcard: <http://www.w3.org/2006/vcard/ns#>

            INSERT DATA {
              <#poc> vcard:hasMember <${webId}>
            }
            `
          };
          await axios.post(
            fusekiEndpoint + `/${datasetName}/update`,
            qs.stringify(data),
            {
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
              }
            }
          );
        } catch (error) {
          vue.$bvToast.toast(`Cannot add user to poc list from fuseki server. Make sure fuseki server works`);
        }
      }


      // Fetch specification info

      try {
        await dispatch("fetchSpec");
      } catch (error) {
        vue.$bvToast.toast(`Could not fetch specification info from ${fusekiEndpoint}/ds/query, make sure it is working`);
      }
      // Write lists to user's pod

      let listQuads = state.store.getQuads(
        null,
        null,
        df.namedNode(poc + "List")
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
            poc: poc,
            dcterms: dcterms,
            rdf: rdf,
            xsd: xsd,
            rdfs: rdfs,
            owl: owl,
            appOntology: appOntology
          },
        });
        writer.addQuads(relatedQuads);
        writer.addQuad(
          df.namedNode(x.subject.value),
          df.namedNode(dcterms + "created"),
          df.literal(
            new Date().toISOString(),
            df.namedNode(xsd + "datetime")
          )
        );
        writer.addQuad(
          df.namedNode(x.subject.value),
          df.namedNode(dcterms + "creator"),
          df.namedNode(state.user)
        );
        writer.addQuad(
          df.namedNode(x.subject.value),
          df.namedNode(
            poc + "items"
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
                /* if (quad.predicate.value == rdf+"first" || quad.predicate.value == rdf+"rest") {
                  console.log(JSON.stringify(quad));
                } */
                if (quad.predicate.value == rdf + "first") {
                  headsOfLists.push(quad.subject.value);
                }
              } else {
                // Filter out the ones that are rest of some node to find real head of lists
                headsOfLists = headsOfLists.filter(item => {
                  return miniStore.getQuads(null, df.namedNode(rdf + "rest"), df.blankNode(item)).length == 0;
                });
                headsOfLists.forEach(x => {
                  let current = x;
                  let quads = miniStore.getQuads(df.blankNode(current), df.namedNode(rdf + "first"), null);
                  while (quads.length > 0 && quads[0].object.value != rdf + "nil") {
                    const obj = quads[0].object;
                    obj["from"] = u.object.value;
                    list.push(obj);
                    let rest = miniStore.getQuads(df.blankNode(current), df.namedNode(rdf + "rest"), null);
                    current = rest[0].object.value;
                    quads = miniStore.getQuads(df.blankNode(current), df.namedNode(rdf + "first"), null);
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
          listName: poc + listName,
          list: list
        });

      });

      // Fetch all workflows instances from all users

      state.workflowInstances = [];
      const workflowInstancesPool = [];

      state.users.forEach(async (u, index) => {
        const url = new URL(u.object.value);
        const userRoot = `${url.protocol}//${url.hostname}`;
        let res;
        try {
          res = await fc.readFolder(userRoot + "/poc/workflow_instances/");
        } catch (error) {
          console.log(userRoot + " does not have any workflow yet");
          //vue.$bvToast.toast("Cannot read " + userRoot + "/poc/workflow_instances/");
        }

        res.files.forEach(async (file) => {
          const fc = new solidFileClient(auth);
          const res = await fc.readFile(file.url);
          const parser = new N3.Parser({
            baseIRI: file.url,
          });
          const miniStore = new N3.Store();
          parser.parse(res, (err, quad, prefixes) => {
            if (err) console.log(err);
            if (quad) {
              miniStore.addQuad(quad);
            } else {
              const datatypeQuads = miniStore.getQuads(
                df.namedNode(file.url),
                df.namedNode(poc + "datatype"),
                null
              );
              workflowInstancesPool.push({ ...file, datatype: datatypeQuads[0].object.value });
            }
          });
        });
      });
      commit("setWorkflowInstances", { workflowInstances: workflowInstancesPool });

      commit("setFetchingFalse");
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
      const res = await axios.get(
        fusekiEndpoint + "/ds/query",
        {
          params: {
            query: `SELECT ?s ?p ?o WHERE { GRAPH<${specGraph}>{ ?s ?p ?o}}`,
          },
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          }
        }
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
        df.namedNode(owl + "Ontology")
      );
      if (ontologyQuad.length > 0) {
        commit("setAppUri", { appUri: ontologyQuad[0].subject.value });
        const ontologyCommentQuad = state.store.getQuads(
          df.namedNode(state.appUri),
          df.namedNode(rdfs + "comment"),
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
          poc + "CompositeDatatype"
        )
      );

      compositeDatatypeQuads = compositeDatatypeQuads.map((x) => {
        let dataFields = state.store.getQuads(
          df.namedNode(x.subject.value),
          df.namedNode(
            poc + "dataField"
          ),
          null
        );
        dataFields = dataFields.map((y) => {
          const fieldTypeQuad = state.store.getQuads(
            df.namedNode(y.object.value),
            df.namedNode(
              poc + "fieldType"
            ),
            null
          );
          const descriptionQuad = state.store.getQuads(
            df.namedNode(y.object.value),
            df.namedNode(dcterms + "description"),
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
          poc + "DerivedDatatype"
        )
      );
      derivedDatatypeQuads = derivedDatatypeQuads.map((x) => {
        const baseDatatypeQuad = state.store.getQuads(
          df.namedNode(x.subject.value),
          df.namedNode(
            poc + "baseDatatype"
          ),
          null
        );
        const maxFrameWidth = state.store.getQuads(
          df.namedNode(x.subject.value),
          df.namedNode(
            poc + "maxFrameWidth"
          ),
          null
        );
        const minFrameWidth = state.store.getQuads(
          df.namedNode(x.subject.value),
          df.namedNode(
            poc + "minFrameWidth"
          ),
          null
        );
        const maxFrameHeight = state.store.getQuads(
          df.namedNode(x.subject.value),
          df.namedNode(
            poc + "maxFrameHeight"
          ),
          null
        );
        const minFrameHeight = state.store.getQuads(
          df.namedNode(x.subject.value),
          df.namedNode(
            poc + "minFrameHeight"
          ),
          null
        );
        const maxTrackLength = state.store.getQuads(
          df.namedNode(x.subject.value),
          df.namedNode(
            poc + "maxTrackLength"
          ),
          null
        );
        const minTrackLength = state.store.getQuads(
          df.namedNode(x.subject.value),
          df.namedNode(
            poc + "minTrackLength"
          ),
          null
        );
        const maxFileSize = state.store.getQuads(
          df.namedNode(x.subject.value),
          df.namedNode(
            poc + "maxFileSize"
          ),
          null
        );
        const minFileSize = state.store.getQuads(
          df.namedNode(x.subject.value),
          df.namedNode(
            poc + "minFileSize"
          ),
          null
        );
        const scaleWidth = state.store.getQuads(
          df.namedNode(x.subject.value),
          df.namedNode(
            poc + "scaleWidth"
          ),
          null
        );
        const scaleHeight = state.store.getQuads(
          df.namedNode(x.subject.value),
          df.namedNode(
            poc + "scaleHeight"
          ),
          null
        );
        const maxSize = state.store.getQuads(
          df.namedNode(x.subject.value),
          df.namedNode(
            poc + "maxSize"
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
          df.namedNode(rdfs + "label"),
          null
        );
        const descriptionQuad = state.store.getQuads(
          df.namedNode(x.subject.value),
          df.namedNode(dcterms + "description"),
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
    },
    async deleteAllWorkflowInstances({ state }, { vue }) {
      const fc = new solidFileClient(auth);
      try {
        await fc.deleteFolder(state.userRoot + "/poc/workflow_instances/");
        vue.$bvToast.toast("All user workflow instances deleted");
      } catch (error) {
        vue.$bvToast.toast("Cannot delete user workflow instances");
      }
    }
  },
});
