<template>
  <div class="home">
    <div class="d-flex justify-content-center mb-3">
      <b-spinner v-if="fetching" label="Loading..."></b-spinner>
    </div>
    
    <h1>Current App: {{appUri || "Current application does not have a name or spec not loaded"}}</h1>
    <h2>Description: {{appDesc || "Current application does not have a description or spec not loaded"}}</h2>
    <div class="poccontainer">
      <h2>Users:</h2>
      <p v-for="(u,ind) in users" :key="ind">
        User {{ind+1}}:
        <a :href="u.object.value" target="_blank">{{u.object.value}}</a>
      </p>
    </div>
    <div style="marginTop: 1rem;" class="poccontainer">
      <h2>Composite Datatypes:</h2>
      <div style="marginTop: 1rem;" v-for="(d,ind) in compositeDatatypes" :key="ind">
        <h3>CompositeDatatype {{ind+1}}: {{d.uri}}</h3>
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
        <h3>Derived Datatype {{ind+1}}: {{d.uri}}</h3>
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
          <h3>Workflow {{ind+1}}: {{w.uri}}</h3>
          <p v-if="w.label">Label: {{w.label}}</p>
          <p v-if="w.description">Description: {{w.description}}</p>
          <b-button @click="onWorkflowInvoke(w)">Start this workflow</b-button>
        </div>
      </div>
    </div>
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
    <div style="marginTop: 1rem;" class="poccontainer">
      <h2>Workflow Instances</h2>
      <div v-for="(w,ind) in workflowInstances" :key="ind" class="poccontainer">
        <p><b>Workflow Instance</b> {{ind+1}}: {{w.url}}</p>
        <p><b>Last modification</b> {{w.modified}}</p>
        <p><b>Datatype</b> {{w.datatype}}</p>
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
// todo: List all workflow instances
// It is not reasonable to show all data instances to the user
// It is reasonable to show contents of all lists to the user
// It is not reasonable to show step instances to the user

export default {
  name: "Poc",
  components: {},
  methods: {
    onWorkflowInvoke(workflow) {
      store.dispatch("createWorkflowInstance", {
        workflowURI: workflow.uri,
        userWebID: this.user,
        vue: this
      });
    }
  },
  created() {},
  computed: {
    workflowInstances() {
      return store.state.workflowInstances;
    },
    fetching() {
      return store.state.fetching;
    },
    users() {
      return store.state.users;
    },
    user() {
      return store.state.user;
    },
    compositeDatatypes() {
      return store.state.compositeDatatypes;
    },
    derivedDatatypes() {
      return store.state.derivedDatatypes;
    },
    lists() {
      return store.state.lists.sort((a, b) => a.from > b.from);
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
