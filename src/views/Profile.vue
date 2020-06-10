<template>
  <div class="profile">
    <b-container>
      <b-row>
        <p>
          Note: In order these buttons below to work, you need to grant all the
          permissions including "Control" in your preferences to this
          application url.
        </p>
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
          <div v-for="(w, ind) in workflowInstances" :key="ind" class="poccontainer">
            <p>
              <b>Workflow Instance</b>
              {{ ind + 1 }}: {{ w.url }}
            </p>
            <p>
              <b>Last modification</b>
              {{ w.modified }}
            </p>
            <p>
              <b>Datatype</b>
              {{ w.datatype }}
            </p>
            <b-button variant="success" @click="workflowInstanceStatus(w.url)">See execution status</b-button>
          </div>
        </div>
      </b-row>
      <b-row>
        <div style="marginTop: 1rem;" class="poccontainer">
          <h2>Lists</h2>
          <div v-for="(l, ind) in lists" :key="ind" class="poccontainer">
            <p>List {{ ind + 1 }}: {{ l.listName }}</p>
            <p v-if="l.list.length > 0">Items:</p>
            <ul v-if="l.list.length > 0">
              <li v-for="(item, indice) in l.list" :key="indice">
                <p v-if="item.termType == 'Literal'">
                  <u>Literal:</u>
                  <b>Datatype:</b>
                  {{ item.datatype.value }}
                  <b>Value:</b>
                  {{ item.value }}
                  <b>From:</b>
                  {{ item.from }}
                </p>
                <p v-if="item.termType == 'NamedNode'">
                  <u>NamedNode:</u>
                  <b>Value:</b>
                  {{ item.value }}
                  <b>From:</b>
                  {{ item.from }}
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
    lists() {
      return store.state.lists.map(l => {
        return {
          listName: l.listName,
          list: l.list.filter(
            el => el.from == store.state.userRoot + "/profile/card#me"
          )
        };
      });
    },
    workflowInstances() {
      return store.state.workflowInstances.filter(w => {
        const url = new URL(w.url);
        return `${url.protocol}//${url.hostname}` == store.state.userRoot;
      });
    }
  },
  methods: {
    onDeleteUserInfo() {
      store.dispatch("deleteUserInfo", { vue: this });
    },
    onDeleteUserWorkflowInstances() {
      store.dispatch("deleteAllWorkflowInstances", { vue: this });
    },
    async workflowInstanceStatus(workflowInstanceFileUrl) {
      //#region Check if human input is needed
      const fc = new solidFileClient(auth);
      const randomString = workflowInstanceFileUrl
        .substring(workflowInstanceFileUrl.lastIndexOf("/") + 1)
        .substring(
          0,
          workflowInstanceFileUrl.substring(
            workflowInstanceFileUrl.lastIndexOf("/")
          ).length - 5
        )
        .substring(18);
      const res = await fc.readFolder(
        store.state.userRoot +
          "/poc/workflow_instances/" +
          randomString +
          "_step_instances/"
      );
      let isInputStepCreateStep;
      let objectPortURI;
      let datatypePortURI;

      let indexPortURI;
      let sourcePortURI;

      res.files.forEach(file => {
        if (
          file.url
            .substring(file.url.lastIndexOf("/") + 1)
            .startsWith("human_input")
        ) {
          const stepName = file.url
            .substring(file.url.lastIndexOf("/") + 1)
            .substring(12)
            .substring(
              0,
              file.url.substring(file.url.lastIndexOf("/") + 1).substring(12)
                .length - 4
            );
          this.$bvToast.toast("Your input is needed on step " + stepName);
          const inputPortQuads = store.state.store.getQuads(
            df.namedNode(appOntology + stepName),
            df.namedNode(poc + "inputPort"),
            null
          );
          inputPortQuads.forEach(quad => {
            const pipeURI = pipeTargetsThisPort.subject.value;
            const isHumanPipe = store.state.store.getQuads(
              df.namedNode(pipeURI),
              df.namedNode(rdf + "type"),
              df.namedNode(poc + "HumanPipe")
            );
            if (isHumanPipe.length > 0) {
              inputPortURI = portURI;
            }

            // So there will be two cases: selecting index for a list, and creating a new object
            // Create dynamic modals in vue bootstrap according to input needed
            // * A CreateStep and GetStep must explain what they want from user by their rdfs:comment annotation.
            // todo: Show the rdfs:comment of the step that needs the human input
            const isGetStep = store.state.store.getQuads(
              df.namedNode(appOntology + stepName),
              df.namedNode(rdf + "type"),
              df.namedNode(poc + "GetStep")
            );
            const isCreateStep = store.state.store.getQuads(
              df.namedNode(appOntology + stepName),
              df.namedNode(rdf + "type"),
              df.namedNode(poc + "CreateStep")
            );

            if (isGetStep.length > 0) {
              isInputStepCreateStep = false;
              const isSourcePort = store.state.store.getQuads(
                df.namedNode(quad.object.value),
                df.namedNode(rdfs + "label"),
                df.literal("source", df.namedNode(xsd + "string"))
              );
              const isIndexPort = store.state.store.getQuads(
                df.namedNode(quad.object.value),
                df.namedNode(rdfs + "label"),
                df.literal("index", df.namedNode(xsd + "string"))
              );

              if (isSourcePort.length > 0) {
                sourcePortURI = quad.object.value;
              } else if (isIndexPort.length > 0) {
                const pipeTargetsThisPort = store.state.store.getQuads(
                  null,
                  df.namedNode(poc + "targetPort"),
                  df.namedNode(quad.object.value)
                );
                if (pipeTargetsThisPort.length == 0) {
                  this.$bvToast.toast(
                    "Error a inputport does not have pipe going to it in" +
                      stepName
                  );
                  return;
                }
                const pipeURI = pipeTargetsThisPort.subject.value;
                const isHumanPipe = store.state.store.getQuads(
                  df.namedNode(pipeURI),
                  df.namedNode(rdf + "type"),
                  df.namedNode(poc + "HumanPipe")
                );
                if (isHumanPipe.length > 0) {
                  indexPortURI = portURI;
                } else {
                  this.$bvToast.toast(
                    "Input port of get step does not have a human pipe on index port"
                  );
                  return;
                }
              } else {
                this.$bvToast.toast(
                  "In a get step there is a input port which is not index or source labeled"
                );
                return;
              }
              // todo: ask for index from user by showing the list items and according to the item that user selects calculate an index
            } else if (isCreateStep.length > 0) {
              isInputStepCreateStep = true;
              const isObjectPort = store.state.store.getQuads(
                df.namedNode(quad.object.value),
                df.namedNode(rdfs + "label"),
                df.literal("object", df.namedNode(xsd + "string"))
              );
              const isDatatypePort = store.state.store.getQuads(
                df.namedNode(quad.object.value),
                df.namedNode(rdfs + "label"),
                df.literal("datatype", df.namedNode(xsd + "string"))
              );

              if (isDatatypePort.length > 0) {
                datatypePortURI = quad.object.value;
              } else if (isObjectPort.length > 0) {
                const pipeTargetsThisPort = store.state.store.getQuads(
                  null,
                  df.namedNode(poc + "targetPort"),
                  df.namedNode(quad.object.value)
                );
                if (pipeTargetsThisPort.length == 0) {
                  this.$bvToast.toast(
                    "Error a inputport does not have pipe going to it in" +
                      stepName
                  );
                  return;
                }
                const pipeURI = pipeTargetsThisPort.subject.value;
                const isHumanPipe = store.state.store.getQuads(
                  df.namedNode(pipeURI),
                  df.namedNode(rdf + "type"),
                  df.namedNode(poc + "HumanPipe")
                );
                if (isHumanPipe.length > 0) {
                  indexPortURI = portURI;
                } else {
                  this.$bvToast.toast(
                    "Input port of create step does not have a human pipe on object port"
                  );
                  return;
                }
              } else {
                this.$bvToast.toast(
                  "In a create step there is a input port which is not object or datatype labeled"
                );
                return;
              }
            } else {
              this.$bvToast.toast(
                "In this application a human pipe is not supported in steps other than create step and get step(for index selection)"
              );
              return;
            }
          });
        }
      });
      if(isInputStepCreateStep){
        // objectPortURI datatypePortURI
        const pipeTargetsDatatypeQuads = store.state.store.getQuads(null, df.namedNode(poc+"targetPort"), df.namedNode(datatypePortURI));
        if(pipeTargetsDatatypeQuads.length != 1){
          this.$bvToast.toast("Datatype port does not have one pipe goes into it.");
          return;
        }
        const datatypePipeURI = pipeTargetsDatatypeQuads[0].subject.value;
        const isDirectPipe = store.state.store.getQuads(df.namedNode(datatypePipeURI), df.namedNode(rdf+"type"), df.namedNode(poc+"DirectPipe")); 
        const isPortPipe = store.state.store.getQuads(df.namedNode(datatypePipeURI), df.namedNode(rdf+"type"), df.namedNode(poc+"PortPipe")); 

        if(isDirectPipe.length > 0){
          const hasUriValue = store.state.store.getQuads(df.namedNode(datatypePipeURI), df.namedNode(poc+"sourceUriValue"), null); 
          const hasLiteralValue = store.state.store.getQuads(df.namedNode(datatypePipeURI), df.namedNode(poc+"sourceLiteralValue"), null); 

          if(hasUriValue.length > 0){
            const uriValue = hasUriValue[0].object.value;
            const fieldQuads = store.state.store.getQuads(df.namedNode(uriValue), df.namedNode(poc+"dataField"),null);
            
            // todo: Show a model given datatype fields and create a value binding in step_instances folder with name objectPort's name 

          }else if(hasLiteralValue > 0) {
            this.$bvToast.toast("A datatype port must not have a direct pipe with a literal value");
            return;
          }else{
            this.$bvToast.toast("A direct pipe does not have sourceUriValue and sourceLiteralValue");
            return;
          }
        }else if(isPortPipe.length > 0){
          // todo: Datatype gets its value from a port pipe. Check if the value exists in step instances folder, if not raise error
        }else{
          this.$bvToast.toast("The datatype port of create step does not have a pipe which is either a port pipe or a direct pipe.");
          return;
        }
      }else{
        // todo: Get step input handling
        // indexPortURI, sourcePortURI
      }
    }
  }
};
</script>

<style></style>
