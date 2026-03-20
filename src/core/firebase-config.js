const firebaseConfig = {
  apiKey: "AIzaSyAIVIuKgXUsdrb9Mmss9PH7R3FpWAMG2hU",
  authDomain: "luminous-system.firebaseapp.com",
  databaseURL: "https://luminous-system-default-rtdb.firebaseio.com",
  projectId: "luminous-system",
  storageBucket: "luminous-system.firebasestorage.app",
  messagingSenderId: "330473029689",
  appId: "1:330473029689:web:44a05e870d493a3b294de8",
  measurementId: "G-X775P4YS7W",
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

export { db };
