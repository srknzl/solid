<template>
  <div class="home">
    <h1>Current App: {{appUri || "Current application does not have a name or spec not loaded"}}</h1>
    <h2>Description: {{appDesc || "Current application does not have a description or spec not loaded"}}</h2>
    <div class="poccontainer">
      <h2>Users:</h2>
      <p v-for="(u,ind) in users" :key="ind">
        User {{ind}}:
        <a :href="u.object.value" target="_blank">{{u.object.value}}</a>
      </p>
    </div>
    <div style="marginTop: 1rem;" class="poccontainer">
      <h2>Composite Datatypes:</h2>
      <div style="marginTop: 1rem;" v-for="(d,ind) in compositeDatatypes" :key="ind">
        <h3>CompositeDatatype {{ind}}: {{d.uri}}</h3>
        <div class="poccontainer" v-for="(x,ind2) in d.datafields" :key="ind2">
          <p>Name: {{x.name}}</p>
          <p>Description: {{x.description}}</p>
          <p>Fieldtype: {{x.fieldtype}}</p>
        </div>
      </div>
    </div>
    <div style="marginTop: 1rem;" class="poccontainer">
      <h2>Derived Datatypes:</h2>
      <div style="marginTop: 1rem;" v-for="(d,ind) in derivedDatatypes" :key="ind">
        <h3>Derived Datatype {{ind}}: {{d.uri}}</h3>
        <p v-if="d.limitations.maxFrameWidth">maxFrameWidth: {{d.limitations.maxFrameWidth}}</p>
        <p v-if="d.limitations.minFrameWidth">minFrameWidth: {{d.limitations.minFrameWidth}}</p>
        <p v-if="d.limitations.maxFrameHeight">maxFrameHeight: {{d.limitations.maxFrameHeight}}</p>
        <p v-if="d.limitations.minFrameHeight">minFrameHeight: {{d.limitations.minFrameHeight}}</p>
        <p v-if="d.limitations.maxTrackLength">maxTrackLength: {{d.limitations.maxTrackLength}}</p>
        <p v-if="d.limitations.minTrackLength">minTrackLength: {{d.limitations.minTrackLength}}</p>
        <p v-if="d.limitations.maxFileSize">maxFileSize: {{d.limitations.maxFileSize}}</p>
        <p v-if="d.limitations.minFileSize">minFileSize: {{d.limitations.minFileSize}}</p>
        <p v-if="d.limitations.scaleWidth">scaleWidth: {{d.limitations.scaleWidth}}</p>
        <p v-if="d.limitations.scaleHeight">scaleHeight: {{d.limitations.scaleHeight}}</p>
        <p v-if="d.limitations.maxSize">maxSize: {{d.limitations.maxSize}}</p>
      </div>
    </div>
    <div style="marginTop: 1rem;" class="poccontainer">
      <h2>Workflows</h2>
      <div style="marginTop: 1rem;" v-for="(w,ind) in workflows" :key="ind">
        <div class="poccontainer">
          <h3>Workflow {{ind}}: {{w.uri}}</h3>
          <p v-if="w.label">Label: {{w.label}}</p>
          <p v-if="w.description">Description: {{w.description}}</p>
          <b-button @click="onWorkflowInvoke(w)">Start this workflow</b-button>
        </div>
      </div>
    </div>
  </div>
</template>
<style>
.poccontainer {
  border: 1px solid black;
  border-radius: 2px;
  padding: 10px;
}
</style>
<script>
import store from "../store/index";
const N3 = require("n3");
const df = N3.DataFactory;
//todo: List all workflow instances
//todo: List all step instances
//todo: List all data instances if applicable

export default {
  name: "Home",
  components: {},
  methods: {
    onWorkflowInvoke(workflow){
      console.log("Workflow", workflow, "invoked!");
    }
  },
  created() {
    store.dispatch("fetchSpec");
  },
  computed: {
    users() {
      return store.state.users;
    },
    compositeDatatypes() {
      return store.state.compositeDatatypes;
    },
    derivedDatatypes() {
      return store.state.derivedDatatypes;
    },
    appDesc() {
      return store.state.appDesc;
    },
    appUri() {
      return store.state.appUri;
    },
    workflows() {
      return store.state.workflows;
    }
  }
};
</script>
