import { createApp } from 'vue'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import Aura from '@primevue/themes/aura'

import App from './App.vue'
import router from './router'

// PrimeVue components
import Button from 'primevue/button'
import Card from 'primevue/card'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Badge from 'primevue/badge'
import Chip from 'primevue/chip'
import Panel from 'primevue/panel'
import ProgressBar from 'primevue/progressbar'
import Slider from 'primevue/slider'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Dropdown from 'primevue/dropdown'
import Calendar from 'primevue/calendar'
import Checkbox from 'primevue/checkbox'
import Dialog from 'primevue/dialog'
import Divider from 'primevue/divider'
import Toast from 'primevue/toast'
import ToastService from 'primevue/toastservice'
import ConfirmationService from 'primevue/confirmationservice'
import Tooltip from 'primevue/tooltip'

// Styles
import 'primevue/resources/themes/aura-light-green/theme.css'
import 'primevue/resources/primevue.min.css'
import 'primeicons/primeicons.css'
import '@fortawesome/fontawesome-free/css/all.min.css'
import './assets/styles/main.scss'

const app = createApp(App)

// Pinia store
app.use(createPinia())

// Vue Router
app.use(router)

// PrimeVue configuration
app.use(PrimeVue, {
  theme: {
    preset: Aura,
    options: {
      darkModeSelector: '.dark-mode',
      cssLayer: {
        name: 'primevue',
        order: 'tailwind-base, primevue, tailwind-utilities'
      }
    }
  }
})

// PrimeVue services
app.use(ToastService)
app.use(ConfirmationService)

// Global components
app.component('Button', Button)
app.component('Card', Card)
app.component('DataTable', DataTable)
app.component('Column', Column)
app.component('Badge', Badge)
app.component('Chip', Chip)
app.component('Panel', Panel)
app.component('ProgressBar', ProgressBar)
app.component('Slider', Slider)
app.component('InputText', InputText)
app.component('InputNumber', InputNumber)
app.component('Dropdown', Dropdown)
app.component('Calendar', Calendar)
app.component('Checkbox', Checkbox)
app.component('Dialog', Dialog)
app.component('Divider', Divider)
app.component('Toast', Toast)

// Global directives
app.directive('tooltip', Tooltip)

app.mount('#app')