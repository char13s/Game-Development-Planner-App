
import { firebaseConfig } from '../firebase-config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, doc, onSnapshot, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

async function main() {
    const mainContent = document.getElementById('main-content');
    const loadingOverlay = document.getElementById('loading-overlay');
    const archiveContainer = document.getElementById('archive-container');
    const signOutBtn = document.getElementById('sign-out-btn');
    const userInfo = document.getElementById('user-info');

    let app, auth, db, userId;

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
                window.autoAnimate(archiveContainer);
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

    const setupListeners = () => {
        onSnapshot(collection(db, `users/${userId}/tasks`),
            s => renderArchived(s.docs.map(d => ({...d.data(), id: d.id}))),
            e => console.error(e)
        );
    };

    const renderArchived = (tasks) => {
        archiveContainer.innerHTML = '';
        const archivedTasks = tasks.filter(t => t.status === 'archived').sort((a,b) => b.completedAt?.toMillis() - a.completedAt?.toMillis());

        if (archivedTasks.length === 0) {
            archiveContainer.innerHTML = '<p class="text-gray-400">No archived tasks yet.</p>';
            return;
        }

        archivedTasks.forEach(task => {
            const card = document.createElement('div');
            card.className = 'bg-ray-700 p-4 rounded-lg flex justify-between items-center';
            
            const completedDate = task.completedAt ? new Date(task.completedAt.toMillis()).toLocaleDateString() : 'N/A';

            card.innerHTML = `
                <div>
                    <h3 class=\'font-bold text-lg\'>${task.title}</h3>
                    <p class="text-sm text-gray-400">Completed on: ${completedDate}</p>
                </div>
                <div>
                    <button data-id="${task.id}" class="unarchive-btn bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg">Unarchive</button>
                    <button data-id="${task.id}" class="delete-btn bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg ml-2">Delete</button>
                </div>
            `;
            archiveContainer.appendChild(card);
        });
    };

    archiveContainer.addEventListener('click', async (e) => {
        const button = e.target.closest('button');
        if (!button) return;

        const taskId = button.dataset.id;
        if (button.classList.contains('unarchive-btn')) {
            await updateDoc(doc(db, `users/${userId}/tasks`, taskId), {
                status: 'todo'
            });
        } else if (button.classList.contains('delete-btn')) {
            if (confirm('Are you sure you want to permanently delete this task?')) {
                await deleteDoc(doc(db, `users/${userId}/tasks`, taskId));
            }
        }
    });
}

main();
