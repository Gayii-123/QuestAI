export const environment = {
  production: false,
  apiUrl: 'https://us-central1-quest-uk898.cloudfunctions.net',
  appName: 'QuestAI',
  version: '1.0.0-dev',
  firebase: {
    apiKey: 'AIzaSyBuZx6955v_2ce4QwtFFZk7W1mIU8hSCLs',
    authDomain: 'quest-uk898.firebaseapp.com',
    databaseURL: 'https://quest-uk898.firebaseio.com',
    projectId: 'quest-uk898',
    storageBucket: 'quest-uk898.appspot.com',
    messagingSenderId: '354004045459',
    appId: '1:354004045459:web:6da2b62fcf2c1991adc766',
    measurementId: 'G-8GW90B44QS',
  },
  endpoints: {
    health: 'https://us-central1-quest-uk898.cloudfunctions.net/questAiHealth',
    status: 'https://us-central1-quest-uk898.cloudfunctions.net/questAiStatus',
    generate: 'https://us-central1-quest-uk898.cloudfunctions.net/questAiGenerateText',
    inspect: 'https://us-central1-quest-uk898.cloudfunctions.net/questAiInspect',
    inspectPhotos: 'https://us-central1-quest-uk898.cloudfunctions.net/questAiInspectPhotos',
    saveInspection: 'https://us-central1-quest-uk898.cloudfunctions.net/questAiSaveInspection',
  },
};
