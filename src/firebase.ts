// Import the functions you need from the SDKs you need
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: 'AIzaSyDfLHczztZZs5KRCnqy2Dnqgro8vtT27-Y',
  authDomain: 'chat-86d61.firebaseapp.com',
  projectId: 'chat-86d61',
  storageBucket: 'chat-86d61.appspot.com',
  messagingSenderId: '1098998351367',
  appId: '1:1098998351367:web:d5d5d5a6874625390e8ca2',
  measurementId: 'G-8YDWN9EMF2',
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const firestore = getFirestore();
