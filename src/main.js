import Vue from 'vue'
import App from './App.vue'
import router from './router'
import './plugins/at'
import installHttp from './plugins/http'
import decrypt from './plugins/decrypt'
import axios from './plugins/axios'

Vue.config.productionTip = false
Vue.prototype.$get = installHttp.get
Vue.prototype.$post = installHttp.post
Vue.prototype.$dcy = decrypt
Vue.prototype.$axios = axios

new Vue({
  router,
  render: h => h(App)
}).$mount('#app')
