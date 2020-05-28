<template>
  <div id="app">
    <div id="nav">
      <b-container>
        <b-row>
          <b-col>
            <b-navbar toggleable="lg" type="dark" variant="info">
              <b-navbar-brand href="#">Storytelling</b-navbar-brand>

              <b-navbar-toggle target="nav-collapse"></b-navbar-toggle>

              <b-collapse id="nav-collapse" is-nav>
                <b-navbar-nav class="align-items-center">
                  <b-nav-item to="/">Home</b-nav-item>
                  <b-nav-item to="/about">About</b-nav-item>
                  <b-nav-item v-if="loggedIn" to="profile">
                    <b-icon to="profile" icon="person-fill" font-scale="2.5"></b-icon>
                  </b-nav-item>
                </b-navbar-nav>
                <b-navbar-nav class="ml-auto">
                  <b-button v-if="!loggedIn" @click="login">Login</b-button>
                  <b-button v-if="loggedIn" @click="logout">Logout</b-button>
                </b-navbar-nav>
              </b-collapse>
            </b-navbar>
          </b-col>
        </b-row>
        <b-row>
          <p v-if="loggedIn">Welcome {{ user }}</p>
        </b-row>
        <b-row>
          <img id="image" />
        </b-row>
      </b-container>
    </div>
    <router-view />
  </div>
</template>

<style lang="scss">
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
}

#nav {
  padding: 30px;

  a {
    font-weight: bold;
    color: #2c3e50;

    &.router-link-exact-active {
      color: #42b983;
    }
  }
}
</style>
<script>
import store from "../src/store/index";
// import auth from "solid-auth-client";

export default {
  created() {
    store.dispatch("checkLogin");
    store.dispatch("fetchAllUsers");
    /* store.dispatch("testAction2", {
      rootURI: "https://srknzl.solid.community/poc/"
    }); */

    /* auth
      .fetch(
        "https://serkanozel.solid.community/profile/Image_1581238248005.png"
      )
      .then(res => {
        return res.blob();
      })
      .then(images => {
        const urlCreator = window.URL || window.webkitURL;
        const imageUrl = urlCreator.createObjectURL(images);
        document.querySelector("#image").src = imageUrl;
      }); */
  },
  methods: {
    logout() {
      store.dispatch("logoutAction");
    },
    login() {
      store.dispatch("login");
    }
  },
  computed: {
    user() {
      return store.state.user;
    },
    loggedIn() {
      return store.state.loggedIn;
    }
  }
};
</script>