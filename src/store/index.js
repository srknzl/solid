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
    fetching: true,
    execute: false,
    fc: null
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
    },
    startExecution(state) {
      state.execute = true;
    },
    stopExecution(state){
      state.execute = false;
    },
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
      //#region Create workflow instance, step instances, and control pipes of them in step instances
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
          // const isDirect = state.store.getQuads(df.namedNode(pipe), df.namedNode(rdf + "type"), df.namedNode(poc + "DirectPipe"));
          // const isPort = state.store.getQuads(df.namedNode(pipe), df.namedNode(rdf + "type"), df.namedNode(poc + "PortPipe"));
          const isControl = state.store.getQuads(df.namedNode(pipe), df.namedNode(rdf + "type"), df.namedNode(poc + "ControlPipe"));
          if (isControl.length > 0) {
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
        //#endregion
        dispatch("executeWorkflowInstance", { workflowURI: workflowURI, workflowInstanceID: randomString, vue: vue });
        vue.$bvToast.toast("Workflow instance created! Its execution started!");
      } catch (error) {
        vue.$bvToast.toast("Can't create workflow make sure to give permission to this website's url");
      }
    },
    async executeWorkflowInstance({ state, dispatch,commit }, { workflowURI, workflowInstanceID, vue }) {

      //#region Check if workflow instance exists
      const fc = new solidFileClient(auth);

      if (!(await fc.itemExists(state.userRoot + "/poc/workflow_instances/workflow_instance_" + workflowInstanceID + ".ttl"))) {// check if workflow exists
        vue.$bvToast.toast("Workflow instance not found while trying to execute it!");
        return;
      }
      //#endregion

      //#region Get all files inside step instances folder and return if human input is needed
      // sort the steps according to their dependencies and find a step that has zero dependency or only human pipes


      // get all files in step instances folder
      const res = await fc.readFolder(state.userRoot + "/poc/workflow_instances/" + workflowInstanceID + "_step_instances/");

      res.files.forEach(file => {
        // if there is a need for human input, return 
        if (file.url.includes("human_input")) {
          vue.$bvToast.toast("The workflow instance with id " + workflowInstanceID + " needs your input to be able execute, please go to profile and enter the necessary inputs");
          return;
        }
      });
      //#endregion

      //#region Get all pipes in an array in own format 
      const pipeQuads = state.store.getQuads(df.namedNode(workflowURI), df.namedNode(poc + "pipe"), null);
      const pipes = []; // will hold all pipes in our data format
      pipeQuads.forEach(quad => {
        const uri = quad.object.value;
        const pipeName = uri.substring(uri.lastIndexOf("#") + 1);
        const isPipe = state.store.getQuads(df.namedNode(appOntology + pipeName), df.namedNode(rdf + "type"), df.namedNode(poc + "Pipe"));
        if (isPipe.length > 0) {
          const isHumanPipe = state.store.getQuads(df.namedNode(appOntology + pipeName), df.namedNode(rdf + "type"), df.namedNode(poc + "HumanPipe"));
          const isPortPipe = state.store.getQuads(df.namedNode(appOntology + pipeName), df.namedNode(rdf + "type"), df.namedNode(poc + "PortPipe"));
          const isControlPipe = state.store.getQuads(df.namedNode(appOntology + pipeName), df.namedNode(rdf + "type"), df.namedNode(poc + "ControlPipe"));
          const isDirectPipe = state.store.getQuads(df.namedNode(appOntology + pipeName), df.namedNode(rdf + "type"), df.namedNode(poc + "DirectPipe"));
          const targetStep = state.store.getQuads(df.namedNode(appOntology + pipeName), df.namedNode(poc + "targetStep"), null);
          const pipe = {
            name: pipeName,
            step: targetStep[0].object.value
          };

          if (isHumanPipe.length > 0) {
            pipe.type = "human";
          } else if (isPortPipe.length > 0) {
            pipe.type = "port";
          } else if (isControlPipe.length > 0) {
            pipe.type = "control";
          } else if (isDirectPipe.length > 0) {
            pipe.type = "direct";
          } else {
            vue.$bvToast.toast("Warning! Pipe named " + pipeName + " is not human, port or control pipe. ");
            return;
          }
          pipes.push(pipe);
        }
      });
      //#endregion

      //#region Count all steps human and execution dependencies
      const stepQuads = state.store.getQuads(df.namedNode(workflowURI), df.namedNode(poc + "step"), null);
      const steps = {};
      for (const s of stepQuads) {
        // check if step status is not completed before adding to steps that will be considered to run 
        const stepName = s.object.value.substring(s.object.value.lastIndexOf("#") + 1);
        const res = await fc.readFile(state.userRoot + "/poc/workflow_instances/" + workflowInstanceID + "_step_instances/" + stepName + ".ttl");
        const miniStore = new N3.Store();
        const parser = new N3.Parser();
        const quads = parser.parse(res);
        miniStore.addQuads(quads);
        const status = miniStore.getQuads(null, df.namedNode(poc + "status"), null);
        if (status.length > 0) {
          const statusText = status[0].object.value;
          if (statusText != "completed") {
            steps[s.object.value] = {
              humanDependency: 0,
              executionDependency: 0
            };
          }
        } else {
          vue.$bvToast.toast(`Warning a step named ${s.object.value} in workflow instance ${workflowInstanceID} does not have status`);
          return;
        }
      }

      pipes.forEach(pipe => {
        if (pipe.type == "port") {
          steps[pipe.step].executionDependency++;
        } else if (pipe.type == "human") {
          steps[pipe.step].humanDependency++;
        } else if (pipe.type == "control") {
          steps[pipe.step].executionDependency++;
        } else if(pipe.type != "direct") {
          vue.$bvToast.toast("Warning a pipe named " + pipe.name + " has a wrong type! Not port, human, direct and control");
        }
      });
      //#endregion

      //#region Start execution loop 
      
      // stop when
      // 1. a human step needs to run, in this case create human_input_${stepName} file in the step instances folder.
      commit("startExecution");
      while (state.execute) {
        // check if there is a step with no dependency and execute it
        let stepToRun = "";
        for (let key in steps) {
          if (steps[key].humanDependency == 0 && steps[key].executionDependency == 0) {
            stepToRun = key;
            break;
          }
        }
        if (stepToRun == "") {
          for (let key in steps) {
            if (steps[key].executionDependency == 0) {
              stepToRun = key;
              break;
            }
          }
        }
        if (stepToRun == "") {
          vue.$bvToast.toast("Workflow is malformed as there are not any step to be able to run! Possibly there is a cycle in the workflow.");
          commit("stopExecution");
          return;
        }
        // stepToRun holds step URI like appOntology:S0

        // continueExecution = false;

        if (steps[stepToRun].humanDependency == 0) {  // Execute the step right away
          await dispatch("executeStepInstance", { vue: vue, stepToRun: stepToRun, workflowURI: workflowURI, workflowInstanceID: workflowInstanceID });
        } else {
          vue.$bvToast.toast("Your input is needed in order to continue this workflow. Please go to your profile page and add details.");
          const stepName = stepToRun.substring(stepToRun.lastIndexOf("#") + 1);
          await fc.postFile(state.userRoot + `/poc/workflow_instances/${workflowInstanceID}_step_instances/human_input_${stepName}.ttl`, "");
          commit("stopExecution");
        }
      }
      //#endregion


    },
    async executeStepInstance({ state, dispatch, commit }, { vue, stepToRun, workflowURI, workflowInstanceID }) {
      //#region Find out which step to execute, get input and output ports in our own format
      const isCreateStep = state.store.getQuads(df.namedNode(stepToRun), df.namedNode(rdf + "type"), df.namedNode(poc + "CreateStep"));
      const isDeleteStep = state.store.getQuads(df.namedNode(stepToRun), df.namedNode(rdf + "type"), df.namedNode(poc + "DeleteStep"));
      const isDisplayStep = state.store.getQuads(df.namedNode(stepToRun), df.namedNode(rdf + "type"), df.namedNode(poc + "DisplayStep"));
      const isEvaluateStep = state.store.getQuads(df.namedNode(stepToRun), df.namedNode(rdf + "type"), df.namedNode(poc + "EvaluateStep"));
      const isFilterStep = state.store.getQuads(df.namedNode(stepToRun), df.namedNode(rdf + "type"), df.namedNode(poc + "FilterStep"));
      const isGetStep = state.store.getQuads(df.namedNode(stepToRun), df.namedNode(rdf + "type"), df.namedNode(poc + "GetStep"));
      const isInsertStep = state.store.getQuads(df.namedNode(stepToRun), df.namedNode(rdf + "type"), df.namedNode(poc + "InsertStep"));
      const isModifyStep = state.store.getQuads(df.namedNode(stepToRun), df.namedNode(rdf + "type"), df.namedNode(poc + "ModifyStep"));
      const isRemoveStep = state.store.getQuads(df.namedNode(stepToRun), df.namedNode(rdf + "type"), df.namedNode(poc + "RemoveStep"));
      const isSaveStep = state.store.getQuads(df.namedNode(stepToRun), df.namedNode(rdf + "type"), df.namedNode(poc + "SaveStep"));
      const isSizeStep = state.store.getQuads(df.namedNode(stepToRun), df.namedNode(rdf + "type"), df.namedNode(poc + "SizeStep"));

      let inputPorts = state.store.getQuads(df.namedNode(stepToRun), df.namedNode(poc + "inputPort"), null);
      let outputPorts = state.store.getQuads(df.namedNode(stepToRun), df.namedNode(poc + "outputPort"), null);
      let flag = 0;
      inputPorts = inputPorts.map(quad => {
        const labelQuad = state.store.getQuads(df.namedNode(quad.object.value), df.namedNode(rdfs + "label"), null);
        if (labelQuad.length == 0) {
          vue.$bvToast.toast("The input port " + quad.object.value.substring(quad.object.value.lastIndexOf("#") + 1) + " does not have a label!");
          flag = 1;
        }
        return {
          uri: quad.object.value,
          name: quad.object.value.substring(quad.object.value.lastIndexOf("#") + 1),
          label: labelQuad[0].object.value
        }
      });
      if (flag) return;
      outputPorts = outputPorts.map(quad => {
        const labelQuad = state.store.getQuads(df.namedNode(quad.object.value), df.namedNode(rdfs + "label"), null);
        if (labelQuad.length == 0) {
          vue.$bvToast.toast("The output port " + quad.object.value.substring(quad.object.value.lastIndexOf("#") + 1) + " does not have a label!");
          flag = 1;
        }
        return {
          uri: quad.object.value,
          name: quad.object.value.substring(quad.object.value.lastIndexOf("#") + 1),
          label: labelQuad[0].object.value
        }
      });
      if (flag) return;
      //#endregion

      if (isCreateStep.length > 0) {
          //#region Validation
        const checklist = [0, 0, 0];
        if (inputPorts.length != 2) {
          vue.$bvToast.toast("The CreateStep " + stepToRun + " does not have exactly 2 input ports");
          return;
        }
        inputPorts.forEach(i => {
          if (i.label == "datatype") {
            checklist[0] = 1;
          } else if (i.label == "object") {
            checklist[1] = 1;
          }
        });
        if (outputPorts.length != 1) {
          vue.$bvToast.toast("The CreateStep " + stepToRun + " does not have exactly 1 output port");
          return;
        }
        outputPorts.forEach(i => {
          if (i.label == "result") {
            checklist[2] = 1;
          }
        });
        if (!checklist[0] || !checklist[1] || !checklist[2]) {
          vue.$bvToast.toast("The CreateStep " + stepToRun + " does not have ports labeled correctly");
          return;
        }
        else {
          //#endregion
          //#region Get ports and pipes of them 
          const datatypePort = inputPorts[0].label == "datatype" ? inputPorts[0] : inputPorts[1];
          const objectPort = inputPorts[0].label == "object" ? inputPorts[0] : inputPorts[1];
          const dataTypePipe = state.store.getQuads(null, df.namedNode(poc + "targetPort"), df.namedNode(datatypePort.uri));
          const objectPipe = state.store.getQuads(null, df.namedNode(poc + "targetPort"), df.namedNode(objectPort.uri));

          const fc = new solidFileClient(auth);

          if (dataTypePipe.length == 0 || objectPipe.length == 0) { // Check if there are pipes that come in to the ports 
            vue.$bvToast.toast("The CreateStep " + stepToRun + " does not have pipes that targets both datatype and object ports");
            return;
          }
          const datatypePipeURI = dataTypePipe[0].subject.value;
          const objectPipeURI = objectPipe[0].subject.value;
          //#endregion
          //#region Datatype Port
          const isDatatypePipeHumanPipe = state.store.getQuads(df.namedNode(datatypePipeURI), df.namedNode(rdf + "type", df.namedNode(poc + "HumanPipe")));
          const isDatatypePipeDirectPipe = state.store.getQuads(df.namedNode(datatypePipeURI), df.namedNode(rdf + "type", df.namedNode(poc + "DirectPipe")));
          const isDatatypePipeControlPipe = state.store.getQuads(df.namedNode(datatypePipeURI), df.namedNode(rdf + "type", df.namedNode(poc + "ControlPipe")));
          const isDatatypePipePortPipe = state.store.getQuads(df.namedNode(datatypePipeURI), df.namedNode(rdf + "type", df.namedNode(poc + "PortPipe")));

          const datatypePortDataLocation = state.userRoot + "/poc/workflow_instances/" + workflowInstanceID + "_step_instances/" + datatypePort.name + ".ttl";
          const objectPortDataLocation = state.userRoot + "/poc/workflow_instances/" + workflowInstanceID + "_step_instances/" + objectPort.name + ".ttl";

          let datatype;
          let object;
          // If datatype is entered by human it is stored directly in the step_instances folder 
          // If object is entered bu human, if it is a complex data there is a reference value binding in the step_instances folder to a data_instance in data_instances folder
          // If the object is a xsd datatype it is stored in step instances folder

          if (isDatatypePipeHumanPipe.length > 0) { // if it is human pipe the data should be in the pod of the user
            if (!(await fc.itemExists(datatypePortDataLocation))) {
              commit("stopExecution");
              vue.$bvToast.toast("The inputport " + datatypePort.name + " that should be entered by the human does not exists.");
              return;
            }
            const res = await fc.readFile(datatypePortDataLocation);
            const parser = new N3.Parser();
            const miniStore = new N3.Store();
            const quads = parser.parse(res);
            miniStore.addQuads(quads);
            const uriValueQuad = miniStore.getQuads(null, df.namedNode(poc + "uriValue"), null);
            const literalValueQuad = miniStore.getQuads(null, df.namedNode(poc + "literalValue"), null);
            if (uriValueQuad.length > 0) {
              datatype = uriValueQuad[0].object.value;
            } else if (literalValueQuad.length > 0) {
              vue.$bvToast.toast("Into inputport " + datatypePort.name + ", the datatype entered by human cannot be literal")
              commit("stopExecution");
              return;
            } else {
              vue.$bvToast.toast("Into inputport " + datatypePort.name + ", the datatype entered by human is possibly empty or malformed")
              commit("stopExecution");
              return;
            }

          } else if (isDatatypePipeControlPipe.length > 0) {
            vue.$bvToast.toast("Into inputport " + datatypePort.name + ", there is an control pipe which is illegal");
            commit("stopExecution");
            return;
          } else if (isDatatypePipeDirectPipe.length > 0) {
            const hasSourceURIValue = state.store.getQuads(df.namedNode(datatypePipeURI), df.namedNode(poc + "sourceUriValue"), null);
            const hasSourceLiteralValue = state.store.getQuads(df.namedNode(datatypePipeURI), df.namedNode(poc + "sourceLiteralValue"), null);
            if (hasSourceURIValue.length > 0) {
              datatype = hasSourceURIValue[0].object.value;
            } else if (hasSourceLiteralValue.length > 0) {
              vue.$bvToast.toast("The datatype port " + datatypePort.name + " has a direct pipe with a literal value which is wrong");
              commit("stopExecution");
              return;
            } else {
              vue.$bvToast.toast("The datatype port " + datatypePort.name + " has a direct pipe without a value");
              commit("stopExecution");
              return;
            }
          } else if (isDatatypePipePortPipe.length > 0) {
            // There should be a inputPort entry in the step instances folder. 
            if (!(await fc.itemExists(datatypePortDataLocation))) {
              vue.$bvToast.toast("The inputport " + datatypePort.name + " that should be created by automation does not exists");
              commit("stopExecution");
              return;
            }
            const res = await fc.readFile(datatypePortDataLocation);
            const parser = new N3.Parser();
            const miniStore = new N3.Store();
            const quads = parser.parse(res);
            miniStore.addQuads(quads);
            const uriValueQuad = miniStore.getQuads(null, df.namedNode(poc + "uriValue"), null);
            const literalValueQuad = miniStore.getQuads(null, df.namedNode(poc + "literalValue"), null);
            if (uriValueQuad.length > 0) {
              datatype = uriValueQuad[0].object.value;
            } else if (literalValueQuad.length > 0) {
              vue.$bvToast.toast("Into inputport " + datatypePort.name + ", the datatype entered by automation cannot be literal")
              commit("stopExecution");
              return;
            } else {
              vue.$bvToast.toast("Into inputport " + datatypePort.name + ", the datatype entered by automation is possibly empty or malformed")
              commit("stopExecution");
              return;
            }
          } else {
            vue.$bvToast.toast("The type of pipe " + datatypePipeURI + " is not humanpipe, control pipe, direct pipe or port pipe");
            commit("stopExecution");
            return;
          }
          //#endregion
          //#region Object Port
          const isObjectPipeHumanPipe = state.store.getQuads(df.namedNode(objectPipeURI), df.namedNode(rdf + "type", df.namedNode(poc + "HumanPipe")));
          const isObjectPipeDirectPipe = state.store.getQuads(df.namedNode(objectPipeURI), df.namedNode(rdf + "type", df.namedNode(poc + "DirectPipe")));
          const isObjectPipeControlPipe = state.store.getQuads(df.namedNode(objectPipeURI), df.namedNode(rdf + "type", df.namedNode(poc + "ControlPipe")));
          const isObjectPipePortPipe = state.store.getQuads(df.namedNode(objectPipeURI), df.namedNode(rdf + "type", df.namedNode(poc + "PortPipe")));


          if (isObjectPipeHumanPipe.length > 0) {
            if (!(await fc.itemExists(objectPortDataLocation))) {
              vue.$bvToast.toast("The inputport " + objectPort.name + " that should be entered by the human does not exists.");
              return;
            }
            const res = await fc.readFile(objectPortDataLocation);
            const parser = new N3.Parser();
            const miniStore = new N3.Store();
            const quads = parser.parse(res);
            miniStore.addQuads(quads);
            const uriValueQuad = miniStore.getQuads(null, df.namedNode(poc + "uriValue"), null);
            const literalValueQuad = miniStore.getQuads(null, df.namedNode(poc + "literalValue"), null);
            if (uriValueQuad.length > 0) {
              object = uriValueQuad[0].object.value;
              const datatypeCheck = state.store.getQuads(df.namedNode(object), df.namedNode(rdf + "type"), df.namedNode(datatype));
              if (datatypeCheck.length == 0) {
                vue.$bvToast.toast("The datatype of the port " + objectPort.name + " does not match the datatype of the datatype port " + datatypePort.name);
                return;
              }
            } else if (literalValueQuad.length > 0) {
              object = literalValueQuad[0].object.value;
              if (datatype != literalValueQuad[0].object.datatype.value) {
                vue.$bvToast.toast("The datatype of the port " + objectPort.name + " does not match the datatype of the datatype port " + datatypePort.name);
                return;
              }
            } else {
              vue.$bvToast.toast("Into inputport " + objectPort.name + ", the datatype entered by human is possibly empty or malformed")
              return;
            }
          } else if (isObjectPipeControlPipe.length > 0) {
            vue.$bvToast.toast("Into inputport " + datatypePort.name + ", there is an control pipe which is illegal");
            return;
          } else if (isObjectPipeDirectPipe.length > 0) {
            const hasSourceURIValue = state.store.getQuads(df.namedNode(objectPipeURI), df.namedNode(poc + "sourceUriValue"), null);
            const hasSourceLiteralValue = state.store.getQuads(df.namedNode(objectPipeURI), df.namedNode(poc + "sourceLiteralValue"), null);
            if (hasSourceURIValue.length > 0) {
              object = hasSourceURIValue[0].object.value;
            } else if (hasSourceLiteralValue.length > 0) {
              object = hasSourceLiteralValue[0].object.value;
              if (hasSourceLiteralValue[0].object.datatype.value != datatype) {
                vue.$bvToast.toast("The object port " + objectPort.name + " has a direct pipe with a literal value that does not match the datatype");
                return;
              }
            } else {
              vue.$bvToast.toast("The datatype port " + datatypePort.name + " has a direct pipe without a value");
              return;
            }
          } else if (isObjectPipePortPipe.length > 0) {
            if (!(await fc.itemExists(objectPortDataLocation))) {
              vue.$bvToast.toast("The inputport " + objectPort.name + " that should be entered by the automation does not exists.");
              return;
            }
            const res = await fc.readFile(objectPortDataLocation);
            const parser = new N3.Parser();
            const miniStore = new N3.Store();
            const quads = parser.parse(res);
            miniStore.addQuads(quads);
            const uriValueQuad = miniStore.getQuads(null, df.namedNode(poc + "uriValue"), null);
            const literalValueQuad = miniStore.getQuads(null, df.namedNode(poc + "literalValue"), null);
            if (uriValueQuad.length > 0) {
              object = uriValueQuad[0].object.value;
              const x = state.store.getQuads(df.namedNode(object), df.namedNode(rdf + "type"), df.namedNode(datatype));
              if (x.length == 0) {
                vue.$bvToast.toast("The datatype of the port " + objectPort.name + " does not match the datatype of the datatype port " + datatypePort.name);
                return;
              }
            } else if (literalValueQuad.length > 0) {
              object = literalValueQuad[0].object.value;
              if (datatype != literalValueQuad[0].object.datatype.value) {
                vue.$bvToast.toast("The datatype of the port " + objectPort.name + " does not match the datatype of the datatype port " + datatypePort.name);
                return;
              }
            } else {
              vue.$bvToast.toast("Into inputport " + objectPort.name + ", the datatype entered by automation is possibly empty or malformed")
              return;
            }
          } else {
            vue.$bvToast.toast("The type of pipe " + objectPipeURI + " is not humanpipe, control pipe, direct pipe or port pipe");
            return;
          }
          //#endregion
          //#region Handle output port and result
          const outputPort = outputPorts[0];

          // check if there is a portpipe whose source port is this port. In this case write to the input port at the other end of the pipe 
          // check if there is a control pipe coming out of this output port. Remove the pipes accordingly. 
          const pipesOriginateFromOutputPort = state.store.getQuads(null, df.namedNode(poc + "sourcePort"), df.namedNode(outputPort.uri));
          let valueBindingContent;
          if (datatype.startsWith(xsd)) {
            const datatypeName = datatype.substring(datatype.lastIndexOf("#") + 1);
            valueBindingContent = constants.literalValueBinding(object, datatypeName);
          } else {
            valueBindingContent = constants.URIValueBinding(object);
          }
          pipesOriginateFromOutputPort.forEach(async p => {
            const isPortPipe = state.store.getQuads(df.namedNode(p.subject.value), df.namedNode(rdf + "type"), df.namedNode(poc + "PortPipe"));
            const isUnconditionalPipe = state.store.getQuads(df.namedNode(p.subject.value), df.namedNode(rdf + "type"), df.namedNode(poc + "UnconditionalControlPipe"));
            const isTruePipe = state.store.getQuads(df.namedNode(p.subject.value), df.namedNode(rdf + "type"), df.namedNode(poc + "TruePipe"));
            const isFalsePipe = state.store.getQuads(df.namedNode(p.subject.value), df.namedNode(rdf + "type"), df.namedNode(poc + "FalsePipe"));

            if (isPortPipe.length > 0) {
              const targetPort = state.store.getQuads(df.namedNode(p.subject.value), df.namedNode(poc + "targetPort"), null);
              if (targetPort.length == 0) {
                vue.$bvToast.toast("Warning the pipe " + p.subject.value + " is a port pipe but does not have targetPort");
                commit("stopExecution");
                return;
              }
              const targetPortName = targetPort.object.value.substring(targetPort.object.value.lastIndexOf("#") + 1);
              await fc.postFile(`${state.userRoot}/poc/workflow_instances/${workflowInstanceID}_step_instances/${targetPortName}.ttl`, valueBindingContent);
            } else if (isUnconditionalPipe.length > 0) {
              const pipeName = p.subject.value.substring(p.subject.value.lastIndexOf("#") + 1);
              await fc.deleteFile(`${state.userRoot}/poc/workflow_instances/${workflowInstanceID}_step_instances/${pipeName}.ttl`);
            } else if (isTruePipe.length > 0) {
              const pipeName = p.subject.value.substring(p.subject.value.lastIndexOf("#") + 1);
              const datatype = datatype.substring(datatype.lastIndexOf("#") + 1);
              let dontDelete = false;
              if (datatype.startsWith(xsd)) {
                if (datatype == "string" && object == "") {
                  dontDelete = true;
                } else if (datatype == "boolean" && object == "false") {
                  dontDelete = true;
                } else if ((datatype == "float" || datatype == "double" || datatype == "decimal") && parseFloat(object)) {
                  dontDelete = true;
                } else if ((datatype == "integer" || datatype == "nonPositiveInteger" || datatype == "negativeInteger" || datatype == "unsignedInt" || datatype == "positiveInteger") && parseInt(object)) {
                  dontDelete = true;
                }
              }
              if (!dontDelete) {
                await fc.deleteFile(`${state.userRoot}/poc/workflow_instances/${workflowInstanceID}_step_instances/${pipeName}.ttl`);
              }
            } else if (isFalsePipe.length > 0) {
              const pipeName = p.subject.value.substring(p.subject.value.lastIndexOf("#") + 1);
              const datatype = datatype.substring(datatype.lastIndexOf("#") + 1);
              let deleteIt = false;
              if (datatype.startsWith(xsd)) {
                if (datatype == "string" && object == "") {
                  deleteIt = true;
                } else if (datatype == "boolean" && object == "false") {
                  deleteIt = true;
                } else if ((datatype == "float" || datatype == "double" || datatype == "decimal") && parseFloat(object)) {
                  deleteIt = true;
                } else if ((datatype == "integer" || datatype == "nonPositiveInteger" || datatype == "negativeInteger" || datatype == "unsignedInt" || datatype == "positiveInteger") && parseInt(object)) {
                  deleteIt = true;
                }
              }
              if (deleteIt) await fc.deleteFile(`${state.userRoot}/poc/workflow_instances/${workflowInstanceID}_step_instances/${pipeName}.ttl`);
            } else {
              vue.$bvToast.toast("Warning! The pipe " + p.subject.value + " has an invalid type!");
              commit("stopExecution");
              return;
            }
          });

          //#endregion
        }
      }
      else if (isDeleteStep.length > 0) {
        //#region Validation
        // A delete step has 1 inputport(object)
        const checklist = [0];
        if (inputPorts.length != 1) {
          vue.$bvToast.toast("The DeleteStep " + stepToRun + " does not have exactly 1 input port");
          commit("stopExecution");
          return;
        }
        inputPorts.forEach(i => {
          if (i.label == "object") {
            checklist[0] = 1;
          }
        });
        if (outputPorts.length != 0) {
          vue.$bvToast.toast("The DeleteStep " + stepToRun + " does not have exactly 0 output port");
          commit("stopExecution");
          return;
        }
        if (!checklist[0]) {
          vue.$bvToast.toast("The DeleteStep " + stepToRun + " does not have ports labeled correctly");
          commit("stopExecution");
          return;
        } else { // Check complete start execution
          //#endregion


        }
      }
      else if (isDisplayStep.length > 0) {
        //#region Validation



        // A Display step has 1 inputport(message)
        const checklist = [0];
        if (inputPorts.length != 1) {
          vue.$bvToast.toast("The DisplayStep " + stepToRun + " does not have exactly 1 input port");
          commit("stopExecution");
          return;
        }
        inputPorts.forEach(i => {
          if (i.label == "message") {
            checklist[0] = 1;
          }
        });
        if (outputPorts.length != 0) {
          vue.$bvToast.toast("The DisplayStep " + stepToRun + " does not have exactly 0 output port");
          commit("stopExecution");
          return;
        }

        if (!checklist[0]) {
          vue.$bvToast.toast("The DisplayStep " + stepToRun + " does not have ports labeled correctly");
          commit("stopExecution");
          return;
        } else { // Check complete start execution
          //#endregion




        }
      }
      else if (isEvaluateStep.length > 0) {
        //#region Validation

        // A evaluate step has 1 inputport(object) and an output port(result)
        const checklist = [0, 0];
        if (inputPorts.length != 1) {
          vue.$bvToast.toast("The EvaluateStep " + stepToRun + " does not have exactly 1 input port");
          commit("stopExecution");
          return;
        }
        inputPorts.forEach(i => {
          if (i.label == "object") {
            checklist[0] = 1;
          }
        });
        if (outputPorts.length != 1) {
          vue.$bvToast.toast("The EvaluateStep " + stepToRun + " does not have exactly 1 output port");
          commit("stopExecution");
          return;
        }
        outputPorts.forEach(i => {
          if (i.label == "result") {
            checklist[1] = 1;
          }
        });
        if (!checklist[0] || !checklist[1]) {
          vue.$bvToast.toast("The EvaluateStep " + stepToRun + " does not have ports labeled correctly");
          commit("stopExecution");
          return;
        } else { // Check complete start execution


          //#endregion



        }
      }
      else if (isFilterStep.length > 0) {
        //#region Validation
        // A filter step has 2 inputports(condition, object) and an output port(result)
        const checklist = [0, 0, 0];
        if (inputPorts.length != 2) {
          vue.$bvToast.toast("The FilterStep " + stepToRun + " does not have exactly 2 input ports");
          commit("stopExecution");
          return;
        }
        inputPorts.forEach(i => {
          if (i.label == "condition") {
            checklist[0] = 1;
          } else if (i.label == "object") {
            checklist[1] = 1;
          }
        });
        if (outputPorts.length != 1) {
          vue.$bvToast.toast("The FilterStep " + stepToRun + " does not have exactly 1 output port");
          commit("stopExecution");
          return;
        }
        outputPorts.forEach(i => {
          if (i.label == "result") {
            checklist[2] = 1;
          }
        });
        if (!checklist[0] || !checklist[1] || !checklist[2]) {
          vue.$bvToast.toast("The FilterStep " + stepToRun + " does not have ports labeled correctly");
          commit("stopExecution");
          return;
        } else { // Check complete start execution
          //#endregion



        }
      }
      else if (isGetStep.length > 0) {
        //#region Validation

        // A get step has 2 inputports(index, source) and an output port(result)
        const checklist = [0, 0, 0];
        if (inputPorts.length != 2) {
          vue.$bvToast.toast("The GetStep " + stepToRun + " does not have exactly 2 input ports");
          commit("stopExecution");
          return;
        }
        inputPorts.forEach(i => {
          if (i.label == "index") {
            checklist[0] = 1;
          } else if (i.label == "source") {
            checklist[1] = 1;
          }
        });
        if (outputPorts.length != 1) {
          vue.$bvToast.toast("The GetStep " + stepToRun + " does not have exactly 1 output port");
          commit("stopExecution");
          return;
        }
        outputPorts.forEach(i => {
          if (i.label == "result") {
            checklist[2] = 1;
          }
        });
        if (!checklist[0] || !checklist[1] || !checklist[2]) {
          vue.$bvToast.toast("The GetStep " + stepToRun + " does not have ports labeled correctly");
          commit("stopExecution");
          return;
        } else { // Check complete start execution


          //#endregion

        }
      }
      else if (isInsertStep.length > 0) {
        //#region Validation
        // A Insert step has 2 inputports(target, object)
        const checklist = [0, 0];
        if (inputPorts.length != 2) {
          vue.$bvToast.toast("The InsertStep " + stepToRun + " does not have exactly 2 input ports");
          commit("stopExecution");
          return;
        }
        inputPorts.forEach(i => {
          if (i.label == "target") {
            checklist[0] = 1;
          } else if (i.label == "object") {
            checklist[1] = 1;
          }
        });
        if (outputPorts.length != 0) {
          vue.$bvToast.toast("The InsertStep " + stepToRun + " does not have exactly 0 output port");
          commit("stopExecution");
          return;
        }

        if (!checklist[0] || !checklist[1]) {
          vue.$bvToast.toast("The InsertStep " + stepToRun + " does not have ports labeled correctly");
          commit("stopExecution");
          return;
        } else { // Check complete start execution

          //#endregion



        }
      }
      else if (isModifyStep.length > 0) {
        //#region Validation
        // A modify step has 3 inputports(value, object, dataField or property) and an output port(result)
        const checklist = [0, 0, 0, 0];
        if (inputPorts.length != 3) {
          vue.$bvToast.toast("The ModifyStep " + stepToRun + " does not have exactly 3 input ports");
          commit("stopExecution");
          return;
        }
        inputPorts.forEach(i => {
          if (i.label == "value") {
            checklist[0] = 1;
          } else if (i.label == "object") {
            checklist[1] = 1;
          } else if (i.label == "dataField" || i.label == "property") {
            checklist[2] = 1;
          }
        });
        if (outputPorts.length != 1) {
          vue.$bvToast.toast("The ModifyStep " + stepToRun + " does not have exactly 1 output port");
          commit("stopExecution");
          return;
        }
        outputPorts.forEach(i => {
          if (i.label == "result") {
            checklist[3] = 1;
          }
        });
        if (!checklist[0] || !checklist[1] || !checklist[2] || !checklist[3]) {
          vue.$bvToast.toast("The ModifyStep " + stepToRun + " does not have ports labeled correctly");
          commit("stopExecution");
          return;
        } else { // Check complete start execution
          //#endregion



        }
      }
      else if (isRemoveStep.length > 0) {
        //#region Validation
        // A Remove step has 2 inputports(source, index or object)
        const checklist = [0, 0];
        if (inputPorts.length != 2) {
          vue.$bvToast.toast("The RemoveStep " + stepToRun + " does not have exactly 2 input ports");
          commit("stopExecution");
          return;
        }
        inputPorts.forEach(i => {
          if (i.label == "source") {
            checklist[0] = 1;
          } else if (i.label == "index" || i.label == "object") {
            checklist[1] = 1;
          }
        });
        if (outputPorts.length != 0) {
          vue.$bvToast.toast("The RemoveStep " + stepToRun + " does not have exactly 0 output port");
          commit("stopExecution");
          return;
        }

        if (!checklist[0] || !checklist[1]) {
          vue.$bvToast.toast("The RemoveStep " + stepToRun + " does not have ports labeled correctly");
          commit("stopExecution");
          return;
        } else { // Check complete start execution
          //#endregion


        }
      }
      else if (isSaveStep.length > 0) {
        //#region Validation
        // A Save step has 2 inputports(name, object)
        const checklist = [0, 0];
        if (inputPorts.length != 2) {
          vue.$bvToast.toast("The SaveStep " + stepToRun + " does not have exactly 2 input ports");
          commit("stopExecution");
          return;
        }
        inputPorts.forEach(i => {
          if (i.label == "name") {
            checklist[0] = 1;
          } else if (i.label == "object") {
            checklist[1] = 1;
          }
        });
        if (outputPorts.length != 0) {
          vue.$bvToast.toast("The SaveStep " + stepToRun + " does not have exactly 0 output port");
          commit("stopExecution");
          return;
        }

        if (!checklist[0] || !checklist[1]) {
          vue.$bvToast.toast("The SaveStep " + stepToRun + " does not have ports labeled correctly");
          commit("stopExecution");
          return;
        } else { // Check complete start execution
          //#endregion



        }
      }
      else if (isSizeStep.length > 0) {
        //#region Validation
        // A Size step has 1 inputport (object) and an output port(result)
        const checklist = [0, 0];
        if (inputPorts.length != 1) {
          vue.$bvToast.toast("The SizeStep " + stepToRun + " does not have exactly 1 input ports");
          commit("stopExecution");
          return;
        }
        inputPorts.forEach(i => {
          if (i.label == "object") {
            checklist[0] = 1;
          }
        });
        if (outputPorts.length != 1) {
          vue.$bvToast.toast("The SizeStep " + stepToRun + " does not have exactly 1 output port");
          commit("stopExecution");
          return;
        }
        outputPorts.forEach(i => {
          if (i.label == "result") {
            checklist[1] = 1;
          }
        });
        if (!checklist[0] || !checklist[1]) {
          vue.$bvToast.toast("The SizeStep " + stepToRun + " does not have ports labeled correctly");
          commit("stopExecution");
          return;
        } else { // Check complete start execution
          //#endregion

        }
      }
      else {
        vue.$bvToast.toast("Invalid type for step instance " + stepToRun + " in workflow instance " + workflowInstanceID);
        commit("stopExecution");
        return;
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
