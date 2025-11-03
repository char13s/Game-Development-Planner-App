
import { firebaseConfig } from '../firebase-config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc, writeBatch, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

async function main() {
    const loadingOverlay = document.getElementById('loading-overlay');
    const mainContent = document.getElementById('main-content');
    const folderContainer = document.getElementById('folder-container');
    const contextMenu = document.getElementById('context-menu');
    const signOutBtn = document.getElementById('sign-out-btn');
    const userInfo = document.getElementById('user-info');
    
    const taskModal = document.getElementById('task-modal');
    const taskForm = document.getElementById('task-form');
    const closeModalBtn = document.getElementById('close-modal-btn');

    const inputModal = document.getElementById('input-modal');
    const inputForm = document.getElementById('input-form');
    const closeInputModalBtn = document.getElementById('close-input-modal-btn');
    const inputModalTitle = document.getElementById('input-modal-title');
    const inputModalLabel = document.getElementById('input-modal-label');
    const inputModalField = document.getElementById('input-modal-field');

    let app, auth, db, userId, folders = [], tasks = [];
    let draggedItemId = null, draggedItemType = null;
    let onInputConfirm = null;

    if (!firebaseConfig) {
        document.body.innerHTML = `<div class="text-red-500 p-8">Error: Firebase config not found.</div>`;
        return;
    }

    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);

    signOutBtn.addEventListener('click', () => {
        signOut(auth).catch(error => console.error("Sign out error", error));
    });

    onAuthStateChanged(auth, user => {
        if (user && !user.isAnonymous) {
            userId = user.uid;
            userInfo.textContent = `Signed in as ${user.email}`;
            mainContent.classList.remove('hidden');
            loadingOverlay.classList.add('hidden');

            onSnapshot(collection(db, `users/${userId}/folders`), s => { folders = s.docs.map(d => ({...d.data(), id: d.id})); render(); }, e => console.error(e));
            onSnapshot(collection(db, `users/${userId}/tasks`), s => { tasks = s.docs.map(d => ({...d.data(), id: d.id})); render(); }, e => console.error(e));
            
            autoAnimate(folderContainer);
            setupCoreEventListeners();
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

    const setupCoreEventListeners = () => {
        folderContainer.addEventListener('click', async e => {
            const collapseBtn = e.target.closest('.collapse-btn');
            if (collapseBtn) {
                const folderId = collapseBtn.dataset.folderId;
                const folder = folders.find(f => f.id === folderId);
                if (folder) {
                    await updateDoc(doc(db, `users/${userId}/folders`, folderId), { isCollapsed: !folder.isCollapsed });
                }
            }
        });

        folderContainer.addEventListener('dragstart', e => {
            const taskItem = e.target.closest('.task-item');
            if (taskItem) {
                draggedItemId = taskItem.dataset.taskId;
                draggedItemType = 'task';
                e.dataTransfer.setData('text/plain', draggedItemId);
                return;
            }
            const folderWrapper = e.target.closest('.folder-wrapper');
            if (folderWrapper) {
                draggedItemId = folderWrapper.dataset.folderId;
                draggedItemType = 'folder';
                e.dataTransfer.setData('text/plain', draggedItemId);
                setTimeout(() => folderWrapper.classList.add('dragging'), 0);
            }
        });

        folderContainer.addEventListener('dragover', e => {
            e.preventDefault();
            const targetWrapper = e.target.closest('.folder-wrapper');
            if (!targetWrapper) return;
            document.querySelectorAll('.over-top, .over-bottom, .over-middle').forEach(el => el.classList.remove('over-top', 'over-bottom', 'over-middle'));
            
            if (draggedItemType === 'task') {
                targetWrapper.querySelector('.folder-box').classList.add('over-middle');
            } else if (draggedItemType === 'folder' && targetWrapper.dataset.folderId !== draggedItemId) {
                const rect = targetWrapper.getBoundingClientRect();
                const y = e.clientY - rect.top;
                const zone = y < rect.height * 0.25 ? 'top' : y > rect.height * 0.75 ? 'bottom' : 'middle';
                targetWrapper.querySelector('.folder-box').classList.add(`over-${zone}`);
            }
        });

        folderContainer.addEventListener('dragleave', e => {
            e.target.closest('.folder-box')?.classList.remove('over-top', 'over-bottom', 'over-middle');
        });

        folderContainer.addEventListener('dragend', e => {
            draggedItemId = null;
            draggedItemType = null;
            document.querySelectorAll('.dragging, .over-top, .over-bottom, .over-middle').forEach(el => el.classList.remove('dragging', 'over-top', 'over-bottom', 'over-middle'));
        });

        folderContainer.addEventListener('drop', async e => {
            e.preventDefault();
            e.stopPropagation();
            document.querySelectorAll('.over-top, .over-bottom, .over-middle').forEach(el => el.classList.remove('over-top', 'over-bottom', 'over-middle'));
            const targetWrapper = e.target.closest('.folder-wrapper');
            if (!draggedItemId || !targetWrapper) return;

            const targetFolderId = targetWrapper.dataset.folderId;

            if (draggedItemType === 'task') {
                const task = tasks.find(t => t.id === draggedItemId);
                if (task && task.folderId !== targetFolderId) {
                    await updateDoc(doc(db, `users/${userId}/tasks`, draggedItemId), { folderId: targetFolderId });
                }
            } else if (draggedItemType === 'folder' && targetFolderId !== draggedItemId) {
                const targetFolder = folders.find(f => f.id === targetFolderId);
                const rect = targetWrapper.getBoundingClientRect(), y = e.clientY - rect.top;
                const zone = y < rect.height * 0.25 ? 'top' : y > rect.height * 0.75 ? 'bottom' : 'middle';
                
                const batch = writeBatch(db);
                let newOrder, newParentId;

                if (zone === 'middle') {
                    newParentId = targetFolderId;
                    const children = folders.filter(f => f.parentId === newParentId);
                    newOrder = (children.length > 0 ? Math.max(...children.map(c => c.order)) : 0) + 1000;
                } else {
                    newParentId = targetFolder.parentId;
                    const siblings = folders.filter(f => (f.parentId || null) === (newParentId || null)).sort((a,b) => a.order-b.order);
                    const targetIndex = siblings.findIndex(f => f.id === targetFolderId);
                    if (zone === 'top') {
                        const prevOrder = siblings[targetIndex - 1]?.order || 0;
                        newOrder = (prevOrder + targetFolder.order) / 2;
                    } else {
                        const nextOrder = siblings[targetIndex + 1]?.order;
                        newOrder = nextOrder ? (targetFolder.order + nextOrder) / 2 : targetFolder.order + 1000;
                    }
                }
                batch.update(doc(db, `users/${userId}/folders`, draggedItemId), { parentId: newParentId || null, order: newOrder });
                await batch.commit();
            }
        });

        document.addEventListener('contextmenu', e => {
            e.preventDefault();
            const target = e.target.closest('.folder-wrapper, .task-item');
            contextMenu.style.top = `${e.clientY}px`;
            contextMenu.style.left = `${e.clientX}px`;
            contextMenu.style.display = 'block';

            if (target?.matches('.task-item')) {
                contextMenu.innerHTML = `<div data-action="edit-task" data-id="${target.dataset.taskId}">Edit Task</div>`;
            } else if (target?.matches('.folder-wrapper')) {
                const folderId = target.dataset.folderId;
                contextMenu.innerHTML = `<div data-action="add-task" data-id="${folderId}">Add Task</div><div data-action="add-subfolder" data-id="${folderId}">Add Subfolder</div><div data-action="rename-folder" data-id="${folderId}">Rename Folder</div><div data-action="delete-folder" data-id="${folderId}">Delete Folder</div>`;
            } else {
                contextMenu.innerHTML = '<div data-action="add-folder">Create Folder</div>';
            }
        });

        document.addEventListener('click', e => {
            if (!contextMenu.contains(e.target)) contextMenu.style.display = 'none';
            const taskItem = e.target.closest('.task-item');
            if(taskItem && !e.target.closest('.collapse-btn')) openModal(null, taskItem.dataset.taskId);
        });

        contextMenu.addEventListener('click', async e => {
            contextMenu.style.display = 'none';
            const { action, id } = e.target.dataset;
            if (!action) return;

            const handleFolderCreation = (name, parentId) => {
                const siblings = folders.filter(f => (f.parentId || null) === (parentId || null));
                const order = (siblings.length > 0 ? Math.max(...siblings.map(s => s.order)) : 0) + 1000;
                addDoc(collection(db, `users/${userId}/folders`), { name, parentId: parentId || null, order, createdAt: serverTimestamp(), isCollapsed: false });
            };
            
            if (action === 'add-folder') {
                openInputModal('Create New Folder', 'Folder Name', '', (name) => handleFolderCreation(name, null));
            } else if (action === 'add-subfolder') {
                openInputModal('Create Subfolder', 'Subfolder Name', '', (name) => handleFolderCreation(name, id));
            } else if (action === 'add-task') {
                openModal(id);
            } else if (action === 'edit-task') {
                openModal(null, id);
            } else if (action === 'rename-folder') {
                const folder = folders.find(f => f.id === id);
                if (folder) {
                    openInputModal('Rename Folder', 'New Name', folder.name, (newName) => {
                        if (newName && newName !== folder.name) updateDoc(doc(db, `users/${userId}/folders`, id), { name: newName });
                    });
                }
            } else if (action === 'delete-folder') {
                const canDelete = !tasks.some(t => t.folderId === id) && !folders.some(f => f.parentId === id);
                if (canDelete && confirm("Are you sure you want to delete this empty folder?")) {
                    await deleteDoc(doc(db, `users/${userId}/folders`, id));
                } else if (!canDelete) {
                    alert("Cannot delete a folder that is not empty.");
                }
            }
        });
    };

    const openModal = (folderId = null, taskId = null) => {
        taskForm.reset();
        populateFolderDropdown();
        if (taskId) {
            const task = tasks.find(t => t.id === taskId);
            if (!task) return;
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
            taskForm['task-folder'].value = folderId || '';
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

    const render = () => {
        const scrollState = { top: folderContainer.scrollTop, left: folderContainer.scrollLeft };
        folderContainer.innerHTML = '';
        renderChildren(folderContainer, null, 0);
        populateFolderDropdown();
        folderContainer.scrollTop = scrollState.top;
        folderContainer.scrollLeft = scrollState.left;
    };

    const renderChildren = (container, parentId, level) => {
        const children = folders.filter(f => (f.parentId || null) === parentId).sort((a, b) => a.order - b.order);
        children.forEach(folder => {
            const isCollapsed = folder.isCollapsed || false;
            const folderWrapper = document.createElement('div');
            folderWrapper.className = 'folder-wrapper';
            folderWrapper.style.paddingLeft = `${level * 1.5}rem`;
            folderWrapper.dataset.folderId = folder.id;
            folderWrapper.draggable = true;

            const tasksInFolder = tasks.filter(t => t.folderId === folder.id && t.status !== 'archived');
            const tasksHtml = tasksInFolder.map(task => {
                const color = ({ todo: 'bg-red-500', inprogress: 'bg-yellow-500', done: 'bg-green-500' })[task.status] || 'bg-gray-500';
                return `<div class="task-item flex items-center justify-between bg-gray-700 p-2 rounded-md mt-2" draggable="true" data-task-id="${task.id}"><span>${task.title}</span><span class="${color} w-3 h-3 rounded-full"></span></div>`;
            }).join('') || '<p class="text-gray-500 text-xs italic px-2">No tasks here.</p>';

            const folderBox = document.createElement('div');
            folderBox.className = 'folder-box bg-gray-800 p-3 rounded-lg shadow-lg relative mt-1';
            
            folderBox.innerHTML = `
                <div class="flex items-center justify-between">
                    <div class="flex items-center font-bold">
                       <span class="collapse-btn mr-2 text-indigo-400" data-folder-id="${folder.id}">${isCollapsed ? '&#x25B6;' : '&#x25BC;'}</span>
                       <span>${folder.name}</span>
                    </div>
                </div>
                <div class="folder-content mt-2 space-y-2 pl-4 ${isCollapsed ? 'hidden' : ''}">
                   ${tasksHtml}
                   <div class="subfolder-container"></div>
                </div>
            `;

            if (!isCollapsed) {
                renderChildren(folderBox.querySelector('.subfolder-container'), folder.id, level + 1);
            }
            
            folderWrapper.appendChild(folderBox);
            container.appendChild(folderWrapper);
        });
    };

    const closeTaskModal = () => taskModal.classList.add('hidden');
    closeModalBtn.addEventListener('click', closeTaskModal);
    taskModal.addEventListener('click', (e) => { if (e.target === taskModal) closeTaskModal(); });

    taskForm.addEventListener('submit', async (e) => {
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
    });

    const closeInputModal = () => {
        inputModal.classList.add('hidden');
        onInputConfirm = null;
        inputForm.reset();
    }
    closeInputModalBtn.addEventListener('click', closeInputModal);
    inputModal.addEventListener('click', (e) => { if (e.target === inputModal) closeInputModal(); });
    inputForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const value = inputModalField.value.trim();
        if (value && onInputConfirm) onInputConfirm(value);
        closeInputModal();
    });
}

main();
