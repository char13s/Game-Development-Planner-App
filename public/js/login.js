
import { firebaseConfig } from '../firebase-config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const errorMessage = document.getElementById('error-message');

// Redirect if user is already logged in
onAuthStateChanged(auth, user => {
    if (user && !user.isAnonymous) {
        window.location.href = 'index.html';
    }
});

// Handle Sign In
loginForm.addEventListener('submit', e => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    signInWithEmailAndPassword(auth, email, password)
        .then(userCredential => {
            // Signed in, redirection is handled by onAuthStateChanged
        })
        .catch(error => {
            errorMessage.textContent = error.message;
        });
});

// Handle Sign Up
signupForm.addEventListener('submit', e => {
    e.preventDefault();
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    createUserWithEmailAndPassword(auth, email, password)
        .then(userCredential => {
            // Signed up, redirection is handled by onAuthStateChanged
        })
        .catch(error => {
            errorMessage.textContent = error.message;
        });
});
