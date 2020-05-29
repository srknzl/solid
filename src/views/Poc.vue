<template>
  <div class="home">
    <div id="users">
      <h2>Users:</h2>
      <p v-for="(u,ind) in users" :key="ind">
        User {{ind}}:
        <a :href="u.object.value" target="_blank">{{u.object.value}}</a>
      </p>
    </div>
  </div>
</template>
<style>
#users {
  border: 1px solid black;
  border-radius: 2px;
  padding: 10px;
}
</style>
<script>
import store from "../store/index";
//todo: List all workflow instances
//todo: List all step instances
//todo: List all data instances if applicable
//todo: List application's workflows
//todo: List application's steps
//todo: List application's data types

export default {
  name: "Home",
  components: {},
  methods: {},
  computed: {
    users() {
      return store.state.users;
    }
  }
};
</script>
