
import { firebaseConfig } from '../firebase-config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc, serverTimestamp, writeBatch } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

async function main() {
    const loadingOverlay = document.getElementById('loading-overlay');
    const mainContent = document.getElementById('main-content');
    const screenplayContainer = document.getElementById('screenplay-container');
    const contextMenu = document.getElementById('context-menu');
    const signOutBtn = document.getElementById('sign-out-btn');
    const userInfo = document.getElementById('user-info');

    const inputModal = document.getElementById('input-modal');
    const inputForm = document.getElementById('input-form');
    const closeInputModalBtn = document.getElementById('close-input-modal-btn');
    const inputModalTitle = document.getElementById('input-modal-title');
    const inputModalLabel = document.getElementById('input-modal-label');
    const inputModalField = document.getElementById('input-modal-field');

    let app, auth, db, userId, screenplayElements = [];
    let onInputConfirm = null;

    if (!firebaseConfig) {
        document.body.innerHTML = `<div class="text-red-500 p-8">Error: Firebase config not found.</div>`;
        return;
    }

    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);

    const waitForAutoAnimate = () => {
        const interval = setInterval(() => {
            if (window.autoAnimate) {
                clearInterval(interval);
                window.autoAnimate(screenplayContainer);
            }
        }, 100);
    };

    signOutBtn.addEventListener('click', () => {
        signOut(auth).catch(error => console.error("Sign out error", error));
    });

    onAuthStateChanged(auth, user => {
        if (user && !user.isAnonymous) {
            userId = user.uid;
            userInfo.textContent = `Signed in as ${user.email}`;
            mainContent.classList.remove('hidden');
            loadingOverlay.classList.add('hidden');
            
            setupListeners();
            waitForAutoAnimate();
        } else {
            window.location.href = 'login.html';
        }
    });

    const openInputModal = (title, label, initialValue = '', callback) => {
        inputModalTitle.innerText = title;
        inputModalLabel.innerText = label;
        inputModalField.value = initialValue;
        onInputConfirm = callback;
        inputModal.classList.remove('hidden');
        inputModalField.focus();
    };
    
    const closeInputModal = () => {
        inputModal.classList.add('hidden');
        onInputConfirm = null;
        inputForm.reset();
    };

    const setupListeners = () => {
        onSnapshot(collection(db, `users/${userId}/screenplay`), s => {
            screenplayElements = s.docs.map(d => ({ ...d.data(), id: d.id })).sort((a,b) => a.order - b.order);
            renderScreenplay();
        });

        document.addEventListener('contextmenu', e => {
            e.preventDefault();
            contextMenu.style.top = `${e.clientY}px`;
            contextMenu.style.left = `${e.clientX}px`;
            contextMenu.style.display = 'block';

            contextMenu.innerHTML = `
                <div data-action="add-scene">Add Scene Heading</div>
                <div data-action="add-action">Add Action</div>
                <div data-action="add-character">Add Character</div>
                <div data-action="add-dialogue">Add Dialogue</div>
                <div data-action="add-parenthetical">Add Parenthetical</div>
            `;
        });

        document.addEventListener('click', e => {
            if (!contextMenu.contains(e.target)) contextMenu.style.display = 'none';
        });

        contextMenu.onclick = e => {
            const { action } = e.target.dataset;
            contextMenu.style.display = 'none';

            const lastOrder = screenplayElements.length > 0 ? screenplayElements[screenplayElements.length - 1].order : 0;
            const order = lastOrder + 1000;

            switch (action) {
                case 'add-scene':
                    openInputModal('New Scene Heading', 'Scene (e.g., INT. COFFEE SHOP - DAY)', '', content => {
                        addDoc(collection(db, `users/${userId}/screenplay`), { type: 'scene-heading', content, order });
                    });
                    break;
                case 'add-action':
                     openInputModal('New Action', 'Action description', '', content => {
                        addDoc(collection(db, `users/${userId}/screenplay`), { type: 'action', content, order });
                    });
                    break;
                case 'add-character':
                    openInputModal('New Character', 'Character Name', '', content => {
                        addDoc(collection(db, `users/${userId}/screenplay`), { type: 'character', content, order });
                    });
                    break;
                case 'add-dialogue':
                    openInputModal('New Dialogue', 'Dialogue', '', content => {
                        addDoc(collection(db, `users/${userId}/screenplay`), { type: 'dialogue', content, order });
                    });
                    break;
                case 'add-parenthetical':
                    openInputModal('New Parenthetical', 'Parenthetical (e.g., (wryly))', '', content => {
                        addDoc(collection(db, `users/${userId}/screenplay`), { type: 'parenthetical', content, order });
                    });
                    break;
            }
        };
        
        closeInputModalBtn.onclick = closeInputModal;
        inputForm.onsubmit = e => {
            e.preventDefault();
            const value = inputModalField.value.trim();
            if (value && onInputConfirm) onInputConfirm(value);
            closeInputModal();
        };
    };

    const renderScreenplay = () => {
        screenplayContainer.innerHTML = '';
        screenplayElements.forEach(element => {
            const el = document.createElement('div');
            el.classList.add(element.type);
            el.textContent = element.content;
            screenplayContainer.appendChild(el);
        });
    };
}

main();
