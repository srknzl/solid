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
// todo: Give user chance to invoke/interact his/her instances
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
    }
  }
};
</script>

<style>
</style>