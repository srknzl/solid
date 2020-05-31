<template>
  <div class="profile">
    <b-container>
      <b-row>
        <p>Note: In order this button below to work, you need to grant all the permissions including "Control" in your preferences to this application url.</p>
      </b-row>
      <b-row>
        <b-button variant="danger" @click="onDeleteUserInfo">Delete my all data in my pod</b-button>
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
// todo: List user workflow instances
// todo: List user data instances if applicable
// todo: Give user chance to invoke/interact his/her instances
// todo: Save all the user related info to user's own pod
export default {
  computed: {
    userRoot() {
      return store.state.userRoot;
    }
  },
  methods: {
    onDeleteUserInfo() {
      store.dispatch("deleteUserInfo", { vue: this });
    }
  }
};
</script>

<style>
</style>