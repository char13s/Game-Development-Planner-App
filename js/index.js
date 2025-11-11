
import { firebaseConfig } from './firebase-config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, doc, onSnapshot, addDoc, updateDoc, serverTimestamp, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

async function main() {
    const mainContent = document.getElementById('main-content');
    const loadingOverlay = document.getElementById('loading-overlay');
    const calendarContainer = document.getElementById('calendar-container');
    const columns = { todo: document.getElementById('todo-tasks'), inprogress: document.getElementById('inprogress-tasks'), done: document.getElementById('done-tasks') };
    const taskModal = document.getElementById('task-modal');
    const taskForm = document.getElementById('task-form');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const contextMenu = document.getElementById('context-menu');
    const doneCounter = document.getElementById('done-counter');
    const searchInput = document.getElementById('search-input');
    const folderFilter = document.getElementById('folder-filter');
    const signOutBtn = document.getElementById('sign-out-btn');
    const userInfo = document.getElementById('user-info');

    let app, auth, db, userId, appId, tasks = [], folders = [];
    let currentCalendarDate = new Date();

    try {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        appId = firebaseConfig.appId;
    } catch (error) {
        console.error("Firebase initialization failed:", error);
        loadingOverlay.innerText = "Error connecting to the app. Please check the console for details.";
        return;
    }

    const waitForAutoAnimate = () => {
        const interval = setInterval(() => {
            if (window.autoAnimate) {
                clearInterval(interval);
                window.autoAnimate(columns.todo);
                window.autoAnimate(columns.inprogress);
                window.autoAnimate(columns.done);
                window.autoAnimate(calendarContainer);
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
        onSnapshot(collection(db, `users/${userId}/tasks`), s => { tasks = s.docs.map(d => ({...d.data(), id: d.id})); renderAll(); }, e => console.error(e));
        onSnapshot(collection(db, `users/${userId}/folders`), s => { folders = s.docs.map(d => ({...d.data(), id: d.id})); renderAll(); }, e => console.error(e));
        searchInput.addEventListener('input', renderTasks);
        folderFilter.addEventListener('change', renderTasks);
    };

    const renderAll = () => { 
        renderTasks(); 
        renderCalendar(currentCalendarDate); 
        populateFolderDropdown();
        populateFolderFilter();
    };

    const renderTasks = async () => {
        Object.values(columns).forEach(col => col.innerHTML = '');
        let completedTasks = 0;
        const searchTerm = searchInput.value.toLowerCase();
        const selectedFolderId = folderFilter.value;

        const folderIdsToFilter = selectedFolderId ? getFolderAndSubfolderIds(selectedFolderId) : null;
        
        const activeTasks = tasks.filter(task => task.status !== 'archived');

        const taskElements = await Promise.all(activeTasks
            .filter(task => !searchTerm || task.title.toLowerCase().includes(searchTerm))
            .filter(task => !folderIdsToFilter || folderIdsToFilter.includes(task.folderId))
            .map(async task => {
                if (task.status === 'done') completedTasks++;
                if (!columns[task.status]) return null;
                
                const card = document.createElement('div');
                card.className = 'task-card bg-gray-700 p-4 rounded-lg shadow-lg';
                card.draggable = true;
                card.dataset.taskId = task.id;

                const folderPath = getFolderPath(task.folderId);
                card.innerHTML = `${folderPath ? `<div class='text-xs font-bold text-indigo-400 mb-2'>${folderPath}</div>` : ''}<h3 class='font-bold text-lg'>${task.title}</h3>`;

                if(task.status === 'done') {
                    const archiveBtn = document.createElement('button');
                    archiveBtn.className = 'archive-btn bg-gray-600 hover:bg-gray-700 text-white text-xs font-bold py-1 px-2 rounded absolute bottom-2 right-2';
                    archiveBtn.textContent = 'Archive';
                    archiveBtn.onclick = async (e) => {
                        e.stopPropagation();
                        await updateDoc(doc(db, `users/${userId}/tasks`, task.id), { status: 'archived' });
                    };
                    card.appendChild(archiveBtn);
                }
                
                card.ondragstart = e => {
                    e.dataTransfer.setData('text/plain', task.id);
                };
                card.onclick = () => openModal({task});
                return { card, status: task.status };
            }));

        taskElements.forEach(item => {
            if (item) columns[item.status].appendChild(item.card);
        });

        doneCounter.innerText = completedTasks;
    };

    const getFolderAndSubfolderIds = (folderId) => {
        let result = [folderId];
        const getChildren = (id) => {
            const children = folders.filter(f => f.parentId === id);
            children.forEach(c => {
                result.push(c.id);
                getChildren(c.id);
            });
        }
        getChildren(folderId);
        return result;
    };
    
    const renderCalendar = (date) => {
        calendarContainer.innerHTML = '';
        const month = date.getMonth(), year = date.getFullYear();
        
        const header = document.createElement('div');
        header.className = 'flex justify-between items-center mb-4';
        header.innerHTML = `
            <button id="prev-month" class="px-2 py-1 bg-gray-700 rounded hover:bg-gray-600">&lt;</button>
            <h3 class="text-xl font-bold">${date.toLocaleString('default',{month:'long'})} ${year}</h3>
            <button id="next-month" class="px-2 py-1 bg-gray-700 rounded hover:bg-gray-600">&gt;</button>
        `;
        calendarContainer.appendChild(header);

        document.getElementById('prev-month').onclick = () => { currentCalendarDate.setMonth(month - 1); renderCalendar(currentCalendarDate); };
        document.getElementById('next-month').onclick = () => { currentCalendarDate.setMonth(month + 1); renderCalendar(currentCalendarDate); };

        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const daysGrid = document.createElement('div');
        daysGrid.className = 'grid grid-cols-7 gap-2';
        
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        dayNames.forEach(name => daysGrid.innerHTML += `<div class="text-center font-bold text-gray-400">${name}</div>`);

        for (let i=0; i<firstDay; i++) daysGrid.appendChild(document.createElement('div'));
        
        for (let d=1; d<=daysInMonth; d++) {
            const dayEl = document.createElement('div');
            const dateString = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
            dayEl.className = 'calendar-day p-2 bg-gray-700 rounded-lg min-h-[80px]';
            dayEl.dataset.date = dateString;
            dayEl.innerHTML = `<span class="font-bold text-gray-300">${d}</span>`;
            tasks.filter(t => t.status !== 'archived' && t.date === dateString).forEach(t => {
                const tEl = document.createElement('div');
                tEl.className = 'text-xs mt-1 p-1 rounded-md text-white truncate';
                tEl.style.backgroundColor = ({todo:'#ef4444',inprogress:'#f59e0b',done:'#10b981'})[t.status]||'#6b7280';
                tEl.textContent = t.title;
                dayEl.appendChild(tEl);
            });
            daysGrid.appendChild(dayEl);
        }
        calendarContainer.appendChild(daysGrid);
    };

    const getFolderPath = (folderId) => {
        if (!folderId) return '';
        let path = [];
        let currentFolderId = folderId;
        while(currentFolderId) {
            const folder = folders.find(f => f.id === currentFolderId);
            if (!folder) break;
            path.unshift(folder.name);
            currentFolderId = folder.parentId;
        }
        return path.join(' / ');
    };
    
    document.querySelectorAll('.kanban-column-container').forEach(c => {
        c.ondragover = e => { e.preventDefault(); c.classList.add('over'); e.dataTransfer.dropEffect = 'move'; };
        c.ondragleave = () => c.classList.remove('over');
        c.ondrop = async e => {
            e.preventDefault();
            c.classList.remove('over');
            const taskId = e.dataTransfer.getData('text/plain');
            const newStatus = c.dataset.status;
            const task = tasks.find(t=>t.id===taskId);
            if (task && task.status !== newStatus) {
                const updateData = { status: newStatus };
                if (newStatus === 'done' && task.status !== 'done') updateData.completedAt = serverTimestamp();
                await updateDoc(doc(db, `users/${userId}/tasks`, taskId), updateData);
            }
        };
    });

    document.oncontextmenu = e => {
        e.preventDefault();
        const target = e.target.closest('.kanban-column-container, .calendar-day');
        if (target) {
            contextMenu.style.top = `${e.clientY}px`;
            contextMenu.style.left = `${e.clientX}px`;
            contextMenu.style.display = 'block';
            if (target.matches('.kanban-column-container')) {
                contextMenu.innerHTML = `<div data-action="add-task" data-status="${target.dataset.status}">Add Task</div>`;
            } else if (target.matches('.calendar-day')) {
                contextMenu.innerHTML = `<div data-action="add-task-to-date" data-date="${target.dataset.date}">Add Task</div>`;
            }
        } else {
            contextMenu.style.display = 'none';
        }
    };

    document.onclick = e => {
        if (!contextMenu.contains(e.target)) contextMenu.style.display = 'none';
    };

    contextMenu.onclick = e => {
        const { action, status, date } = e.target.dataset;
        if (action === 'add-task') {
            openModal({defaultStatus: status});
        } else if (action === 'add-task-to-date') {
            openModal({defaultDate: date});
        }
        contextMenu.style.display = 'none';
    };
    
    calendarContainer.ondragover = e => {
        e.preventDefault();
        document.querySelectorAll('.calendar-day.over').forEach(d => d.classList.remove('over'));
        const dayEl = e.target.closest('.calendar-day');
        if (dayEl) dayEl.classList.add('over');
    };

    calendarContainer.ondrop = async e => {
        e.preventDefault();
        document.querySelectorAll('.calendar-day.over').forEach(d => d.classList.remove('over'));
        const dayEl = e.target.closest('.calendar-day');
        const taskId = e.dataTransfer.getData('text/plain');
        if (dayEl && taskId) {
            await updateDoc(doc(db, `users/${userId}/tasks`, taskId), { date: dayEl.dataset.date });
        }
    };
    
    const openModal = ({task = null, defaultStatus = 'todo', defaultDate = ''}) => {
        taskForm.reset();
        populateFolderDropdown();
        if(task) {
            document.getElementById('modal-title').innerText = 'Edit Task';
            taskForm['task-id'].value = task.id;
            taskForm['task-title'].value = task.title;
            taskForm['task-desc'].value = task.description || '';
            taskForm['task-status'].value = task.status;
            taskForm['task-date'].value = task.date || '';
            taskForm['task-folder'].value = task.folderId || '';
        } else {
            document.getElementById('modal-title').innerText = 'New Task';
            taskForm['task-id'].value = '';
            taskForm['task-status'].value = defaultStatus;
            taskForm['task-date'].value = defaultDate;
        }
        taskModal.classList.remove('hidden');
    };

    const populateFolderDropdown = () => {
        const select = document.getElementById('task-folder');
        if (!select) return;
        const currentVal = select.value;
        select.innerHTML = '<option value="">No Folder</option>';
        const renderOptions = (parentId, level) => {
            folders.filter(f => (f.parentId || null) === parentId).sort((a,b) => a.order - b.order).forEach(folder => {
                select.innerHTML += `<option value="${folder.id}">${ '  '.repeat(level) }&#x2514; ${folder.name}</option>`;
                renderOptions(folder.id, level + 1);
            });
        }
        renderOptions(null, 0);
        select.value = currentVal;
    };

    const populateFolderFilter = () => {
        const select = document.getElementById('folder-filter');
        if (!select) return;
        const currentVal = select.value;
        select.innerHTML = '<option value="">All Folders</option>';
         const renderOptions = (parentId, level) => {
            folders.filter(f => (f.parentId || null) === parentId).sort((a,b) => a.order - b.order).forEach(folder => {
                select.innerHTML += `<option value="${folder.id}">${ '  '.repeat(level) }&#x2514; ${folder.name}</option>`;
                renderOptions(folder.id, level + 1);
            });
        }
        renderOptions(null, 0);
        select.value = currentVal;
    };

    const closeTaskModal = () => taskModal.classList.add('hidden');
    closeModalBtn.addEventListener('click', closeTaskModal);
    taskModal.addEventListener('click', (e) => { if(e.target === taskModal) closeTaskModal() });

    taskForm.onsubmit = async (e) => {
        e.preventDefault();
        const taskId = taskForm['task-id'].value;
        const title = taskForm['task-title'].value.trim();
        if (!title) return;
        
        const data = { 
            title: title,
            description: taskForm['task-desc'].value.trim(),
            status: taskForm['task-status'].value, 
            date: taskForm['task-date'].value || null,
            folderId: taskForm['task-folder'].value || null
        };

        if (taskId) {
            const existingTask = tasks.find(t => t.id === taskId);
            if (existingTask && existingTask.status !== 'done' && data.status === 'done') data.completedAt = serverTimestamp();
            await updateDoc(doc(db, `users/${userId}/tasks`, taskId), data);
        } else {
            if (data.status === 'done') data.completedAt = serverTimestamp();
            data.createdAt = serverTimestamp();
            await addDoc(collection(db, `users/${userId}/tasks`), data);
        }
        closeTaskModal();
    };
}

main();
