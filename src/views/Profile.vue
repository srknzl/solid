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
// todo: List user workflow instances(possibly from filtering all)
// todo: List user lists (possibly from filtering all)
// todo: Give user chance to invoke/interact his/her instances
export default {
  computed: {
    userRoot() {
      return store.state.userRoot;
    }
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