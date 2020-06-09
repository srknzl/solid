<template>
  <div class="profile">
    <b-container>
      <b-row>
        <p>Note: In order these buttons below to work, you need to grant all the permissions including "Control" in your preferences to this application url.</p>
      </b-row>
      <b-row>
        <b-button variant="danger" @click="onDeleteUserInfo">Delete my all data in my pod</b-button>
      </b-row>
      <b-row>
        <b-button
          variant="danger"
          @click="onDeleteUserWorkflowInstances"
        >Delete my all workflow instances in my pod</b-button>
      </b-row>
      <b-row>
        <div style="marginTop: 1rem;" class="poccontainer">
          <h2>Workflow Instances</h2>
          <div v-for="(w,ind) in workflowInstances" :key="ind" class="poccontainer">
            <p>
              <b>Workflow Instance</b>
              {{ind+1}}: {{w.url}}
            </p>
            <p>
              <b>Last modification</b>
              {{w.modified}}
            </p>
            <p>
              <b>Datatype</b>
              {{w.datatype}}
            </p>
            <b-button variant="success" @click="workflowInstanceStatus(w.url)">See execution status</b-button>
          </div>
        </div>
      </b-row>
      <b-row>
        <div style="marginTop: 1rem;" class="poccontainer">
          <h2>Lists</h2>
          <div v-for="(l,ind) in lists" :key="ind" class="poccontainer">
            <p>List {{ind+1}}: {{l.listName}}</p>
            <p v-if="l.list.length > 0">Items:</p>
            <ul v-if="l.list.length > 0">
              <li v-for="(item, indice) in l.list" :key="indice">
                <p v-if="item.termType == 'Literal'">
                  <u>Literal:</u>
                  <b>Datatype:</b>
                  {{item.datatype.value}}
                  <b>Value:</b>
                  {{item.value}}
                  <b>From:</b>
                  {{item.from}}
                </p>
                <p v-if="item.termType == 'NamedNode'">
                  <u>NamedNode:</u>
                  <b>Value:</b>
                  {{item.value}}
                  <b>From:</b>
                  {{item.from}}
                </p>
              </li>
            </ul>
          </div>
        </div>
      </b-row>
    </b-container>
  </div>
</template>
<style>
.profile {
  display: flex;
  justify-content: center;
}
</style>
<script>
import store from "../store/index";
import solidFileClient from "solid-file-client";
import auth from "solid-auth-client";
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

export default {
  computed: {
    userRoot() {
      return store.state.userRoot;
    },
    lists(){
      return store.state.lists.map(l => {
        return {
          listName: l.listName,
          list: l.list.filter(el => el.from == store.state.userRoot+ "/profile/card#me")
        };
      });
    },
    workflowInstances(){
      return store.state.workflowInstances.filter(w => {
        const url = new URL(w.url);
        return `${url.protocol}//${url.hostname}` == store.state.userRoot;
      });
    },
  },
  methods: {
    onDeleteUserInfo() {
      store.dispatch("deleteUserInfo", { vue: this });
    },
    onDeleteUserWorkflowInstances() {
      store.dispatch("deleteAllWorkflowInstances", { vue: this });
    },
    async workflowInstanceStatus(workflowInstanceFileUrl){
      //#region Check if human input is needed 
      const fc = new solidFileClient(auth);
      const randomString = workflowInstanceFileUrl.substring(workflowInstanceFileUrl.lastIndexOf("/")+1).substring(0,workflowInstanceFileUrl.substring(workflowInstanceFileUrl.lastIndexOf("/")).length-5).substring(18);
      const res = await fc.readFolder(store.state.userRoot + "/poc/workflow_instances/"+randomString + "_step_instances/");
      let inputPortURI;
      res.files.forEach(file => {
        if(file.url.substring(file.url.lastIndexOf("/")+1).startsWith("human_input")){
          const stepName = file.url.substring(file.url.lastIndexOf("/")+1).substring(12).substring(0,file.url.substring(file.url.lastIndexOf("/")+1).substring(12).length-4);
          this.$bvToast.toast("Your input is needed on step " + stepName);
          const inputPortQuads = store.state.store.getQuads(df.namedNode(appOntology + stepName), df.namedNode(poc+"inputPort"), null);
          inputPortQuads.forEach(quad => {
            const portURI = quad.object.value;
            const pipeTargetsThisPort = store.state.store.getQuads(null, df.namedNode(poc + "targetPort"), df.namedNode(portURI));
            if(pipeTargetsThisPort.length == 0){
              this.$bvToast.toast("Error a inputport does not have pipe going to it in" + stepName);
              return;
            }
            const pipeURI = pipeTargetsThisPort.subject.value;
            const isHumanPipe = store.state.store.getQuads(df.namedNode(pipeURI), df.namedNode(rdf+"type"), df.namedNode(poc+"HumanPipe"));
            if(isHumanPipe.length > 0){
              inputPortURI = portURI;
            }
            // So there will be two cases: selecting index for a list, and creating a new object 
            // Create dynamic modals according to these scenarios. 
            // todo: right now you use save steps with human pipes, change that to create steps with human pipe and save steps
            // todo: A CreateStep and GetStep must explain what they what from user by their rdfs:comment annotation.
            // todo: This value will be shown to the user in this application.  
            const isGetStep = store.state.store.getQuads(df.namedNode(appOntology+stepName), df.namedNode(rdf+"type"), df.namedNode(poc+"GetStep"));
            const isCreateStep = store.state.store.getQuads(df.namedNode(appOntology+stepName), df.namedNode(rdf+"type"), df.namedNode(poc+"CreateStep"));

            if(isGetStep.length > 0){ 
              const isInputPortsLabelIsIndex = store.state.store.getQuads(df.namedNode(inputPortURI), df.namedNode(rdfs+"label"), df.literal("index", df.namedNode(xsd+"string")));
              if(isInputPortsLabelIsIndex.length == 0){
                this.$bvToast.toast("In a GetStep only index can be retrieved from user.");
                return;
              }
              // todo: ask for index from user
            }else if(isCreateStep.length > 0){
              const isInputPortsLabelIsObject = store.state.store.getQuads(df.namedNode(inputPortURI), df.namedNode(rdfs+"label"), df.literal("object", df.namedNode(xsd+"string")));
              if(isInputPortsLabelIsObject.length == 0){
                this.$bvToast.toast("In a CreateStep only object can be retrieved from user.");
                return;
              }
              // todo: ask for dynamic data instance from user depending on the datatype
            }else {
              this.$bvToast.toast("In this application a human pipe is not supported in steps other than create step and get step(for index selection)");
              return;
            }

          });
        }
      });
    }
  }
};
</script>

<style>
</style>